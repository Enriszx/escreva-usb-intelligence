--!nonstrict
-- Daily/weekly quests, the daily-reward streak and the collection index.
-- Together these are the retention spine: a reason to log in tomorrow that
-- does not depend on the player already being rich.

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local TableUtil = require(Shared.Util.TableUtil)
local Store = require(script.Parent.Parent.Data.Store)

local Balance = Config.Balance
local Quests = Config.Quests
local Seeds = Config.Seeds
local Pets = Config.Pets
local Rarities = Config.Rarities

local QuestService = { name = "QuestService", priority = 8 }

local app
local rng = Random.new()

function QuestService:init(a)
	app = a
end

-- Day/week helpers -------------------------------------------------------

local function dayIndex(t: number?): number
	return math.floor(((t or os.time()) - Balance.dailyResetHour * 3600) / 86400)
end

local function weekIndex(t: number?): number
	return math.floor(dayIndex(t) / 7)
end

-- Rolling ----------------------------------------------------------------

function QuestService:roll(player: Player, force: boolean?)
	local profile = Store.get(player.UserId)
	if not profile then
		return
	end
	local today = dayIndex()
	local lastDay = dayIndex(profile.questRolledAt)
	if not force and profile.questRolledAt > 0 and lastDay == today then
		return
	end

	local keepWeekly = {}
	if weekIndex(profile.questRolledAt) == weekIndex() then
		for _, q in profile.quests do
			if q.weekly then
				table.insert(keepWeekly, q)
			end
		end
	end

	local pool = TableUtil.shuffle(Quests.daily, rng)
	local fresh = {}
	for i = 1, math.min(Quests.dailyCount, #pool) do
		local t = pool[i]
		table.insert(fresh, {
			key = t.key,
			goal = Quests.goalFor(t, profile.rebirths),
			progress = 0,
			claimed = false,
		})
	end
	if #keepWeekly == 0 then
		local w = Quests.weekly[rng:NextInteger(1, #Quests.weekly)]
		table.insert(keepWeekly, {
			key = w.key,
			goal = Quests.goalFor(w, profile.rebirths),
			progress = 0,
			claimed = false,
			weekly = true,
		})
	end
	for _, q in keepWeekly do
		table.insert(fresh, q)
	end

	profile.quests = fresh
	profile.questRolledAt = os.time()
	self:push(player)
end

local function templateFor(key: string)
	for _, t in Quests.daily do
		if t.key == key then
			return t
		end
	end
	for _, t in Quests.weekly do
		if t.key == key then
			return t
		end
	end
	return nil
end

-- Progress ---------------------------------------------------------------

--- Called from everywhere. Cheap: a handful of table lookups per gameplay action.
function QuestService:progress(player: Player, kind: string, amount: number)
	local profile = Store.get(player.UserId)
	if not profile or amount <= 0 then
		return
	end
	local changed = false
	for _, q in profile.quests do
		if not q.claimed and q.progress < q.goal then
			local t = templateFor(q.key)
			if t and t.kind == kind then
				q.progress = math.min(q.goal, q.progress + amount)
				changed = true
				if q.progress >= q.goal then
					Net:fire(player, "Toast", {
						kind = "quest",
						title = t.icon .. " Missão concluída!",
						body = t.name .. " — resgate sua recompensa",
						duration = 5,
					})
				end
			end
		end
	end
	if changed then
		self:push(player)
	end
end

function QuestService:claim(player: Player, key: string): (boolean, string?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false
	end
	for _, q in profile.quests do
		if q.key == key then
			if q.claimed then
				return false, "Já resgatada"
			end
			if q.progress < q.goal then
				return false, "Missão incompleta"
			end
			local t = templateFor(key)
			if not t then
				return false, "Missão inválida"
			end
			q.claimed = true
			local lines = {}
			if t.reward.gems then
				app.PlayerService:addGems(player, t.reward.gems, "quest:" .. key)
				table.insert(lines, ("+%s gemas"):format(Format.short(t.reward.gems)))
			end
			if t.reward.coins then
				app.PlayerService:addCoins(player, t.reward.coins, "quest:" .. key)
				table.insert(lines, ("+%s moedas"):format(Format.short(t.reward.coins)))
			end
			if t.reward.egg then
				app.PetService:giveEgg(player, t.reward.egg)
				table.insert(lines, "+1 " .. Config.Eggs.byId[t.reward.egg].name)
			end
			Net:fire(player, "Toast", {
				kind = "success",
				title = "Recompensa recebida!",
				body = table.concat(lines, "  •  "),
			})
			self:push(player)
			app.PlayerService:sync(player)
			return true
		end
	end
	return false, "Missão não encontrada"
end

function QuestService:push(player: Player)
	local profile = Store.get(player.UserId)
	if not profile then
		return
	end
	local payload = {}
	for _, q in profile.quests do
		local t = templateFor(q.key)
		if t then
			table.insert(payload, {
				key = q.key,
				name = t.name,
				desc = (t.desc:gsub("{goal}", Format.short(q.goal))),
				icon = t.icon,
				progress = q.progress,
				goal = q.goal,
				claimed = q.claimed,
				weekly = q.weekly,
				reward = t.reward,
			})
		end
	end
	Net:fire(player, "Quests", payload)
end

-- Daily reward -----------------------------------------------------------

function QuestService:dailyState(player: Player)
	local profile = Store.get(player.UserId)
	if not profile then
		return nil
	end
	local today = dayIndex()
	local lastDay = profile.daily.lastClaim > 0 and dayIndex(profile.daily.lastClaim) or -99
	return {
		streak = profile.daily.streak,
		canClaim = today > lastDay,
		rewards = Balance.dailyRewards,
		brokeStreak = today - lastDay > 1 and profile.daily.streak > 0,
	}
end

function QuestService:claimDaily(player: Player): (boolean, string?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false
	end
	local today = dayIndex()
	local lastDay = profile.daily.lastClaim > 0 and dayIndex(profile.daily.lastClaim) or -99
	if today <= lastDay then
		return false, "Você já resgatou hoje. Volte amanhã!"
	end

	-- a missed day resets the streak; consecutive days advance it
	if today - lastDay == 1 then
		profile.daily.streak += 1
	else
		profile.daily.streak = 1
	end
	profile.daily.lastClaim = os.time()

	local slot = ((profile.daily.streak - 1) % #Balance.dailyRewards) + 1
	local reward = Balance.dailyRewards[slot]
	local lines = {}
	if reward.gems then
		app.PlayerService:addGems(player, reward.gems, "daily")
		table.insert(lines, ("+%s gemas"):format(Format.short(reward.gems)))
	end
	if reward.minutes then
		local amount = app.MonetizationService:scaledCoins(player, reward.minutes)
		app.PlayerService:addCoins(player, amount, "daily")
		table.insert(lines, ("+%s moedas"):format(Format.short(amount)))
	end
	if reward.egg then
		app.PetService:giveEgg(player, reward.egg)
		table.insert(lines, "+1 " .. Config.Eggs.byId[reward.egg].name)
	end

	Net:fire(player, "Toast", {
		kind = "success",
		title = ("🎁 Dia %d de login!"):format(profile.daily.streak),
		body = table.concat(lines, "  •  "),
		duration = 6,
	})
	Net:fire(player, "DailyUpdate", self:dailyState(player))
	app.PlayerService:sync(player)
	return true
end

-- Collection index -------------------------------------------------------

--- Completion rewards: the index is what keeps a maxed player playing.
function QuestService:indexPayload(player: Player)
	local profile = Store.get(player.UserId)
	if not profile then
		return nil
	end
	local seedEntries, petEntries = {}, {}
	local seedsFound, petsFound = 0, 0
	for _, s in Seeds.all do
		local count = profile.index[s.id] or 0
		if count > 0 then
			seedsFound += 1
		end
		table.insert(seedEntries, {
			id = s.id,
			name = s.name,
			rarity = s.rarity,
			tier = s.tier,
			count = count,
			claimed = profile.indexClaimed["seed:" .. s.id] or false,
		})
	end
	for _, p in Pets.all do
		local count = profile.index[p.id] or 0
		if count > 0 then
			petsFound += 1
		end
		table.insert(petEntries, {
			id = p.id,
			name = p.name,
			rarity = p.rarity,
			egg = p.egg,
			count = count,
			claimed = profile.indexClaimed["pet:" .. p.id] or false,
		})
	end
	return {
		seeds = seedEntries,
		pets = petEntries,
		seedsFound = seedsFound,
		seedsTotal = #Seeds.all,
		petsFound = petsFound,
		petsTotal = #Pets.all,
	}
end

function QuestService:claimIndex(player: Player, kind: string, id: string): (boolean, string?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false
	end
	local key = kind .. ":" .. id
	if profile.indexClaimed[key] then
		return false, "Já resgatado"
	end
	if (profile.index[id] or 0) <= 0 then
		return false, "Você ainda não obteve este item"
	end
	local rarityId = nil
	if kind == "seed" then
		rarityId = Seeds.byId[id] and Seeds.byId[id].rarity
	else
		rarityId = Pets.byId[id] and Pets.byId[id].rarity
	end
	if not rarityId then
		return false, "Item inválido"
	end
	local order = Rarities.get(rarityId).order
	local gems = math.floor(15 * order ^ 1.9)
	profile.indexClaimed[key] = true
	app.PlayerService:addGems(player, gems, "index")
	Net:fire(player, "Toast", {
		kind = "success",
		title = "Índice completado!",
		body = ("+%s gemas"):format(Format.short(gems)),
	})
	app.PlayerService:sync(player)
	return true
end

-- Lifecycle --------------------------------------------------------------

function QuestService:start()
	app.PlayerService.onProfileReady:Connect(function(player)
		task.defer(function()
			self:roll(player)
			self:push(player)
			Net:fire(player, "DailyUpdate", self:dailyState(player))
		end)
	end)

	-- midnight roll for players who stay online across the reset
	task.spawn(function()
		local lastDay = dayIndex()
		while true do
			task.wait(60)
			local today = dayIndex()
			if today ~= lastDay then
				lastDay = today
				for _, player in Players:GetPlayers() do
					self:roll(player, true)
					Net:fire(player, "DailyUpdate", self:dailyState(player))
					Net:fire(player, "Toast", {
						kind = "info",
						title = "🔄 Novas missões diárias!",
						body = "E seu login diário já está disponível.",
					})
				end
			end
		end
	end)

	Net:on("ClaimQuest", function(player, key)
		if type(key) ~= "string" then
			return
		end
		local ok, err = self:claim(player, key)
		if not ok and err then
			Net:fire(player, "Toast", { kind = "error", title = err })
		end
	end)

	Net:on("ClaimDaily", function(player)
		local ok, err = self:claimDaily(player)
		if not ok and err then
			Net:fire(player, "Toast", { kind = "info", title = err })
		end
	end)

	Net:on("ClaimIndex", function(player, kind, id)
		if type(kind) ~= "string" or type(id) ~= "string" then
			return
		end
		local ok, err = self:claimIndex(player, kind, id)
		if not ok and err then
			Net:fire(player, "Toast", { kind = "error", title = err })
		end
	end)
end

return QuestService
