--!nonstrict
-- Rebirth screen. Shows exactly what is lost, exactly what is gained, and what
-- the next rebirth unlocks — the three things a player needs before they will
-- willingly delete their own progress.

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
local Ranks = Config.Ranks

local Panel = {}

function Panel.build(parent, app)
	local panel = C.panel({
		parent = parent,
		name = "Rebirth",
		title = "RENASCIMENTO",
		icon = "♻️",
		tint = Color3.fromRGB(90, 50, 150),
		size = UDim2.fromOffset(640, 520),
	})
	local list = B.scroll({ parent = panel.body, gap = 10 })
	local api = { panel = panel }

	function api.refresh()
		for _, child in list:GetChildren() do
			if child:IsA("Frame") or child:IsA("TextButton") then
				child:Destroy()
			end
		end

		local cost = State.rebirthCost or Economy.rebirthCost(State.rebirths)
		local afford = State.coins >= cost
		local next_ = State.rebirths + 1
		panel.setSubtitle(("Renascimento atual: %d"):format(State.rebirths))

		-- current rank / next rank
		local rank = Ranks:for_(State.rebirths)
		local nextRank = nil
		for _, r in Ranks.list do
			if r.rebirths > State.rebirths then
				nextRank = r
				break
			end
		end

		local header = B.card({
			parent = list,
			size = UDim2.new(1, 0, 0, 92),
			colour = Theme.panel,
			strokeColour = rank.colour,
			order = 1,
			pad = 12,
		})
		B.label(("%s %s"):format(rank.icon, rank.name), {
			Parent = header,
			Size = UDim2.new(1, 0, 0, 28),
			Font = Theme.fontBlack,
			TextSize = Theme.h2,
			TextColor3 = rank.colour,
		})
		if nextRank then
			B.label(
				("Próximo rank: %s %s em %d renascimentos"):format(
					nextRank.icon,
					nextRank.name,
					nextRank.rebirths - State.rebirths
				),
				{
					Parent = header,
					Size = UDim2.new(1, 0, 0, 20),
					Position = UDim2.fromOffset(0, 30),
					TextSize = Theme.small,
					TextColor3 = Theme.textDim,
					Font = Theme.fontBody,
				}
			)
			B.bar({
				parent = header,
				size = UDim2.new(1, 0, 0, 14),
				position = UDim2.fromOffset(0, 54),
				colour = nextRank.colour,
				value = State.rebirths / math.max(nextRank.rebirths, 1),
				text = ("%d / %d"):format(State.rebirths, nextRank.rebirths),
			})
		end

		-- gains
		local gains = B.card({
			parent = list,
			size = UDim2.new(1, 0, 0, 118),
			colour = Theme.panelAlt,
			strokeColour = Theme.primary,
			order = 2,
			pad = 12,
		})
		B.label("✅ VOCÊ GANHA", {
			Parent = gains,
			Size = UDim2.new(1, 0, 0, 20),
			Font = Theme.fontBlack,
			TextSize = Theme.small,
			TextColor3 = Theme.primary,
		})
		local unlocked = {}
		for _, seed in Seeds.all do
			if seed.unlockRebirth == next_ and seed.cost > 0 then
				table.insert(unlocked, seed.name)
			end
		end
		local gainLines = {
			("• +%s no valor de venda, para sempre (acumula a cada renascimento)"):format(
				Format.percent(Config.Balance.rebirthValueBonus, 0)
			),
			("• %s gemas de bônus"):format(Format.short(Config.Balance.rebirthGemReward * next_)),
			"• Seus pets e o armazém são mantidos",
		}
		if #unlocked > 0 then
			table.insert(gainLines, "• Desbloqueia: " .. table.concat(unlocked, ", "))
		end
		B.label(table.concat(gainLines, "\n"), {
			Parent = gains,
			Size = UDim2.new(1, 0, 0, 84),
			Position = UDim2.fromOffset(0, 22),
			TextSize = Theme.tiny,
			TextColor3 = Theme.text,
			Font = Theme.fontBody,
			TextWrapped = true,
			TextYAlignment = Enum.TextYAlignment.Top,
		})

		-- losses
		local losses = B.card({
			parent = list,
			size = UDim2.new(1, 0, 0, 92),
			colour = Theme.panelAlt,
			strokeColour = Theme.danger,
			order = 3,
			pad = 12,
		})
		B.label("⚠️ VOCÊ PERDE", {
			Parent = losses,
			Size = UDim2.new(1, 0, 0, 20),
			Font = Theme.fontBlack,
			TextSize = Theme.small,
			TextColor3 = Theme.danger,
		})
		B.label(
			"• Todas as moedas\n• Todas as plantas e sementes\n• As melhorias (exceto Armazém e Lanternas)",
			{
				Parent = losses,
				Size = UDim2.new(1, 0, 0, 60),
				Position = UDim2.fromOffset(0, 22),
				TextSize = Theme.tiny,
				TextColor3 = Theme.textDim,
				Font = Theme.fontBody,
				TextWrapped = true,
				TextYAlignment = Enum.TextYAlignment.Top,
			}
		)

		-- action
		local btn = B.button({
			parent = list,
			size = UDim2.new(1, 0, 0, 64),
			colour = afford and Theme.steal or Theme.panel,
			icon = "♻️",
			text = afford and "RENASCER AGORA"
				or ("Faltam %s moedas"):format(Format.short(cost - State.coins)),
			sub = ("Custo: %s moedas"):format(Format.short(cost)),
			textSize = Theme.h3,
			textColour = afford and Theme.text or Theme.textDim,
			subColour = afford and Theme.text or Theme.textFaint,
			gradient = afford,
			order = 4,
			onClick = function()
				if not afford then
					return
				end
				C.confirm(app.HudController:overlayLayer(), {
					title = "Renascer?",
					body = ("Você vai perder <b>%s moedas</b>, suas plantas e sementes.\n\nEm troca: <b>+%s</b> de valor permanente e <b>%s gemas</b>."):format(
						Format.short(State.coins),
						Format.percent(Config.Balance.rebirthValueBonus, 0),
						Format.short(Config.Balance.rebirthGemReward * next_)
					),
					tint = Theme.steal,
					confirmText = "Renascer",
					onConfirm = function()
						Net:send("Rebirth")
					end,
				})
			end,
		})
		B.setDisabled(btn, not afford)

		-- the paid shortcut, shown last and clearly optional
		local token = Config.Products.byKey.rebirthToken
		B.button({
			parent = list,
			size = UDim2.new(1, 0, 0, 52),
			colour = Theme.panelAlt,
			icon = token.icon,
			text = ("%s — %s Robux"):format(token.name, Format.comma(token.robux)),
			sub = token.desc,
			textSize = Theme.small,
			textColour = Theme.text,
			subColour = Theme.textDim,
			gradient = false,
			order = 5,
			onClick = function()
				Net:send("PromptProduct", "rebirthToken")
			end,
		})
	end

	return api
end

return Panel
