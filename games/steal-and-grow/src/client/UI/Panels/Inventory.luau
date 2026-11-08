--!nonstrict
-- Harvest storage + the planting picker (same data, two modes).
--
-- The planting picker is the single most-used screen in the game, so it is
-- optimised for one-thumb use: a big grid of seed cards, each one plantable in
-- a single tap, sorted by value so the best choice is first.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local State = require(script.Parent.Parent.Parent.State)
local B = require(script.Parent.Parent.Builder)
local C = require(script.Parent.Parent.Components)

local Theme = Config.Theme
local Seeds = Config.Seeds
local Mutations = Config.Mutations
local Rarities = Config.Rarities

local Inventory = {}

function Inventory.build(parent, app)
	local panel = C.panel({
		parent = parent,
		name = "Inventory",
		title = "COLHEITA",
		icon = "🧺",
		tint = Color3.fromRGB(150, 110, 30),
	})

	local api = { panel = panel, mode = "crops", tile = nil }

	local tabsHolder = B.new("Frame", {
		Size = UDim2.new(1, 0, 0, 44),
		BackgroundTransparency = 1,
		Parent = panel.body,
	})
	local content = B.new("Frame", {
		Size = UDim2.new(1, 0, 1, -104),
		Position = UDim2.fromOffset(0, 50),
		BackgroundTransparency = 1,
		Parent = panel.body,
	})
	local footer = B.new("Frame", {
		Size = UDim2.new(1, 0, 0, 48),
		Position = UDim2.new(0, 0, 1, -48),
		BackgroundTransparency = 1,
		Parent = panel.body,
	})

	local list = B.scroll({ parent = content, gap = 6 })
	local seedGrid = B.scroll({
		parent = content,
		grid = UDim2.fromOffset(150, 112),
		gridGap = UDim2.fromOffset(8, 8),
	})
	seedGrid.Visible = false

	local _, select = C.tabs(tabsHolder, { "Colheita", "Sementes" }, function(index)
		api.mode = index == 1 and "crops" or "seeds"
		api.refresh()
	end)

	local sellAll = B.button({
		parent = footer,
		size = UDim2.fromScale(1, 1),
		colour = Theme.coins,
		icon = "💰",
		text = "VENDER TUDO",
		onClick = function()
			Net:send("SellAll")
		end,
	})

	-- Crops --------------------------------------------------------------

	local function cropRow(crop, index)
		local seed = Seeds.byId[crop.seed]
		if not seed then
			return
		end
		local label = Mutations.label(crop.element, crop.aura)
		local mult = Mutations.multiplier(crop.element, crop.aura)
		local rarity = Rarities.get(seed.rarity)
		local element = crop.element and Mutations.byId[crop.element]
		local aura = crop.aura and Mutations.byId[crop.aura]
		local tint = (aura and aura.mult > 1 and aura.colour)
			or (element and element.mult > 1 and element.colour)
			or rarity.colour

		local row = B.card({
			parent = list,
			size = UDim2.new(1, 0, 0, 60),
			colour = Theme.panelAlt,
			strokeColour = tint,
			strokeTransparency = mult > 1 and 0 or 0.4,
			order = index,
			pad = 8,
		})
		local swatch = B.new("Frame", {
			Size = UDim2.fromOffset(42, 42),
			Position = UDim2.fromOffset(0, 1),
			BackgroundColor3 = tint,
			Parent = row,
		})
		B.corner(10).Parent = swatch
		B.label(crop.giant and "🔥" or "", {
			Parent = swatch,
			Size = UDim2.fromScale(1, 1),
			TextSize = 22,
			TextXAlignment = Enum.TextXAlignment.Center,
		})

		B.label(((label ~= "" and label .. " ") or "") .. seed.name, {
			Parent = row,
			Size = UDim2.new(1, -190, 0, 20),
			Position = UDim2.fromOffset(50, 0),
			Font = Theme.fontBlack,
			TextSize = Theme.small,
			TextColor3 = tint,
		})
		B.label(
			("Tam. %.2fx  •  %s%s"):format(
				crop.size or 1,
				Format.multiplier(mult),
				crop.giant and "  •  GIGANTE" or ""
			),
			{
				Parent = row,
				Size = UDim2.new(1, -190, 0, 16),
				Position = UDim2.fromOffset(50, 22),
				TextSize = Theme.tiny,
				TextColor3 = Theme.textDim,
				Font = Theme.fontBody,
			}
		)

		B.button({
			parent = row,
			size = UDim2.fromOffset(132, 42),
			position = UDim2.new(1, -132, 0, 1),
			colour = Theme.coins,
			icon = "💰",
			text = Format.short(crop.value or 0),
			textSize = Theme.small,
			onClick = function()
				Net:send("Sell", index)
			end,
		})
	end

	-- Seeds / planting ---------------------------------------------------

	local function seedCard(seedId, count, order)
		local seed = Seeds.byId[seedId]
		if not seed then
			return
		end
		local rarity = Rarities.get(seed.rarity)
		local card = B.card({
			parent = seedGrid,
			size = UDim2.fromOffset(150, 112),
			colour = Theme.panelAlt,
			strokeColour = rarity.colour,
			strokeTransparency = 0.2,
			order = order,
			pad = 8,
		})
		local swatch = B.new("Frame", {
			Size = UDim2.new(1, 0, 0, 34),
			BackgroundColor3 = seed.fruit,
			Parent = card,
		})
		B.corner(9).Parent = swatch
		B.label(("x%d"):format(count), {
			Parent = swatch,
			Size = UDim2.fromScale(1, 1),
			TextSize = Theme.body,
			Font = Theme.fontBlack,
			TextXAlignment = Enum.TextXAlignment.Center,
			TextColor3 = Color3.fromRGB(16, 20, 28),
		})
		B.label(seed.name, {
			Parent = card,
			Size = UDim2.new(1, 0, 0, 18),
			Position = UDim2.fromOffset(0, 37),
			TextSize = Theme.tiny,
			Font = Theme.fontBlack,
			TextXAlignment = Enum.TextXAlignment.Center,
			TextColor3 = rarity.colour,
		})
		B.label(("⏱%s  💰%s"):format(Format.time(seed.growTime), Format.short(seed.baseValue)), {
			Parent = card,
			Size = UDim2.new(1, 0, 0, 14),
			Position = UDim2.fromOffset(0, 54),
			TextSize = Theme.tiny,
			TextColor3 = Theme.textFaint,
			TextXAlignment = Enum.TextXAlignment.Center,
			Font = Theme.fontBody,
		})
		B.button({
			parent = card,
			size = UDim2.new(1, 0, 0, 36),
			position = UDim2.new(0, 0, 1, -36),
			colour = Theme.primary,
			text = api.tile and "PLANTAR" or "PLANTAR",
			textSize = Theme.small,
			onClick = function()
				local tile = api.tile
				if not tile then
					-- no specific tile chosen: use the first free one
					for i = 1, State.tileCount do
						if not State.tiles[i] then
							tile = i
							break
						end
					end
				end
				if not tile then
					app.FeedbackController:toast({ kind = "error", title = "Nenhum canteiro livre!" })
					return
				end
				Net:send("Plant", tile, seedId)
				api.tile = nil
				panel.close()
			end,
		})
	end

	-- Refresh ------------------------------------------------------------

	function api.refresh()
		local crops = api.mode == "crops"
		list.Visible = crops
		seedGrid.Visible = not crops
		sellAll.Visible = crops

		if crops then
			for _, child in list:GetChildren() do
				if child:IsA("Frame") then
					child:Destroy()
				end
			end
			local storage = State.mult and State.mult.storage or 40
			local total = 0
			for _, crop in State.inventory do
				total += crop.value or 0
			end
			panel.setSubtitle(
				("%d/%d  •  Total: %s moedas"):format(#State.inventory, storage, Format.short(total))
			)
			if #State.inventory == 0 then
				C.empty(list, "🧺", "Nada colhido ainda.\nPlante e espere as plantas ficarem prontas!")
			else
				-- most valuable first: that is what the player wants to see
				local sorted = {}
				for i, crop in State.inventory do
					table.insert(sorted, { crop = crop, index = i })
				end
				table.sort(sorted, function(a, b)
					return (a.crop.value or 0) > (b.crop.value or 0)
				end)
				for order, entry in sorted do
					cropRow(entry.crop, entry.index)
				end
			end
			local text = sellAll.Content:FindFirstChild("Text")
			if text then
				text.Text = ("💰  VENDER TUDO (%s)"):format(Format.short(total))
			end
		else
			for _, child in seedGrid:GetChildren() do
				if child:IsA("Frame") then
					child:Destroy()
				end
			end
			local free = 0
			for i = 1, State.tileCount do
				if not State.tiles[i] then
					free += 1
				end
			end
			panel.setSubtitle(
				api.tile and ("Plantando no canteiro %d"):format(api.tile)
					or ("%d canteiros livres"):format(free)
			)

			local owned = {}
			for seedId, count in State.seeds do
				if count > 0 and Seeds.byId[seedId] then
					table.insert(owned, { id = seedId, count = count })
				end
			end
			if #owned == 0 then
				C.empty(seedGrid, "🌱", "Você não tem sementes.\nCompre na Loja de Sementes!")
			else
				table.sort(owned, function(a, b)
					return Seeds.byId[a.id].baseValue > Seeds.byId[b.id].baseValue
				end)
				for order, entry in owned do
					seedCard(entry.id, entry.count, order)
				end
			end
		end
	end

	function api.openPlanting(tileIndex)
		api.tile = tileIndex
		api.mode = "seeds"
		select(2)
		panel.open()
		api.refresh()
	end

	return api
end

return Inventory
