--!nonstrict
-- Planting, growing, mutating, harvesting, selling.
--
-- PERFORMANCE NOTE (this is the architectural centrepiece):
-- There is no timer, loop or instance per plant. A plant is five numbers:
-- {seed, plantedAt, duration, element, aura}. "Is it ready?" is arithmetic.
-- A single 1 Hz sweep walks only the tiles of players currently in the server
-- and only to detect the ripen transition (the moment mutations are rolled).
-- Everything else — progress bars, countdowns, pulsing visuals — is computed
-- client-side from the same two stamps. 12 players x 48 tiles = 576 cheap
-- integer comparisons per second, flat, regardless of how rich anyone is.

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Economy = require(Shared.Economy)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local Layout = require(Shared.Layout)
local Signal = require(Shared.Util.Signal)
local Store = require(script.Parent.Parent.Data.Store)

local Balance = Config.Balance
local Seeds = Config.Seeds
local Mutations = Config.Mutations
local Rarities = Config.Rarities

local GrowthService = { name = "GrowthService", priority = 4 }
GrowthService.onHarvest = Signal.new()
GrowthService.onRipen = Signal.new()

local app
local rng = Random.new()
local lastAuto = {} :: { [number]: number }

function GrowthService:init(a)
	app = a
end

-- Helpers ----------------------------------------------------------------

local function nearOwnPlot(player: Player, plotId: number?): boolean
	if not plotId then
		return false
	end
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then
		return false
	end
	local origin = Layout.plotOrigin(plotId).Position
	-- generous: anywhere on your own island counts, so a player can tap any
	-- tile from the UI without fighting the camera
	return (root.Position - origin).Magnitude <= Balance.plotSize
end

local function indexBump(profile, id: string)
	profile.index[id] = (profile.index[id] or 0) + 1
end

-- Planting ---------------------------------------------------------------

function GrowthService:plant(player: Player, tileIndex: number, seedId: string): (boolean, string?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false, "Perfil não carregado"
	end
	local seed = Seeds.byId[seedId]
	if not seed then
		return false, "Semente inválida"
	end
	local plotId = app.PlotService:plotIdOf(player)
	if not plotId then
		return false, "Você não tem uma fazenda neste servidor"
	end
	tileIndex = math.floor(tileIndex)
	local maxTiles = app.PlotService:tileCount(player)
	if tileIndex < 1 or tileIndex > maxTiles then
		return false, "Canteiro bloqueado"
	end
	if profile.tiles[tileIndex] then
		return false, "Canteiro ocupado"
	end
	if (profile.seeds[seedId] or 0) <= 0 then
		return false, "Você não tem essa semente"
	end
	if not nearOwnPlot(player, plotId) then
		return false, "Vá até a sua fazenda para plantar"
	end

	local m = app.PlayerService:multipliers(player)
	profile.seeds[seedId] -= 1
	if profile.seeds[seedId] <= 0 then
		profile.seeds[seedId] = nil
	end

	profile.tiles[tileIndex] = {
		seed = seedId,
		plantedAt = os.time(),
		duration = Economy.growDuration(seedId, m.grow),
		plantedBy = player.UserId,
	}

	app.PlotService:pushTile(plotId, tileIndex)
	app.QuestService:progress(player, "plant", 1)
	app.PlayerService:sync(player)
	return true
end

-- Ripening ---------------------------------------------------------------

--- Roll mutations for a plant that just finished. This is where the game's
--- "jackpot moment" lives, so it also handles the announcements.
function GrowthService:ripen(player: Player, tileIndex: number, plant, silent: boolean?)
	local profile = Store.get(player.UserId)
	if not profile then
		return
	end
	local m = app.PlayerService:multipliers(player)
	local unlocked = app.EventService and app.EventService:unlockedMutation() or nil

	local element, aura = Economy.rollMutations(m.luck, unlocked, rng)
	local size, giant = Economy.rollSize(rng)

	plant.element = element
	plant.aura = aura
	plant.size = size
	plant.giant = giant or nil
	plant.ripeAt = os.time()

	local mult = Mutations.multiplier(element, aura)
	if mult > 1 then
		profile.stats.mutations += 1
		app.QuestService:progress(player, "mutate", 1)
	end

	local plotId = app.PlotService:plotIdOf(player)
	if plotId then
		app.PlotService:pushTile(plotId, tileIndex)
	end

	if not silent then
		local seed = Seeds.byId[plant.seed]
		local label = Mutations.label(element, aura)
		local value = Economy.cropValue(plant.seed, element, aura, size, m.coin)

		Net:fire(player, "MutationRoll", {
			tile = tileIndex,
			seed = plant.seed,
			element = element,
			aura = aura,
			size = size,
			giant = giant,
			mult = mult,
			value = value,
		})

		-- Global announcement rules: only genuinely rare things, or the chat
		-- becomes noise and players mute it (and then stop feeling FOMO).
		local e, a = Mutations.byId[element], Mutations.byId[aura]
		local shouldAnnounce = (e and e.announce) or (a and a.announce) or giant
		if shouldAnnounce and profile.settings.announcements ~= false then
			local rarity = Rarities.get(seed and seed.rarity or "Common")
			Net:fireAll("Announce", {
				kind = "mutation",
				title = ("%s conseguiu %s%s %s!"):format(
					player.DisplayName,
					giant and "GIGANTE " or "",
					label ~= "" and label or "",
					seed and seed.name or plant.seed
				),
				body = ("Valor: %s moedas  •  %s"):format(Format.short(value), Format.multiplier(mult)),
				colour = (a and a.mult > (e and e.mult or 1)) and a.colour
					or (e and e.colour)
					or rarity.colour,
			})
		end
	end

	self.onRipen:Fire(player, tileIndex, plant)
end

--- The 1 Hz sweep. Only detects the not-ripe -> ripe transition.
function GrowthService:sweep()
	local now = os.time()
	for _, player in Players:GetPlayers() do
		local profile = Store.get(player.UserId)
		if profile then
			for tileIndex, plant in profile.tiles do
				if plant and not plant.element and (plant.plantedAt + plant.duration) <= now then
					self:ripen(player, tileIndex, plant)
				end
			end
		end
	end
end

--- Offline growth, applied once on load. Capped by the player's offline hours
--- so Fazenda Eterna / VIP have a concrete value.
function GrowthService:applyOffline(player: Player, profile)
	local m = app.PlayerService:multipliers(player)
	local away = os.time() - (profile.lastSeen or os.time())
	if away <= 5 then
		return 0
	end
	local cap = m.offlineHours * 3600
	local credited = math.min(away, cap)
	local ripened = 0

	for tileIndex, plant in profile.tiles do
		if plant and not plant.element then
			-- shift plantedAt back by the credited time: equivalent to the
			-- plant having grown while away, and keeps a single code path
			plant.plantedAt -= credited
			if (plant.plantedAt + plant.duration) <= os.time() then
				self:ripen(player, tileIndex, plant, true)
				ripened += 1
			end
		end
	end

	if ripened > 0 or away > 60 then
		Net:fire(player, "Toast", {
			kind = "offline",
			title = "Bem-vindo de volta!",
			body = ("Sua fazenda cresceu por %s%s. %d plantas estão prontas."):format(
				Format.time(credited),
				credited < away and (" (limite de %dh)"):format(m.offlineHours) or "",
				ripened
			),
			duration = 7,
		})
	end
	return ripened
end

-- Harvesting -------------------------------------------------------------

local function storageFull(profile, m): boolean
	return #profile.inventory >= m.storage
end

function GrowthService:harvestTile(player: Player, tileIndex: number, m): (boolean, string?, number?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false, "Perfil não carregado"
	end
	local plant = profile.tiles[tileIndex]
	if not plant then
		return false, "Canteiro vazio"
	end
	if not plant.element then
		return false, "Ainda não está pronta"
	end
	m = m or app.PlayerService:multipliers(player)

	local autoSell = app.MonetizationService:effect(player, "autoSell") == true
	if not autoSell and storageFull(profile, m) then
		return false, "Armazém cheio! Venda no mercado ou melhore o armazém."
	end

	local decay = Economy.ripeDecay(plant, os.time())
	local value = Economy.cropValue(plant.seed, plant.element, plant.aura, plant.size or 1, m.coin, decay)

	profile.tiles[tileIndex] = nil
	profile.stats.harvested += 1
	profile.stats.bestCrop = math.max(profile.stats.bestCrop, value)
	indexBump(profile, plant.seed)

	local seed = Seeds.byId[plant.seed]
	if seed then
		app.PlayerService:addXp(player, seed.xp)
	end

	if autoSell then
		app.PlayerService:addCoins(player, value, "autosell")
		profile.stats.sold += value
		app.QuestService:progress(player, "sell", value)
	else
		table.insert(profile.inventory, {
			seed = plant.seed,
			element = plant.element,
			aura = plant.aura,
			size = plant.size or 1,
			giant = plant.giant,
			value = value,
			at = os.time(),
		})
	end

	local plotId = app.PlotService:plotIdOf(player)
	if plotId then
		app.PlotService:pushTile(plotId, tileIndex)
	end

	app.QuestService:progress(player, "harvest", 1)
	self.onHarvest:Fire(player, plant, value)

	-- auto-replant: the quality-of-life that makes the pass worth buying
	if app.MonetizationService:effect(player, "autoPlant") == true then
		self:autoPlantTile(player, tileIndex)
	end

	return true, nil, value
end

function GrowthService:harvestAll(player: Player): (number, number)
	local profile = Store.get(player.UserId)
	if not profile then
		return 0, 0
	end
	local m = app.PlayerService:multipliers(player)
	local count, total = 0, 0
	-- collect indices first: harvestTile mutates profile.tiles
	local ready = {}
	for tileIndex, plant in profile.tiles do
		if plant and plant.element then
			table.insert(ready, tileIndex)
		end
	end
	table.sort(ready)
	for _, tileIndex in ready do
		local ok, _, value = self:harvestTile(player, tileIndex, m)
		if ok then
			count += 1
			total += value or 0
		else
			break -- storage full; stop instead of spamming errors
		end
	end
	if count > 0 then
		app.PlayerService:sync(player)
	end
	return count, total
end

--- Pick the most valuable seed the player can afford to plant and plant it.
function GrowthService:autoPlantTile(player: Player, tileIndex: number): boolean
	local profile = Store.get(player.UserId)
	if not profile or profile.tiles[tileIndex] then
		return false
	end
	local best, bestValue = nil, -1
	for seedId, count in profile.seeds do
		if count > 0 then
			local seed = Seeds.byId[seedId]
			if seed and seed.baseValue > bestValue then
				best, bestValue = seedId, seed.baseValue
			end
		end
	end
	if not best then
		return false
	end
	local m = app.PlayerService:multipliers(player)
	profile.seeds[best] -= 1
	if profile.seeds[best] <= 0 then
		profile.seeds[best] = nil
	end
	profile.tiles[tileIndex] = {
		seed = best,
		plantedAt = os.time(),
		duration = Economy.growDuration(best, m.grow),
		plantedBy = player.UserId,
	}
	local plotId = app.PlotService:plotIdOf(player)
	if plotId then
		app.PlotService:pushTile(plotId, tileIndex)
	end
	return true
end

--- Auto-harvest pulse (pass + Robô/Chronos pets).
function GrowthService:autoPulse()
	local now = os.clock()
	for _, player in Players:GetPlayers() do
		local hasPass = app.MonetizationService:effect(player, "autoHarvest") == true
		local petInterval = nil
		local profile = Store.get(player.UserId)
		if profile then
			local m = app.PlayerService:multipliers(player)
			local slots = m.petSlots
			local used = 0
			for _, owned in profile.pets do
				if owned.equipped and used < slots then
					used += 1
					local pet = Config.Pets.byId[owned.id]
					local interval = pet and pet.buff.autoHarvest
					if interval then
						petInterval = math.min(petInterval or math.huge, interval)
					end
				end
			end
		end
		local interval = hasPass and 3 or petInterval
		if interval then
			local last = lastAuto[player.UserId] or 0
			if now - last >= interval then
				lastAuto[player.UserId] = now
				local count = self:harvestAll(player)
				if count > 0 then
					Net:fire(player, "Vfx", { kind = "autoharvest", count = count })
				end
			end
		end
	end
end

-- Selling ----------------------------------------------------------------

function GrowthService:sellAll(player: Player): (number, number)
	local profile = Store.get(player.UserId)
	if not profile or #profile.inventory == 0 then
		return 0, 0
	end
	local total, count = 0, #profile.inventory
	for _, crop in profile.inventory do
		total += crop.value
	end
	profile.inventory = {}
	profile.stats.sold += total
	app.PlayerService:addCoins(player, total, "sell")
	app.QuestService:progress(player, "sell", total)
	app.PlayerService:sync(player)
	return count, total
end

function GrowthService:sellOne(player: Player, invIndex: number): (boolean, number?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false
	end
	local crop = profile.inventory[invIndex]
	if not crop then
		return false
	end
	table.remove(profile.inventory, invIndex)
	profile.stats.sold += crop.value
	app.PlayerService:addCoins(player, crop.value, "sell")
	app.QuestService:progress(player, "sell", crop.value)
	app.PlayerService:sync(player)
	return true, crop.value
end

-- Instant grow (product) -------------------------------------------------

function GrowthService:instantGrowAll(player: Player): number
	local profile = Store.get(player.UserId)
	if not profile then
		return 0
	end
	local n = 0
	for tileIndex, plant in profile.tiles do
		if plant and not plant.element then
			plant.plantedAt = os.time() - plant.duration
			self:ripen(player, tileIndex, plant)
			n += 1
		end
	end
	if n > 0 then
		app.PlayerService:sync(player)
	end
	return n
end

-- Lifecycle --------------------------------------------------------------

function GrowthService:start()
	app.PlayerService.onProfileReady:Connect(function(player, profile)
		task.defer(function()
			self:applyOffline(player, profile)
			app.PlayerService:sync(player)
		end)
	end)

	Players.PlayerRemoving:Connect(function(player)
		lastAuto[player.UserId] = nil
	end)

	task.spawn(function()
		while true do
			task.wait(Balance.growthTickRate)
			local ok, err = pcall(function()
				self:sweep()
			end)
			if not ok then
				warn("[Growth] sweep error: " .. tostring(err))
			end
		end
	end)

	task.spawn(function()
		while true do
			task.wait(1.5)
			pcall(function()
				self:autoPulse()
			end)
		end
	end)

	Net:on("Plant", function(player, tileIndex, seedId)
		if type(tileIndex) ~= "number" or type(seedId) ~= "string" then
			return
		end
		local ok, err = self:plant(player, tileIndex, seedId)
		if not ok and err then
			Net:fire(player, "Toast", { kind = "error", title = err })
		end
	end)

	Net:on("Harvest", function(player, tileIndex)
		if type(tileIndex) ~= "number" then
			return
		end
		local ok, err, value = self:harvestTile(player, math.floor(tileIndex))
		if ok then
			Net:fire(player, "Vfx", { kind = "harvest", tile = math.floor(tileIndex), value = value })
			app.PlayerService:sync(player)
		elseif err then
			Net:fire(player, "Toast", { kind = "error", title = err })
		end
	end)

	Net:on("HarvestAll", function(player)
		local count, total = self:harvestAll(player)
		if count == 0 then
			Net:fire(player, "Toast", { kind = "info", title = "Nada pronto para colher ainda." })
		else
			Net:fire(player, "Toast", {
				kind = "success",
				title = ("Colheu %d plantas"):format(count),
				body = ("Valor total: %s moedas"):format(Format.short(total)),
			})
		end
	end)

	Net:on("Sell", function(player, invIndex)
		if type(invIndex) ~= "number" then
			return
		end
		local ok, value = self:sellOne(player, math.floor(invIndex))
		if ok then
			Net:fire(player, "Vfx", { kind = "sell", value = value })
		end
	end)

	Net:on("SellAll", function(player)
		local count, total = self:sellAll(player)
		if count == 0 then
			Net:fire(player, "Toast", { kind = "info", title = "Seu armazém está vazio." })
		else
			Net:fire(player, "Toast", {
				kind = "success",
				title = ("Vendeu %d itens"):format(count),
				body = ("+%s moedas"):format(Format.short(total)),
			})
			Net:fire(player, "Vfx", { kind = "sell", value = total })
		end
	end)
end

return GrowthService
