--!nonstrict
-- The client's single source of truth. Every controller reads from here and
-- subscribes to `changed`; nothing keeps its own copy of the profile. That is
-- what stops the classic "the shop says 3 but the HUD says 2" class of bug.

local Shared = game:GetService("ReplicatedStorage").Shared
local Net = require(Shared.Util.Net)
local Signal = require(Shared.Util.Signal)

local State = {
	-- profile mirror
	coins = 0,
	gems = 0,
	rebirths = 0,
	level = 1,
	xpInto = 0,
	xpNeed = 1,
	rank = nil,
	tileCount = 6,
	maxTiles = 48,
	tiles = {},
	seeds = {},
	inventory = {},
	pets = {},
	eggs = {},
	upgrades = {},
	boosts = {},
	quests = {},
	daily = nil,
	index = {},
	indexClaimed = {},
	stats = {},
	settings = {},
	passes = {},
	productsBought = {},
	mult = nil,
	rebirthCost = 0,
	plotId = nil,
	tutorialStep = 0,

	-- world mirror
	plots = {}, -- [plotId] = snapshot
	shop = nil,
	event = nil,
	nextEventAt = 0,
	serverBoard = {},
	trade = nil,

	-- client-only
	quality = nil,
	ready = false,
	serverTimeOffset = 0,
}

State.changed = Signal.new()
State.plotChanged = Signal.new()
State.ready = false
State.onReady = Signal.new()

--- Server time, corrected for the client's clock drift. Every countdown in the
--- UI uses this so a phone with a wrong clock still shows the right timer.
function State.now(): number
	return os.time() + State.serverTimeOffset
end

function State.applySync(payload)
	if not payload then
		return
	end
	if payload.serverTime then
		State.serverTimeOffset = payload.serverTime - os.time()
	end
	for key, value in payload do
		if key ~= "serverTime" then
			State[key] = value
		end
	end
	if not State.ready then
		State.ready = true
		State.onReady:Fire()
	end
	State.changed:Fire("sync")
end

function State.hasPass(key: string): boolean
	return State.passes and State.passes[key] == true
end

function State.seedCount(seedId: string): number
	return State.seeds[seedId] or 0
end

function State.myPlot()
	return State.plotId and State.plots[State.plotId] or nil
end

function State.connect()
	Net:listen("Sync", function(payload)
		State.applySync(payload)
	end)

	Net:listen("Currency", function(payload)
		for key, value in payload do
			State[key] = value
		end
		State.changed:Fire("currency")
	end)

	Net:listen("Boosts", function(payload)
		State.boosts = payload.boosts or {}
		State.mult = payload.mult or State.mult
		State.changed:Fire("boosts")
	end)

	Net:listen("Quests", function(payload)
		State.quests = payload or {}
		State.changed:Fire("quests")
	end)

	Net:listen("DailyUpdate", function(payload)
		State.daily = payload
		State.changed:Fire("daily")
	end)

	Net:listen("PetsUpdate", function(payload)
		State.pets = payload.pets or State.pets
		State.changed:Fire("pets")
	end)

	Net:listen("InventoryUpdate", function(payload)
		if payload.shop then
			State.shop = payload.shop
		end
		State.changed:Fire("shop")
	end)

	Net:listen("PlotDelta", function(payload)
		if not payload or not payload.plotId then
			return
		end
		local id = payload.plotId
		if payload.full then
			State.plots[id] = payload.full
			if id == State.plotId then
				State.tiles = payload.full.tiles or State.tiles
				State.tileCount = payload.full.tileCount or State.tileCount
			end
			State.plotChanged:Fire(id, nil)
		elseif payload.tile then
			local snap = State.plots[id]
			if snap then
				snap.tiles = snap.tiles or {}
				snap.tiles[payload.tile] = payload.plant
				if id == State.plotId then
					State.tiles[payload.tile] = payload.plant
				end
			end
			State.plotChanged:Fire(id, payload.tile)
		end
	end)

	Net:listen("EventStarted", function(payload)
		State.event = payload
		State.changed:Fire("event")
	end)

	Net:listen("EventEnded", function(payload)
		State.event = nil
		State.nextEventAt = payload and payload.nextAt or 0
		State.changed:Fire("event")
	end)

	Net:listen("Leaderboard", function(payload)
		State.serverBoard = payload.server or State.serverBoard
		State.changed:Fire("leaderboard")
	end)

	Net:listen("TradeUpdate", function(payload)
		State.trade = payload.state ~= "closed" and payload or nil
		State.changed:Fire("trade")
	end)

	-- initial fetch (the server also pushes, this just removes the race)
	task.spawn(function()
		local payload = Net:request("GetProfile")
		if payload then
			State.applySync(payload)
		else
			Net:send("RequestSync")
		end
	end)
end

return State
