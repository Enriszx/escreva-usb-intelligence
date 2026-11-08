--!nonstrict
-- Procedural world construction.
--
-- Everything the player sees is built from primitives at runtime. That is a
-- deliberate choice, not a shortcut:
--   * zero asset downloads => the game is playable ~2s after joining on a
--     bad connection, which is most of the mobile audience
--   * no MeshPart streaming hitches on a 2GB Android device
--   * the entire art direction is a handful of colour constants, so a reskin
--     (seasonal event, new biome) is a config change
--
-- The look comes from lighting, saturated palettes, soft gradients and
-- silhouettes rather than polygon count.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Layout = require(Shared.Layout)

local Balance = Config.Balance
local Theme = Config.Theme

local Build = {}

local function col(r, g, b)
	return Color3.fromRGB(r, g, b)
end

local PALETTE = {
	grass = col(104, 191, 110),
	grassDark = col(72, 152, 84),
	dirt = col(126, 92, 66),
	dirtDark = col(96, 68, 48),
	stone = col(150, 160, 174),
	stoneDark = col(104, 114, 130),
	wood = col(158, 112, 74),
	woodDark = col(110, 76, 50),
	water = col(86, 180, 226),
	accent = col(96, 220, 140),
	gold = col(255, 205, 70),
	sand = col(232, 214, 168),
}

--- Shared helper: a part with sensible defaults for a static world.
local function part(props)
	local p = Instance.new(props.shape == "Ball" and "Part" or "Part")
	p.Anchored = true
	p.CanCollide = props.collide ~= false
	p.CanTouch = false
	p.CanQuery = props.query ~= false
	p.CastShadow = props.shadow ~= false
	p.Material = props.material or Enum.Material.SmoothPlastic
	p.Color = props.color or PALETTE.stone
	p.Size = props.size or Vector3.one
	p.CFrame = props.cframe or CFrame.new()
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if props.shape == "Ball" then
		p.Shape = Enum.PartType.Ball
	elseif props.shape == "Cylinder" then
		p.Shape = Enum.PartType.Cylinder
	end
	if props.transparency then
		p.Transparency = props.transparency
	end
	if props.reflectance then
		p.Reflectance = props.reflectance
	end
	if props.name then
		p.Name = props.name
	end
	p.Parent = props.parent
	return p
end

local function wedge(props)
	local p = Instance.new("WedgePart")
	p.Anchored = true
	p.CanCollide = props.collide ~= false
	p.CanTouch = false
	p.Material = props.material or Enum.Material.SmoothPlastic
	p.Color = props.color or PALETTE.stone
	p.Size = props.size or Vector3.one
	p.CFrame = props.cframe or CFrame.new()
	p.Parent = props.parent
	return p
end

--- A floating sign with crisp text. Billboards beat SurfaceGui on mobile
--- because they never force a texture re-render when the camera moves.
local function sign(parent: Instance, at: CFrame, title: string, subtitle: string?, tint: Color3?)
	local anchor = part({
		parent = parent,
		size = Vector3.new(1, 1, 1),
		cframe = at,
		transparency = 1,
		collide = false,
		query = false,
		shadow = false,
		name = "SignAnchor",
	})
	local bb = Instance.new("BillboardGui")
	bb.Name = "Sign"
	bb.Size = UDim2.fromScale(13, 4.4)
	bb.StudsOffsetWorldSpace = Vector3.new(0, 0, 0)
	bb.AlwaysOnTop = false
	bb.MaxDistance = 260
	bb.LightInfluence = 0
	bb.Parent = anchor

	local frame = Instance.new("Frame")
	frame.Size = UDim2.fromScale(1, 1)
	frame.BackgroundColor3 = Theme.panel
	frame.BackgroundTransparency = 0.12
	frame.BorderSizePixel = 0
	frame.Parent = bb
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 18)
	corner.Parent = frame
	local strokeObj = Instance.new("UIStroke")
	strokeObj.Color = tint or Theme.primary
	strokeObj.Thickness = 3
	strokeObj.Transparency = 0.1
	strokeObj.Parent = frame
	local grad = Instance.new("UIGradient")
	grad.Color = ColorSequence.new(Theme.panelAlt, Theme.panel)
	grad.Rotation = 90
	grad.Parent = frame

	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.new(1, -16, subtitle and 0.58 or 1, 0)
	label.Position = UDim2.fromOffset(8, 4)
	label.Font = Theme.fontBlack
	label.Text = title
	label.TextColor3 = tint or Theme.text
	label.TextScaled = true
	label.Parent = frame
	local c1 = Instance.new("UITextSizeConstraint")
	c1.MaxTextSize = 44
	c1.Parent = label

	if subtitle then
		local sub = Instance.new("TextLabel")
		sub.BackgroundTransparency = 1
		sub.Size = UDim2.new(1, -16, 0.36, 0)
		sub.Position = UDim2.new(0, 8, 0.58, 0)
		sub.Font = Theme.fontBody
		sub.Text = subtitle
		sub.TextColor3 = Theme.textDim
		sub.TextScaled = true
		sub.Parent = frame
		local c2 = Instance.new("UITextSizeConstraint")
		c2.MaxTextSize = 24
		c2.Parent = sub
	end
	return anchor
end

Build.sign = sign
Build.part = part
Build.palette = PALETTE

--- A hub building: a chunky pedestal, a canopy, a glowing core and a sign.
--- Interaction is a tagged hitbox the client raycasts against.
local function kiosk(parent, at: CFrame, opts)
	local model = Instance.new("Model")
	model.Name = opts.name
	model.Parent = parent

	-- pedestal
	part({
		parent = model,
		size = Vector3.new(18, 1.6, 18),
		cframe = at * CFrame.new(0, 0.8, 0),
		color = PALETTE.stone,
		material = Enum.Material.Concrete,
	})
	part({
		parent = model,
		size = Vector3.new(15, 0.6, 15),
		cframe = at * CFrame.new(0, 1.9, 0),
		color = opts.tint,
		material = Enum.Material.SmoothPlastic,
		reflectance = 0.04,
	})

	-- pillars
	for _, sx in { -1, 1 } do
		for _, sz in { -1, 1 } do
			part({
				parent = model,
				size = Vector3.new(1.1, 11, 1.1),
				cframe = at * CFrame.new(sx * 6.4, 7.5, sz * 6.4),
				color = PALETTE.woodDark,
				material = Enum.Material.Wood,
			})
		end
	end

	-- canopy: two wedges make a pitched roof far cheaper than a mesh
	local roofY = 13.6
	for _, s in { 1, -1 } do
		wedge({
			parent = model,
			size = Vector3.new(16, 4.2, 8.6),
			cframe = at * CFrame.new(0, roofY, s * 4.3) * CFrame.Angles(0, s > 0 and 0 or math.pi, 0),
			color = opts.tint,
			material = Enum.Material.SmoothPlastic,
		})
	end
	part({
		parent = model,
		size = Vector3.new(17, 0.5, 18),
		cframe = at * CFrame.new(0, roofY - 2.1, 0),
		color = PALETTE.woodDark,
		material = Enum.Material.Wood,
	})

	-- glowing core: the thing that reads as "interactable" from across the hub
	local core = part({
		parent = model,
		size = Vector3.new(3.4, 3.4, 3.4),
		cframe = at * CFrame.new(0, 5.6, 0),
		color = opts.tint,
		material = Enum.Material.Neon,
		shape = "Ball",
		collide = false,
		name = "Core",
	})
	local light = Instance.new("PointLight")
	light.Color = opts.tint
	light.Brightness = 2.2
	light.Range = 26
	light.Shadows = false
	light.Parent = core

	-- interaction hitbox (tagged; the client handles prompts itself so we pay
	-- no ProximityPrompt cost for 8 kiosks on a weak device)
	local hit = part({
		parent = model,
		size = Vector3.new(20, 14, 20),
		cframe = at * CFrame.new(0, 7, 0),
		transparency = 1,
		collide = false,
		shadow = false,
		name = "Interact",
	})
	hit:SetAttribute("Station", opts.station)
	hit:SetAttribute("Label", opts.label)
	hit:AddTag("Station")

	sign(model, at * CFrame.new(0, 16.6, 0), opts.icon .. " " .. opts.label, opts.hint, opts.tint)
	model.PrimaryPart = core
	return model
end

--- The hub: a round plaza with the eight stations and decorative scatter.
function Build.hub(parent: Instance)
	local hub = Instance.new("Model")
	hub.Name = "Hub"
	hub.Parent = parent

	-- plaza base, built as three concentric discs for a layered silhouette
	part({
		parent = hub,
		size = Vector3.new(Layout.hubRadius * 2 + 16, 4, Layout.hubRadius * 2 + 16),
		cframe = CFrame.new(0, -2, 0) * CFrame.Angles(0, 0, math.rad(90)),
		shape = "Cylinder",
		color = PALETTE.grassDark,
		material = Enum.Material.Grass,
	})
	part({
		parent = hub,
		size = Vector3.new(Layout.hubRadius * 2, 3, Layout.hubRadius * 2),
		cframe = CFrame.new(0, 0, 0) * CFrame.Angles(0, 0, math.rad(90)),
		shape = "Cylinder",
		color = PALETTE.grass,
		material = Enum.Material.Grass,
	})
	part({
		parent = hub,
		size = Vector3.new(74, 3.4, 74),
		cframe = CFrame.new(0, 0.3, 0) * CFrame.Angles(0, 0, math.rad(90)),
		shape = "Cylinder",
		color = PALETTE.sand,
		material = Enum.Material.Sand,
	})

	-- centrepiece fountain
	part({
		parent = hub,
		size = Vector3.new(22, 3, 22),
		cframe = CFrame.new(0, 1.6, 0) * CFrame.Angles(0, 0, math.rad(90)),
		shape = "Cylinder",
		color = PALETTE.stone,
		material = Enum.Material.Marble,
	})
	part({
		parent = hub,
		size = Vector3.new(19, 1.2, 19),
		cframe = CFrame.new(0, 2.6, 0) * CFrame.Angles(0, 0, math.rad(90)),
		shape = "Cylinder",
		color = PALETTE.water,
		material = Enum.Material.Glass,
		transparency = 0.35,
		reflectance = 0.25,
		collide = false,
	})
	for i = 1, 3 do
		part({
			parent = hub,
			size = Vector3.new(8 - i * 1.8, 2.4, 8 - i * 1.8),
			cframe = CFrame.new(0, 2.6 + i * 2.2, 0) * CFrame.Angles(0, 0, math.rad(90)),
			shape = "Cylinder",
			color = PALETTE.stone,
			material = Enum.Material.Marble,
		})
	end
	local orb = part({
		parent = hub,
		size = Vector3.new(4.6, 4.6, 4.6),
		cframe = CFrame.new(0, 12.4, 0),
		shape = "Ball",
		color = PALETTE.accent,
		material = Enum.Material.Neon,
		collide = false,
		name = "HubOrb",
	})
	local orbLight = Instance.new("PointLight")
	orbLight.Color = PALETTE.accent
	orbLight.Brightness = 3
	orbLight.Range = 60
	orbLight.Shadows = false
	orbLight.Parent = orb

	-- the eight stations
	local stations = {
		{
			station = "seedShop",
			label = "LOJA DE SEMENTES",
			icon = "🌱",
			tint = col(96, 220, 140),
			hint = "Compre sementes • estoque novo a cada 5 min",
		},
		{
			station = "market",
			label = "MERCADO",
			icon = "💰",
			tint = PALETTE.gold,
			hint = "Venda sua colheita",
		},
		{
			station = "petShop",
			label = "OVOS E PETS",
			icon = "🥚",
			tint = col(236, 64, 122),
			hint = "Choque ovos • equipe pets",
		},
		{
			station = "upgrades",
			label = "MELHORIAS",
			icon = "⚒️",
			tint = col(124, 170, 255),
			hint = "Expanda a fazenda",
		},
		{
			station = "rebirth",
			label = "RENASCIMENTO",
			icon = "♻️",
			tint = col(176, 118, 255),
			hint = "Reinicie e fique mais forte",
		},
		{
			station = "passShop",
			label = "LOJA VIP",
			icon = "👑",
			tint = col(255, 179, 0),
			hint = "Passes e pacotes",
		},
		{
			station = "leaderboard",
			label = "RANKING GLOBAL",
			icon = "🏆",
			tint = col(0, 229, 255),
			hint = "Os maiores do servidor",
		},
		{
			station = "eventAltar",
			label = "ALTAR DE EVENTOS",
			icon = "🌀",
			tint = col(255, 92, 104),
			hint = "Próximo evento global",
		},
	}
	for _, s in stations do
		kiosk(hub, Layout.hubSpot(s.station), {
			name = s.station,
			station = s.station,
			label = s.label,
			icon = s.icon,
			tint = s.tint,
			hint = s.hint,
		})
	end

	-- decorative trees around the rim: silhouette, not detail
	local rng = Random.new(1337)
	for i = 1, 26 do
		local a = i / 26 * math.pi * 2 + rng:NextNumber(-0.06, 0.06)
		local r = Layout.hubRadius + rng:NextNumber(4, 12)
		local pos = Vector3.new(math.cos(a) * r, 0, math.sin(a) * r)
		local h = rng:NextNumber(9, 16)
		part({
			parent = hub,
			size = Vector3.new(1.8, h, 1.8),
			cframe = CFrame.new(pos + Vector3.new(0, h / 2, 0)),
			color = PALETTE.woodDark,
			material = Enum.Material.Wood,
			collide = false,
		})
		for j = 1, 3 do
			local s = (4.2 - j * 0.8) * rng:NextNumber(0.9, 1.15)
			part({
				parent = hub,
				size = Vector3.new(s * 2.4, s * 1.5, s * 2.4),
				cframe = CFrame.new(pos + Vector3.new(0, h + j * 1.9 - 1, 0)),
				color = j == 1 and PALETTE.grassDark or PALETTE.grass,
				material = Enum.Material.Grass,
				shape = "Ball",
				collide = false,
			})
		end
	end

	-- spawn pad
	local pad = part({
		parent = hub,
		size = Vector3.new(16, 0.6, 16),
		cframe = CFrame.new(0, 1.9, 0),
		color = PALETTE.accent,
		material = Enum.Material.Neon,
		transparency = 0.45,
		collide = false,
		shadow = false,
		name = "SpawnPad",
	})

	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "HubSpawn"
	spawn.Size = Vector3.new(14, 1, 14)
	spawn.CFrame = CFrame.new(0, 2.2, 0)
	spawn.Anchored = true
	spawn.Transparency = 1
	spawn.CanCollide = false
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Parent = hub

	return hub
end

--- One farm plot. Tiles are pads with a tagged hitbox; plants themselves are
--- rendered client-side from replicated data (see client/PlotRenderer).
function Build.plot(parent: Instance, plotId: number)
	local origin = Layout.plotOrigin(plotId)
	local size = Balance.plotSize

	local model = Instance.new("Model")
	model.Name = "Plot" .. plotId
	model:SetAttribute("PlotId", plotId)
	model.Parent = parent

	-- island: grass top, rock underside, so it reads as a floating island
	local ground = part({
		parent = model,
		size = Vector3.new(size, 4, size),
		cframe = origin * CFrame.new(0, -2, 0),
		color = PALETTE.grass,
		material = Enum.Material.Grass,
		name = "Ground",
	})
	part({
		parent = model,
		size = Vector3.new(size - 8, 10, size - 8),
		cframe = origin * CFrame.new(0, -9, 0),
		color = PALETTE.stoneDark,
		material = Enum.Material.Slate,
		collide = false,
	})
	part({
		parent = model,
		size = Vector3.new(size - 26, 14, size - 26),
		cframe = origin * CFrame.new(0, -20, 0),
		color = PALETTE.stoneDark,
		material = Enum.Material.Slate,
		collide = false,
		shadow = false,
	})

	-- fence: the visual language of "this is someone's property"
	local fenceColor = PALETTE.wood
	local half = size / 2 - 1
	for _, side in { "N", "S", "E", "W" } do
		local isNS = side == "N" or side == "S"
		local sgn = (side == "N" or side == "E") and 1 or -1
		local offset = isNS and Vector3.new(0, 2.2, sgn * half) or Vector3.new(sgn * half, 2.2, 0)
		local dim = isNS and Vector3.new(size, 0.5, 0.5) or Vector3.new(0.5, 0.5, size)
		part({
			parent = model,
			size = dim,
			cframe = origin * CFrame.new(offset),
			color = fenceColor,
			material = Enum.Material.Wood,
			collide = false,
			shadow = false,
		})
		part({
			parent = model,
			size = dim,
			cframe = origin * CFrame.new(offset - Vector3.new(0, 1.2, 0)),
			color = fenceColor,
			material = Enum.Material.Wood,
			collide = false,
			shadow = false,
		})
	end
	-- fence posts: four runs, one per edge
	for i = 0, 11 do
		local t = (i / 11 - 0.5) * (size - 2)
		local spots = {
			Vector3.new(t, 1.6, half),
			Vector3.new(t, 1.6, -half),
			Vector3.new(half, 1.6, t),
			Vector3.new(-half, 1.6, t),
		}
		for _, offset in spots do
			part({
				parent = model,
				size = Vector3.new(0.8, 4, 0.8),
				cframe = origin * CFrame.new(offset),
				color = PALETTE.woodDark,
				material = Enum.Material.Wood,
				collide = false,
				shadow = false,
			})
		end
	end

	-- tile pads for every possible tile; PlotService toggles the locked look
	local tilesFolder = Instance.new("Folder")
	tilesFolder.Name = "Tiles"
	tilesFolder.Parent = model

	for index = 1, Balance.maxTiles do
		local cf = Layout.tileCFrame(plotId, index)
		local pad = part({
			parent = tilesFolder,
			size = Vector3.new(Balance.tileSize, 0.7, Balance.tileSize),
			cframe = cf * CFrame.new(0, 0.35, 0),
			color = PALETTE.dirt,
			material = Enum.Material.Ground,
			name = "Tile" .. index,
			shadow = false,
		})
		pad:SetAttribute("PlotId", plotId)
		pad:SetAttribute("TileIndex", index)
		pad:AddTag("Tile")
		-- inner darker square: a free-looking "tilled soil" detail
		part({
			parent = pad,
			size = Vector3.new(Balance.tileSize - 1.4, 0.76, Balance.tileSize - 1.4),
			cframe = cf * CFrame.new(0, 0.38, 0),
			color = PALETTE.dirtDark,
			material = Enum.Material.Ground,
			collide = false,
			query = false,
			shadow = false,
			name = "Soil",
		})
	end

	-- owner sign + teleport pad
	sign(
		model,
		origin * CFrame.new(0, 10, -size / 2 + 4),
		"FAZENDA LIVRE",
		"Pise no painel para reivindicar",
		Theme.textDim
	)

	local pad = part({
		parent = model,
		size = Vector3.new(12, 0.5, 12),
		cframe = origin * CFrame.new(0, 0.5, -size / 2 + 8),
		color = Theme.secondary,
		material = Enum.Material.Neon,
		transparency = 0.5,
		collide = false,
		shadow = false,
		name = "ClaimPad",
	})
	pad:SetAttribute("PlotId", plotId)
	pad:AddTag("ClaimPad")

	model.PrimaryPart = ground
	return model
end

--- Decorative distant terrain so the skybox never meets a hard edge. Pure
--- silhouette work: ~40 parts for the whole horizon.
function Build.horizon(parent: Instance)
	local folder = Instance.new("Model")
	folder.Name = "Horizon"
	folder.Parent = parent
	local rng = Random.new(90210)
	for i = 1, 42 do
		local a = i / 42 * math.pi * 2
		local r = rng:NextNumber(620, 1150)
		local h = rng:NextNumber(60, 220)
		local w = rng:NextNumber(90, 260)
		part({
			parent = folder,
			size = Vector3.new(w, h, w),
			cframe = CFrame.new(math.cos(a) * r, h / 2 - 30, math.sin(a) * r)
				* CFrame.Angles(0, rng:NextNumber(0, 6), 0),
			color = i % 3 == 0 and PALETTE.stoneDark or PALETTE.grassDark,
			material = Enum.Material.Slate,
			collide = false,
			shadow = false,
			query = false,
		})
	end
	-- ocean plane
	part({
		parent = folder,
		size = Vector3.new(4000, 2, 4000),
		cframe = CFrame.new(0, -34, 0),
		color = PALETTE.water,
		material = Enum.Material.Glass,
		transparency = 0.25,
		reflectance = 0.35,
		collide = false,
		shadow = false,
		query = false,
		name = "Ocean",
	})
	return folder
end

function Build.all()
	local world = Instance.new("Folder")
	world.Name = "World"
	world.Parent = workspace

	Build.horizon(world)
	Build.hub(world)

	local plots = Instance.new("Folder")
	plots.Name = "Plots"
	plots.Parent = world
	for i = 1, Balance.plotCount do
		Build.plot(plots, i)
	end

	-- bridges from the hub out to each plot ring segment
	local bridges = Instance.new("Folder")
	bridges.Name = "Bridges"
	bridges.Parent = world
	for i = 1, Balance.plotCount do
		local origin = Layout.plotOrigin(i)
		local from = Vector3.new(0, 0, 0)
		local to = origin.Position
		local dir = (to - from)
		local len = dir.Magnitude - Layout.hubRadius - Balance.plotSize / 2 + 10
		local mid = from + dir.Unit * (Layout.hubRadius + len / 2 - 4)
		part({
			parent = bridges,
			size = Vector3.new(9, 0.8, len),
			cframe = CFrame.lookAt(mid, mid + dir.Unit) * CFrame.new(0, 0, 0),
			color = PALETTE.wood,
			material = Enum.Material.WoodPlanks,
			shadow = false,
			name = "Bridge" .. i,
		})
		-- rails
		for _, s in { -1, 1 } do
			part({
				parent = bridges,
				size = Vector3.new(0.4, 2.4, len),
				cframe = CFrame.lookAt(mid, mid + dir.Unit) * CFrame.new(s * 4.3, 1.3, 0),
				color = PALETTE.woodDark,
				material = Enum.Material.Wood,
				collide = false,
				shadow = false,
			})
		end
	end

	return world
end

return Build
