--!strict
-- Deterministic world geometry, shared by server and client.
--
-- This matters more than it looks: because every tile's world position is a
-- pure function of (plotId, tileIndex), the client can render plants locally
-- with no per-plant replication, and the server can still validate "were you
-- actually standing next to that tile?" without storing any instances.

local Config = require(script.Parent.Config)
local Balance = Config.Balance

local Layout = {}

Layout.hubCentre = Vector3.new(0, 0, 0)
Layout.hubRadius = 86
Layout.plotRingRadius = 300
Layout.plotY = 0

--- Plots sit on a ring around the hub, facing inward.
function Layout.plotOrigin(plotId: number): CFrame
	local count = Balance.plotCount
	local angle = (plotId - 1) / count * math.pi * 2
	local pos = Vector3.new(
		math.cos(angle) * Layout.plotRingRadius,
		Layout.plotY,
		math.sin(angle) * Layout.plotRingRadius
	)
	-- face the hub
	return CFrame.lookAt(pos, Vector3.new(0, Layout.plotY, 0))
end

--- Tile grid is laid out in plot-local space, centred, rows along local X.
function Layout.tileLocalOffset(tileIndex: number): Vector3
	local perRow = Balance.tilesPerRow
	local size = Balance.tileSize
	local i = tileIndex - 1
	local col = i % perRow
	local row = i // perRow
	local rows = math.ceil(Balance.maxTiles / perRow)
	local x = (col - (perRow - 1) / 2) * (size + 1.5)
	local z = (row - (rows - 1) / 2) * (size + 1.5)
	return Vector3.new(x, 0, z)
end

function Layout.tileWorldPosition(plotId: number, tileIndex: number): Vector3
	local origin = Layout.plotOrigin(plotId)
	return origin:PointToWorldSpace(Layout.tileLocalOffset(tileIndex))
end

function Layout.tileCFrame(plotId: number, tileIndex: number): CFrame
	local origin = Layout.plotOrigin(plotId)
	return origin * CFrame.new(Layout.tileLocalOffset(tileIndex))
end

--- Where a visiting player is dropped when they teleport to a plot.
function Layout.plotSpawn(plotId: number): CFrame
	local origin = Layout.plotOrigin(plotId)
	return origin * CFrame.new(0, 4, -Balance.plotSize / 2 + 6)
end

--- Hub landmarks, placed on a circle so adding one never requires re-measuring.
local HUB_SPOTS = {
	seedShop = 0,
	market = 1,
	petShop = 2,
	upgrades = 3,
	rebirth = 4,
	passShop = 5,
	leaderboard = 6,
	eventAltar = 7,
}
Layout.hubSpots = HUB_SPOTS

function Layout.hubSpot(name: string): CFrame
	local slot = HUB_SPOTS[name] or 0
	local total = 8
	local angle = slot / total * math.pi * 2 + math.pi / 8
	local pos = Vector3.new(
		math.cos(angle) * (Layout.hubRadius - 18),
		Layout.plotY,
		math.sin(angle) * (Layout.hubRadius - 18)
	)
	return CFrame.lookAt(pos, Vector3.new(0, Layout.plotY, 0))
end

function Layout.spawnCFrame(): CFrame
	return CFrame.new(0, Layout.plotY + 4, 0)
end

return Layout
