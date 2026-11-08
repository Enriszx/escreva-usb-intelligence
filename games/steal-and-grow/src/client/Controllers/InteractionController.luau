--!nonstrict
-- World interaction: one unified "tap the thing in front of you" system for
-- touch, mouse and gamepad.
--
-- Mobile-first decisions:
--  * No ProximityPrompt. They are fine for 3 objects, but with 576 tiles they
--    cost real frame time and the UI is not themeable. Instead: a single
--    contextual action button at the bottom of the screen that always shows
--    the best nearby action, plus direct tapping for precision.
--  * The action button is the primary input on a phone (thumb-reachable,
--    58px tall). Tapping a tile directly is the secondary, for players who
--    want to target a specific plant.
--  * Raycasts happen only on input, never per frame. The "best nearby action"
--    is computed at 6 Hz from distances, which is free.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local ContextActionService = game:GetService("ContextActionService")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Layout = require(Shared.Layout)
local Economy = require(Shared.Economy)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local Signal = require(Shared.Util.Signal)
local State = require(script.Parent.Parent.State)

local Balance = Config.Balance
local Seeds = Config.Seeds
local Mutations = Config.Mutations

local InteractionController = { name = "InteractionController" }
InteractionController.onContextChanged = Signal.new()
InteractionController.onStationEntered = Signal.new()

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local context = nil -- { kind, label, icon, run }
local app

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude

function InteractionController:init(a)
	app = a
end

local function rootPosition(): Vector3?
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	return root and root.Position or nil
end

-- Actions ----------------------------------------------------------------

--- What happens when you act on one of your own tiles.
local function ownTileAction(tileIndex: number)
	local plant = State.tiles[tileIndex]
	if plant then
		if Economy.isRipe(plant, State.now()) then
			return {
				kind = "harvest",
				icon = "🧺",
				label = "Colher",
				detail = ("%s — 💰 %s"):format(
					(Mutations.label(plant.element, plant.aura) ~= "" and Mutations.label(plant.element, plant.aura) .. " " or "")
						.. (Seeds.byId[plant.seed] and Seeds.byId[plant.seed].name or plant.seed),
					Format.short(Economy.plantValue(plant, State.mult and State.mult.coin or 1, State.now()))
				),
				run = function()
					Net:send("Harvest", tileIndex)
				end,
			}
		end
		return {
			kind = "wait",
			icon = "⏳",
			label = "Crescendo",
			detail = Format.clock(Economy.secondsLeft(plant, State.now())),
			run = nil,
		}
	end
	if tileIndex > State.tileCount then
		return {
			kind = "locked",
			icon = "🔒",
			label = "Canteiro bloqueado",
			detail = "Compre em Melhorias",
			run = function()
				app.PanelController:open("upgrades")
			end,
		}
	end
	return {
		kind = "plant",
		icon = "🌱",
		label = "Plantar",
		detail = "Escolher semente",
		run = function()
			app.PanelController:openPlanting(tileIndex)
		end,
	}
end

--- What happens when you act on someone else's tile.
local function foreignTileAction(plotId: number, tileIndex: number)
	local snap = State.plots[plotId]
	if not snap or not snap.tiles then
		return nil
	end
	local plant = snap.tiles[tileIndex]
	if not plant or not plant.element then
		return nil
	end
	if plant.stolen then
		return { kind = "busy", icon = "⚠️", label = "Já está sendo roubada", run = nil }
	end
	if snap.protectedUntil and State.now() < snap.protectedUntil then
		return {
			kind = "protected",
			icon = "🕊️",
			label = "Jogador novo protegido",
			detail = Format.clock(snap.protectedUntil - State.now()),
			run = nil,
		}
	end

	local mult = State.mult
	local stealTime = Economy.stealTime(plant, mult and mult.stealSpeed or 1, snap.defense or 0)
	local value = math.floor(Economy.plantValue(plant, mult and mult.coin or 1, State.now()) * Balance.stealValueCut)
	local label = Mutations.label(plant.element, plant.aura)
	return {
		kind = "steal",
		icon = "🥷",
		label = "ROUBAR",
		detail = ("%s • %ss • 💰 %s%s"):format(
			(label ~= "" and label .. " " or "") .. (Seeds.byId[plant.seed] and Seeds.byId[plant.seed].name or plant.seed),
			string.format("%.1f", stealTime),
			Format.short(value),
			(snap.shielded and "  🛡️" or "")
		),
		danger = true,
		run = function()
			Net:send("StealStart", plotId, tileIndex)
		end,
	}
end

local function stationAction(part: BasePart)
	local station = part:GetAttribute("Station")
	if not station then
		return nil
	end
	local labels = {
		seedShop = { icon = "🌱", label = "Abrir Loja de Sementes", panel = "shop" },
		market = { icon = "💰", label = "Vender Colheita", panel = "inventory" },
		petShop = { icon = "🥚", label = "Ovos e Pets", panel = "pets" },
		upgrades = { icon = "⚒️", label = "Melhorias", panel = "upgrades" },
		rebirth = { icon = "♻️", label = "Renascer", panel = "rebirth" },
		passShop = { icon = "👑", label = "Loja VIP", panel = "shopvip" },
		leaderboard = { icon = "🏆", label = "Ranking", panel = "leaderboard" },
		eventAltar = { icon = "🌀", label = "Eventos", panel = "events" },
	}
	local info = labels[station]
	if not info then
		return nil
	end
	return {
		kind = "station",
		icon = info.icon,
		label = info.label,
		run = function()
			app.PanelController:open(info.panel)
		end,
	}
end

-- Context resolution -----------------------------------------------------

--- Find the single best action near the player. Pure distance maths.
function InteractionController:resolveContext()
	local pos = rootPosition()
	if not pos then
		return nil
	end

	-- stations win when you are standing in one
	local world = workspace:FindFirstChild("World")
	local hub = world and world:FindFirstChild("Hub")
	if hub then
		local best, bestDist = nil, math.huge
		for _, model in hub:GetChildren() do
			local interact = model:IsA("Model") and model:FindFirstChild("Interact")
			if interact then
				local d = (interact.Position - pos).Magnitude
				if d < 13 and d < bestDist then
					best, bestDist = interact, d
				end
			end
		end
		if best then
			return stationAction(best)
		end
	end

	-- otherwise, the nearest actionable tile
	local myPlot = State.plotId
	local best, bestDist, bestPlot, bestTile = nil, math.huge, nil, nil
	for plotId, snap in State.plots do
		if snap and snap.owner and snap.owner ~= 0 then
			local plotPos = Layout.plotOrigin(plotId).Position
			if (plotPos - pos).Magnitude < Balance.plotSize then
				local limit = snap.tileCount or 0
				for tileIndex = 1, math.max(limit, 1) do
					local tilePos = Layout.tileWorldPosition(plotId, tileIndex)
					local d = (tilePos - pos).Magnitude
					if d < 11 and d < bestDist then
						best, bestDist, bestPlot, bestTile = snap, d, plotId, tileIndex
					end
				end
			end
		end
	end

	if bestPlot and bestTile then
		if bestPlot == myPlot then
			return ownTileAction(bestTile)
		end
		return foreignTileAction(bestPlot, bestTile)
	end
	return nil
end

function InteractionController:context()
	return context
end

function InteractionController:act()
	if context and context.run then
		context.run()
	end
end

-- Direct tapping ---------------------------------------------------------

local function pickAt(screenPos: Vector2)
	if not camera then
		return
	end
	local char = player.Character
	rayParams.FilterDescendantsInstances = { char, workspace:FindFirstChild("PlantVisuals") }
	local ray = camera:ViewportPointToRay(screenPos.X, screenPos.Y)
	local result = workspace:Raycast(ray.Origin, ray.Direction * 420, rayParams)
	if not result or not result.Instance then
		return
	end

	local hit = result.Instance
	-- tile?
	local tileIndex = hit:GetAttribute("TileIndex") or (hit.Parent and hit.Parent:GetAttribute("TileIndex"))
	local plotId = hit:GetAttribute("PlotId") or (hit.Parent and hit.Parent:GetAttribute("PlotId"))
	if tileIndex and plotId then
		local pos = rootPosition()
		local tilePos = Layout.tileWorldPosition(plotId, tileIndex)
		if pos and (pos - tilePos).Magnitude > Balance.stealRange + 6 then
			-- too far: walk there instead of silently failing
			app.FeedbackController:toast({ kind = "info", title = "Chegue mais perto desse canteiro" })
			return
		end
		local action = if plotId == State.plotId then ownTileAction(tileIndex) else foreignTileAction(plotId, tileIndex)
		if action and action.run then
			action.run()
		end
		return
	end

	-- station?
	local stationPart = hit:GetAttribute("Station") and hit or hit.Parent and hit.Parent:FindFirstChild("Interact")
	if stationPart then
		local action = stationAction(stationPart)
		if action and action.run then
			action.run()
		end
		return
	end

	-- claim pad / another player's plot sign -> teleport there
	local pad = hit:HasTag("ClaimPad") and hit or nil
	if pad then
		local id = pad:GetAttribute("PlotId")
		if id then
			Net:send("VisitPlot", id)
		end
	end
end

function InteractionController:start()
	camera = workspace.CurrentCamera
	workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(function()
		camera = workspace.CurrentCamera
	end)

	-- context refresh at 6 Hz
	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		if acc < 1 / 6 then
			return
		end
		acc = 0
		local next_ = self:resolveContext()
		local changed = (next_ == nil) ~= (context == nil)
			or (next_ and context and (next_.kind ~= context.kind or next_.label ~= context.label or next_.detail ~= context.detail))
		context = next_
		if changed then
			self.onContextChanged:Fire(context)
		end
	end)

	-- tap / click to target
	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
			pickAt(Vector2.new(input.Position.X, input.Position.Y))
		end
	end)

	-- keyboard/gamepad: E and ButtonX run the contextual action
	ContextActionService:BindAction("SAG_Act", function(_, inputState)
		if inputState == Enum.UserInputState.Begin then
			self:act()
		end
		return Enum.ContextActionResult.Sink
	end, false, Enum.KeyCode.E, Enum.KeyCode.ButtonX)

	-- quick keys for the panels, desktop convenience
	local shortcuts = {
		[Enum.KeyCode.One] = "shop",
		[Enum.KeyCode.Two] = "inventory",
		[Enum.KeyCode.Three] = "pets",
		[Enum.KeyCode.Four] = "upgrades",
		[Enum.KeyCode.Five] = "quests",
		[Enum.KeyCode.Six] = "shopvip",
		[Enum.KeyCode.Seven] = "index",
		[Enum.KeyCode.Eight] = "leaderboard",
	}
	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		local panel = shortcuts[input.KeyCode]
		if panel then
			app.PanelController:toggle(panel)
		elseif input.KeyCode == Enum.KeyCode.H then
			Net:send("GoHome")
		elseif input.KeyCode == Enum.KeyCode.Q then
			Net:send("HarvestAll")
		end
	end)
end

return InteractionController
