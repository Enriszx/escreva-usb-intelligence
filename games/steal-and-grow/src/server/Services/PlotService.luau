--!nonstrict
-- Owns the world, plot assignment and tile replication.
--
-- Replication model: the server holds plot state as plain tables and pushes
-- deltas. Plants are NEVER instances on the server, and never replicated as
-- instances — the client builds the visuals from the data (client/PlotRenderer).
-- A 12-plot server with 48 tiles each is ~576 small tables instead of ~3000
-- parts replicated to every client, which is the difference between 60 FPS and
-- 12 FPS on a budget Android phone.

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Layout = require(Shared.Layout)
local Economy = require(Shared.Economy)
local Net = require(Shared.Util.Net)
local Signal = require(Shared.Util.Signal)
local Store = require(script.Parent.Parent.Data.Store)
local Build = require(script.Parent.Parent.World.Build)

local Balance = Config.Balance
local Ranks = Config.Ranks

-- how long a plot stays reserved (and stealable) after the owner leaves, so
-- disconnecting is never a way to protect a ripe farm
local HOLD_SECONDS = 120

local PlotService = { name = "PlotService", priority = 3 }
PlotService.onTileChanged = Signal.new()

local app
local plots = {} :: {
	[number]: {
		id: number,
		owner: number?,
		ownerName: string?,
		online: boolean,
		heldUntil: number?,
		model: Model?,
	}
}
local byUser = {} :: { [number]: number }

function PlotService:init(a)
	app = a
end

-- World ------------------------------------------------------------------

local function buildWorld()
	-- clear anything shipped in the place file so the generated world is the
	-- single source of truth
	local existing = workspace:FindFirstChild("World")
	if existing then
		existing:Destroy()
	end
	for _, obj in workspace:GetChildren() do
		if obj:IsA("SpawnLocation") then
			obj:Destroy()
		end
	end

	local world = Build.all()
	local plotFolder = world:FindFirstChild("Plots")
	for i = 1, Balance.plotCount do
		plots[i] = {
			id = i,
			owner = nil,
			ownerName = nil,
			online = false,
			model = plotFolder and plotFolder:FindFirstChild("Plot" .. i) or nil,
		}
	end
end

-- Assignment -------------------------------------------------------------

local function updatePlotSign(plotId: number)
	local plot = plots[plotId]
	if not plot or not plot.model then
		return
	end
	local anchor = plot.model:FindFirstChild("SignAnchor", true)
	local bb = anchor and anchor:FindFirstChildWhichIsA("BillboardGui")
	if not bb then
		return
	end
	local frame = bb:FindFirstChildWhichIsA("Frame")
	if not frame then
		return
	end
	local title = frame:FindFirstChildWhichIsA("TextLabel")
	if not plot.owner then
		if title then
			title.Text = "FAZENDA LIVRE"
			title.TextColor3 = Config.Theme.textDim
		end
	else
		local profile = Store.get(plot.owner)
		local rank = Ranks:for_(profile and profile.rebirths or 0)
		if title then
			title.Text = rank.icon .. " " .. (plot.ownerName or "?")
			title.TextColor3 = rank.colour
		end
		for _, child in frame:GetChildren() do
			if child:IsA("TextLabel") and child ~= title then
				child.Text = plot.online and (rank.name .. " • Renascimentos: " .. (profile and profile.rebirths or 0))
					or "⚠ Fazenda desprotegida — dono saiu"
				child.TextColor3 = plot.online and Config.Theme.textDim or Config.Theme.warn
			end
		end
	end
	-- the model attribute is what the client renderer watches
	plot.model:SetAttribute("Owner", plot.owner or 0)
	plot.model:SetAttribute("OwnerName", plot.ownerName or "")
	plot.model:SetAttribute("Online", plot.online)
end

function PlotService:assign(player: Player): number?
	local uid = player.UserId
	-- re-claim a held plot first so a rejoin feels seamless
	for id, plot in plots do
		if plot.owner == uid then
			plot.online = true
			plot.heldUntil = nil
			byUser[uid] = id
			updatePlotSign(id)
			self:broadcast(id)
			return id
		end
	end
	for id = 1, Balance.plotCount do
		local plot = plots[id]
		if plot and not plot.owner then
			plot.owner = uid
			plot.ownerName = player.DisplayName
			plot.online = true
			plot.heldUntil = nil
			byUser[uid] = id
			updatePlotSign(id)
			self:rebuildTiles(player)
			self:broadcast(id)
			return id
		end
	end
	return nil
end

function PlotService:release(player: Player)
	local id = byUser[player.UserId]
	if not id then
		return
	end
	local plot = plots[id]
	if plot then
		plot.online = false
		plot.heldUntil = os.time() + HOLD_SECONDS
		updatePlotSign(id)
		self:broadcast(id)
	end
end

function PlotService:plotIdOf(player: Player): number?
	return byUser[player.UserId]
end

function PlotService:plot(plotId: number)
	return plots[plotId]
end

function PlotService:ownerOf(plotId: number): Player?
	local plot = plots[plotId]
	if not plot or not plot.owner then
		return nil
	end
	return Players:GetPlayerByUserId(plot.owner)
end

function PlotService:allPlots()
	return plots
end

-- Tiles ------------------------------------------------------------------

--- How many tiles this player currently has unlocked (upgrades + passes).
function PlotService:tileCount(player: Player): number
	local profile = Store.get(player.UserId)
	if not profile then
		return Balance.startTiles
	end
	local m = app.PlayerService:multipliers(player)
	-- profile.tileCount tracks product-purchased tiles; multipliers cover
	-- upgrades and passes. The effective count is the larger of the two paths.
	return math.clamp(math.max(profile.tileCount, m.tiles), 1, Balance.maxTiles)
end

--- Push unlocked-tile visuals. Locked pads get a flat dark look client-side,
--- driven by this single attribute rather than per-pad replication.
function PlotService:rebuildTiles(player: Player)
	local id = byUser[player.UserId]
	if not id then
		return
	end
	local plot = plots[id]
	if not plot or not plot.model then
		return
	end
	local count = self:tileCount(player)
	plot.model:SetAttribute("TileCount", count)
	self:broadcast(id)
end

function PlotService:snapshot(plotId: number)
	local plot = plots[plotId]
	if not plot then
		return nil
	end
	if not plot.owner then
		return { owner = 0, plotId = plotId, tiles = {}, tileCount = 0, online = false }
	end
	local profile = Store.get(plot.owner)
	local owner = Players:GetPlayerByUserId(plot.owner)
	local defense, shielded, tileCount = 0, false, Balance.startTiles
	if owner then
		local m = app.PlayerService:multipliers(owner)
		defense = m.defense
		shielded = defense >= 0.5
		tileCount = self:tileCount(owner)
	end
	local protectedUntil = nil
	if profile and profile.firstJoin and os.time() - profile.firstJoin < Balance.stealProtectionAfterJoin then
		protectedUntil = profile.firstJoin + Balance.stealProtectionAfterJoin
	end
	return {
		plotId = plotId,
		owner = plot.owner,
		ownerName = plot.ownerName,
		online = plot.online,
		heldUntil = plot.heldUntil,
		tileCount = tileCount,
		tiles = profile and profile.tiles or {},
		defense = defense,
		shielded = shielded,
		protectedUntil = protectedUntil,
		rebirths = profile and profile.rebirths or 0,
		rank = Ranks:for_(profile and profile.rebirths or 0).name,
	}
end

--- Replicate one tile to everyone. This is the hot path: a single small table.
function PlotService:pushTile(plotId: number, tileIndex: number)
	local plot = plots[plotId]
	if not plot or not plot.owner then
		return
	end
	local profile = Store.get(plot.owner)
	Net:fireAll("PlotDelta", {
		plotId = plotId,
		tile = tileIndex,
		plant = profile and profile.tiles[tileIndex] or nil,
	})
	self.onTileChanged:Fire(plotId, tileIndex)
end

--- Replicate a whole plot (ownership change, rebirth, tile count change).
function PlotService:broadcast(plotId: number)
	local snap = self:snapshot(plotId)
	if snap then
		Net:fireAll("PlotDelta", { plotId = plotId, full = snap })
	end
end

function PlotService:broadcastTo(player: Player)
	for id in plots do
		local snap = self:snapshot(id)
		if snap then
			Net:fire(player, "PlotDelta", { plotId = id, full = snap })
		end
	end
end

-- Teleports --------------------------------------------------------------

local function teleport(player: Player, cf: CFrame)
	local char = player.Character
	if not char then
		return false
	end
	local root = char:FindFirstChild("HumanoidRootPart")
	if not root then
		return false
	end
	char:PivotTo(cf)
	return true
end

function PlotService:sendHome(player: Player)
	local id = byUser[player.UserId]
	if id then
		teleport(player, Layout.plotSpawn(id))
	else
		teleport(player, Layout.spawnCFrame())
	end
end

-- Lifecycle --------------------------------------------------------------

function PlotService:start()
	buildWorld()

	app.PlayerService.onProfileReady:Connect(function(player, profile)
		local id = self:assign(player)
		if not id then
			Net:fire(player, "Toast", {
				kind = "error",
				title = "Servidor cheio de fazendas",
				body = "Todas as 12 fazendas estão ocupadas. Troque de servidor para pegar a sua!",
				duration = 10,
			})
		end
		-- clamp any tile data beyond the current unlock (e.g. a pass expired)
		local count = self:tileCount(player)
		for index in profile.tiles do
			if index > count then
				profile.tiles[index] = nil
			end
		end
		self:rebuildTiles(player)
		task.defer(function()
			self:broadcastTo(player)
			app.PlayerService:sync(player)
			self:sendHome(player)
		end)
	end)

	Players.PlayerRemoving:Connect(function(player)
		self:release(player)
	end)

	-- expire holds: once the grace period passes, the plot is free for the
	-- next joiner and the absent farm is no longer stealable
	task.spawn(function()
		while true do
			task.wait(10)
			local now = os.time()
			for id, plot in plots do
				if plot.owner and not plot.online and plot.heldUntil and now >= plot.heldUntil then
					byUser[plot.owner] = nil
					plot.owner = nil
					plot.ownerName = nil
					plot.heldUntil = nil
					if plot.model then
						plot.model:SetAttribute("TileCount", 0)
					end
					updatePlotSign(id)
					self:broadcast(id)
				end
			end
		end
	end)

	Net:handle("GetPlotSnapshot", function(_, plotId)
		if type(plotId) ~= "number" then
			return nil
		end
		return self:snapshot(math.floor(plotId))
	end)

	Net:on("GoHome", function(player)
		self:sendHome(player)
	end)

	Net:on("VisitPlot", function(player, plotId)
		if type(plotId) ~= "number" then
			return
		end
		plotId = math.floor(plotId)
		local plot = plots[plotId]
		if not plot or not plot.owner then
			Net:fire(player, "Toast", { kind = "info", title = "Esta fazenda está vazia." })
			return
		end
		teleport(player, Layout.plotSpawn(plotId))
		local profile = Store.get(player.UserId)
		if profile and plot.owner ~= player.UserId then
			profile.stats.visits += 1
			app.QuestService:progress(player, "visit", 1)
		end
	end)
end

return PlotService
