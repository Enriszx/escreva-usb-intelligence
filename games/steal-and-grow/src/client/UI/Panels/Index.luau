--!nonstrict
-- Collection index. The end-game goal for players who already have everything:
-- a checklist with per-entry gem rewards and a visible completion percentage.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local State = require(script.Parent.Parent.Parent.State)
local B = require(script.Parent.Parent.Builder)
local C = require(script.Parent.Parent.Components)

local Theme = Config.Theme
local Seeds = Config.Seeds
local Pets = Config.Pets
local Rarities = Config.Rarities

local Panel = {}

function Panel.build(parent, app)
	local panel = C.panel({
		parent = parent,
		name = "Index",
		title = "ÍNDICE",
		icon = "📖",
		tint = Color3.fromRGB(10, 110, 130),
	})
	local api = { panel = panel, mode = "seeds" }

	local tabsHolder = B.new("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = panel.body })
	local content = B.new("Frame", {
		Size = UDim2.new(1, 0, 1, -50),
		Position = UDim2.fromOffset(0, 50),
		BackgroundTransparency = 1,
		Parent = panel.body,
	})
	local grid = B.scroll({
		parent = content,
		grid = UDim2.fromOffset(136, 96),
		gridGap = UDim2.fromOffset(8, 8),
	})

	local _, select = C.tabs(tabsHolder, { "Plantas", "Pets" }, function(index)
		api.mode = index == 1 and "seeds" or "pets"
		api.refresh()
	end)

	local function entryCard(kind, id, name, rarityId, swatchColour, order)
		local count = State.index[id] or 0
		local found = count > 0
		local claimed = State.indexClaimed[kind .. ":" .. id]
		local rarity = Rarities.get(rarityId)
		local gems = math.floor(15 * rarity.order ^ 1.9)

		local card = B.card({
			parent = grid,
			size = UDim2.fromOffset(136, 96),
			colour = found and Theme.panelAlt or Theme.panel,
			strokeColour = found and rarity.colour or Theme.stroke,
			strokeTransparency = found and 0.1 or 0.6,
			order = order,
			pad = 6,
		})
		local swatch = B.new("Frame", {
			Size = UDim2.new(1, 0, 0, 28),
			BackgroundColor3 = found and swatchColour or Color3.fromRGB(44, 48, 60),
			Parent = card,
		})
		B.corner(8).Parent = swatch
		B.label(found and ("x" .. Format.short(count)) or "???", {
			Parent = swatch, Size = UDim2.fromScale(1, 1), TextSize = Theme.tiny,
			Font = Theme.fontBlack, TextXAlignment = Enum.TextXAlignment.Center,
			TextColor3 = found and Color3.fromRGB(16, 20, 28) or Theme.textFaint,
		})
		B.label(found and name or "???", {
			Parent = card, Size = UDim2.new(1, 0, 0, 16), Position = UDim2.fromOffset(0, 31),
			TextSize = Theme.tiny, Font = Theme.fontBlack,
			TextXAlignment = Enum.TextXAlignment.Center,
			TextColor3 = found and rarity.colour or Theme.textFaint,
		})
		B.label(rarity.name, {
			Parent = card, Size = UDim2.new(1, 0, 0, 14), Position = UDim2.fromOffset(0, 47),
			TextSize = Theme.tiny, TextXAlignment = Enum.TextXAlignment.Center,
			TextColor3 = Theme.textFaint, Font = Theme.fontBody,
		})

		local btn = B.button({
			parent = card,
			size = UDim2.new(1, 0, 0, 28),
			position = UDim2.new(0, 0, 1, -28),
			colour = claimed and Theme.panel or (found and Theme.gems or Theme.panel),
			text = claimed and "✔" or ("💎 " .. Format.short(gems)),
			textSize = Theme.tiny,
			textColour = (found and not claimed) and Color3.fromRGB(16, 20, 28) or Theme.textFaint,
			gradient = found and not claimed,
			height = 28,
			onClick = function()
				if found and not claimed then
					Net:send("ClaimIndex", kind, id)
				end
			end,
		})
		B.setDisabled(btn, claimed or not found)
	end

	function api.refresh()
		for _, child in grid:GetChildren() do
			if child:IsA("Frame") then
				child:Destroy()
			end
		end
		if api.mode == "seeds" then
			local found = 0
			for _, seed in Seeds.all do
				if (State.index[seed.id] or 0) > 0 then
					found += 1
				end
			end
			panel.setSubtitle(("Plantas: %d/%d (%s)"):format(found, #Seeds.all, Format.percent(found / #Seeds.all, 0)))
			local sorted = table.clone(Seeds.all)
			table.sort(sorted, function(a, b)
				if a.tier ~= b.tier then
					return a.tier < b.tier
				end
				return a.baseValue < b.baseValue
			end)
			for order, seed in sorted do
				entryCard("seed", seed.id, seed.name, seed.rarity, seed.fruit, order)
			end
		else
			local found = 0
			for _, pet in Pets.all do
				if (State.index[pet.id] or 0) > 0 then
					found += 1
				end
			end
			panel.setSubtitle(("Pets: %d/%d (%s)"):format(found, #Pets.all, Format.percent(found / #Pets.all, 0)))
			local sorted = table.clone(Pets.all)
			table.sort(sorted, function(a, b)
				local oa, ob = Rarities.get(a.rarity).order, Rarities.get(b.rarity).order
				if oa ~= ob then
					return oa < ob
				end
				return a.name < b.name
			end)
			for order, pet in sorted do
				entryCard("pet", pet.id, pet.name, pet.rarity, pet.body, order)
			end
		end
	end

	return api
end

return Panel
