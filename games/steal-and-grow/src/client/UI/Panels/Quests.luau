--!nonstrict
-- Missions, the daily login streak and code redemption, in one place — because
-- that is the screen a returning player opens first.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local State = require(script.Parent.Parent.Parent.State)
local B = require(script.Parent.Parent.Builder)
local C = require(script.Parent.Parent.Components)

local Theme = Config.Theme
local Balance = Config.Balance

local Panel = {}

function Panel.build(parent, _app)
	local panel = C.panel({
		parent = parent,
		name = "Quests",
		title = "MISSÕES E PRÊMIOS",
		icon = "📋",
		tint = Color3.fromRGB(160, 110, 30),
	})
	local api = { panel = panel, mode = "quests" }

	local tabsHolder =
		B.new("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = panel.body })
	local content = B.new("Frame", {
		Size = UDim2.new(1, 0, 1, -50),
		Position = UDim2.fromOffset(0, 50),
		BackgroundTransparency = 1,
		Parent = panel.body,
	})
	local questList = B.scroll({ parent = content, gap = 8 })
	local dailyList = B.scroll({ parent = content, gap = 8 })
	dailyList.Visible = false
	local codeList = B.scroll({ parent = content, gap = 8 })
	codeList.Visible = false

	C.tabs(tabsHolder, { "Missões", "Login Diário", "Códigos" }, function(index)
		api.mode = ({ "quests", "daily", "codes" })[index]
		api.refresh()
	end)

	-- Quests -------------------------------------------------------------

	local function questRow(quest, order)
		local done = quest.progress >= quest.goal
		local row = B.card({
			parent = questList,
			size = UDim2.new(1, 0, 0, 82),
			colour = Theme.panelAlt,
			strokeColour = quest.claimed and Theme.stroke
				or (done and Theme.primary or (quest.weekly and Theme.steal or Theme.warn)),
			strokeTransparency = quest.claimed and 0.6 or 0,
			order = order,
			pad = 10,
		})
		B.label(quest.icon, {
			Parent = row,
			Size = UDim2.fromOffset(42, 42),
			Position = UDim2.fromOffset(0, 2),
			TextSize = 26,
			TextXAlignment = Enum.TextXAlignment.Center,
		})
		B.label(quest.name .. (quest.weekly and "  [SEMANAL]" or ""), {
			Parent = row,
			Size = UDim2.new(1, -190, 0, 20),
			Position = UDim2.fromOffset(46, 0),
			Font = Theme.fontBlack,
			TextSize = Theme.small,
			TextColor3 = quest.weekly and Theme.steal or Theme.text,
		})
		B.label(quest.desc, {
			Parent = row,
			Size = UDim2.new(1, -190, 0, 18),
			Position = UDim2.fromOffset(46, 20),
			TextSize = Theme.tiny,
			TextColor3 = Theme.textDim,
			Font = Theme.fontBody,
		})
		B.bar({
			parent = row,
			size = UDim2.new(1, -190, 0, 18),
			position = UDim2.fromOffset(46, 42),
			colour = done and Theme.primary or Theme.secondary,
			value = quest.progress / math.max(quest.goal, 1),
			text = ("%s / %s"):format(Format.short(quest.progress), Format.short(quest.goal)),
		})

		local rewardText = {}
		if quest.reward.gems then
			table.insert(rewardText, "💎 " .. Format.short(quest.reward.gems))
		end
		if quest.reward.coins then
			table.insert(rewardText, "💰 " .. Format.short(quest.reward.coins))
		end
		if quest.reward.egg then
			local egg = Config.Eggs.byId[quest.reward.egg]
			table.insert(rewardText, "🥚 " .. (egg and egg.name or "ovo"))
		end

		local btn = B.button({
			parent = row,
			size = UDim2.fromOffset(170, 52),
			position = UDim2.new(1, -170, 0, 5),
			colour = quest.claimed and Theme.panel or (done and Theme.primary or Theme.panel),
			text = quest.claimed and "RESGATADO" or (done and "RESGATAR" or "EM PROGRESSO"),
			sub = table.concat(rewardText, "  "),
			textSize = Theme.small,
			textColour = (done and not quest.claimed) and Color3.fromRGB(16, 20, 28) or Theme.textDim,
			subColour = (done and not quest.claimed) and Color3.fromRGB(32, 42, 56) or Theme.textFaint,
			gradient = done and not quest.claimed,
			onClick = function()
				if done and not quest.claimed then
					Net:send("ClaimQuest", quest.key)
				end
			end,
		})
		B.setDisabled(btn, quest.claimed or not done)
	end

	-- Daily --------------------------------------------------------------

	local function buildDaily()
		for _, child in dailyList:GetChildren() do
			if child:IsA("Frame") or child:IsA("TextButton") then
				child:Destroy()
			end
		end
		local daily = State.daily
		local streak = daily and daily.streak or 0
		local canClaim = daily and daily.canClaim

		local header = B.card({
			parent = dailyList,
			size = UDim2.new(1, 0, 0, 72),
			colour = Theme.panel,
			strokeColour = Theme.warn,
			order = 1,
			pad = 12,
		})
		B.label(("🔥 Sequência: %d dia(s)"):format(streak), {
			Parent = header,
			Size = UDim2.new(1, 0, 0, 24),
			Font = Theme.fontBlack,
			TextSize = Theme.h3,
			TextColor3 = Theme.warn,
		})
		B.label(
			canClaim and "Seu prêmio de hoje está disponível!"
				or "Volte amanhã para continuar a sequência.",
			{
				Parent = header,
				Size = UDim2.new(1, 0, 0, 22),
				Position = UDim2.fromOffset(0, 26),
				TextSize = Theme.small,
				TextColor3 = Theme.textDim,
				Font = Theme.fontBody,
			}
		)

		local grid = B.new("Frame", {
			Size = UDim2.new(1, 0, 0, 118),
			BackgroundTransparency = 1,
			LayoutOrder = 2,
			Parent = dailyList,
		})
		B.grid(UDim2.fromOffset(88, 104), UDim2.fromOffset(6, 6)).Parent = grid

		for day, reward in Balance.dailyRewards do
			local slot = ((streak - 1) % #Balance.dailyRewards) + 1
			local claimedDay = day <= slot and not canClaim or day < slot
			local isToday = canClaim and day == (streak % #Balance.dailyRewards) + 1
			local card = B.card({
				parent = grid,
				size = UDim2.fromOffset(88, 104),
				colour = isToday and Theme.panel or Theme.panelAlt,
				strokeColour = isToday and Theme.warn or (claimedDay and Theme.primary or Theme.stroke),
				strokeTransparency = isToday and 0 or 0.4,
				order = day,
				pad = 6,
			})
			B.label("Dia " .. day, {
				Parent = card,
				Size = UDim2.new(1, 0, 0, 16),
				TextSize = Theme.tiny,
				TextXAlignment = Enum.TextXAlignment.Center,
				Font = Theme.fontBlack,
				TextColor3 = isToday and Theme.warn or Theme.textDim,
			})
			local icon = reward.egg and "🥚" or (reward.gems and "💎" or "💰")
			B.label(icon, {
				Parent = card,
				Size = UDim2.new(1, 0, 0, 36),
				Position = UDim2.fromOffset(0, 18),
				TextSize = 28,
				TextXAlignment = Enum.TextXAlignment.Center,
			})
			local text = reward.egg
					and (Config.Eggs.byId[reward.egg] and Config.Eggs.byId[reward.egg].name or "Ovo")
				or (reward.gems and Format.short(reward.gems) .. " gemas")
				or (Format.time((reward.minutes or 0) * 60) .. " de moedas")
			B.label(text, {
				Parent = card,
				Size = UDim2.new(1, 0, 0, 30),
				Position = UDim2.fromOffset(0, 54),
				TextSize = Theme.tiny,
				TextXAlignment = Enum.TextXAlignment.Center,
				TextColor3 = Theme.textDim,
				Font = Theme.fontBody,
				TextWrapped = true,
			})
			if claimedDay then
				B.label("✔", {
					Parent = card,
					Size = UDim2.new(1, 0, 0, 20),
					Position = UDim2.new(0, 0, 1, -20),
					TextSize = Theme.body,
					TextXAlignment = Enum.TextXAlignment.Center,
					TextColor3 = Theme.primary,
				})
			end
		end

		local btn = B.button({
			parent = dailyList,
			size = UDim2.new(1, 0, 0, 56),
			colour = canClaim and Theme.warn or Theme.panel,
			icon = "🎁",
			text = canClaim and "RESGATAR PRÊMIO DE HOJE" or "JÁ RESGATADO HOJE",
			order = 3,
			textColour = canClaim and Color3.fromRGB(16, 20, 28) or Theme.textDim,
			gradient = canClaim,
			onClick = function()
				if canClaim then
					Net:send("ClaimDaily")
				end
			end,
		})
		B.setDisabled(btn, not canClaim)
	end

	-- Codes --------------------------------------------------------------

	local function buildCodes()
		for _, child in codeList:GetChildren() do
			if child:IsA("Frame") or child:IsA("TextButton") then
				child:Destroy()
			end
		end
		local card = B.card({
			parent = codeList,
			size = UDim2.new(1, 0, 0, 132),
			colour = Theme.panel,
			strokeColour = Theme.gems,
			order = 1,
			pad = 12,
		})
		B.label("Digite um código", {
			Parent = card,
			Size = UDim2.new(1, 0, 0, 22),
			Font = Theme.fontBlack,
			TextSize = Theme.body,
			TextColor3 = Theme.gems,
		})
		local box = B.new("TextBox", {
			Size = UDim2.new(1, 0, 0, 48),
			Position = UDim2.fromOffset(0, 26),
			BackgroundColor3 = Theme.bg,
			Text = "",
			PlaceholderText = "EX: LANCAMENTO",
			PlaceholderColor3 = Theme.textFaint,
			TextColor3 = Theme.text,
			Font = Theme.fontBlack,
			TextSize = Theme.body,
			ClearTextOnFocus = false,
			Parent = card,
		})
		B.corner(10).Parent = box
		B.stroke(Theme.stroke, 2, 0.2).Parent = box
		B.padding(nil, { left = 12, right = 12, top = 0, bottom = 0 }).Parent = box

		B.button({
			parent = card,
			size = UDim2.new(1, 0, 0, 46),
			position = UDim2.fromOffset(0, 80),
			colour = Theme.gems,
			icon = "🎟️",
			text = "RESGATAR",
			onClick = function()
				if #box.Text > 0 then
					Net:send("RedeemCode", box.Text)
					box.Text = ""
				end
			end,
		})

		local info = B.card({
			parent = codeList,
			size = UDim2.new(1, 0, 0, 96),
			colour = Theme.panelAlt,
			order = 2,
			pad = 12,
		})
		B.label("Onde conseguir códigos?", {
			Parent = info,
			Size = UDim2.new(1, 0, 0, 20),
			Font = Theme.fontBlack,
			TextSize = Theme.small,
		})
		B.label(
			"Códigos novos saem a cada atualização e em marcos de visitas. "
				.. "Entre no grupo do jogo e siga as redes sociais para não perder nenhum.",
			{
				Parent = info,
				Size = UDim2.new(1, 0, 0, 60),
				Position = UDim2.fromOffset(0, 22),
				TextSize = Theme.tiny,
				TextColor3 = Theme.textDim,
				Font = Theme.fontBody,
				TextWrapped = true,
				TextYAlignment = Enum.TextYAlignment.Top,
			}
		)
	end

	function api.refresh()
		questList.Visible = api.mode == "quests"
		dailyList.Visible = api.mode == "daily"
		codeList.Visible = api.mode == "codes"

		if api.mode == "quests" then
			for _, child in questList:GetChildren() do
				if child:IsA("Frame") then
					child:Destroy()
				end
			end
			local pending = 0
			for _, q in State.quests do
				if q.progress >= q.goal and not q.claimed then
					pending += 1
				end
			end
			panel.setSubtitle(pending > 0 and ("%d para resgatar!"):format(pending) or "")
			if #State.quests == 0 then
				C.empty(questList, "📋", "Carregando missões...")
			else
				for order, quest in State.quests do
					questRow(quest, order)
				end
			end
		elseif api.mode == "daily" then
			buildDaily()
		else
			buildCodes()
		end
	end

	return api
end

return Panel
