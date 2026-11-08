--!nonstrict
-- Server-wide live events. Announced with a 60s warning, then applied as global
-- multipliers plus a lighting change so the whole world visibly shifts — that
-- visual change is what makes players screenshot it and tell their friends.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local Weighted = require(Shared.Util.WeightedRandom)
local Signal = require(Shared.Util.Signal)

local Players = game:GetService("Players")
local Events = Config.Events

local EventService = { name = "EventService", priority = 9 }
EventService.onStart = Signal.new()
EventService.onEnd = Signal.new()

local app
local rng = Random.new()
local active = nil :: { key: string, endsAt: number }?
local nextAt = 0

function EventService:init(a)
	app = a
end

function EventService:current()
	if active and active.endsAt > os.time() then
		return Events.byKey[active.key], active.endsAt
	end
	return nil, nil
end

--- The multiplier bundle Economy consumes. nil when nothing is running.
function EventService:mods()
	local event = self:current()
	return event and event.mods or nil
end

function EventService:unlockedMutation(): string?
	local event = self:current()
	return event and event.mods.mutationUnlock or nil
end

local function refreshEveryone()
	for _, player in Players:GetPlayers() do
		app.PlayerService:dirty(player)
		app.PlayerService:pushBoosts(player)
	end
end

function EventService:startEvent(key: string, durationOverride: number?)
	local event = Events.byKey[key]
	if not event then
		return false
	end
	local duration = durationOverride or event.duration
	active = { key = key, endsAt = os.time() + duration }
	refreshEveryone()

	Net:fireAll("EventStarted", {
		key = key,
		name = event.name,
		desc = event.desc,
		icon = event.icon,
		colour = event.colour,
		endsAt = active.endsAt,
		duration = duration,
		mods = event.mods,
		lighting = event.lighting,
	})
	Net:fireAll("Announce", {
		kind = "event",
		title = event.icon .. " " .. event.name .. " COMEÇOU!",
		body = event.desc .. ("  •  Duração: %s"):format(Format.time(duration)),
		colour = event.colour,
		duration = 8,
	})
	self.onStart:Fire(key, event)

	task.delay(duration, function()
		if active and active.key == key then
			self:endEvent()
		end
	end)
	return true
end

function EventService:endEvent()
	if not active then
		return
	end
	local event = Events.byKey[active.key]
	active = nil
	refreshEveryone()
	nextAt = os.time() + Events.interval
	Net:fireAll("EventEnded", { key = event and event.key })
	Net:fireAll("Announce", {
		kind = "event",
		title = (event and event.icon or "") .. " Evento encerrado",
		body = ("Próximo evento em %s"):format(Format.time(Events.interval)),
		colour = Config.Theme.textDim,
	})
	self.onEnd:Fire(event and event.key)
end

function EventService:pickNext(): string
	local entries = {}
	for _, e in Events.all do
		table.insert(entries, { key = e.key, weight = e.weight, luckScale = 0 })
	end
	return Weighted.pick(entries, 1, rng).key
end

function EventService:schedulePayload()
	local event, endsAt = self:current()
	return {
		active = event and {
			key = event.key, name = event.name, desc = event.desc, icon = event.icon,
			colour = event.colour, endsAt = endsAt, mods = event.mods, lighting = event.lighting,
		} or nil,
		nextAt = nextAt,
	}
end

function EventService:start()
	nextAt = os.time() + 180 -- first event 3 minutes after the server boots

	app.PlayerService.onProfileReady:Connect(function(player)
		task.defer(function()
			local payload = self:schedulePayload()
			if payload.active then
				Net:fire(player, "EventStarted", payload.active)
			else
				Net:fire(player, "EventEnded", { nextAt = nextAt })
			end
		end)
	end)

	task.spawn(function()
		local warned = false
		while true do
			task.wait(5)
			if not active then
				local left = nextAt - os.time()
				if left <= Events.warning and not warned then
					warned = true
					Net:fireAll("Announce", {
						kind = "event",
						title = "⏳ Evento global em 1 minuto!",
						body = "Prepare as plantas mais caras que você tiver.",
						colour = Config.Theme.warn,
					})
				end
				if left <= 0 then
					warned = false
					self:startEvent(self:pickNext())
				end
			end
		end
	end)
end

return EventService
