--!nonstrict
-- Eggs + pet collection. Two tabs: hatching (with live timers) and the pet
-- list (equip / fuse / release). Buff numbers are shown resolved, including the
-- star multiplier, so a player can see exactly what equipping changes.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local State = require(script.Parent.Parent.Parent.State)
local B = require(script.Parent.Parent.Builder)
local C = require(script.Parent.Parent.Components)

local Theme = Config.Theme
local Pets = Config.Pets
local Eggs = Config.Eggs
local Rarities = Config.Rarities

local Panel = {}

local BUFF_LABELS = {
	coins = { "💰", "moedas" },
	grow = { "⚡", "crescimento" },
	luck = { "🍀", "sorte" },
	defense = { "🛡️", "defesa" },
	thief = { "🥷", "roubo mais rápido" },
	offline = { "🌙", "offline" },
	autoHarvest = { "🤖", "colheita automática" },
}

local function buffText(pet, stars: number): string
	local parts = {}
	local mult = Pets.starMultiplier(stars)
	for key, value in pet.buff do
		local info = BUFF_LABELS[key]
		if info then
			if key == "autoHarvest" then
				table.insert(parts, ("%s %ds %s"):format(info[1], math.floor(value), info[2]))
			else
				table.insert(parts, ("%s +%.0f%% %s"):format(info[1], value * mult, info[2]))
			end
		end
	end
	return table.concat(parts, "  ")
end

function Panel.build(parent, app)
	local panel = C.panel({
		parent = parent,
		name = "Pets",
		title = "OVOS E PETS",
		icon = "🐾",
		tint = Color3.fromRGB(150, 40, 80),
	})
	local api = { panel = panel, mode = "eggs" }

	local tabsHolder = B.new("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = panel.body })
	local content = B.new("Frame", {
		Size = UDim2.new(1, 0, 1, -50),
		Position = UDim2.fromOffset(0, 50),
		BackgroundTransparency = 1,
		Parent = panel.body,
	})
	local eggList = B.scroll({ parent = content, gap = 8 })
	local petList = B.scroll({ parent = content, gap = 6 })
	petList.Visible = false

	local _, select = C.tabs(tabsHolder, { "Ovos", "Meus Pets" }, function(index)
		api.mode = index == 1 and "eggs" or "pets"
		api.refresh()
	end)

	-- Eggs ---------------------------------------------------------------

	local function hatchingCard(slot, index)
		local egg = Eggs.byId[slot.id]
		if not egg then
			return
		end
		local left = math.max(0, (slot.startedAt + slot.duration) - State.now())
		local ready = left <= 0
		local row = B.card({
			parent = eggList,
			size = UDim2.new(1, 0, 0, 72),
			colour = Theme.panelAlt,
			strokeColour = ready and Theme.primary or egg.colour,
			strokeTransparency = 0,
			order = index,
			pad = 10,
		})
		local shell = B.new("Frame", {
			Size = UDim2.fromOffset(46, 52),
			Position = UDim2.fromOffset(0, 0),
			BackgroundColor3 = egg.colour,
			Parent = row,
		})
		B.corner(22).Parent = shell
		B.label("🥚", {
			Parent = shell, Size = UDim2.fromScale(1, 1), TextSize = 26,
			TextXAlignment = Enum.TextXAlignment.Center,
		})
		B.label(egg.name, {
			Parent = row, Size = UDim2.new(1, -200, 0, 20), Position = UDim2.fromOffset(56, 0),
			Font = Theme.fontBlack, TextSize = Theme.small, TextColor3 = egg.colour,
		})
		local bar = B.bar({
			parent = row,
			size = UDim2.new(1, -200, 0, 18),
			position = UDim2.fromOffset(56, 26),
			colour = ready and Theme.primary or Theme.secondary,
			value = ready and 1 or 1 - (left / math.max(slot.duration, 1)),
			text = ready and "PRONTO!" or Format.clock(left),
		})
		B.button({
			parent = row,
			size = UDim2.fromOffset(140, 46),
			position = UDim2.new(1, -140, 0, 3),
			colour = ready and Theme.primary or Theme.panel,
			text = ready and "ABRIR" or "CHOCANDO",
			textSize = Theme.small,
			textColour = ready and Color3.fromRGB(16, 20, 28) or Theme.textDim,
			gradient = ready,
			onClick = function()
				if ready then
					Net:send("HatchEgg", index)
				end
			end,
		})
	end

	local function eggShopCard(egg, order)
		local locked = egg.unlockRebirth > State.rebirths
		local currency = egg.currency == "gems" and State.gems or State.coins
		local afford = currency >= egg.cost
		local row = B.card({
			parent = eggList,
			size = UDim2.new(1, 0, 0, 76),
			colour = Theme.panelAlt,
			strokeColour = egg.colour,
			strokeTransparency = locked and 0.6 or 0.2,
			order = order + 100,
			pad = 10,
		})
		local shell = B.new("Frame", {
			Size = UDim2.fromOffset(46, 54),
			BackgroundColor3 = egg.colour,
			Parent = row,
		})
		B.corner(22).Parent = shell
		B.gradient(egg.accent, egg.colour, 90).Parent = shell

		B.label(egg.name, {
			Parent = row, Size = UDim2.new(1, -200, 0, 20), Position = UDim2.fromOffset(56, 0),
			Font = Theme.fontBlack, TextSize = Theme.small, TextColor3 = egg.colour,
		})

		-- show the real pool with real odds: trust is worth more than mystery
		local pool = Pets.byEgg[egg.id] or {}
		local total = 0
		for _, pet in pool do
			total += pet.weight
		end
		local best, bestOrder = nil, 0
		for _, pet in pool do
			local o = Rarities.get(pet.rarity).order
			if o > bestOrder then
				best, bestOrder = pet, o
			end
		end
		B.label(("%d pets  •  ⏱ %s  •  Melhor: %s (%s)"):format(
			#pool,
			Format.time(egg.hatchTime),
			best and best.name or "?",
			best and Format.odds(best.weight / math.max(total, 1)) or "—"
		), {
			Parent = row, Size = UDim2.new(1, -200, 0, 32), Position = UDim2.fromOffset(56, 22),
			TextSize = Theme.tiny, TextColor3 = Theme.textDim, Font = Theme.fontBody, TextWrapped = true,
			TextYAlignment = Enum.TextYAlignment.Top,
		})

		local btn = B.button({
			parent = row,
			size = UDim2.fromOffset(140, 46),
			position = UDim2.new(1, -140, 0, 5),
			colour = locked and Theme.panel or (afford and (egg.currency == "gems" and Theme.gems or Theme.coins) or Theme.panel),
			icon = locked and "🔒" or (egg.currency == "gems" and "💎" or "💰"),
			text = locked and ("RB " .. egg.unlockRebirth) or Format.short(egg.cost),
			textSize = Theme.small,
			textColour = (not locked and afford) and Color3.fromRGB(16, 20, 28) or Theme.textDim,
			gradient = not locked and afford,
			onClick = function()
				if locked then
					app.PanelController:open("rebirth")
				else
					Net:send("BuyEgg", egg.id)
				end
			end,
		})
		B.setDisabled(btn, not locked and not afford)
	end

	-- Pets ---------------------------------------------------------------

	local function petRow(owned, order)
		local pet = Pets.byId[owned.id]
		if not pet then
			return
		end
		local rarity = Rarities.get(pet.rarity)
		local row = B.card({
			parent = petList,
			size = UDim2.new(1, 0, 0, 78),
			colour = owned.equipped and Theme.panel or Theme.panelAlt,
			strokeColour = owned.equipped and Theme.primary or rarity.colour,
			strokeTransparency = owned.equipped and 0 or 0.35,
			order = order,
			pad = 10,
		})
		local swatch = B.new("Frame", {
			Size = UDim2.fromOffset(46, 46),
			Position = UDim2.fromOffset(0, 5),
			BackgroundColor3 = pet.body,
			Parent = row,
		})
		B.corner(12).Parent = swatch
		B.stroke(pet.accent, 2.5, 0).Parent = swatch

		local stars = owned.stars > 0 and (" " .. string.rep("⭐", owned.stars)) or ""
		B.label(pet.name .. stars, {
			Parent = row, Size = UDim2.new(1, -230, 0, 20), Position = UDim2.fromOffset(54, 2),
			Font = Theme.fontBlack, TextSize = Theme.small, TextColor3 = rarity.colour,
		})
		B.label(buffText(pet, owned.stars), {
			Parent = row, Size = UDim2.new(1, -230, 0, 34), Position = UDim2.fromOffset(54, 22),
			TextSize = Theme.tiny, TextColor3 = Theme.textDim, Font = Theme.fontBody,
			TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top,
		})

		B.button({
			parent = row,
			size = UDim2.fromOffset(96, 40),
			position = UDim2.new(1, -220, 0, 8),
			colour = owned.equipped and Theme.warn or Theme.primary,
			text = owned.equipped and "REMOVER" or "EQUIPAR",
			textColour = Color3.fromRGB(16, 20, 28),
			textSize = Theme.tiny,
			onClick = function()
				Net:send(owned.equipped and "UnequipPet" or "EquipPet", owned.uid)
			end,
		})

		-- count duplicates to show whether fusing is possible
		local dupes = 0
		for _, other in State.pets do
			if other.id == owned.id and other.stars == owned.stars and not other.equipped then
				dupes += 1
			end
		end
		local canFuse = dupes >= Config.Balance.fuseCount and owned.stars < Pets.maxStars
		B.button({
			parent = row,
			size = UDim2.fromOffset(60, 40),
			position = UDim2.new(1, -118, 0, 8),
			colour = canFuse and Theme.steal or Theme.panel,
			icon = "⭐",
			textSize = Theme.tiny,
			textColour = canFuse and Theme.text or Theme.textFaint,
			gradient = false,
			onClick = function()
				if canFuse then
					Net:send("FusePets", owned.uid)
				else
					app.FeedbackController:toast({
						kind = "info",
						title = ("Precisa de %d cópias"):format(Config.Balance.fuseCount),
						body = ("Você tem %d de %s com %d estrelas."):format(dupes, pet.name, owned.stars),
					})
				end
			end,
		})
		B.button({
			parent = row,
			size = UDim2.fromOffset(52, 40),
			position = UDim2.new(1, -54, 0, 8),
			colour = Theme.panel,
			icon = "🗑️",
			textSize = Theme.tiny,
			textColour = Theme.danger,
			gradient = false,
			onClick = function()
				if owned.equipped then
					app.FeedbackController:toast({ kind = "error", title = "Desequipe primeiro" })
					return
				end
				C.confirm(app.HudController:overlayLayer(), {
					title = "Soltar " .. pet.name .. "?",
					body = "Você recebe algumas gemas, mas o pet é perdido para sempre.",
					tint = Theme.danger,
					confirmText = "Soltar",
					onConfirm = function()
						Net:send("DeletePet", owned.uid)
					end,
				})
			end,
		})
	end

	-- Refresh ------------------------------------------------------------

	function api.refresh()
		local eggs = api.mode == "eggs"
		eggList.Visible = eggs
		petList.Visible = not eggs

		if eggs then
			for _, child in eggList:GetChildren() do
				if child:IsA("Frame") then
					child:Destroy()
				end
			end
			panel.setSubtitle(("%d/3 chocando"):format(#State.eggs))
			for i, slot in State.eggs do
				hatchingCard(slot, i)
			end
			for order, id in Eggs.order do
				eggShopCard(Eggs.byId[id], order)
			end
		else
			for _, child in petList:GetChildren() do
				if child:IsA("Frame") then
					child:Destroy()
				end
			end
			local slots = State.mult and State.mult.petSlots or 3
			local equipped = 0
			for _, p in State.pets do
				if p.equipped then
					equipped += 1
				end
			end
			panel.setSubtitle(("Equipados %d/%d  •  Total %d"):format(equipped, slots, #State.pets))
			if #State.pets == 0 then
				C.empty(petList, "🐾", "Nenhum pet ainda.\nCompre um ovo na aba Ovos!")
			else
				local sorted = table.clone(State.pets)
				table.sort(sorted, function(a, b)
					if a.equipped ~= b.equipped then
						return a.equipped
					end
					local pa, pb = Pets.byId[a.id], Pets.byId[b.id]
					local oa = pa and Rarities.get(pa.rarity).order or 0
					local ob = pb and Rarities.get(pb.rarity).order or 0
					if oa ~= ob then
						return oa > ob
					end
					return a.stars > b.stars
				end)
				for order, owned in sorted do
					petRow(owned, order)
				end
			end
		end
	end

	return api
end

return Panel
