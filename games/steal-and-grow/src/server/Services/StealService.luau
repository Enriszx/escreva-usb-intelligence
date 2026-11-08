--!nonstrict
-- The steal-and-defend layer. This is what turns a farming idle game into a
-- social game people scream about, so it gets the most careful rules:
--
--  * Server-authoritative channel. The client renders a bar; the server owns
--    the timer, re-validates distance every tick, and is the only thing that
--    can move a crop between inventories.
--  * You can only steal RIPE, unharvested crops. That makes "harvest promptly"
--    a real decision and gives Auto-Harvest genuine value.
--  * Rarer and more mutated = slower to steal. The jackpot crop is the one you
--    are most likely to get caught taking.
--  * The victim always gets a loud, unmissable alarm with a direction. Being
--    robbed must feel survivable, not arbitrary.
--  * New players get a protection window; leaving the server does not protect
--    a ripe farm (the plot is held for 2 minutes), so "disconnect to save my
--    crops" is not a strategy.
--  * The thief gets a cut (75%), not the full value. Stealing is good, farming
--    is still better — otherwise nobody farms and the loop collapses.

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Economy = require(Shared.Economy)
local Layout = require(Shared.Layout)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local Signal = require(Shared.Util.Signal)
local Store = require(script.Parent.Parent.Data.Store)

local Balance = Config.Balance
local Seeds = Config.Seeds
local Mutations = Config.Mutations

local StealService = { name = "StealService", priority = 5 }
StealService.onSteal = Signal.new()
StealService.onBlocked = Signal.new()

local app
local rng = Random.new()

-- active channels: [thiefUserId] = { [token] = channel }
local channels = {} :: { [number]: { [string]: any } }
-- cooldowns
local pairCooldown = {} :: { [string]: number } -- "thief:victim" -> expiry
local globalCooldown = {} :: { [number]: number }

function StealService:init(a)
	app = a
end

local function countChannels(userId: number): number
	local set = channels[userId]
	if not set then
		return 0
	end
	local n = 0
	for _ in set do
		n += 1
	end
	return n
end

local function pairKey(thief: number, victim: number): string
	return thief .. ":" .. victim
end

local function rootOf(player: Player): BasePart?
	local char = player.Character
	return char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
end

-- Validation -------------------------------------------------------------

--- Everything that must be true before a channel may even start. Returns
--- (ok, reasonOrNil, context).
function StealService:validate(thief: Player, plotId: number, tileIndex: number)
	local thiefProfile = Store.get(thief.UserId)
	if not thiefProfile then
		return false, "Perfil não carregado"
	end

	local plot = app.PlotService:plot(plotId)
	if not plot or not plot.owner then
		return false, "Fazenda vazia"
	end
	if plot.owner == thief.UserId then
		return false, "Essa fazenda é sua"
	end

	local victimProfile = Store.get(plot.owner)
	if not victimProfile then
		return false, "Dono indisponível"
	end

	-- hold expiry: an abandoned plot stops being stealable
	if not plot.online and plot.heldUntil and os.time() > plot.heldUntil then
		return false, "O dono saiu e a fazenda foi trancada"
	end
	if not plot.online and not Balance.stealOfflineOwnerAllowed then
		return false, "O dono está offline"
	end

	-- new-player protection
	if
		victimProfile.firstJoin
		and (os.time() - victimProfile.firstJoin) < Balance.stealProtectionAfterJoin
	then
		local left = Balance.stealProtectionAfterJoin - (os.time() - victimProfile.firstJoin)
		return false, ("Jogador novo protegido por %s"):format(Format.time(left))
	end

	local plant = victimProfile.tiles[tileIndex]
	if not plant then
		return false, "Canteiro vazio"
	end
	if not plant.element then
		return false, "Essa planta ainda não está pronta"
	end
	if plant.stolen then
		return false, "Alguém já está roubando essa"
	end

	-- cooldowns
	local now = os.time()
	if (globalCooldown[thief.UserId] or 0) > now then
		return false,
			("Espere %s para roubar de novo"):format(Format.time(globalCooldown[thief.UserId] - now))
	end
	local pk = pairKey(thief.UserId, plot.owner)
	if (pairCooldown[pk] or 0) > now then
		return false, ("Você já roubou essa fazenda. Espere %s"):format(Format.time(pairCooldown[pk] - now))
	end

	-- channel slots
	local m = app.PlayerService:multipliers(thief)
	if countChannels(thief.UserId) >= m.stealSlots then
		return false, "Você já está roubando o máximo de plantas ao mesmo tempo"
	end

	-- distance
	local root = rootOf(thief)
	if not root then
		return false, "Personagem não carregado"
	end
	local tilePos = Layout.tileWorldPosition(plotId, tileIndex)
	if (root.Position - tilePos).Magnitude > Balance.stealRange then
		return false, "Chegue mais perto da planta"
	end

	return true,
		nil,
		{
			plot = plot,
			victimProfile = victimProfile,
			plant = plant,
			tilePos = tilePos,
			thiefMult = m,
		}
end

-- Channelling ------------------------------------------------------------

function StealService:begin(thief: Player, plotId: number, tileIndex: number)
	local ok, reason, ctx = self:validate(thief, plotId, tileIndex)
	if not ok then
		Net:fire(thief, "StealResult", { ok = false, reason = reason })
		return
	end

	local plot = ctx.plot
	local plant = ctx.plant
	local victim = Players:GetPlayerByUserId(plot.owner)
	local victimMult = victim and app.PlayerService:multipliers(victim) or nil
	local defense = victimMult and victimMult.defense or 0

	-- SHIELD ROLL: resolved up front so the victim's alarm can say "blocked!"
	-- and the thief doesn't waste 20 seconds channelling a doomed theft.
	if rng:NextNumber() < defense then
		local victimProfile = ctx.victimProfile
		victimProfile.stats.blocked += 1
		globalCooldown[thief.UserId] = os.time() + Balance.stealGlobalCooldown
		pairCooldown[pairKey(thief.UserId, plot.owner)] = os.time() + Balance.stealCooldown

		Net:fire(thief, "StealResult", {
			ok = false,
			blocked = true,
			reason = "🛡️ BLOQUEADO! Essa fazenda está protegida.",
		})
		if victim then
			Net:fire(victim, "StealAlarm", {
				kind = "blocked",
				tile = tileIndex,
				thief = app.MonetizationService:has(thief, "masterThief") and "Alguém" or thief.DisplayName,
				position = ctx.tilePos,
			})
			app.QuestService:progress(victim, "defend", 1)
			app.PlayerService:sync(victim)
		end
		self.onBlocked:Fire(thief, victim)
		return
	end

	local duration = Economy.stealTime(plant, ctx.thiefMult.stealSpeed, defense)
	local token = tostring(os.clock()) .. ":" .. tileIndex

	plant.stolen = true -- claim it so two thieves can't take the same crop
	app.PlotService:pushTile(plotId, tileIndex)

	local channel = {
		token = token,
		thief = thief,
		plotId = plotId,
		tileIndex = tileIndex,
		victimId = plot.owner,
		startedAt = os.clock(),
		duration = duration,
		tilePos = ctx.tilePos,
		cancelled = false,
	}
	channels[thief.UserId] = channels[thief.UserId] or {}
	channels[thief.UserId][token] = channel

	Net:fire(thief, "StealProgress", {
		token = token,
		tile = tileIndex,
		plotId = plotId,
		duration = duration,
		seed = plant.seed,
		element = plant.element,
		aura = plant.aura,
	})

	if victim then
		local victimProfile = ctx.victimProfile
		if victimProfile.settings.alarms ~= false then
			Net:fire(victim, "StealAlarm", {
				kind = "start",
				tile = tileIndex,
				duration = duration,
				thief = app.MonetizationService:has(thief, "masterThief") and "Um ladrão desconhecido"
					or thief.DisplayName,
				position = ctx.tilePos,
				seed = plant.seed,
			})
		end
	end

	-- the channel watcher
	task.spawn(function()
		while true do
			task.wait(0.15)
			if channel.cancelled then
				return
			end
			if not thief.Parent then
				self:cancel(thief, token, "left")
				return
			end
			local root = rootOf(thief)
			if not root then
				self:cancel(thief, token, "died")
				return
			end
			-- the thief must hold position: this is what makes a theft a
			-- readable, interruptible event instead of a drive-by click
			if (root.Position - ctx.tilePos).Magnitude > Balance.stealRange + Balance.stealMoveTolerance then
				self:cancel(thief, token, "moved")
				return
			end
			if os.clock() - channel.startedAt >= duration then
				self:complete(channel)
				return
			end
		end
	end)
end

function StealService:cancel(thief: Player, token: string?, why: string?)
	local set = channels[thief.UserId]
	if not set then
		return
	end
	local list = {}
	if token then
		if set[token] then
			table.insert(list, set[token])
		end
	else
		for _, ch in set do
			table.insert(list, ch)
		end
	end
	for _, ch in list do
		ch.cancelled = true
		set[ch.token] = nil
		-- release the claim
		local victimProfile = Store.get(ch.victimId)
		local plant = victimProfile and victimProfile.tiles[ch.tileIndex]
		if plant then
			plant.stolen = nil
			app.PlotService:pushTile(ch.plotId, ch.tileIndex)
		end
		Net:fire(thief, "StealResult", {
			ok = false,
			token = ch.token,
			reason = why == "moved" and "Você se afastou — roubo cancelado"
				or why == "died" and "Você morreu — roubo cancelado"
				or "Roubo cancelado",
		})
		local victim = Players:GetPlayerByUserId(ch.victimId)
		if victim then
			Net:fire(victim, "StealAlarm", { kind = "cancel", tile = ch.tileIndex })
		end
	end
	if next(set) == nil then
		channels[thief.UserId] = nil
	end
end

function StealService:complete(channel)
	local thief = channel.thief
	local set = channels[thief.UserId]
	if set then
		set[channel.token] = nil
		if next(set) == nil then
			channels[thief.UserId] = nil
		end
	end

	local thiefProfile = Store.get(thief.UserId)
	local victimProfile = Store.get(channel.victimId)
	if not thiefProfile or not victimProfile then
		return
	end
	local plant = victimProfile.tiles[channel.tileIndex]
	if not plant or not plant.element then
		Net:fire(thief, "StealResult", { ok = false, token = channel.token, reason = "A planta sumiu" })
		return
	end

	local victim = Players:GetPlayerByUserId(channel.victimId)
	local plot = app.PlotService:plot(channel.plotId)
	local offline = plot and not plot.online

	local m = app.PlayerService:multipliers(thief)
	local decay = Economy.ripeDecay(plant, os.time())
	local base = Economy.cropValue(plant.seed, plant.element, plant.aura, plant.size or 1, m.coin, decay)
	local value = math.floor(base * Balance.stealValueCut * (offline and Balance.stealOfflinePenalty or 1))

	-- remove from the victim
	victimProfile.tiles[channel.tileIndex] = nil
	victimProfile.stats.robbed += 1
	victimProfile.lastRobbedBy = thief.UserId
	victimProfile.lastRobbedAt = os.time()

	-- give to the thief (respecting storage, with autoSell support)
	local autoSell = app.MonetizationService:effect(thief, "autoSell") == true
	if autoSell or #thiefProfile.inventory >= m.storage then
		app.PlayerService:addCoins(thief, value, "steal")
		thiefProfile.stats.sold += value
	else
		table.insert(thiefProfile.inventory, {
			seed = plant.seed,
			element = plant.element,
			aura = plant.aura,
			size = plant.size or 1,
			giant = plant.giant,
			value = value,
			at = os.time(),
			stolenFrom = channel.victimId,
		})
	end
	thiefProfile.stats.stolen += 1
	thiefProfile.index[plant.seed] = (thiefProfile.index[plant.seed] or 0) + 1

	-- cooldowns
	globalCooldown[thief.UserId] = os.time() + Balance.stealGlobalCooldown
	pairCooldown[pairKey(thief.UserId, channel.victimId)] = os.time() + Balance.stealCooldown

	app.PlotService:pushTile(channel.plotId, channel.tileIndex)
	app.QuestService:progress(thief, "steal", 1)
	app.PlayerService:addXp(thief, 3)
	app.PlayerService:sync(thief)

	local seed = Seeds.byId[plant.seed]
	local label = Mutations.label(plant.element, plant.aura)
	local cropName = ((label ~= "" and label .. " ") or "") .. (seed and seed.name or plant.seed)

	Net:fire(thief, "StealResult", {
		ok = true,
		token = channel.token,
		tile = channel.tileIndex,
		value = value,
		name = cropName,
		victim = plot and plot.ownerName or "?",
	})

	if victim then
		Net:fire(victim, "StealAlarm", {
			kind = "stolen",
			tile = channel.tileIndex,
			thief = app.MonetizationService:has(thief, "masterThief") and "Um ladrão desconhecido"
				or thief.DisplayName,
			thiefId = app.MonetizationService:has(thief, "masterThief") and 0 or thief.UserId,
			name = cropName,
			value = value,
		})
		app.PlayerService:sync(victim)
	end

	-- announce only genuinely big thefts, with the victim named: this is the
	-- single most engagement-generating message in the game
	if value >= 1000 then
		local mult = Mutations.multiplier(plant.element, plant.aura)
		if mult >= 15 or (plant.giant and value >= 10000) then
			Net:fireAll("Announce", {
				kind = "steal",
				title = ("🥷 %s roubou %s de %s!"):format(
					thief.DisplayName,
					cropName,
					plot and plot.ownerName or "alguém"
				),
				body = ("Prejuízo: %s moedas"):format(Format.short(value)),
				colour = Config.Theme.steal,
			})
		end
	end

	self.onSteal:Fire(thief, victim, plant, value)
	if app.Analytics then
		app.Analytics:custom(thief, "steal", { value = value, seed = plant.seed, offline = offline })
	end
end

-- Revenge (product) ------------------------------------------------------

function StealService:revenge(player: Player): (boolean, string?)
	local profile = Store.get(player.UserId)
	if not profile or not profile.lastRobbedBy then
		return false, "Ninguém te roubou recentemente"
	end
	if os.time() - (profile.lastRobbedAt or 0) > Balance.revengeWindow then
		return false, "A janela de vingança expirou"
	end
	local targetId = profile.lastRobbedBy
	local targetProfile = Store.get(targetId)
	if not targetProfile then
		return false, "O alvo não está mais no servidor"
	end

	-- take their single most valuable ripe crop, ignoring shields
	local bestIndex, bestValue, bestPlant = nil, -1, nil
	local target = Players:GetPlayerByUserId(targetId)
	local tm = target and app.PlayerService:multipliers(target)
	for index, plant in targetProfile.tiles do
		if plant and plant.element then
			local v =
				Economy.cropValue(plant.seed, plant.element, plant.aura, plant.size or 1, tm and tm.coin or 1)
			if v > bestValue then
				bestIndex, bestValue, bestPlant = index, v, plant
			end
		end
	end
	if not bestIndex then
		return false, "O alvo não tem nada pronto para roubar"
	end

	local m = app.PlayerService:multipliers(player)
	local value = math.floor(bestValue * Balance.stealValueCut)
	targetProfile.tiles[bestIndex] = nil
	targetProfile.stats.robbed += 1
	profile.stats.stolen += 1
	profile.lastRobbedBy = nil

	if #profile.inventory >= m.storage then
		app.PlayerService:addCoins(player, value, "revenge")
	else
		table.insert(profile.inventory, {
			seed = bestPlant.seed,
			element = bestPlant.element,
			aura = bestPlant.aura,
			size = bestPlant.size or 1,
			giant = bestPlant.giant,
			value = value,
			at = os.time(),
		})
	end

	local targetPlotId = target and app.PlotService:plotIdOf(target)
	if targetPlotId then
		app.PlotService:pushTile(targetPlotId, bestIndex)
	end
	if target then
		Net:fire(target, "StealAlarm", {
			kind = "revenge",
			tile = bestIndex,
			thief = player.DisplayName,
			value = value,
		})
		app.PlayerService:sync(target)
	end
	app.QuestService:progress(player, "steal", 1)
	app.PlayerService:sync(player)
	return true, ("Vingança! +%s moedas"):format(Format.short(value))
end

-- Lifecycle --------------------------------------------------------------

function StealService:start()
	Net:on("StealStart", function(player, plotId, tileIndex)
		if type(plotId) ~= "number" or type(tileIndex) ~= "number" then
			return
		end
		self:begin(player, math.floor(plotId), math.floor(tileIndex))
	end)

	Net:on("StealCancel", function(player, token)
		self:cancel(player, type(token) == "string" and token or nil, "cancel")
	end)

	Players.PlayerRemoving:Connect(function(player)
		self:cancel(player, nil, "left")
		globalCooldown[player.UserId] = nil
		for key in pairCooldown do
			if key:match("^" .. player.UserId .. ":") then
				pairCooldown[key] = nil
			end
		end
	end)

	-- cooldown GC so the tables never grow unbounded on a long-lived server
	task.spawn(function()
		while true do
			task.wait(120)
			local now = os.time()
			for key, expiry in pairCooldown do
				if expiry <= now then
					pairCooldown[key] = nil
				end
			end
			for uid, expiry in globalCooldown do
				if expiry <= now then
					globalCooldown[uid] = nil
				end
			end
		end
	end)
end

return StealService
