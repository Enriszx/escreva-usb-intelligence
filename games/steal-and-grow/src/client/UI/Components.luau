--!nonstrict
-- Composite components: the panel shell every menu lives in, plus the small
-- repeated pieces (currency pills, rarity chips, tab bars, modals).
--
-- Mobile-first layout decision: panels are near-fullscreen sheets on a phone
-- and centred cards on a wide screen, chosen from the viewport aspect rather
-- than UserInputService — that way it also behaves correctly in a window that
-- gets resized, and on a tablet.

local TweenService = game:GetService("TweenService")
local GuiService = game:GetService("GuiService")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Format = require(Shared.Util.Format)
local B = require(script.Parent.Builder)

local Theme = Config.Theme
local Rarities = Config.Rarities

local C = {}

local OPEN_INFO = TweenInfo.new(0.26, Theme.ease, Enum.EasingDirection.Out)
local CLOSE_INFO = TweenInfo.new(0.16, Enum.EasingStyle.Quad, Enum.EasingDirection.In)

function C.isPhone(): boolean
	local cam = workspace.CurrentCamera
	if not cam then
		return false
	end
	local vp = cam.ViewportSize
	-- a phone in landscape is short; a tablet/desktop is tall enough for a card
	return vp.Y < 520 or vp.X < 700
end

--- Global UIScale value so a 4K monitor and a 720p phone both read correctly.
function C.scaleFor(): number
	local cam = workspace.CurrentCamera
	if not cam then
		return 1
	end
	local vp = cam.ViewportSize
	-- target design height of 900px; clamp so text never becomes unreadable
	return math.clamp(vp.Y / 900, 0.72, 1.6)
end

--- Rarity chip used in every list.
function C.rarityChip(rarityId: string, parent: Instance?, order: number?): Frame
	local rarity = Rarities.get(rarityId)
	local chip = B.new("Frame", {
		Name = "Rarity",
		Size = UDim2.new(0, 0, 0, 20),
		AutomaticSize = Enum.AutomaticSize.X,
		BackgroundColor3 = rarity.colour,
		LayoutOrder = order,
		Parent = parent,
	})
	B.corner(6).Parent = chip
	B.padding(nil, { left = 7, right = 7, top = 0, bottom = 0 }).Parent = chip
	B.label(rarity.name:upper(), {
		Parent = chip,
		Size = UDim2.new(0, 0, 1, 0),
		AutomaticSize = Enum.AutomaticSize.X,
		TextSize = Theme.tiny,
		Font = Theme.fontBlack,
		TextColor3 = Color3.fromRGB(18, 20, 28),
		TextXAlignment = Enum.TextXAlignment.Center,
	})
	return chip
end

--- Currency pill for the HUD.
function C.pill(opts): (Frame, TextLabel)
	local pill = B.new("Frame", {
		Name = opts.name or "Pill",
		Size = opts.size or UDim2.new(0, 150, 0, 42),
		BackgroundColor3 = Theme.panel,
		LayoutOrder = opts.order,
		Parent = opts.parent,
	})
	B.corner(21).Parent = pill
	B.stroke(opts.colour or Theme.stroke, 2, 0.25).Parent = pill
	B.gradient(Theme.panelAlt, Theme.panel, 90).Parent = pill

	local icon = B.label(opts.icon or "", {
		Parent = pill,
		Size = UDim2.new(0, 34, 1, 0),
		Position = UDim2.fromOffset(6, 0),
		TextXAlignment = Enum.TextXAlignment.Center,
		TextSize = Theme.h3,
		Name = "Icon",
	})
	local value = B.label(opts.value or "0", {
		Parent = pill,
		Size = UDim2.new(1, -46, 1, 0),
		Position = UDim2.fromOffset(40, 0),
		TextColor3 = opts.colour or Theme.text,
		Font = Theme.fontBlack,
		TextSize = Theme.body,
		Name = "Value",
	})
	return pill, value
end

--- The panel shell. Returns { gui, root, body, header, close, setTitle, open, close }
function C.panel(opts)
	local phone = C.isPhone()
	local root = B.new("Frame", {
		Name = opts.name .. "Panel",
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = phone and UDim2.new(1, -24, 1, -118) or (opts.size or UDim2.fromOffset(700, 560)),
		BackgroundColor3 = Theme.panel,
		Visible = false,
		ZIndex = Theme.z.panel,
		Parent = opts.parent,
	})
	B.corner(Theme.radiusLg).Parent = root
	B.stroke(opts.tint or Theme.strokeBright, 2.5, 0.1).Parent = root
	B.gradient(Theme.panelAlt, Theme.panel, 90).Parent = root
	if not phone then
		local max = B.new("UISizeConstraint", { MaxSize = Vector2.new(820, 640) })
		max.Parent = root
	end

	-- header
	local header = B.new("Frame", {
		Name = "Header",
		Size = UDim2.new(1, 0, 0, 58),
		BackgroundColor3 = opts.tint or Theme.primaryDark,
		BackgroundTransparency = 0.82,
		Parent = root,
	})
	B.corner(Theme.radiusLg).Parent = header
	B.new("Frame", {
		Name = "HeaderFix",
		Size = UDim2.new(1, 0, 0, Theme.radiusLg),
		Position = UDim2.new(0, 0, 1, -Theme.radiusLg),
		BackgroundColor3 = opts.tint or Theme.primaryDark,
		BackgroundTransparency = 0.82,
		BorderSizePixel = 0,
		Parent = header,
	})

	local title = B.label((opts.icon and (opts.icon .. "  ") or "") .. opts.title, {
		Parent = header,
		Size = UDim2.new(1, -140, 1, 0),
		Position = UDim2.fromOffset(18, 0),
		Font = Theme.fontBlack,
		TextSize = Theme.h2,
		TextColor3 = Theme.text,
		Name = "Title",
	})

	local subtitle = B.label(opts.subtitle or "", {
		Parent = header,
		Size = UDim2.new(0, 220, 0, 20),
		Position = UDim2.new(1, -300, 0.5, -10),
		TextXAlignment = Enum.TextXAlignment.Right,
		TextColor3 = Theme.textDim,
		Font = Theme.fontBody,
		TextSize = Theme.small,
		Name = "Subtitle",
	})

	local closeBtn = B.button({
		parent = header,
		name = "Close",
		size = UDim2.fromOffset(44, 44),
		position = UDim2.new(1, -52, 0.5, -22),
		colour = Theme.danger,
		icon = "✕",
		textSize = Theme.h3,
		textColour = Theme.text,
		radius = 14,
	})

	-- body
	local body = B.new("Frame", {
		Name = "Body",
		Size = UDim2.new(1, 0, 1, -58),
		Position = UDim2.fromOffset(0, 58),
		BackgroundTransparency = 1,
		Parent = root,
	})
	B.padding(12).Parent = body

	local api = {
		root = root,
		header = header,
		body = body,
		title = title,
		subtitle = subtitle,
		closeButton = closeBtn,
		isOpen = false,
	}

	function api.setTitle(text: string)
		title.Text = (opts.icon and (opts.icon .. "  ") or "") .. text
	end

	function api.setSubtitle(text: string)
		subtitle.Text = text
	end

	function api.open()
		if api.isOpen then
			return
		end
		api.isOpen = true
		root.Visible = true
		local target = root.Size
		root.Size = UDim2.new(target.X.Scale * 0.92, target.X.Offset * 0.92, target.Y.Scale * 0.92, target.Y.Offset * 0.92)
		root.BackgroundTransparency = 0.4
		TweenService:Create(root, OPEN_INFO, { Size = target, BackgroundTransparency = 0 }):Play()
		if opts.onOpen then
			opts.onOpen()
		end
	end

	function api.close()
		if not api.isOpen then
			return
		end
		api.isOpen = false
		local target = root.Size
		local tween = TweenService:Create(root, CLOSE_INFO, {
			Size = UDim2.new(target.X.Scale * 0.94, target.X.Offset * 0.94, target.Y.Scale * 0.94, target.Y.Offset * 0.94),
			BackgroundTransparency = 0.6,
		})
		tween.Completed:Connect(function()
			if not api.isOpen then
				root.Visible = false
				root.Size = target
				root.BackgroundTransparency = 0
			end
		end)
		tween:Play()
		if opts.onClose then
			opts.onClose()
		end
	end

	closeBtn.MouseButton1Click:Connect(api.close)
	return api
end

--- Tab bar. Returns (container, select) where select(index) switches pages.
function C.tabs(parent: Instance, names: { string }, onSelect: (number) -> ())
	local bar = B.new("Frame", {
		Name = "Tabs",
		Size = UDim2.new(1, 0, 0, 44),
		BackgroundTransparency = 1,
		Parent = parent,
	})
	local layout = B.list(Enum.FillDirection.Horizontal, 6, Enum.HorizontalAlignment.Left)
	layout.Parent = bar

	local buttons = {}
	local current = 1

	local function paint()
		for i, btn in buttons do
			local active = i == current
			btn.BackgroundColor3 = active and Theme.primary or Theme.panelAlt
			local text = btn.Content:FindFirstChild("Text")
			if text then
				text.TextColor3 = active and Color3.fromRGB(16, 20, 28) or Theme.textDim
			end
		end
	end

	-- fixed fractional widths: AutomaticSize would fight the button's own
	-- press-scale tween and make the bar twitch on every tap
	local share = 1 / #names
	local gap = 6 * (#names - 1)
	for i, name in names do
		local btn = B.button({
			parent = bar,
			name = "Tab" .. i,
			size = UDim2.new(share, -gap * share, 1, 0),
			colour = Theme.panelAlt,
			text = name,
			textSize = #names > 2 and Theme.tiny or Theme.small,
			order = i,
			gradient = false,
			onClick = function()
				current = i
				paint()
				onSelect(i)
			end,
		})
		table.insert(buttons, btn)
	end
	paint()

	return bar, function(index: number)
		current = index
		paint()
		onSelect(index)
	end
end

--- Confirmation modal. Used by rebirth, pet delete and trade confirm.
function C.confirm(parent: Instance, opts)
	local shade = B.new("Frame", {
		Name = "Confirm",
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = Color3.new(0, 0, 0),
		BackgroundTransparency = 0.45,
		ZIndex = Theme.z.modal,
		Parent = parent,
	})
	local card = B.new("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = C.isPhone() and UDim2.new(1, -48, 0, 230) or UDim2.fromOffset(440, 230),
		BackgroundColor3 = Theme.panel,
		ZIndex = Theme.z.modal + 1,
		Parent = shade,
	})
	B.corner(Theme.radiusLg).Parent = card
	B.stroke(opts.tint or Theme.warn, 2.5, 0.1).Parent = card
	B.padding(18).Parent = card

	B.label(opts.title, {
		Parent = card,
		Size = UDim2.new(1, 0, 0, 34),
		Font = Theme.fontBlack,
		TextSize = Theme.h3,
		TextXAlignment = Enum.TextXAlignment.Center,
		TextColor3 = opts.tint or Theme.warn,
	})
	B.label(opts.body or "", {
		Parent = card,
		Size = UDim2.new(1, 0, 0, 96),
		Position = UDim2.fromOffset(0, 40),
		TextWrapped = true,
		TextYAlignment = Enum.TextYAlignment.Top,
		TextXAlignment = Enum.TextXAlignment.Center,
		Font = Theme.fontBody,
		TextSize = Theme.body,
		TextColor3 = Theme.textDim,
		RichText = true,
	})

	local row = B.new("Frame", {
		Size = UDim2.new(1, 0, 0, 50),
		Position = UDim2.new(0, 0, 1, -50),
		BackgroundTransparency = 1,
		Parent = card,
	})
	local rowLayout = B.list(Enum.FillDirection.Horizontal, 10, Enum.HorizontalAlignment.Center)
	rowLayout.Parent = row

	B.button({
		parent = row,
		size = UDim2.new(0.48, 0, 1, 0),
		colour = Theme.panelAlt,
		text = opts.cancelText or "Cancelar",
		textColour = Theme.text,
		order = 1,
		gradient = false,
		onClick = function()
			shade:Destroy()
			if opts.onCancel then
				opts.onCancel()
			end
		end,
	})
	B.button({
		parent = row,
		size = UDim2.new(0.48, 0, 1, 0),
		colour = opts.tint or Theme.primary,
		text = opts.confirmText or "Confirmar",
		order = 2,
		onClick = function()
			shade:Destroy()
			if opts.onConfirm then
				opts.onConfirm()
			end
		end,
	})

	return shade
end

--- Empty-state message so no list ever looks broken.
function C.empty(parent: Instance, icon: string, text: string): Frame
	local holder = B.new("Frame", {
		Name = "Empty",
		Size = UDim2.new(1, 0, 0, 140),
		BackgroundTransparency = 1,
		Parent = parent,
	})
	B.label(icon, {
		Parent = holder,
		Size = UDim2.new(1, 0, 0, 56),
		TextSize = 46,
		TextXAlignment = Enum.TextXAlignment.Center,
	})
	B.label(text, {
		Parent = holder,
		Size = UDim2.new(1, 0, 0, 48),
		Position = UDim2.fromOffset(0, 60),
		TextWrapped = true,
		TextXAlignment = Enum.TextXAlignment.Center,
		TextYAlignment = Enum.TextYAlignment.Top,
		TextColor3 = Theme.textFaint,
		Font = Theme.fontBody,
	})
	return holder
end

C.Format = Format
return C
