--!nonstrict
-- Event altar: what is running, what is coming, and the full catalogue with
-- its real modifiers. Telling players exactly what each event does is what
-- makes them wait for one instead of logging off.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local State = require(script.Parent.Parent.Parent.State)
local B = require(script.Parent.Parent.Builder)
local C = require(script.Parent.Parent.Components)

local Theme = Config.Theme
local Events = Config.Events
local Mutations = Config.Mutations

local Panel = {}

local MOD_LABELS = {
	luckMult = "🍀 Sorte",
	coinMult = "💰 Moedas",
	growMult = "⚡ Crescimento",
	stealSpeed = "🥷 Tempo de roubo",
}

function Panel.build(parent, _app)
	local panel = C.panel({
		parent = parent,
		name = "Events",
		title = "EVENTOS GLOBAIS",
		icon = "🌀",
		tint = Color3.fromRGB(130, 40, 50),
	})
	local list = B.scroll({ parent = panel.body, gap = 8 })
	local api = { panel = panel }

	local function modText(mods)
		local parts = {}
		for key, value in mods do
			local label = MOD_LABELS[key]
			if label then
				if key == "stealSpeed" then
					table.insert(
						parts,
						("%s %s"):format(label, Format.percent(1 - value, 0) .. " mais rápido")
					)
				else
					table.insert(parts, ("%s %s"):format(label, Format.multiplier(value)))
				end
			end
		end
		if mods.mutationUnlock then
			local mut = Mutations.byId[mods.mutationUnlock]
			if mut then
				table.insert(parts, ("✨ Libera %s (%s)"):format(mut.name, Format.multiplier(mut.mult)))
			end
		end
		return table.concat(parts, "  •  ")
	end

	function api.refresh()
		for _, child in list:GetChildren() do
			if child:IsA("Frame") then
				child:Destroy()
			end
		end

		local active = State.event
		if active then
			local left = math.max(0, (active.endsAt or 0) - State.now())
			panel.setSubtitle(("%s — %s restantes"):format(active.name or "", Format.clock(left)))
			local card = B.card({
				parent = list,
				size = UDim2.new(1, 0, 0, 118),
				colour = Theme.panel,
				strokeColour = active.colour or Theme.warn,
				strokeThickness = 3.5,
				order = 1,
				pad = 12,
			})
			B.gradient((active.colour or Theme.warn):Lerp(Theme.panel, 0.6), Theme.panel, 115).Parent = card
			B.label(("%s %s — ACONTECENDO AGORA"):format(active.icon or "", active.name or ""), {
				Parent = card,
				Size = UDim2.new(1, 0, 0, 26),
				Font = Theme.fontBlack,
				TextSize = Theme.h3,
				TextColor3 = active.colour or Theme.warn,
			})
			B.label(active.desc or "", {
				Parent = card,
				Size = UDim2.new(1, 0, 0, 36),
				Position = UDim2.fromOffset(0, 28),
				TextSize = Theme.small,
				TextColor3 = Theme.text,
				Font = Theme.fontBody,
				TextWrapped = true,
				TextYAlignment = Enum.TextYAlignment.Top,
			})
			B.label(modText(active.mods or {}), {
				Parent = card,
				Size = UDim2.new(1, 0, 0, 18),
				Position = UDim2.fromOffset(0, 66),
				TextSize = Theme.tiny,
				TextColor3 = Theme.primary,
				Font = Theme.fontBlack,
			})
			B.bar({
				parent = card,
				size = UDim2.new(1, 0, 0, 18),
				position = UDim2.fromOffset(0, 86),
				colour = active.colour or Theme.warn,
				value = left / math.max(active.duration or left, 1),
				text = Format.clock(left),
			})
		else
			local left = math.max(0, (State.nextEventAt or 0) - State.now())
			panel.setSubtitle(("Próximo evento em %s"):format(Format.clock(left)))
			local card = B.card({
				parent = list,
				size = UDim2.new(1, 0, 0, 74),
				colour = Theme.panel,
				strokeColour = Theme.textDim,
				order = 1,
				pad = 12,
			})
			B.label("⏳ Nenhum evento ativo", {
				Parent = card,
				Size = UDim2.new(1, 0, 0, 24),
				Font = Theme.fontBlack,
				TextSize = Theme.body,
				TextColor3 = Theme.textDim,
			})
			B.bar({
				parent = card,
				size = UDim2.new(1, 0, 0, 18),
				position = UDim2.fromOffset(0, 28),
				colour = Theme.secondary,
				value = 1 - (left / Events.interval),
				text = ("Próximo em %s"):format(Format.clock(left)),
			})
		end

		-- the paid option that creates one for everyone
		local boost = Config.Products.byKey.boostServer
		B.button({
			parent = list,
			size = UDim2.new(1, 0, 0, 58),
			colour = Theme.steal,
			icon = boost.icon,
			text = ("%s — %s Robux"):format(boost.name, Format.comma(boost.robux)),
			sub = boost.desc,
			textSize = Theme.small,
			order = 2,
			onClick = function()
				Net:send("PromptProduct", "boostServer")
			end,
		})

		B.label("TODOS OS EVENTOS", {
			Parent = list,
			Size = UDim2.new(1, 0, 0, 26),
			LayoutOrder = 3,
			Font = Theme.fontBlack,
			TextSize = Theme.small,
			TextColor3 = Theme.textDim,
		})

		local sorted = table.clone(Events.all)
		table.sort(sorted, function(a, b)
			return a.weight > b.weight
		end)
		for order, event in sorted do
			local card = B.card({
				parent = list,
				size = UDim2.new(1, 0, 0, 92),
				colour = Theme.panelAlt,
				strokeColour = event.colour,
				strokeTransparency = 0.25,
				order = 10 + order,
				pad = 10,
			})
			B.label(event.icon, {
				Parent = card,
				Size = UDim2.fromOffset(44, 44),
				TextSize = 28,
				TextXAlignment = Enum.TextXAlignment.Center,
			})
			B.label(event.name, {
				Parent = card,
				Size = UDim2.new(1, -50, 0, 20),
				Position = UDim2.fromOffset(48, 0),
				Font = Theme.fontBlack,
				TextSize = Theme.small,
				TextColor3 = event.colour,
			})
			B.label(event.desc, {
				Parent = card,
				Size = UDim2.new(1, -50, 0, 34),
				Position = UDim2.fromOffset(48, 20),
				TextSize = Theme.tiny,
				TextColor3 = Theme.textDim,
				Font = Theme.fontBody,
				TextWrapped = true,
				TextYAlignment = Enum.TextYAlignment.Top,
			})
			B.label(
				("%s  •  ⏱ %s  •  Chance %s"):format(
					modText(event.mods),
					Format.time(event.duration),
					Format.percent(event.weight / 134, 0)
				),
				{
					Parent = card,
					Size = UDim2.new(1, -50, 0, 16),
					Position = UDim2.fromOffset(48, 56),
					TextSize = Theme.tiny,
					TextColor3 = Theme.primary,
					Font = Theme.fontBlack,
				}
			)
		end
	end

	return api
end

return Panel
