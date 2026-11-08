--!nonstrict
-- Trading UI. Mirrors the server's anti-scam rule visibly: any change to
-- either offer clears both confirmations, and the UI says so out loud.

local Players = game:GetService("Players")
local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local State = require(script.Parent.Parent.Parent.State)
local B = require(script.Parent.Parent.Builder)
local C = require(script.Parent.Parent.Components)

local Theme = Config.Theme
local Pets = Config.Pets
local Seeds = Config.Seeds
local Mutations = Config.Mutations
local Rarities = Config.Rarities

local Panel = {}

function Panel.build(parent, app)
	local panel = C.panel({
		parent = parent,
		name = "Trade",
		title = "TROCA",
		icon = "🤝",
		tint = Color3.fromRGB(40, 110, 90),
		size = UDim2.fromOffset(720, 540),
	})
	local api = { panel = panel }

	local info = B.label("", {
		Parent = panel.body,
		Size = UDim2.new(1, 0, 0, 36),
		TextSize = Theme.small,
		TextColor3 = Theme.warn,
		Font = Theme.fontBlack,
		TextXAlignment = Enum.TextXAlignment.Center,
		TextWrapped = true,
	})

	local columns = B.new("Frame", {
		Size = UDim2.new(1, 0, 1, -104),
		Position = UDim2.fromOffset(0, 40),
		BackgroundTransparency = 1,
		Parent = panel.body,
	})
	local mine = B.new("Frame", {
		Size = UDim2.new(0.33, -4, 1, 0),
		BackgroundTransparency = 1,
		Parent = columns,
	})
	local offers = B.new("Frame", {
		Size = UDim2.new(0.34, -4, 1, 0),
		Position = UDim2.fromScale(0.33, 0),
		BackgroundTransparency = 1,
		Parent = columns,
	})
	local theirs = B.new("Frame", {
		Size = UDim2.new(0.33, -4, 1, 0),
		Position = UDim2.fromScale(0.67, 0),
		BackgroundTransparency = 1,
		Parent = columns,
	})

	local function header(holder, text, colour)
		B.label(text, {
			Parent = holder, Size = UDim2.new(1, 0, 0, 24), Font = Theme.fontBlack,
			TextSize = Theme.small, TextColor3 = colour, TextXAlignment = Enum.TextXAlignment.Center,
		})
	end
	header(mine, "SEUS ITENS", Theme.secondary)
	header(offers, "NA MESA", Theme.warn)
	header(theirs, "DO PARCEIRO", Theme.steal)

	local myScroll = B.scroll({ parent = mine, size = UDim2.new(1, 0, 1, -28), position = UDim2.fromOffset(0, 28), gap = 4 })
	local offerScroll = B.scroll({ parent = offers, size = UDim2.new(1, 0, 1, -28), position = UDim2.fromOffset(0, 28), gap = 4 })
	local theirScroll = B.scroll({ parent = theirs, size = UDim2.new(1, 0, 1, -28), position = UDim2.fromOffset(0, 28), gap = 4 })

	local footer = B.new("Frame", {
		Size = UDim2.new(1, 0, 0, 56),
		Position = UDim2.new(0, 0, 1, -56),
		BackgroundTransparency = 1,
		Parent = panel.body,
	})
	B.list(Enum.FillDirection.Horizontal, 8, Enum.HorizontalAlignment.Center).Parent = footer

	local confirmBtn = B.button({
		parent = footer,
		size = UDim2.new(0.48, 0, 1, 0),
		colour = Theme.primary,
		icon = "✔",
		text = "CONFIRMAR",
		order = 1,
		onClick = function()
			Net:send("TradeAction", "confirm")
		end,
	})
	B.button({
		parent = footer,
		size = UDim2.new(0.48, 0, 1, 0),
		colour = Theme.danger,
		icon = "✕",
		text = "CANCELAR",
		order = 2,
		textColour = Theme.text,
		onClick = function()
			Net:send("TradeAction", "cancel")
			panel.close()
		end,
	})

	local function itemRow(holder, label, colour, order, onClick, actionText)
		local card = B.card({
			parent = holder,
			size = UDim2.new(1, 0, 0, 40),
			colour = Theme.panelAlt,
			strokeColour = colour,
			strokeTransparency = 0.3,
			order = order,
			pad = 6,
		})
		B.label(label, {
			Parent = card, Size = UDim2.new(1, onClick and -40 or 0, 1, 0), TextSize = Theme.tiny,
			Font = Theme.fontBlack, TextColor3 = colour, TextTruncate = Enum.TextTruncate.AtEnd,
		})
		if onClick then
			B.button({
				parent = card,
				size = UDim2.fromOffset(34, 28),
				position = UDim2.new(1, -34, 0.5, -14),
				colour = Theme.panel,
				text = actionText or "+",
				textSize = Theme.tiny,
				textColour = Theme.text,
				gradient = false,
				height = 28,
				onClick = onClick,
			})
		end
		return card
	end

	local function petLabel(owned)
		local pet = Pets.byId[owned.id]
		return ("%s%s"):format(pet and pet.name or owned.id, owned.stars > 0 and (" " .. owned.stars .. "⭐") or "")
	end

	local function cropLabel(crop)
		local seed = Seeds.byId[crop.seed]
		local m = Mutations.label(crop.element, crop.aura)
		return ("%s%s — %s"):format(m ~= "" and (m .. " ") or "", seed and seed.name or crop.seed, Format.short(crop.value or 0))
	end

	function api.refresh()
		local trade = State.trade
		for _, scroll in { myScroll, offerScroll, theirScroll } do
			for _, child in scroll:GetChildren() do
				if child:IsA("Frame") then
					child:Destroy()
				end
			end
		end

		if not trade or trade.state == "invite" then
			info.Text = trade and ("%s quer trocar com você!"):format(trade.partner or "?")
				or "Nenhuma troca ativa. Aproxime-se de um jogador e use o ranking do servidor para convidar."
			confirmBtn.Visible = false
			if trade and trade.state == "invite" then
				B.button({
					parent = offerScroll,
					size = UDim2.new(1, 0, 0, 46),
					colour = Theme.primary,
					text = "ACEITAR TROCA",
					onClick = function()
						Net:send("TradeAction", "accept", trade.partnerId)
					end,
				})
			end
			return
		end

		confirmBtn.Visible = true
		panel.setSubtitle(("Trocando com %s"):format(trade.partner or "?"))
		info.Text = (trade.youConfirmed and trade.theyConfirmed)
			and "Finalizando..."
			or ("⚠ Qualquer mudança na oferta cancela as duas confirmações.  Você: %s  •  %s: %s"):format(
				trade.youConfirmed and "✔" or "…",
				trade.partner or "?",
				trade.theyConfirmed and "✔" or "…"
			)

		-- my items (not offered yet)
		local order = 0
		for _, owned in State.pets do
			if not owned.equipped and not table.find(trade.yourOffer.pets, owned.uid) then
				order += 1
				local pet = Pets.byId[owned.id]
				itemRow(myScroll, petLabel(owned), pet and Rarities.get(pet.rarity).colour or Theme.text, order, function()
					Net:send("TradeAction", "offer", "pet", owned.uid)
				end, "+")
			end
		end
		for index, crop in State.inventory do
			if not table.find(trade.yourOffer.crops, index) then
				order += 1
				itemRow(myScroll, cropLabel(crop), Theme.coins, order, function()
					Net:send("TradeAction", "offer", "crop", index)
				end, "+")
			end
		end

		-- on the table (mine, removable)
		order = 0
		for _, uid in trade.yourOffer.pets do
			for _, owned in State.pets do
				if owned.uid == uid then
					order += 1
					itemRow(offerScroll, petLabel(owned), Theme.secondary, order, function()
						Net:send("TradeAction", "offer", "pet", uid)
					end, "−")
				end
			end
		end
		for _, index in trade.yourOffer.crops do
			local crop = State.inventory[index]
			if crop then
				order += 1
				itemRow(offerScroll, cropLabel(crop), Theme.secondary, order, function()
					Net:send("TradeAction", "offer", "crop", index)
				end, "−")
			end
		end

		-- theirs (read-only)
		order = 0
		for _, uid in trade.theirOffer.pets do
			order += 1
			itemRow(theirScroll, "Pet oferecido", Theme.steal, order)
		end
		for _, index in trade.theirOffer.crops do
			order += 1
			itemRow(theirScroll, "Colheita oferecida", Theme.steal, order)
		end
		if order == 0 then
			C.empty(theirScroll, "📦", "Nada oferecido ainda")
		end
	end

	return api
end

return Panel
