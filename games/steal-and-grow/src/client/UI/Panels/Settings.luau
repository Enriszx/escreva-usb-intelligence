--!nonstrict
-- Settings. Includes the manual graphics override, which matters a lot on
-- mobile: some players would rather have 60 FPS and flat plants, and some
-- want the full look on a device that can barely hold 25.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local State = require(script.Parent.Parent.Parent.State)
local B = require(script.Parent.Parent.Builder)
local C = require(script.Parent.Parent.Components)

local Theme = Config.Theme
local Panel = {}

function Panel.build(parent, app)
	local panel = C.panel({
		parent = parent,
		name = "Settings",
		title = "OPÇÕES",
		icon = "⚙️",
		tint = Color3.fromRGB(60, 66, 84),
		size = UDim2.fromOffset(560, 500),
	})
	local list = B.scroll({ parent = panel.body, gap = 8 })
	local api = { panel = panel }

	local function toggleRow(key, label, desc, order)
		local value = State.settings[key] ~= false
		local card = B.card({
			parent = list,
			size = UDim2.new(1, 0, 0, 64),
			colour = Theme.panelAlt,
			order = order,
			pad = 10,
		})
		B.label(label, {
			Parent = card,
			Size = UDim2.new(1, -110, 0, 20),
			Font = Theme.fontBlack,
			TextSize = Theme.small,
		})
		B.label(desc, {
			Parent = card,
			Size = UDim2.new(1, -110, 0, 22),
			Position = UDim2.fromOffset(0, 20),
			TextSize = Theme.tiny,
			TextColor3 = Theme.textDim,
			Font = Theme.fontBody,
			TextWrapped = true,
		})
		local btn
		btn = B.button({
			parent = card,
			size = UDim2.fromOffset(96, 42),
			position = UDim2.new(1, -96, 0, 1),
			colour = value and Theme.primary or Theme.panel,
			text = value and "LIGADO" or "DESLIGADO",
			textSize = Theme.tiny,
			textColour = value and Color3.fromRGB(16, 20, 28) or Theme.textDim,
			gradient = value,
			onClick = function()
				local newValue = State.settings[key] == false
				State.settings[key] = newValue
				Net:send("SetSetting", key, newValue)
				api.refresh()
			end,
		})
	end

	function api.refresh()
		for _, child in list:GetChildren() do
			if child:IsA("Frame") or child:IsA("TextButton") then
				child:Destroy()
			end
		end

		toggleRow("sfx", "Efeitos sonoros", "Sons de colheita, venda, alarme e mutação.", 1)
		toggleRow("music", "Música", "Trilha ambiente do mundo.", 2)
		toggleRow("alarms", "Alarme de roubo", "Avisa na tela quando alguém tenta roubar sua fazenda.", 3)
		toggleRow("announcements", "Anúncios globais", "Mensagens de mutações raras, roubos e eventos.", 4)

		-- graphics
		local card = B.card({
			parent = list,
			size = UDim2.new(1, 0, 0, 132),
			colour = Theme.panelAlt,
			strokeColour = Theme.secondary,
			order = 5,
			pad = 10,
		})
		B.label("Qualidade gráfica", {
			Parent = card,
			Size = UDim2.new(1, 0, 0, 20),
			Font = Theme.fontBlack,
			TextSize = Theme.small,
		})
		B.label(
			("Automático ajusta sozinho pelo seu FPS. Atual: %s"):format(app.GraphicsController.tier.name),
			{
				Parent = card,
				Size = UDim2.new(1, 0, 0, 20),
				Position = UDim2.fromOffset(0, 20),
				TextSize = Theme.tiny,
				TextColor3 = Theme.textDim,
				Font = Theme.fontBody,
			}
		)
		local row = B.new("Frame", {
			Size = UDim2.new(1, 0, 0, 46),
			Position = UDim2.fromOffset(0, 44),
			BackgroundTransparency = 1,
			Parent = card,
		})
		B.list(Enum.FillDirection.Horizontal, 5, Enum.HorizontalAlignment.Left).Parent = row
		for i, name in app.GraphicsController:tierNames() do
			local selected = (State.settings.quality or "auto") == name
			B.button({
				parent = row,
				size = UDim2.new(0, 94, 1, 0),
				colour = selected and Theme.secondary or Theme.panel,
				text = name == "auto" and "AUTO" or name:upper(),
				textSize = Theme.tiny,
				textColour = selected and Color3.fromRGB(16, 20, 28) or Theme.textDim,
				gradient = selected,
				order = i,
				onClick = function()
					State.settings.quality = name
					Net:send("SetSetting", "quality", name)
					app.GraphicsController:setManual(name)
					api.refresh()
				end,
			})
		end
		B.label(
			"Dica: no celular, use AUTO. Se travar, escolha Low ou Potato — o jogo continua bonito, só com menos detalhes por planta.",
			{
				Parent = card,
				Size = UDim2.new(1, 0, 0, 30),
				Position = UDim2.fromOffset(0, 94),
				TextSize = Theme.tiny,
				TextColor3 = Theme.textFaint,
				Font = Theme.fontBody,
				TextWrapped = true,
				TextYAlignment = Enum.TextYAlignment.Top,
			}
		)

		-- stats
		local stats = B.card({
			parent = list,
			size = UDim2.new(1, 0, 0, 142),
			colour = Theme.panel,
			order = 6,
			pad = 12,
		})
		B.label("📊 Suas estatísticas", {
			Parent = stats,
			Size = UDim2.new(1, 0, 0, 22),
			Font = Theme.fontBlack,
			TextSize = Theme.small,
			TextColor3 = Theme.gems,
		})
		local s = State.stats or {}
		B.label(
			("Colhidas: %s\nVendido: %s moedas\nRoubos feitos: %s  •  Roubos sofridos: %s\nRoubos bloqueados: %s\nOvos chocados: %s  •  Mutações: %s\nMelhor colheita: %s moedas"):format(
				Format.short(s.harvested or 0),
				Format.short(s.sold or 0),
				Format.short(s.stolen or 0),
				Format.short(s.robbed or 0),
				Format.short(s.blocked or 0),
				Format.short(s.hatched or 0),
				Format.short(s.mutations or 0),
				Format.short(s.bestCrop or 0)
			),
			{
				Parent = stats,
				Size = UDim2.new(1, 0, 0, 108),
				Position = UDim2.fromOffset(0, 24),
				TextSize = Theme.tiny,
				TextColor3 = Theme.textDim,
				Font = Theme.fontBody,
				TextYAlignment = Enum.TextYAlignment.Top,
			}
		)

		B.label(("%s v%s"):format(Config.Balance.gameName, Config.Balance.version), {
			Parent = list,
			Size = UDim2.new(1, 0, 0, 28),
			LayoutOrder = 7,
			TextSize = Theme.tiny,
			TextColor3 = Theme.textFaint,
			TextXAlignment = Enum.TextXAlignment.Center,
			Font = Theme.fontBody,
		})
	end

	return api
end

return Panel
