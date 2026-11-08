--!nonstrict
-- Seed shop. Shows live stock, restock countdown, coins-per-second efficiency
-- (so the player can see WHY the next tier is better) and honest unlock gates.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Economy = require(Shared.Economy)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local State = require(script.Parent.Parent.Parent.State)
local B = require(script.Parent.Parent.Builder)
local C = require(script.Parent.Parent.Components)

local Theme = Config.Theme
local Seeds = Config.Seeds
local Rarities = Config.Rarities

local Shop = {}

function Shop.build(parent, app)
	local panel = C.panel({
		parent = parent,
		name = "Shop",
		title = "LOJA DE SEMENTES",
		icon = "🌱",
		tint = Theme.primaryDark,
		subtitle = "",
	})

	local list = B.scroll({ parent = panel.body, gap = 8 })
	local api = { panel = panel }

	local function card(entry, order)
		local seed = Seeds.byId[entry.seed]
		if not seed then
			return
		end
		local rarity = Rarities.get(seed.rarity)
		local locked = seed.unlockRebirth > State.rebirths
		local out = seed.unlockRebirth <= State.rebirths and entry.stockLeft <= 0
		local afford = State.coins >= seed.cost

		local row = B.card({
			parent = list,
			size = UDim2.new(1, 0, 0, 92),
			colour = Theme.panelAlt,
			strokeColour = rarity.colour,
			strokeTransparency = locked and 0.6 or 0.15,
			order = order,
			pad = 10,
		})

		-- colour swatch stands in for an icon: instantly recognisable and free
		local swatch = B.new("Frame", {
			Size = UDim2.fromOffset(58, 58),
			Position = UDim2.fromOffset(0, 7),
			BackgroundColor3 = seed.fruit,
			Parent = row,
		})
		B.corner(14).Parent = swatch
		B.stroke(rarity.colour, 2.5, 0.1).Parent = swatch
		B.gradient(seed.fruit:Lerp(Color3.new(1, 1, 1), 0.25), seed.fruit, 90).Parent = swatch
		B.label("T" .. seed.tier, {
			Parent = swatch,
			Size = UDim2.fromScale(1, 1),
			TextSize = Theme.small,
			Font = Theme.fontBlack,
			TextXAlignment = Enum.TextXAlignment.Center,
			TextColor3 = Color3.fromRGB(16, 20, 28),
		})

		B.label(seed.name, {
			Parent = row,
			Size = UDim2.new(1, -230, 0, 22),
			Position = UDim2.fromOffset(68, 4),
			Font = Theme.fontBlack,
			TextSize = Theme.body,
			TextColor3 = locked and Theme.textFaint or Theme.text,
		})
		C.rarityChip(seed.rarity, row).Position = UDim2.fromOffset(68, 28)

		B.label(
			("⏱ %s  •  💰 %s  •  %s/s"):format(
				Format.time(seed.growTime),
				Format.short(seed.baseValue),
				Format.short(Seeds.rate(seed))
			),
			{
				Parent = row,
				Size = UDim2.new(1, -230, 0, 18),
				Position = UDim2.fromOffset(68, 52),
				TextSize = Theme.tiny,
				TextColor3 = Theme.textDim,
				Font = Theme.fontBody,
			}
		)

		B.label(("Estoque: %d  •  Você tem: %d"):format(entry.stockLeft, State.seedCount(seed.id)), {
			Parent = row,
			Size = UDim2.new(0, 200, 0, 16),
			Position = UDim2.new(1, -206, 0, 2),
			TextSize = Theme.tiny,
			TextColor3 = Theme.textFaint,
			TextXAlignment = Enum.TextXAlignment.Right,
		})

		local function buy(qty)
			Net:send("BuySeed", seed.id, qty)
			app.FeedbackController:play("click", 0.2)
		end

		if locked then
			local btn = B.button({
				parent = row,
				size = UDim2.fromOffset(196, 42),
				position = UDim2.new(1, -196, 0, 24),
				colour = Theme.panel,
				icon = "🔒",
				text = ("%d renascimentos"):format(seed.unlockRebirth),
				textSize = Theme.small,
				textColour = Theme.textDim,
				gradient = false,
				onClick = function()
					app.PanelController:open("rebirth")
				end,
			})
		else
			local btn1 = B.button({
				parent = row,
				size = UDim2.fromOffset(124, 42),
				position = UDim2.new(1, -196, 0, 24),
				colour = (afford and not out) and Theme.primary or Theme.panel,
				text = Format.short(seed.cost),
				icon = "💰",
				textSize = Theme.small,
				textColour = (afford and not out) and Color3.fromRGB(16, 20, 28) or Theme.textDim,
				gradient = afford and not out,
				onClick = function()
					buy(1)
				end,
			})
			B.setDisabled(btn1, out or not afford)
			local btnMax = B.button({
				parent = row,
				size = UDim2.fromOffset(66, 42),
				position = UDim2.new(1, -66, 0, 24),
				colour = (afford and not out) and Theme.primaryDark or Theme.panel,
				text = "MAX",
				textSize = Theme.tiny,
				textColour = Theme.text,
				gradient = false,
				onClick = function()
					local canAfford = math.floor(State.coins / math.max(seed.cost, 1))
					buy(math.clamp(math.min(canAfford, entry.stockLeft), 1, 100))
				end,
			})
			B.setDisabled(btnMax, out or not afford)
			if out then
				B.label("ESGOTADO", {
					Parent = row,
					Size = UDim2.fromOffset(196, 42),
					Position = UDim2.new(1, -196, 0, 24),
					TextSize = Theme.small,
					Font = Theme.fontBlack,
					TextColor3 = Theme.danger,
					TextXAlignment = Enum.TextXAlignment.Center,
				})
			end
		end
	end

	function api.refresh()
		for _, child in list:GetChildren() do
			if child:IsA("Frame") then
				child:Destroy()
			end
		end
		local shop = State.shop
		if not shop or not shop.stock then
			C.empty(list, "⏳", "Carregando estoque...")
			return
		end
		local left = math.max(0, (shop.nextRestock or 0) - State.now())
		panel.setSubtitle(("Novo estoque em %s"):format(Format.clock(left)))

		for i, entry in shop.stock do
			card(entry, i)
		end

		-- the paid reroll lives at the bottom of the list, after the player has
		-- already seen (and been disappointed by) the current stock
		local reroll = Config.Products.byKey.shopReroll
		local btn = B.button({
			parent = list,
			size = UDim2.new(1, 0, 0, 52),
			colour = Theme.steal,
			icon = reroll.icon,
			text = ("%s — %s Robux"):format(reroll.name, Format.comma(reroll.robux)),
			sub = reroll.desc,
			textSize = Theme.small,
			order = 100,
			onClick = function()
				Net:send("PromptProduct", "shopReroll")
			end,
		})
	end

	return api
end

return Shop
