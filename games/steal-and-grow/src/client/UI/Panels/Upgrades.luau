--!nonstrict
-- Permanent upgrades. Every row shows the current level, the resolved effect
-- and the next cost, because an upgrade the player cannot evaluate is an
-- upgrade they do not buy.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local State = require(script.Parent.Parent.Parent.State)
local B = require(script.Parent.Parent.Builder)
local C = require(script.Parent.Parent.Components)

local Theme = Config.Theme
local Upgrades = Config.Upgrades

local Panel = {}

function Panel.build(parent, app)
	local panel = C.panel({
		parent = parent,
		name = "Upgrades",
		title = "MELHORIAS",
		icon = "⚒️",
		tint = Color3.fromRGB(40, 80, 160),
	})
	local list = B.scroll({ parent = panel.body, gap = 8 })
	local api = { panel = panel }

	function api.refresh()
		for _, child in list:GetChildren() do
			if child:IsA("Frame") then
				child:Destroy()
			end
		end
		local m = State.mult
		panel.setSubtitle(m and ("Canteiros %d/%d  •  💰%s  ⚡%s"):format(
			m.tiles, State.maxTiles, Format.multiplier(m.coin), Format.multiplier(m.grow)
		) or "")

		for _, upgrade in Upgrades.all do
			local level = State.upgrades[upgrade.key] or 0
			local maxed = level >= upgrade.maxLevel
			local cost = Upgrades.cost(upgrade, level)
			local afford = State.coins >= cost

			local row = B.card({
				parent = list,
				size = UDim2.new(1, 0, 0, 86),
				colour = Theme.panelAlt,
				strokeColour = upgrade.colour,
				strokeTransparency = 0.3,
				order = upgrade.order,
				pad = 10,
			})
			B.label(upgrade.icon, {
				Parent = row, Size = UDim2.fromOffset(44, 44), Position = UDim2.fromOffset(0, 2),
				TextSize = 28, TextXAlignment = Enum.TextXAlignment.Center,
			})
			B.label(upgrade.name, {
				Parent = row, Size = UDim2.new(1, -220, 0, 20), Position = UDim2.fromOffset(48, 0),
				Font = Theme.fontBlack, TextSize = Theme.body, TextColor3 = upgrade.colour,
			})
			B.label(upgrade.desc, {
				Parent = row, Size = UDim2.new(1, -220, 0, 18), Position = UDim2.fromOffset(48, 21),
				TextSize = Theme.tiny, TextColor3 = Theme.textDim, Font = Theme.fontBody,
			})
			B.bar({
				parent = row,
				size = UDim2.new(1, -220, 0, 16),
				position = UDim2.fromOffset(48, 44),
				colour = upgrade.colour,
				value = level / upgrade.maxLevel,
				text = ("Nível %d / %d"):format(level, upgrade.maxLevel),
			})

			local btn = B.button({
				parent = row,
				size = UDim2.fromOffset(196, 52),
				position = UDim2.new(1, -196, 0, 7),
				colour = maxed and Theme.panel or (afford and upgrade.colour or Theme.panel),
				icon = maxed and "✔" or "💰",
				text = maxed and "MÁXIMO" or Format.short(cost),
				sub = maxed and nil or ("+%s por nível"):format(
					upgrade.stat == "tiles" and tostring(upgrade.perLevel)
						or upgrade.stat == "storage" and tostring(upgrade.perLevel)
						or Format.percent(upgrade.perLevel, 0)
				),
				textSize = Theme.small,
				textColour = (not maxed and afford) and Color3.fromRGB(16, 20, 28) or Theme.textDim,
				gradient = not maxed and afford,
				onClick = function()
					if not maxed then
						Net:send("BuyUpgrade", upgrade.key)
					end
				end,
			})
			B.setDisabled(btn, maxed or not afford)
		end

		-- the pass that does what the tile upgrade does, but permanently and
		-- bigger: shown right here, where the player feels the constraint
		local pass = Config.Passes.byKey.extraTiles
		if not State.hasPass("extraTiles") then
			B.button({
				parent = list,
				size = UDim2.new(1, 0, 0, 56),
				colour = pass.colour,
				icon = pass.icon,
				text = ("%s — %s Robux"):format(pass.name, Format.comma(pass.robux)),
				sub = pass.desc,
				textSize = Theme.small,
				order = 999,
				onClick = function()
					Net:send("PromptPass", "extraTiles")
				end,
			})
		end
	end

	return api
end

return Panel
