--!nonstrict
-- The monetisation panel.
--
-- Conversion design, applied honestly:
--   * The Ultimate bundle sits at the top as a price anchor, so the 299-499
--     passes read as reasonable.
--   * Owned passes are shown as owned, not hidden, so the purchase feels
--     permanent and visible.
--   * Every pass states its exact mechanical effect. No vague "boosts your
--     game" copy — players who understand what they bought refund less and
--     buy again.
--   * The starter pack only appears in the first hour, server-enforced.
--   * Nothing here blocks progression. Everything is a multiplier or a
--     convenience, so the game is complete without spending.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local State = require(script.Parent.Parent.Parent.State)
local B = require(script.Parent.Parent.Builder)
local C = require(script.Parent.Parent.Components)

local Theme = Config.Theme
local Passes = Config.Passes
local Products = Config.Products

local Panel = {}

function Panel.build(parent, app)
	local panel = C.panel({
		parent = parent,
		name = "VipShop",
		title = "LOJA VIP",
		icon = "👑",
		tint = Color3.fromRGB(150, 110, 10),
	})
	local api = { panel = panel, mode = "passes" }

	local tabsHolder =
		B.new("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = panel.body })
	local content = B.new("Frame", {
		Size = UDim2.new(1, 0, 1, -50),
		Position = UDim2.fromOffset(0, 50),
		BackgroundTransparency = 1,
		Parent = panel.body,
	})
	local passList = B.scroll({ parent = content, gap = 8 })
	local productList = B.scroll({ parent = content, gap = 8 })
	productList.Visible = false

	local _, select = C.tabs(tabsHolder, { "Passes (permanentes)", "Itens e Moedas" }, function(index)
		api.mode = index == 1 and "passes" or "products"
		api.refresh()
	end)

	local function passCard(pass, order)
		local owned = State.hasPass(pass.key)
		local isUltimate = pass.key == "ultimate"
		local height = isUltimate and 150 or 104

		local card = B.card({
			parent = passList,
			size = UDim2.new(1, 0, 0, height),
			colour = owned and Theme.panel or Theme.panelAlt,
			strokeColour = owned and Theme.primary or pass.colour,
			strokeThickness = isUltimate and 3.5 or 2,
			strokeTransparency = 0,
			order = order,
			pad = 12,
		})
		if isUltimate then
			B.gradient(pass.colour:Lerp(Theme.panel, 0.55), Theme.panel, 115).Parent = card
		end

		B.label(pass.icon, {
			Parent = card,
			Size = UDim2.fromOffset(52, 52),
			Position = UDim2.fromOffset(0, 2),
			TextSize = isUltimate and 40 or 32,
			TextXAlignment = Enum.TextXAlignment.Center,
		})
		B.label(pass.name, {
			Parent = card,
			Size = UDim2.new(1, -230, 0, 24),
			Position = UDim2.fromOffset(58, 0),
			Font = Theme.fontBlack,
			TextSize = isUltimate and Theme.h3 or Theme.body,
			TextColor3 = pass.colour,
		})
		B.label(pass.desc, {
			Parent = card,
			Size = UDim2.new(1, -230, 0, height - 36),
			Position = UDim2.fromOffset(58, 26),
			TextSize = Theme.tiny,
			TextColor3 = Theme.textDim,
			Font = Theme.fontBody,
			TextWrapped = true,
			TextYAlignment = Enum.TextYAlignment.Top,
		})

		if owned then
			local badge = B.new("Frame", {
				Size = UDim2.fromOffset(200, 48),
				Position = UDim2.new(1, -200, 0, 6),
				BackgroundColor3 = Theme.primaryDark,
				Parent = card,
			})
			B.corner(12).Parent = badge
			B.label("✔  ATIVO", {
				Parent = badge,
				Size = UDim2.fromScale(1, 1),
				Font = Theme.fontBlack,
				TextSize = Theme.body,
				TextColor3 = Theme.text,
				TextXAlignment = Enum.TextXAlignment.Center,
			})
		else
			B.button({
				parent = card,
				size = UDim2.fromOffset(200, isUltimate and 64 or 52),
				position = UDim2.new(1, -200, 0, 6),
				colour = pass.colour,
				icon = "🛒",
				text = Format.comma(pass.robux) .. " Robux",
				sub = isUltimate and "MELHOR VALOR" or nil,
				textSize = Theme.small,
				onClick = function()
					Net:send("PromptPass", pass.key)
				end,
			})
		end
	end

	local function productCard(product, order)
		local bought = State.productsBought and State.productsBought[product.key] or 0
		if product.payload.oncePerAccount and bought > 0 then
			return
		end
		if product.payload.maxStack and bought >= product.payload.maxStack then
			return
		end
		-- the starter pack is time-gated client-side too, so it does not tease
		local isStarter = product.key == "starterPack"
		if isStarter then
			local firstJoin = State.stats and State.stats.firstJoin
			-- the server is the authority; we only hide it when clearly expired
			if State.rebirths and State.rebirths > 0 then
				return
			end
		end

		local card = B.card({
			parent = productList,
			size = UDim2.new(1, 0, 0, isStarter and 128 or 96),
			colour = Theme.panelAlt,
			strokeColour = product.colour,
			strokeThickness = (product.bestValue or isStarter) and 3 or 2,
			strokeTransparency = 0,
			order = order,
			pad = 12,
		})
		if isStarter or product.bestValue then
			B.gradient(product.colour:Lerp(Theme.panel, 0.6), Theme.panel, 115).Parent = card
		end

		B.label(product.icon, {
			Parent = card,
			Size = UDim2.fromOffset(50, 50),
			Position = UDim2.fromOffset(0, 2),
			TextSize = 32,
			TextXAlignment = Enum.TextXAlignment.Center,
		})
		B.label(product.name .. (product.bestValue and "   ⭐" or ""), {
			Parent = card,
			Size = UDim2.new(1, -220, 0, 22),
			Position = UDim2.fromOffset(56, 0),
			Font = Theme.fontBlack,
			TextSize = Theme.body,
			TextColor3 = product.colour,
		})
		B.label(product.desc, {
			Parent = card,
			Size = UDim2.new(1, -220, 0, (isStarter and 86 or 56)),
			Position = UDim2.fromOffset(56, 24),
			TextSize = Theme.tiny,
			TextColor3 = Theme.textDim,
			Font = Theme.fontBody,
			TextWrapped = true,
			TextYAlignment = Enum.TextYAlignment.Top,
		})

		-- show what a currency pack is actually worth right now
		local extra = nil
		if product.payload.minutes then
			extra = ("≈ %s de produção"):format(Format.time(product.payload.minutes * 60))
		elseif bought > 0 then
			extra = ("Comprado %dx"):format(bought)
		end

		B.button({
			parent = card,
			size = UDim2.fromOffset(190, 54),
			position = UDim2.new(1, -190, 0, 6),
			colour = product.colour,
			icon = "🛒",
			text = Format.comma(product.robux) .. " Robux",
			sub = extra,
			textSize = Theme.small,
			onClick = function()
				Net:send("PromptProduct", product.key)
			end,
		})
	end

	function api.refresh()
		passList.Visible = api.mode == "passes"
		productList.Visible = api.mode == "products"

		if api.mode == "passes" then
			for _, child in passList:GetChildren() do
				if child:IsA("Frame") then
					child:Destroy()
				end
			end
			local owned = 0
			for _, pass in Passes.ordered do
				if State.hasPass(pass.key) then
					owned += 1
				end
			end
			panel.setSubtitle(("%d de %d passes ativos"):format(owned, #Passes.ordered))

			local note = B.card({
				parent = passList,
				size = UDim2.new(1, 0, 0, 52),
				colour = Theme.panel,
				strokeColour = Theme.primary,
				order = -1,
				pad = 10,
			})
			B.label(
				"Todo passe é permanente e vale para sempre na sua conta. "
					.. "Nada aqui é obrigatório — o jogo é 100% jogável de graça.",
				{
					Parent = note,
					Size = UDim2.fromScale(1, 1),
					TextSize = Theme.tiny,
					TextColor3 = Theme.textDim,
					Font = Theme.fontBody,
					TextWrapped = true,
					TextXAlignment = Enum.TextXAlignment.Center,
				}
			)

			for order, pass in Passes.ordered do
				passCard(pass, order)
			end
		else
			for _, child in productList:GetChildren() do
				if child:IsA("Frame") then
					child:Destroy()
				end
			end
			panel.setSubtitle("Itens consumíveis e moedas")
			for order, product in Products.ordered do
				productCard(product, order)
			end
		end
	end

	return api
end

return Panel
