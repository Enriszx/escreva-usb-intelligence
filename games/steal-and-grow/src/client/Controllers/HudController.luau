--!nonstrict
-- The HUD. Everything a player sees without opening a menu.
--
-- Layout contract (and why):
--   top-left     currency + level     — the numbers that make you feel rich
--   top-right    live event + boosts  — time pressure, always visible
--   left dock    menu buttons         — thumb-reachable on a phone, icon-first
--   bottom-centre contextual action   — the one button that does the right
--                                       thing, the core of mobile play
--   bottom-right quick actions        — Colher Tudo / Vender Tudo / Casa
--   centre       steal bar + alarms   — unmissable by design
--
-- Everything scales from one UIScale driven by viewport height, and every
-- tappable element is >= 46px.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local GuiService = game:GetService("GuiService")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Economy = require(Shared.Economy)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local State = require(script.Parent.Parent.State)
local B = require(script.Parent.Parent.UI.Builder)
local C = require(script.Parent.Parent.UI.Components)

local Theme = Config.Theme
local HudController = { name = "HudController" }

local player = Players.LocalPlayer
local app
local gui: ScreenGui
local refs = {}

function HudController:init(a)
	app = a
end

-- Build ------------------------------------------------------------------

local MENU_BUTTONS = {
	{ panel = "shop", icon = "🌱", label = "Sementes", colour = Color3.fromRGB(96, 220, 140) },
	{ panel = "inventory", icon = "🧺", label = "Colheita", colour = Color3.fromRGB(255, 205, 70) },
	{ panel = "pets", icon = "🐾", label = "Pets", colour = Color3.fromRGB(236, 64, 122) },
	{ panel = "upgrades", icon = "⚒️", label = "Melhorias", colour = Color3.fromRGB(124, 170, 255) },
	{ panel = "quests", icon = "📋", label = "Missões", colour = Color3.fromRGB(255, 176, 60) },
	{ panel = "rebirth", icon = "♻️", label = "Renascer", colour = Color3.fromRGB(176, 118, 255) },
	{ panel = "index", icon = "📖", label = "Índice", colour = Color3.fromRGB(96, 226, 255) },
	{ panel = "leaderboard", icon = "🏆", label = "Ranking", colour = Color3.fromRGB(255, 215, 64) },
	{
		panel = "shopvip",
		icon = "👑",
		label = "VIP",
		colour = Color3.fromRGB(255, 179, 0),
		highlight = true,
	},
	{ panel = "settings", icon = "⚙️", label = "Opções", colour = Color3.fromRGB(150, 160, 184) },
}

local function buildCurrency(parent)
	local holder = B.new("Frame", {
		Name = "Currency",
		Size = UDim2.fromOffset(240, 148),
		Position = UDim2.fromOffset(14, 14),
		BackgroundTransparency = 1,
		Parent = parent,
	})
	local layout = B.list(Enum.FillDirection.Vertical, 6, Enum.HorizontalAlignment.Left)
	layout.Parent = holder

	local _, coinsValue = C.pill({
		parent = holder,
		name = "Coins",
		icon = "💰",
		value = "0",
		colour = Theme.coins,
		order = 1,
		size = UDim2.fromOffset(176, 44),
	})
	local _, gemsValue = C.pill({
		parent = holder,
		name = "Gems",
		icon = "💎",
		value = "0",
		colour = Theme.gems,
		order = 2,
		size = UDim2.fromOffset(150, 38),
	})

	local rankPill = B.new("Frame", {
		Name = "Rank",
		Size = UDim2.fromOffset(196, 42),
		BackgroundColor3 = Theme.panel,
		LayoutOrder = 3,
		Parent = holder,
	})
	B.corner(12).Parent = rankPill
	B.stroke(Theme.stroke, 2, 0.3).Parent = rankPill
	local rankLabel = B.label("🌱 Novato", {
		Parent = rankPill,
		Size = UDim2.new(1, -12, 0, 18),
		Position = UDim2.fromOffset(8, 3),
		TextSize = Theme.small,
		Font = Theme.fontBlack,
		Name = "RankText",
	})
	local xpBar = B.bar({
		parent = rankPill,
		size = UDim2.new(1, -16, 0, 13),
		position = UDim2.fromOffset(8, 24),
		colour = Theme.secondary,
		value = 0,
		text = "Nv. 1",
	})

	refs.coinsValue = coinsValue
	refs.gemsValue = gemsValue
	refs.rankLabel = rankLabel
	refs.xpBar = xpBar
	return holder
end

local function buildEventPanel(parent)
	local holder = B.new("Frame", {
		Name = "EventPanel",
		Size = UDim2.fromOffset(260, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		Position = UDim2.new(1, -274, 0, 14),
		BackgroundTransparency = 1,
		Parent = parent,
	})
	local layout = B.list(Enum.FillDirection.Vertical, 6, Enum.HorizontalAlignment.Right)
	layout.Parent = holder

	local banner = B.card({
		parent = holder,
		name = "Event",
		size = UDim2.new(1, 0, 0, 68),
		colour = Theme.panel,
		order = 1,
		pad = 8,
	})
	banner.Visible = false
	local eventTitle = B.label("", {
		Parent = banner,
		Size = UDim2.new(1, 0, 0, 20),
		Font = Theme.fontBlack,
		TextSize = Theme.small,
		Name = "EventTitle",
	})
	local eventDesc = B.label("", {
		Parent = banner,
		Size = UDim2.new(1, 0, 0, 26),
		Position = UDim2.fromOffset(0, 19),
		TextSize = Theme.tiny,
		TextColor3 = Theme.textDim,
		Font = Theme.fontBody,
		TextWrapped = true,
		TextYAlignment = Enum.TextYAlignment.Top,
		Name = "EventDesc",
	})
	local eventTimer = B.bar({
		parent = banner,
		size = UDim2.new(1, 0, 0, 12),
		position = UDim2.fromOffset(0, 48),
		colour = Theme.warn,
		value = 1,
		text = "",
	})

	local boosts = B.new("Frame", {
		Name = "Boosts",
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundTransparency = 1,
		LayoutOrder = 2,
		Parent = holder,
	})
	local bl = B.list(Enum.FillDirection.Vertical, 4, Enum.HorizontalAlignment.Right)
	bl.Parent = boosts

	refs.eventBanner = banner
	refs.eventTitle = eventTitle
	refs.eventDesc = eventDesc
	refs.eventTimer = eventTimer
	refs.boostHolder = boosts
	return holder
end

local function buildDock(parent)
	local phone = C.isPhone()
	local dock = B.new("Frame", {
		Name = "Dock",
		Size = phone and UDim2.fromOffset(72, 0) or UDim2.fromOffset(88, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		AnchorPoint = Vector2.new(0, 0.5),
		Position = UDim2.new(0, 14, 0.52, 0),
		BackgroundTransparency = 1,
		Parent = parent,
	})
	local layout = B.list(Enum.FillDirection.Vertical, 6, Enum.HorizontalAlignment.Left)
	layout.Parent = dock

	for i, entry in MENU_BUTTONS do
		local btn = B.button({
			parent = dock,
			name = entry.panel,
			size = UDim2.new(1, 0, 0, phone and 48 or 52),
			colour = entry.colour,
			order = i,
			onClick = function()
				app.PanelController:toggle(entry.panel)
			end,
		})
		local content = btn:FindFirstChild("Content")
		B.label(entry.icon, {
			Parent = content,
			Size = UDim2.new(0, 28, 1, 0),
			TextSize = 22,
			TextXAlignment = Enum.TextXAlignment.Center,
		})
		if not phone then
			B.label(entry.label, {
				Parent = content,
				Size = UDim2.new(1, -30, 1, 0),
				Position = UDim2.fromOffset(30, 0),
				TextSize = Theme.tiny,
				Font = Theme.fontBlack,
				TextColor3 = Color3.fromRGB(16, 20, 28),
			})
		end
		if entry.highlight then
			-- the VIP button pulses: it is the highest-value button on screen
			task.spawn(function()
				local stroke = btn:FindFirstChildWhichIsA("UIStroke")
				while btn.Parent do
					if stroke then
						TweenService:Create(
							stroke,
							TweenInfo.new(0.9),
							{ Transparency = 0.1, Color = Color3.fromRGB(255, 255, 255) }
						):Play()
						task.wait(0.95)
						TweenService:Create(
							stroke,
							TweenInfo.new(0.9),
							{ Transparency = 0.72, Color = Color3.new(0, 0, 0) }
						):Play()
						task.wait(0.95)
					else
						task.wait(1)
					end
				end
			end)
		end
		refs["dock_" .. entry.panel] = btn
	end
	return dock
end

local function buildAction(parent)
	local holder = B.new("Frame", {
		Name = "Action",
		Size = UDim2.fromOffset(330, 76),
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -18),
		BackgroundTransparency = 1,
		Parent = parent,
	})
	local btn = B.button({
		parent = holder,
		name = "Act",
		size = UDim2.fromScale(1, 1),
		colour = Theme.primary,
		radius = 20,
		onClick = function()
			app.InteractionController:act()
		end,
	})
	btn.Visible = false
	local content = btn:FindFirstChild("Content")
	local icon = B.label("", {
		Parent = content,
		Size = UDim2.new(0, 48, 1, 0),
		TextSize = 34,
		TextXAlignment = Enum.TextXAlignment.Center,
		Name = "Icon",
	})
	local label = B.label("", {
		Parent = content,
		Size = UDim2.new(1, -54, 0.54, 0),
		Position = UDim2.fromOffset(52, 2),
		Font = Theme.fontBlack,
		TextSize = Theme.h3,
		TextColor3 = Color3.fromRGB(16, 20, 28),
		Name = "Main",
		TextYAlignment = Enum.TextYAlignment.Bottom,
	})
	local detail = B.label("", {
		Parent = content,
		Size = UDim2.new(1, -54, 0.44, 0),
		Position = UDim2.new(0, 52, 0.54, 0),
		Font = Theme.fontBody,
		TextSize = Theme.small,
		TextColor3 = Color3.fromRGB(32, 42, 56),
		Name = "Detail",
		TextYAlignment = Enum.TextYAlignment.Top,
	})
	local hint = B.label("[E]", {
		Parent = holder,
		Size = UDim2.new(0, 40, 0, 18),
		Position = UDim2.new(1, -4, 0, -16),
		TextSize = Theme.tiny,
		TextColor3 = Theme.textFaint,
		TextXAlignment = Enum.TextXAlignment.Right,
	})
	hint.Visible = not C.isPhone()

	refs.actionButton = btn
	refs.actionIcon = icon
	refs.actionLabel = label
	refs.actionDetail = detail
	return holder
end

local function buildQuickActions(parent)
	local holder = B.new("Frame", {
		Name = "Quick",
		Size = UDim2.fromOffset(150, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		AnchorPoint = Vector2.new(1, 1),
		Position = UDim2.new(1, -14, 1, -18),
		BackgroundTransparency = 1,
		Parent = parent,
	})
	local layout = B.list(Enum.FillDirection.Vertical, 6, Enum.HorizontalAlignment.Right)
	layout.Parent = holder

	local function quick(icon, text, colour, order, onClick)
		return B.button({
			parent = holder,
			size = UDim2.new(1, 0, 0, 48),
			colour = colour,
			icon = icon,
			text = text,
			textSize = Theme.small,
			order = order,
			onClick = onClick,
		})
	end

	refs.harvestAll = quick("🧺", "Colher Tudo", Theme.primary, 1, function()
		Net:send("HarvestAll")
	end)
	refs.sellAll = quick("💰", "Vender Tudo", Theme.coins, 2, function()
		Net:send("SellAll")
	end)
	quick("🏠", "Minha Fazenda", Theme.secondary, 3, function()
		Net:send("GoHome")
	end)
	return holder
end

local function buildStealBar(parent)
	local holder = B.new("Frame", {
		Name = "StealBar",
		Size = UDim2.fromOffset(360, 92),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.66),
		BackgroundColor3 = Theme.panel,
		Visible = false,
		ZIndex = Theme.z.overlay,
		Parent = parent,
	})
	B.corner(Theme.radius).Parent = holder
	B.stroke(Theme.steal, 3, 0).Parent = holder
	B.padding(10).Parent = holder

	B.label("🥷 ROUBANDO...", {
		Parent = holder,
		Size = UDim2.new(1, 0, 0, 24),
		Font = Theme.fontBlack,
		TextSize = Theme.h3,
		TextColor3 = Theme.steal,
		TextXAlignment = Enum.TextXAlignment.Center,
		Name = "Title",
	})
	local sub = B.label("", {
		Parent = holder,
		Size = UDim2.new(1, 0, 0, 18),
		Position = UDim2.fromOffset(0, 24),
		TextSize = Theme.small,
		TextColor3 = Theme.textDim,
		Font = Theme.fontBody,
		TextXAlignment = Enum.TextXAlignment.Center,
		Name = "Sub",
	})
	local bar = B.bar({
		parent = holder,
		size = UDim2.new(1, 0, 0, 22),
		position = UDim2.fromOffset(0, 46),
		colour = Theme.steal,
		value = 0,
		text = "",
		textSize = Theme.small,
	})
	B.label("NÃO SE AFASTE", {
		Parent = holder,
		Size = UDim2.new(1, -96, 0, 14),
		Position = UDim2.fromOffset(0, 70),
		TextSize = Theme.tiny,
		TextColor3 = Theme.warn,
		Font = Theme.fontBody,
		TextXAlignment = Enum.TextXAlignment.Center,
	})

	-- Giving up must be a deliberate, one-tap action: on a phone the only
	-- other way out is to walk away, which also wastes the cooldown.
	B.button({
		parent = holder,
		name = "CancelSteal",
		size = UDim2.fromOffset(88, 30),
		position = UDim2.new(1, -88, 1, -30),
		colour = Theme.panelAlt,
		text = "DESISTIR",
		textSize = Theme.tiny,
		textColour = Theme.textDim,
		height = 30,
		gradient = false,
		onClick = function()
			local active = HudController._steal
			if active then
				Net:send("StealCancel", active.token)
			end
			HudController:hideSteal()
		end,
	})

	refs.stealHolder = holder
	refs.stealSub = sub
	refs.stealBar = bar
	return holder
end

-- Updates ----------------------------------------------------------------

local function updateCurrency()
	if refs.coinsValue then
		refs.coinsValue.Text = Format.short(State.coins)
	end
	if refs.gemsValue then
		refs.gemsValue.Text = Format.short(State.gems)
	end
	if refs.rankLabel and State.rank then
		refs.rankLabel.Text = ("%s %s"):format(State.rank.icon, State.rank.name)
		refs.rankLabel.TextColor3 = State.rank.colour or Theme.text
	end
	if refs.xpBar then
		local need = math.max(State.xpNeed or 1, 1)
		B.setBar(
			refs.xpBar,
			(State.xpInto or 0) / need,
			("Nv. %d  •  %s/%s"):format(
				State.level or 1,
				Format.short(State.xpInto or 0),
				Format.short(need)
			)
		)
	end
end

local function updateQuick()
	local ready, total = 0, 0
	local now = State.now()
	for _, plant in State.tiles do
		if plant then
			total += 1
			if Economy.isRipe(plant, now) then
				ready += 1
			end
		end
	end
	if refs.harvestAll then
		local text = refs.harvestAll.Content:FindFirstChild("Text")
		if text then
			text.Text = ready > 0 and ("🧺  Colher (%d)"):format(ready) or "🧺  Colher Tudo"
		end
		refs.harvestAll.BackgroundColor3 = ready > 0 and Theme.primary or Theme.panelAlt
	end
	if refs.sellAll then
		local value = 0
		for _, crop in State.inventory do
			value += crop.value or 0
		end
		local text = refs.sellAll.Content:FindFirstChild("Text")
		if text then
			text.Text = #State.inventory > 0 and ("💰  Vender %s"):format(Format.short(value))
				or "💰  Vender Tudo"
		end
		refs.sellAll.BackgroundColor3 = #State.inventory > 0 and Theme.coins or Theme.panelAlt
		local storage = State.mult and State.mult.storage or 40
		if #State.inventory >= storage then
			refs.sellAll.BackgroundColor3 = Theme.danger
			if text then
				text.Text = "⚠️  ARMAZÉM CHEIO"
			end
		end
	end
end

local function updateBoosts()
	local holder = refs.boostHolder
	if not holder then
		return
	end
	for _, child in holder:GetChildren() do
		if child:IsA("Frame") then
			child:Destroy()
		end
	end
	local now = State.now()
	local shown = 0
	for _, boost in State.boosts or {} do
		if boost.expires > now and shown < 5 then
			shown += 1
			local names = { coinMult = "💰 Moedas", luckMult = "🍀 Sorte", growMult = "⚡ Crescimento" }
			local chip = B.card({
				parent = holder,
				size = UDim2.new(1, 0, 0, 30),
				colour = Theme.panel,
				order = shown,
				pad = 6,
			})
			B.label(("%s %s"):format(names[boost.stat] or boost.stat, Format.multiplier(boost.value)), {
				Parent = chip,
				Size = UDim2.new(1, -56, 1, 0),
				TextSize = Theme.tiny,
				Font = Theme.fontBlack,
			})
			B.label(Format.clock(boost.expires - now), {
				Parent = chip,
				Size = UDim2.fromOffset(52, 18),
				Position = UDim2.new(1, -52, 0.5, -9),
				TextSize = Theme.tiny,
				TextColor3 = Theme.warn,
				TextXAlignment = Enum.TextXAlignment.Right,
			})
		end
	end

	-- the global multiplier summary: players love seeing this number
	local m = State.mult
	if m then
		local chip = B.card({
			parent = holder,
			size = UDim2.new(1, 0, 0, 30),
			colour = Theme.panelAlt,
			order = 99,
			pad = 6,
		})
		B.label(
			("💰%s  ⚡%s  🍀%.0f"):format(Format.multiplier(m.coin), Format.multiplier(m.grow), m.luck),
			{
				Parent = chip,
				Size = UDim2.fromScale(1, 1),
				TextSize = Theme.tiny,
				Font = Theme.fontBlack,
				TextXAlignment = Enum.TextXAlignment.Center,
				TextColor3 = Theme.primary,
			}
		)
	end
end

local function updateEvent()
	local banner = refs.eventBanner
	if not banner then
		return
	end
	local event = State.event
	if not event then
		banner.Visible = State.nextEventAt > 0
		if banner.Visible then
			refs.eventTitle.Text = "⏳ PRÓXIMO EVENTO"
			refs.eventTitle.TextColor3 = Theme.textDim
			refs.eventDesc.Text = "Fique por perto — eventos dobram tudo."
			local left = math.max(0, State.nextEventAt - State.now())
			B.setBar(refs.eventTimer, 0, Format.clock(left))
		end
		return
	end
	banner.Visible = true
	refs.eventTitle.Text = (event.icon or "") .. " " .. (event.name or "EVENTO")
	refs.eventTitle.TextColor3 = event.colour or Theme.warn
	refs.eventDesc.Text = event.desc or ""
	local total = event.duration or math.max(1, (event.endsAt or 0) - State.now())
	local left = math.max(0, (event.endsAt or 0) - State.now())
	B.setBar(refs.eventTimer, left / math.max(total, 1), Format.clock(left))
	local stroke = banner:FindFirstChildWhichIsA("UIStroke")
	if stroke then
		stroke.Color = event.colour or Theme.warn
	end
end

local function updateAction()
	local context = app.InteractionController:context()
	local btn = refs.actionButton
	if not btn then
		return
	end
	if not context then
		btn.Visible = false
		return
	end
	btn.Visible = true
	refs.actionIcon.Text = context.icon or ""
	refs.actionLabel.Text = context.label or ""
	refs.actionDetail.Text = context.detail or ""
	local colour = context.danger and Theme.steal
		or (context.kind == "harvest" and Theme.coins)
		or (context.kind == "wait" and Theme.panelAlt)
		or (context.kind == "locked" and Theme.panelAlt)
		or (context.kind == "protected" and Theme.panelAlt)
		or (context.kind == "busy" and Theme.danger)
		or Theme.primary
	btn.BackgroundColor3 = colour
	local light = context.kind == "wait" or context.kind == "locked" or context.kind == "protected"
	refs.actionLabel.TextColor3 = light and Theme.text or Color3.fromRGB(16, 20, 28)
	refs.actionDetail.TextColor3 = light and Theme.textDim or Color3.fromRGB(32, 42, 56)
	B.setDisabled(btn, context.run == nil)
end

-- Steal bar API ----------------------------------------------------------

function HudController:showSteal(payload)
	local holder = refs.stealHolder
	if not holder then
		return
	end
	holder.Visible = true
	local Seeds = Config.Seeds
	local Mutations = Config.Mutations
	local label = Mutations.label(payload.element, payload.aura)
	refs.stealSub.Text = ((label ~= "" and label .. " ") or "")
		.. (Seeds.byId[payload.seed] and Seeds.byId[payload.seed].name or payload.seed or "")
	self._steal = { startedAt = os.clock(), duration = payload.duration, token = payload.token }
end

function HudController:hideSteal()
	if refs.stealHolder then
		refs.stealHolder.Visible = false
	end
	self._steal = nil
end

-- Lifecycle --------------------------------------------------------------

function HudController:start()
	gui = B.new("ScreenGui", {
		Name = "HUD",
		ResetOnSpawn = false,
		IgnoreGuiInset = false,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		DisplayOrder = 10,
		Parent = player:WaitForChild("PlayerGui"),
	})
	local scale = B.new("UIScale", { Scale = C.scaleFor(), Parent = gui })
	refs.scale = scale

	buildCurrency(gui)
	buildEventPanel(gui)
	buildDock(gui)
	buildAction(gui)
	buildQuickActions(gui)
	buildStealBar(gui)

	-- Admin console. Visible to everyone, authorised only on the server
	-- (AdminService:isAdmin), so there is nothing to exploit by opening it.
	local console = B.new("Frame", {
		Name = "Console",
		Size = UDim2.fromOffset(460, 44),
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -104),
		BackgroundColor3 = Theme.panel,
		Visible = false,
		ZIndex = Theme.z.modal,
		Parent = gui,
	})
	B.corner(10).Parent = console
	B.stroke(Theme.danger, 2, 0).Parent = console
	local consoleBox = B.new("TextBox", {
		Size = UDim2.new(1, -16, 1, -8),
		Position = UDim2.fromOffset(8, 4),
		BackgroundTransparency = 1,
		Text = "",
		PlaceholderText = "comando admin (ex: coins eu 1e9 | event BloodMoon | help)",
		PlaceholderColor3 = Theme.textFaint,
		TextColor3 = Theme.text,
		Font = Theme.fontBody,
		TextSize = Theme.small,
		TextXAlignment = Enum.TextXAlignment.Left,
		ClearTextOnFocus = false,
		Parent = console,
	})
	consoleBox.FocusLost:Connect(function(enterPressed)
		if enterPressed and #consoleBox.Text > 0 then
			Net:send("AdminCommand", consoleBox.Text)
			consoleBox.Text = ""
		end
		console.Visible = false
	end)
	refs.console = console
	game:GetService("UserInputService").InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.F2 then
			console.Visible = not console.Visible
			if console.Visible then
				consoleBox:CaptureFocus()
			end
		end
	end)

	refs.panelLayer = B.new("Frame", {
		Name = "Panels",
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		ZIndex = Theme.z.panel,
		Parent = gui,
	})
	refs.overlayLayer = B.new("Frame", {
		Name = "Overlay",
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		ZIndex = Theme.z.toast,
		Parent = gui,
	})

	-- keep the scale honest when the window or orientation changes
	local camera = workspace.CurrentCamera
	if camera then
		camera:GetPropertyChangedSignal("ViewportSize"):Connect(function()
			scale.Scale = C.scaleFor()
		end)
	end

	State.changed:Connect(function(reason)
		updateCurrency()
		if reason == "sync" or reason == "boosts" then
			updateBoosts()
		end
		if reason == "sync" or reason == "event" then
			updateEvent()
		end
		updateQuick()
	end)
	State.plotChanged:Connect(updateQuick)
	app.InteractionController.onContextChanged:Connect(updateAction)

	-- 1 Hz tick for every countdown on screen
	task.spawn(function()
		while true do
			task.wait(0.5)
			pcall(function()
				updateEvent()
				updateBoosts()
				updateQuick()
				updateAction()
			end)
		end
	end)

	-- steal bar progress at frame rate (it is one bar, it can afford it)
	RunService.RenderStepped:Connect(function()
		if self._steal and refs.stealBar then
			local elapsed = os.clock() - self._steal.startedAt
			local p = math.clamp(elapsed / math.max(self._steal.duration, 0.01), 0, 1)
			B.setBar(refs.stealBar, p, ("%.1fs"):format(math.max(0, self._steal.duration - elapsed)))
			if p >= 1 then
				-- the server confirms; keep the full bar until it does
				B.setBar(refs.stealBar, 1, "confirmando...")
			end
		end
	end)

	updateCurrency()
	updateEvent()
	updateQuick()
end

function HudController:panelLayer(): Frame
	return refs.panelLayer
end

function HudController:overlayLayer(): Frame
	return refs.overlayLayer
end

function HudController:screenGui(): ScreenGui
	return gui
end

return HudController
