--!strict
-- Remote plumbing. One place that owns every RemoteEvent/RemoteFunction so
-- there is no chance of a typo'd FindFirstChild at runtime, and so every
-- server-bound call goes through the rate limiter automatically.
--
-- Server:  Net:on("Plant", function(player, tileIndex, seedId) ... end)
--          Net:fire(player, "Toast", "Plantado!")
--          Net:fireAll("EventStarted", "BloodMoon")
-- Client:  Net:send("Plant", 3, "carrot")
--          Net:listen("Toast", function(msg) ... end)
--          Net:request("GetProfile")

local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local IS_SERVER = RunService:IsServer()

-- Every remote name in the game. Declaring them up-front catches typos and
-- lets us create the whole folder in one pass at boot.
local EVENTS = {
	-- client -> server (actions)
	"Plant", "Harvest", "HarvestAll", "Sell", "SellAll", "BuySeed", "BuyUpgrade",
	"BuyEgg", "HatchEgg", "EquipPet", "UnequipPet", "FusePets", "DeletePet",
	"StealStart", "StealCancel", "GoHome", "VisitPlot", "Rebirth", "RedeemCode",
	"ClaimQuest", "ClaimDaily", "ClaimIndex", "TradeAction", "SetSetting",
	"PromptPass", "PromptProduct", "AdminCommand", "RequestSync",
	-- server -> client (state + feedback)
	"Sync", "PlotDelta", "Toast", "Announce", "Currency", "Boosts", "Quests",
	"PetsUpdate", "InventoryUpdate", "StealAlarm", "StealProgress", "StealResult",
	"EventStarted", "EventEnded", "HatchResult", "MutationRoll", "RebirthResult",
	"TradeUpdate", "DailyUpdate", "Leaderboard", "Vfx",
}

local FUNCTIONS = { "GetProfile", "GetPlotSnapshot", "GetLeaderboard", "GetPassState" }

local Net = {}
Net._handlers = {}
Net._limiter = nil

local folder: Folder
local eventObj: { [string]: RemoteEvent } = {}
local funcObj: { [string]: RemoteFunction } = {}

local function build()
	if IS_SERVER then
		folder = ReplicatedStorage:FindFirstChild("Net") :: Folder
		if not folder then
			folder = Instance.new("Folder")
			folder.Name = "Net"
			folder.Parent = ReplicatedStorage
		end
		for _, name in EVENTS do
			local r = folder:FindFirstChild(name) :: RemoteEvent
			if not r then
				r = Instance.new("RemoteEvent")
				r.Name = name
				r.Parent = folder
			end
			eventObj[name] = r
		end
		for _, name in FUNCTIONS do
			local r = folder:FindFirstChild(name) :: RemoteFunction
			if not r then
				r = Instance.new("RemoteFunction")
				r.Name = name
				r.Parent = folder
			end
			funcObj[name] = r
		end
	else
		folder = ReplicatedStorage:WaitForChild("Net", 30) :: Folder
		assert(folder, "[Net] server never created the Net folder")
	end
end

build()

local function getEvent(name: string): RemoteEvent
	local r = eventObj[name]
	if not r then
		r = folder:WaitForChild(name, 15) :: RemoteEvent
		assert(r, ("[Net] unknown remote event %q"):format(name))
		eventObj[name] = r
	end
	return r
end

local function getFunction(name: string): RemoteFunction
	local r = funcObj[name]
	if not r then
		r = folder:WaitForChild(name, 15) :: RemoteFunction
		assert(r, ("[Net] unknown remote function %q"):format(name))
		funcObj[name] = r
	end
	return r
end

--- Server: attach the rate limiter (injected to avoid a require cycle).
function Net:setLimiter(limiter)
	self._limiter = limiter
end

--- Server: handle a client action.
function Net:on(name: string, fn: (Player, ...any) -> ())
	assert(IS_SERVER, "Net:on is server-only")
	getEvent(name).OnServerEvent:Connect(function(player, ...)
		if self._limiter and not self._limiter:allow(player, name) then
			return
		end
		local ok, err = pcall(fn, player, ...)
		if not ok then
			warn(("[Net] handler %s failed for %s: %s"):format(name, player.Name, tostring(err)))
		end
	end)
end

--- Server: answer a client request.
function Net:handle(name: string, fn: (Player, ...any) -> any)
	assert(IS_SERVER, "Net:handle is server-only")
	getFunction(name).OnServerInvoke = function(player, ...)
		if self._limiter and not self._limiter:allow(player, name) then
			return nil
		end
		local ok, res = pcall(fn, player, ...)
		if not ok then
			warn(("[Net] request %s failed for %s: %s"):format(name, player.Name, tostring(res)))
			return nil
		end
		return res
	end
end

--- Server -> one client.
function Net:fire(player: Player, name: string, ...)
	assert(IS_SERVER, "Net:fire is server-only")
	getEvent(name):FireClient(player, ...)
end

--- Server -> every client.
function Net:fireAll(name: string, ...)
	assert(IS_SERVER, "Net:fireAll is server-only")
	getEvent(name):FireAllClients(...)
end

--- Server -> every client except one.
function Net:fireExcept(exclude: Player, name: string, ...)
	assert(IS_SERVER, "Net:fireExcept is server-only")
	for _, p in game:GetService("Players"):GetPlayers() do
		if p ~= exclude then
			getEvent(name):FireClient(p, ...)
		end
	end
end

--- Client -> server.
function Net:send(name: string, ...)
	assert(not IS_SERVER, "Net:send is client-only")
	getEvent(name):FireServer(...)
end

--- Client: subscribe to a server message.
function Net:listen(name: string, fn: (...any) -> ())
	assert(not IS_SERVER, "Net:listen is client-only")
	return getEvent(name).OnClientEvent:Connect(function(...)
		local ok, err = pcall(fn, ...)
		if not ok then
			warn(("[Net] listener %s failed: %s"):format(name, tostring(err)))
		end
	end)
end

--- Client: blocking request with a timeout so the UI can never hard-lock.
function Net:request(name: string, ...): any
	assert(not IS_SERVER, "Net:request is client-only")
	local args = table.pack(...)
	local done, result = false, nil
	task.spawn(function()
		local ok, res = pcall(function()
			return getFunction(name):InvokeServer(table.unpack(args, 1, args.n))
		end)
		done, result = true, ok and res or nil
	end)
	local t = 0
	while not done and t < 12 do
		t += task.wait()
	end
	return result
end

Net.events = EVENTS
Net.functions = FUNCTIONS

return Net
