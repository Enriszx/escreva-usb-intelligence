--!nonstrict
-- Owns the player lifecycle: load the profile, cache multipliers, move money,
-- award XP, and push state to the client.
--
-- Every other service asks PlayerService for the multiplier struct rather than
-- recomputing it, so a 12-player server evaluates the multiplier chain a few
-- times a second total instead of thousands of times.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Economy = require(Shared.Economy)
local Net = require(Shared.Util.Net)
local Signal = require(Shared.Util.Signal)
local Format = require(Shared.Util.Format)
local Store = require(script.Parent.Parent.Data.Store)

local Balance = Config.Balance
local Ranks = Config.Ranks

local PlayerService = { name = "PlayerService", priority = 1 }

PlayerService.onProfileReady = Signal.new()
PlayerService.onCurrencyChanged = Signal.new()
PlayerService.onLeaving = Signal.new()

local app
local multCache = {} :: { [number]: { value: any, at: number } }
local MULT_TTL = 1.5

function PlayerService:init(a)
	app = a
end

-- Profiles ---------------------------------------------------------------

function PlayerService:profile(player: Player)
	return Store.get(player.UserId)
end

function PlayerService:profileOf(userId: number)
	return Store.get(userId)
end

--- Invalidate the multiplier cache. Called by anything that changes pets,
--- upgrades, passes or boosts.
function PlayerService:dirty(player: Player)
	multCache[player.UserId] = nil
end

--- The multiplier struct for a player, cached for MULT_TTL seconds.
function PlayerService:multipliers(player: Player)
	local uid = player.UserId
	local cached = multCache[uid]
	local now = os.clock()
	if cached and now - cached.at < MULT_TTL then
		return cached.value
	end

	local profile = Store.get(uid)
	if not profile then
		return Economy.multipliers({ rebirths = 0, upgrades = {}, passes = {}, pets = {}, boosts = {} })
	end

	local value = Economy.multipliers({
		rebirths = profile.rebirths,
		upgrades = profile.upgrades,
		passes = app.MonetizationService:passesOf(player),
		pets = profile.pets,
		boosts = profile.boosts,
		event = app.EventService and app.EventService:mods() or nil,
		serverBoost = app.MonetizationService:serverBoost(),
		now = os.time(),
	})
	multCache[uid] = { value = value, at = now }
	return value
end

--- Context struct for Economy calls that need the raw inputs.
function PlayerService:context(player: Player)
	local profile = Store.get(player.UserId)
	if not profile then
		return nil
	end
	return {
		rebirths = profile.rebirths,
		upgrades = profile.upgrades,
		passes = app.MonetizationService:passesOf(player),
		pets = profile.pets,
		boosts = profile.boosts,
		event = app.EventService and app.EventService:mods() or nil,
		serverBoost = app.MonetizationService:serverBoost(),
		now = os.time(),
	}
end

-- Currency ---------------------------------------------------------------

function PlayerService:addCoins(player: Player, amount: number, reason: string?)
	local profile = Store.get(player.UserId)
	if not profile or amount == 0 then
		return false
	end
	-- hard ceiling keeps the value inside f64 integer-exact range forever
	profile.coins = math.clamp(profile.coins + amount, 0, 9e15)
	if amount > 0 then
		profile.stats.totalEarned += amount
	end
	self:pushCurrency(player)
	self.onCurrencyChanged:Fire(player, "coins", amount, reason)
	if app.Analytics then
		app.Analytics:economy(player, "coins", amount, reason or "unknown", profile.coins)
	end
	return true
end

function PlayerService:spendCoins(player: Player, amount: number, reason: string?): boolean
	local profile = Store.get(player.UserId)
	if not profile or amount < 0 then
		return false
	end
	if profile.coins < amount then
		return false
	end
	profile.coins -= amount
	self:pushCurrency(player)
	self.onCurrencyChanged:Fire(player, "coins", -amount, reason)
	if app.Analytics then
		app.Analytics:economy(player, "coins", -amount, reason or "unknown", profile.coins)
	end
	return true
end

function PlayerService:addGems(player: Player, amount: number, reason: string?)
	local profile = Store.get(player.UserId)
	if not profile or amount == 0 then
		return false
	end
	profile.gems = math.clamp(profile.gems + amount, 0, 9e12)
	self:pushCurrency(player)
	self.onCurrencyChanged:Fire(player, "gems", amount, reason)
	return true
end

function PlayerService:spendGems(player: Player, amount: number, reason: string?): boolean
	local profile = Store.get(player.UserId)
	if not profile or profile.gems < amount then
		return false
	end
	profile.gems -= amount
	self:pushCurrency(player)
	self.onCurrencyChanged:Fire(player, "gems", -amount, reason)
	return true
end

function PlayerService:pushCurrency(player: Player)
	local profile = Store.get(player.UserId)
	if not profile then
		return
	end
	local level, into, need = Economy.levelFromXp(profile.xp)
	Net:fire(player, "Currency", {
		coins = profile.coins,
		gems = profile.gems,
		rebirths = profile.rebirths,
		level = level,
		xpInto = into,
		xpNeed = need,
	})
	self:updateLeaderstats(player, profile)
end

-- XP / level -------------------------------------------------------------

function PlayerService:addXp(player: Player, amount: number)
	local profile = Store.get(player.UserId)
	if not profile or amount <= 0 then
		return
	end
	local before = Economy.levelFromXp(profile.xp)
	profile.xp += amount
	local after = Economy.levelFromXp(profile.xp)
	profile.level = after
	if after > before then
		-- level rewards: gems scale with level so late levels still matter
		local reward = 25 * after
		self:addGems(player, reward, "levelup")
		Net:fire(player, "Toast", {
			kind = "levelup",
			title = "NÍVEL " .. after .. "!",
			body = ("+%s gemas"):format(Format.short(reward)),
		})
	end
	self:pushCurrency(player)
end

-- Boosts -----------------------------------------------------------------

function PlayerService:addBoost(player: Player, stat: string, value: number, seconds: number, source: string?)
	local profile = Store.get(player.UserId)
	if not profile then
		return
	end
	-- stacking rule: same stat+value extends the duration, a stronger value
	-- replaces it. This is the behaviour players expect and complain about least.
	for _, b in profile.boosts do
		if b.stat == stat and b.value == value then
			b.expires = math.max(b.expires, os.time()) + seconds
			self:dirty(player)
			self:pushBoosts(player)
			return
		end
	end
	table.insert(profile.boosts, {
		stat = stat,
		value = value,
		expires = os.time() + seconds,
		source = source,
	})
	self:dirty(player)
	self:pushBoosts(player)
end

function PlayerService:pushBoosts(player: Player)
	local profile = Store.get(player.UserId)
	if not profile then
		return
	end
	local now = os.time()
	local active = {}
	for _, b in profile.boosts do
		if b.expires > now then
			table.insert(active, b)
		end
	end
	local m = self:multipliers(player)
	Net:fire(player, "Boosts", { boosts = active, mult = m })
end

local function pruneBoosts(profile)
	local now = os.time()
	for i = #profile.boosts, 1, -1 do
		if profile.boosts[i].expires <= now then
			table.remove(profile.boosts, i)
		end
	end
end

-- Leaderstats ------------------------------------------------------------

function PlayerService:updateLeaderstats(player: Player, profile)
	local stats = player:FindFirstChild("leaderstats")
	if not stats then
		stats = Instance.new("Folder")
		stats.Name = "leaderstats"
		stats.Parent = player
	end
	local function set(name: string, value: string)
		local v = stats:FindFirstChild(name) :: StringValue
		if not v then
			v = Instance.new("StringValue")
			v.Name = name
			v.Parent = stats
		end
		v.Value = value
	end
	set("💰 Moedas", Format.short(profile.coins))
	set("♻️ Renascimentos", tostring(profile.rebirths))
	set("🥷 Roubos", Format.short(profile.stats.stolen))
end

-- Full state sync --------------------------------------------------------

--- The single payload the client needs to render everything it owns.
function PlayerService:syncPayload(player: Player)
	local profile = Store.get(player.UserId)
	if not profile then
		return nil
	end
	pruneBoosts(profile)
	local level, into, need = Economy.levelFromXp(profile.xp)
	local m = self:multipliers(player)
	return {
		coins = profile.coins,
		gems = profile.gems,
		rebirths = profile.rebirths,
		level = level,
		xpInto = into,
		xpNeed = need,
		rank = Ranks:for_(profile.rebirths),
		tileCount = math.min(profile.tileCount, m.tiles),
		tiles = profile.tiles,
		seeds = profile.seeds,
		inventory = profile.inventory,
		pets = profile.pets,
		eggs = profile.eggs,
		upgrades = profile.upgrades,
		boosts = profile.boosts,
		quests = profile.quests,
		daily = profile.daily,
		index = profile.index,
		indexClaimed = profile.indexClaimed,
		stats = profile.stats,
		settings = profile.settings,
		tutorialStep = profile.tutorialStep,
		productsBought = profile.productsBought,
		mult = m,
		passes = app.MonetizationService:passesOf(player),
		maxTiles = Balance.maxTiles,
		rebirthCost = app.RebirthService:cost(player),
		plotId = app.PlotService:plotIdOf(player),
		serverTime = os.time(),
	}
end

function PlayerService:sync(player: Player)
	local payload = self:syncPayload(player)
	if payload then
		Net:fire(player, "Sync", payload)
	end
end

-- Lifecycle --------------------------------------------------------------

local function onPlayerAdded(player: Player)
	local profile = Store.load(player)
	if not profile then
		player:Kick(
			"Não foi possível carregar sua fazenda agora.\n"
				.. "Isso acontece quando outro servidor ainda está salvando seus dados.\n\n"
				.. "Espere ~30 segundos e entre novamente — nada foi perdido."
		)
		return
	end

	profile.lastSeen = os.time()
	PlayerService:updateLeaderstats(player, profile)
	PlayerService.onProfileReady:Fire(player, profile)
end

function PlayerService:start()
	Players.PlayerAdded:Connect(function(player)
		task.spawn(onPlayerAdded, player)
	end)
	-- Players already present at boot are handled with task.defer, not
	-- task.spawn: spawn would run onPlayerAdded synchronously, firing
	-- onProfileReady before PlotService/GrowthService have connected to it,
	-- and the first player of a Studio session would get no farm.
	for _, player in Players:GetPlayers() do
		task.defer(onPlayerAdded, player)
	end

	Players.PlayerRemoving:Connect(function(player)
		self.onLeaving:Fire(player)
		multCache[player.UserId] = nil
	end)

	-- playtime + boost expiry sweep
	task.spawn(function()
		while true do
			task.wait(10)
			for _, player in Players:GetPlayers() do
				local profile = Store.get(player.UserId)
				if profile then
					profile.playtime += 10
					local before = #profile.boosts
					pruneBoosts(profile)
					if #profile.boosts ~= before then
						self:dirty(player)
						self:pushBoosts(player)
					end
				end
			end
		end
	end)

	-- passive gem income from VIP/Supremo
	task.spawn(function()
		while true do
			task.wait(60)
			for _, player in Players:GetPlayers() do
				local passes = app.MonetizationService:passesOf(player)
				local perHour = 0
				for key, owned in passes do
					if owned then
						local p = Config.Passes.byKey[key]
						if p and p.effect.gemPerHour then
							perHour = math.max(perHour, p.effect.gemPerHour * 25)
						end
					end
				end
				if perHour > 0 then
					self:addGems(player, math.max(1, math.floor(perHour / 60)), "pass_passive")
				end
			end
		end
	end)

	Net:handle("GetProfile", function(player)
		return self:syncPayload(player)
	end)

	Net:on("RequestSync", function(player)
		self:sync(player)
	end)

	Net:on("SetSetting", function(player, key, value)
		local profile = Store.get(player.UserId)
		if not profile or type(key) ~= "string" then
			return
		end
		local allowed = {
			music = "boolean",
			sfx = "boolean",
			alarms = "boolean",
			announcements = "boolean",
			quality = "string",
			joystickSide = "string",
		}
		local expect = allowed[key]
		if not expect then
			return
		end
		if expect == "string" and type(value) ~= "string" then
			return
		end
		if expect == "boolean" and type(value) ~= "boolean" then
			return
		end
		profile.settings[key] = value
	end)
end

return PlayerService
