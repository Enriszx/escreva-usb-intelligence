--!nonstrict
-- Builds every plant you see, client-side, from replicated data.
--
-- Why this is the most important file for mobile performance:
--   * Plants are never replicated as instances. The server sends 5 numbers per
--     plant; the client decides how much geometry to spend on it.
--   * Three LOD levels. Far away or on a weak device a plant is 1 part. Close
--     up on a good device it is a stem, leaves, N fruits and an aura.
--   * Everything is pooled. Walking past 12 farms creates and destroys zero
--     instances after the first pass.
--   * Growth animation is driven by one Heartbeat that only touches plants
--     inside the camera's view and within the tier's visible-plant budget,
--     sorted by distance. 500 plants in the world costs the same as 90 if the
--     tier says 90.

local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Layout = require(Shared.Layout)
local Economy = require(Shared.Economy)
local Format = require(Shared.Util.Format)
local Pool = require(Shared.Util.Pool)
local State = require(script.Parent.Parent.State)
local Graphics = require(script.Parent.GraphicsController)

local Balance = Config.Balance
local Seeds = Config.Seeds
local Mutations = Config.Mutations
local Theme = Config.Theme

local PlotRenderer = { name = "PlotRenderer" }

local container: Folder
local rendered = {} :: { [string]: any } -- "plotId:tile" -> record
local partPool, labelPool

local function key(plotId: number, tileIndex: number): string
	return plotId .. ":" .. tileIndex
end

-- Pools ------------------------------------------------------------------

local function makePart(): BasePart
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.CastShadow = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	return p
end

local function resetPart(p: BasePart)
	p.Transparency = 0
	p.Reflectance = 0
	p.Color = Color3.new(1, 1, 1)
	p.Shape = Enum.PartType.Block
	p.Material = Enum.Material.SmoothPlastic
	p.Size = Vector3.one
	for _, child in p:GetChildren() do
		child:Destroy()
	end
end

local function makeLabel(): BillboardGui
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromScale(7, 2.1)
	bb.AlwaysOnTop = false
	bb.LightInfluence = 0
	bb.MaxDistance = 140
	bb.StudsOffsetWorldSpace = Vector3.new(0, 4.4, 0)

	local frame = Instance.new("Frame")
	frame.Name = "Box"
	frame.Size = UDim2.fromScale(1, 1)
	frame.BackgroundColor3 = Theme.panel
	frame.BackgroundTransparency = 0.18
	frame.BorderSizePixel = 0
	frame.Parent = bb
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 10)
	corner.Parent = frame
	local stroke = Instance.new("UIStroke")
	stroke.Name = "Edge"
	stroke.Color = Theme.primary
	stroke.Thickness = 2
	stroke.Parent = frame

	local top = Instance.new("TextLabel")
	top.Name = "Top"
	top.BackgroundTransparency = 1
	top.Size = UDim2.new(1, -8, 0.56, 0)
	top.Position = UDim2.fromOffset(4, 1)
	top.Font = Theme.fontBlack
	top.TextScaled = true
	top.TextColor3 = Theme.text
	top.Parent = frame
	local c1 = Instance.new("UITextSizeConstraint")
	c1.MaxTextSize = 26
	c1.Parent = top

	local bottom = Instance.new("TextLabel")
	bottom.Name = "Bottom"
	bottom.BackgroundTransparency = 1
	bottom.Size = UDim2.new(1, -8, 0.42, 0)
	bottom.Position = UDim2.new(0, 4, 0.56, 0)
	bottom.Font = Theme.fontBody
	bottom.TextScaled = true
	bottom.TextColor3 = Theme.textDim
	bottom.Parent = frame
	local c2 = Instance.new("UITextSizeConstraint")
	c2.MaxTextSize = 18
	c2.Parent = bottom

	return bb
end

-- Model construction -----------------------------------------------------

--- Build a plant at a given LOD. detail: 1 = single blob, 2 = stem+fruits,
--- 3 = stem+leaves+fruits+aura.
local function buildPlant(seed, plant, detail: number, cf: CFrame)
	local model = Instance.new("Model")
	model.Name = "Plant"

	local mutMult = Mutations.multiplier(plant.element, plant.aura)
	local element = plant.element and Mutations.byId[plant.element]
	local aura = plant.aura and Mutations.byId[plant.aura]
	local tint = (aura and aura.mult > 1 and aura.colour) or (element and element.mult > 1 and element.colour) or nil

	local scale = (plant.size or 1) * seed.scale
	local fruitColour = tint and seed.fruit:Lerp(tint, 0.55) or seed.fruit
	local material = seed.material or Enum.Material.SmoothPlastic

	if detail == 1 then
		-- single blob: still reads as "a plant of that colour" from 60 studs
		local blob = partPool:get()
		blob.Shape = Enum.PartType.Ball
		blob.Size = Vector3.one * (2.2 * scale)
		blob.Color = fruitColour
		blob.Material = (seed.emissive or 0) > 0.5 and Enum.Material.Neon or material
		blob.CFrame = cf * CFrame.new(0, 1.4 * scale, 0)
		blob.Parent = model
		return model, { blob }
	end

	local parts = {}

	-- stem
	local stem = partPool:get()
	stem.Size = Vector3.new(0.38, 2.4 * scale, 0.38)
	stem.Color = seed.stem
	stem.Material = Enum.Material.Grass
	stem.CFrame = cf * CFrame.new(0, 1.2 * scale, 0)
	stem.Parent = model
	table.insert(parts, stem)

	-- leaves (detail 3 only)
	if detail >= 3 then
		for i = 1, 3 do
			local angle = (i / 3) * math.pi * 2
			local leaf = partPool:get()
			leaf.Size = Vector3.new(1.5 * scale, 0.14, 0.7 * scale)
			leaf.Color = seed.stem
			leaf.Material = Enum.Material.Grass
			leaf.CFrame = cf
				* CFrame.new(math.cos(angle) * 0.75 * scale, 0.75 * scale, math.sin(angle) * 0.75 * scale)
				* CFrame.Angles(0, -angle, math.rad(18))
			leaf.Parent = model
			table.insert(parts, leaf)
		end
	end

	-- fruits
	local count = detail >= 3 and seed.fruitCount or math.min(seed.fruitCount, 2)
	for i = 1, count do
		local fruit = partPool:get()
		local shape = seed.shape
		if shape == "Ball" then
			fruit.Shape = Enum.PartType.Ball
			fruit.Size = Vector3.one * (1.5 * scale)
		elseif shape == "Cylinder" then
			fruit.Shape = Enum.PartType.Cylinder
			fruit.Size = Vector3.new(2.1 * scale, 1.1 * scale, 1.1 * scale)
		elseif shape == "Cone" then
			fruit.Shape = Enum.PartType.Ball
			fruit.Size = Vector3.new(1.1 * scale, 2.2 * scale, 1.1 * scale)
		else
			fruit.Size = Vector3.one * (1.4 * scale)
		end
		fruit.Color = fruitColour
		fruit.Material = material
		if (seed.emissive or 0) > 0 then
			fruit.Material = Enum.Material.Neon
			fruit.Transparency = 1 - math.clamp(seed.emissive, 0.3, 1)
		end
		if tint then
			fruit.Reflectance = 0.18
		end

		local angle = count > 1 and (i / count) * math.pi * 2 or 0
		local radius = count > 1 and 0.85 * scale or 0
		local height = (2.2 + (i % 2) * 0.45) * scale
		fruit.CFrame = cf
			* CFrame.new(math.cos(angle) * radius, height, math.sin(angle) * radius)
			* CFrame.Angles(0, angle, shape == "Cylinder" and math.rad(90) or 0)
		fruit.Parent = model
		table.insert(parts, fruit)
	end

	-- aura: the mutation payoff. Only at detail 3 and only when the tier
	-- allows particles, because this is the single most expensive piece.
	if detail >= 3 and tint and Graphics.tier.particles and mutMult > 1 then
		local glow = partPool:get()
		glow.Shape = Enum.PartType.Ball
		glow.Size = Vector3.one * (4.2 * scale)
		glow.Color = tint
		glow.Material = Enum.Material.Neon
		glow.Transparency = 0.86
		glow.CFrame = cf * CFrame.new(0, 2.1 * scale, 0)
		glow.Parent = model
		table.insert(parts, glow)

		local light = Instance.new("PointLight")
		light.Color = tint
		light.Brightness = math.clamp(math.log(mutMult, 10) * 1.2, 0.4, 3)
		light.Range = math.clamp(6 + math.log(mutMult, 10) * 4, 8, 26)
		light.Shadows = false
		light.Parent = glow

		if mutMult >= 15 then
			local sparkles = Instance.new("ParticleEmitter")
			sparkles.Texture = "rbxasset://textures/particles/sparkles_main.dds"
			sparkles.Color = ColorSequence.new(tint)
			sparkles.Size = NumberSequence.new(0.35 * scale)
			sparkles.Lifetime = NumberRange.new(0.5, 1.1)
			sparkles.Rate = math.clamp(mutMult, 6, 40)
			sparkles.Speed = NumberRange.new(0.6, 1.8)
			sparkles.SpreadAngle = Vector2.new(180, 180)
			sparkles.LightEmission = 0.8
			sparkles.Parent = glow
		end
	end

	return model, parts
end

-- Record lifecycle -------------------------------------------------------

local function destroyRecord(record)
	if record.label then
		labelPool:release(record.label)
	end
	for _, p in record.parts or {} do
		partPool:release(p)
	end
	if record.model then
		record.model:Destroy()
	end
end

local function removeTile(plotId: number, tileIndex: number)
	local k = key(plotId, tileIndex)
	local record = rendered[k]
	if record then
		destroyRecord(record)
		rendered[k] = nil
	end
end

local function upsertTile(plotId: number, tileIndex: number, plant, detail: number)
	local k = key(plotId, tileIndex)
	local record = rendered[k]

	if not plant then
		removeTile(plotId, tileIndex)
		return
	end

	local seed = Seeds.byId[plant.seed]
	if not seed then
		return
	end

	-- rebuild when identity, mutation or detail level changed
	local signature = ("%s|%s|%s|%d|%s"):format(
		plant.seed,
		plant.element or "-",
		plant.aura or "-",
		detail,
		tostring(plant.stolen or false)
	)
	if record and record.signature == signature then
		return record
	end
	if record then
		destroyRecord(record)
	end

	local cf = Layout.tileCFrame(plotId, tileIndex)
	local model, parts = buildPlant(seed, plant, detail, cf)
	model.Parent = container

	local label = nil
	if detail >= 2 then
		label = labelPool:get()
		label.Adornee = parts[1]
		label.Parent = parts[1]
	end

	record = {
		signature = signature,
		model = model,
		parts = parts,
		label = label,
		plotId = plotId,
		tileIndex = tileIndex,
		plant = plant,
		seed = seed,
		basePos = cf.Position,
		detail = detail,
	}
	rendered[k] = record
	return record
end

-- Per-frame update -------------------------------------------------------

local function detailFor(distance: number, maxDetail: number): number
	if distance > 150 then
		return 1
	end
	if distance > 70 then
		return math.min(2, maxDetail)
	end
	return maxDetail
end

local function updateRecord(record, now: number, mult: number)
	local plant = record.plant
	local progress = Economy.progress(plant, now)
	local ripe = progress >= 1

	-- growth is a scale animation on the model's parts, computed from the
	-- stamps: no state, no tweens, resumes correctly after streaming back in
	local grow = ripe and 1 or (0.18 + progress * 0.82)
	local bob = ripe and math.sin(now * 2.2 + record.tileIndex) * 0.12 or 0

	if record.lastGrow == nil or math.abs(record.lastGrow - grow) > 0.01 or ripe then
		record.lastGrow = grow
		for _, p in record.parts do
			if not p.Parent then
				continue
			end
			local baseSize = p:GetAttribute("BaseSize")
			if not baseSize then
				baseSize = p.Size
				p:SetAttribute("BaseSize", baseSize)
			end
			local basePos = p:GetAttribute("BaseOffset")
			if not basePos then
				basePos = p.Position - record.basePos
				p:SetAttribute("BaseOffset", basePos)
			end
			p.Size = baseSize * grow
			p.Position = record.basePos + basePos * grow + Vector3.new(0, bob, 0)
		end
	end

	if record.label then
		local box = record.label:FindFirstChild("Box")
		local top = box and box:FindFirstChild("Top")
		local bottom = box and box:FindFirstChild("Bottom")
		local edge = box and box:FindFirstChild("Edge")
		if top and bottom then
			if ripe then
				local label = Mutations.label(plant.element, plant.aura)
				local value = Economy.plantValue(plant, mult, now)
				top.Text = (label ~= "" and (label .. " ") or "") .. record.seed.name
				top.TextColor3 = plant.giant and Theme.warn or Theme.text
				bottom.Text = plant.stolen and "⚠ SENDO ROUBADA!"
					or ("💰 " .. Format.short(value) .. (plant.giant and "  🔥 GIGANTE" or ""))
				bottom.TextColor3 = plant.stolen and Theme.danger or Theme.coins
				if edge then
					local m = Mutations.multiplier(plant.element, plant.aura)
					edge.Color = plant.stolen and Theme.danger
						or (m >= 15 and Theme.steal)
						or (m > 1 and Theme.coins)
						or Theme.primary
				end
			else
				top.Text = record.seed.name
				top.TextColor3 = Theme.textDim
				bottom.Text = "⏳ " .. Format.clock(Economy.secondsLeft(plant, now))
				bottom.TextColor3 = Theme.secondary
				if edge then
					edge.Color = Theme.stroke
				end
			end
		end
	end
end

function PlotRenderer:refresh()
	local camera = workspace.CurrentCamera
	if not camera then
		return
	end
	local tier = Graphics.tier
	local origin = camera.CFrame.Position
	local now = State.now()
	local mult = State.mult and State.mult.coin or 1

	-- gather candidate tiles with distances
	local candidates = {}
	for plotId, snap in State.plots do
		if snap and snap.tiles then
			local plotPos = Layout.plotOrigin(plotId).Position
			if (plotPos - origin).Magnitude <= tier.drawDistance + Balance.plotSize then
				for tileIndex, plant in snap.tiles do
					if plant then
						local pos = Layout.tileWorldPosition(plotId, tileIndex)
						local d = (pos - origin).Magnitude
						if d <= tier.drawDistance then
							table.insert(candidates, { plotId = plotId, tileIndex = tileIndex, plant = plant, d = d })
						end
					end
				end
			end
		end
	end

	table.sort(candidates, function(a, b)
		return a.d < b.d
	end)

	local budget = tier.maxVisiblePlants
	local keep = {}
	for i, c in candidates do
		if i > budget then
			break
		end
		local detail = detailFor(c.d, tier.maxPlantDetail)
		local record = upsertTile(c.plotId, c.tileIndex, c.plant, detail)
		if record then
			record.plant = c.plant
			updateRecord(record, now, mult)
			keep[key(c.plotId, c.tileIndex)] = true
		end
	end

	-- release anything no longer in budget/range
	for k, record in rendered do
		if not keep[k] then
			destroyRecord(record)
			rendered[k] = nil
		end
	end
end

function PlotRenderer:start()
	container = Instance.new("Folder")
	container.Name = "PlantVisuals"
	container.Parent = workspace

	partPool = Pool.new(makePart, resetPart, 900)
	labelPool = Pool.new(makeLabel, function(bb)
		bb.Adornee = nil
	end, 180)
	-- prewarm so the first farm you look at doesn't hitch
	partPool:prewarm(220)
	labelPool:prewarm(40)

	-- locked-tile visuals, driven by the plot model attribute
	local function paintTiles(plotModel: Model)
		local count = plotModel:GetAttribute("TileCount") or 0
		local tiles = plotModel:FindFirstChild("Tiles")
		if not tiles then
			return
		end
		for _, pad in tiles:GetChildren() do
			local index = pad:GetAttribute("TileIndex")
			if index then
				local unlocked = index <= count
				pad.Transparency = unlocked and 0 or 0.55
				pad.Color = unlocked and Color3.fromRGB(126, 92, 66) or Color3.fromRGB(60, 62, 70)
				local soil = pad:FindFirstChild("Soil")
				if soil then
					soil.Transparency = unlocked and 0 or 0.7
				end
			end
		end
	end

	local function hookPlots()
		local world = workspace:FindFirstChild("World")
		local plots = world and world:FindFirstChild("Plots")
		if not plots then
			return
		end
		for _, plotModel in plots:GetChildren() do
			paintTiles(plotModel)
			plotModel:GetAttributeChangedSignal("TileCount"):Connect(function()
				paintTiles(plotModel)
			end)
		end
	end

	task.spawn(function()
		local world = workspace:WaitForChild("World", 30)
		if world then
			world:WaitForChild("Plots", 15)
			task.wait(0.2)
			hookPlots()
		end
	end)

	-- the single driver. 15 Hz is plenty for growth visuals and leaves the
	-- render thread alone on a weak device.
	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		if acc < 1 / 15 then
			return
		end
		acc = 0
		local ok, err = pcall(function()
			self:refresh()
		end)
		if not ok then
			warn("[PlotRenderer] " .. tostring(err))
		end
	end)

	Graphics.onTierChanged:Connect(function()
		-- force a rebuild at the new detail level
		for k, record in rendered do
			destroyRecord(record)
			rendered[k] = nil
		end
	end)
end

function PlotRenderer:recordAt(plotId: number, tileIndex: number)
	return rendered[key(plotId, tileIndex)]
end

return PlotRenderer
