--!nonstrict
-- A tiny declarative layer over Instance.new. Not a framework — just enough to
-- make 2000 lines of UI readable and consistent, and to guarantee every
-- interactive element is at least 46px tall on a phone.

local TweenService = game:GetService("TweenService")
local Shared = game:GetService("ReplicatedStorage").Shared
local Theme = require(Shared.Config).Theme

local B = {}

--- new("Frame", { Size = ..., Parent = ... }, { child1, child2 })
function B.new(className: string, props: { [string]: any }?, children: { Instance }?): Instance
	local inst = Instance.new(className)
	if props then
		local parent = props.Parent
		props.Parent = nil
		for key, value in props do
			-- attributes via a reserved key, so callers can tag things inline
			if key == "Attributes" then
				for name, v in value do
					inst:SetAttribute(name, v)
				end
			elseif key == "Tags" then
				for _, tag in value do
					inst:AddTag(tag)
				end
			else
				(inst :: any)[key] = value
			end
		end
		if children then
			for _, child in children do
				child.Parent = inst
			end
		end
		if parent then
			inst.Parent = parent
		end
		return inst
	end
	if children then
		for _, child in children do
			child.Parent = inst
		end
	end
	return inst
end

function B.corner(radius: number?): UICorner
	return B.new("UICorner", { CornerRadius = UDim.new(0, radius or Theme.radius) })
end

function B.stroke(colour: Color3?, thickness: number?, transparency: number?): UIStroke
	return B.new("UIStroke", {
		Color = colour or Theme.stroke,
		Thickness = thickness or 1.5,
		Transparency = transparency or 0,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
	})
end

function B.gradient(from: Color3, to: Color3, rotation: number?): UIGradient
	return B.new("UIGradient", {
		Color = ColorSequence.new(from, to),
		Rotation = rotation or 90,
	})
end

function B.padding(all: number?, extra: { [string]: number }?): UIPadding
	local v = all or Theme.pad
	local p = B.new("UIPadding", {
		PaddingTop = UDim.new(0, (extra and extra.top) or v),
		PaddingBottom = UDim.new(0, (extra and extra.bottom) or v),
		PaddingLeft = UDim.new(0, (extra and extra.left) or v),
		PaddingRight = UDim.new(0, (extra and extra.right) or v),
	})
	return p
end

function B.list(direction: Enum.FillDirection?, gap: number?, align: Enum.HorizontalAlignment?): UIListLayout
	return B.new("UIListLayout", {
		FillDirection = direction or Enum.FillDirection.Vertical,
		Padding = UDim.new(0, gap or Theme.gap),
		SortOrder = Enum.SortOrder.LayoutOrder,
		HorizontalAlignment = align or Enum.HorizontalAlignment.Center,
		VerticalAlignment = Enum.VerticalAlignment.Top,
	})
end

function B.grid(cell: UDim2, gap: UDim2?): UIGridStyleLayout
	return B.new("UIGridLayout", {
		CellSize = cell,
		CellPadding = gap or UDim2.fromOffset(Theme.gap, Theme.gap),
		SortOrder = Enum.SortOrder.LayoutOrder,
		HorizontalAlignment = Enum.HorizontalAlignment.Center,
	})
end

function B.aspect(ratio: number): UIAspectRatioConstraint
	return B.new("UIAspectRatioConstraint", { AspectRatio = ratio })
end

--- Text that scales but never below legibility on a small screen.
function B.label(text: string, props: { [string]: any }?): TextLabel
	local p = props or {}
	local size = p.TextSize or Theme.body
	p.TextSize = nil
	local label = B.new("TextLabel", {
		BackgroundTransparency = 1,
		Font = p.Font or Theme.font,
		Text = text,
		TextColor3 = p.TextColor3 or Theme.text,
		TextSize = size,
		TextXAlignment = p.TextXAlignment or Enum.TextXAlignment.Left,
		TextYAlignment = p.TextYAlignment or Enum.TextYAlignment.Center,
		RichText = p.RichText == true,
		TextTruncate = Enum.TextTruncate.AtEnd,
		Size = p.Size or UDim2.new(1, 0, 0, size + 6),
		Position = p.Position,
		AnchorPoint = p.AnchorPoint,
		LayoutOrder = p.LayoutOrder,
		Name = p.Name or "Label",
		Parent = p.Parent,
		ZIndex = p.ZIndex,
		TextWrapped = p.TextWrapped == true,
		AutomaticSize = p.AutomaticSize,
	})
	if p.stroke then
		B.stroke(p.stroke, p.strokeThickness or 2, 0).Parent = label
	end
	return label
end

local PRESS_IN = TweenInfo.new(0.07, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
local PRESS_OUT = TweenInfo.new(0.16, Theme.ease, Enum.EasingDirection.Out)

--- The only button constructor in the game. Handles hover, press-scale,
--- disabled state and a guaranteed minimum touch size.
function B.button(opts): TextButton
	local height = math.max(opts.height or Theme.minTouch, Theme.minTouch)
	local btn = B.new("TextButton", {
		Name = opts.name or "Button",
		Size = opts.size or UDim2.new(1, 0, 0, height),
		Position = opts.position,
		AnchorPoint = opts.anchor,
		BackgroundColor3 = opts.colour or Theme.primary,
		BackgroundTransparency = opts.transparent and 1 or 0,
		AutoButtonColor = false,
		Text = "",
		LayoutOrder = opts.order,
		ZIndex = opts.zIndex,
		Parent = opts.parent,
	})
	B.corner(opts.radius or Theme.radiusSm).Parent = btn
	if opts.strokeColour ~= false then
		B.stroke(opts.strokeColour or Color3.new(0, 0, 0), 2, 0.72).Parent = btn
	end
	if opts.gradient ~= false and not opts.transparent then
		local base = opts.colour or Theme.primary
		local h, s, v = base:ToHSV()
		B.gradient(Color3.fromHSV(h, math.max(0, s - 0.08), math.min(1, v + 0.1)), base, 90).Parent = btn
	end

	local content = B.new("Frame", {
		Name = "Content",
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		Parent = btn,
	})
	B.padding(nil, { left = 10, right = 10, top = 4, bottom = 4 }).Parent = content

	if opts.icon or opts.text then
		local text = ((opts.icon and (opts.icon .. "  ")) or "") .. (opts.text or "")
		B.label(text, {
			Parent = content,
			Size = UDim2.fromScale(1, 1),
			TextXAlignment = opts.align or Enum.TextXAlignment.Center,
			TextColor3 = opts.textColour or Color3.fromRGB(16, 20, 28),
			Font = Theme.fontBlack,
			TextSize = opts.textSize or Theme.body,
			Name = "Text",
		})
	end
	if opts.sub then
		local main = content:FindFirstChild("Text")
		if main then
			main.Size = UDim2.new(1, 0, 0.56, 0)
			main.TextYAlignment = Enum.TextYAlignment.Bottom
		end
		B.label(opts.sub, {
			Parent = content,
			Size = UDim2.new(1, 0, 0.44, 0),
			Position = UDim2.fromScale(0, 0.56),
			TextXAlignment = opts.align or Enum.TextXAlignment.Center,
			TextYAlignment = Enum.TextYAlignment.Top,
			TextColor3 = opts.subColour or Color3.fromRGB(28, 36, 48),
			Font = Theme.fontBody,
			TextSize = Theme.small,
			Name = "Sub",
		})
	end

	local baseSize = btn.Size
	local pressed = false
	local function scale(factor: number, info: TweenInfo)
		TweenService:Create(btn, info, {
			Size = UDim2.new(
				baseSize.X.Scale * factor,
				baseSize.X.Offset * factor,
				baseSize.Y.Scale * factor,
				baseSize.Y.Offset * factor
			),
		}):Play()
	end

	btn.MouseButton1Down:Connect(function()
		if btn:GetAttribute("Disabled") then
			return
		end
		pressed = true
		scale(0.96, PRESS_IN)
	end)
	local function release()
		if pressed then
			pressed = false
			scale(1, PRESS_OUT)
		end
	end
	btn.MouseButton1Up:Connect(release)
	btn.MouseLeave:Connect(release)

	if opts.onClick then
		btn.MouseButton1Click:Connect(function()
			if btn:GetAttribute("Disabled") then
				return
			end
			opts.onClick(btn)
		end)
	end

	return btn
end

function B.setDisabled(btn: TextButton, disabled: boolean, reason: string?)
	btn:SetAttribute("Disabled", disabled)
	btn.BackgroundTransparency = disabled and 0.55 or 0
	local text = btn:FindFirstChild("Content") and btn.Content:FindFirstChild("Text")
	if text then
		text.TextTransparency = disabled and 0.45 or 0
	end
	local sub = btn:FindFirstChild("Content") and btn.Content:FindFirstChild("Sub")
	if sub and reason then
		sub.Text = reason
	end
end

--- Horizontal progress bar with an optional label baked in.
function B.bar(opts)
	local holder = B.new("Frame", {
		Name = opts.name or "Bar",
		Size = opts.size or UDim2.new(1, 0, 0, 16),
		Position = opts.position,
		AnchorPoint = opts.anchor,
		BackgroundColor3 = opts.track or Theme.bg,
		LayoutOrder = opts.order,
		Parent = opts.parent,
	})
	B.corner(opts.radius or 8).Parent = holder
	local fill = B.new("Frame", {
		Name = "Fill",
		Size = UDim2.fromScale(math.clamp(opts.value or 0, 0, 1), 1),
		BackgroundColor3 = opts.colour or Theme.primary,
		BorderSizePixel = 0,
		Parent = holder,
	})
	B.corner(opts.radius or 8).Parent = fill
	B.gradient(
		(opts.colour or Theme.primary):Lerp(Color3.new(1, 1, 1), 0.3),
		opts.colour or Theme.primary,
		90
	).Parent = fill
	if opts.text ~= nil then
		B.label(opts.text, {
			Parent = holder,
			Size = UDim2.fromScale(1, 1),
			TextXAlignment = Enum.TextXAlignment.Center,
			TextSize = opts.textSize or Theme.tiny,
			Font = Theme.fontBlack,
			TextColor3 = Theme.text,
			Name = "BarText",
			stroke = Color3.new(0, 0, 0),
			strokeThickness = 1.5,
		})
	end
	return holder, fill
end

function B.setBar(holder: Frame, value: number, text: string?)
	local fill = holder:FindFirstChild("Fill")
	if fill then
		TweenService:Create(fill, TweenInfo.new(0.2, Theme.ease, Enum.EasingDirection.Out), {
			Size = UDim2.fromScale(math.clamp(value, 0, 1), 1),
		}):Play()
	end
	local label = holder:FindFirstChild("BarText")
	if label and text then
		label.Text = text
	end
end

--- Scrolling container with a mobile-friendly scrollbar and auto canvas.
function B.scroll(opts): ScrollingFrame
	local scroll = B.new("ScrollingFrame", {
		Name = opts.name or "Scroll",
		Size = opts.size or UDim2.fromScale(1, 1),
		Position = opts.position,
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 5,
		ScrollBarImageColor3 = Theme.strokeBright,
		ScrollBarImageTransparency = 0.3,
		ScrollingDirection = Enum.ScrollingDirection.Y,
		ElasticBehavior = Enum.ElasticBehavior.WhenScrollable,
		LayoutOrder = opts.order,
		Parent = opts.parent,
	})
	if opts.grid then
		B.grid(opts.grid, opts.gridGap).Parent = scroll
	else
		B.list(Enum.FillDirection.Vertical, opts.gap, opts.align).Parent = scroll
	end
	B.padding(opts.pad or 4).Parent = scroll
	return scroll
end

--- Card: the base surface for every list item in the game.
function B.card(opts): Frame
	local card = B.new("Frame", {
		Name = opts.name or "Card",
		Size = opts.size or UDim2.new(1, 0, 0, 72),
		BackgroundColor3 = opts.colour or Theme.panelAlt,
		LayoutOrder = opts.order,
		Parent = opts.parent,
	})
	B.corner(opts.radius or Theme.radius).Parent = card
	B.stroke(opts.strokeColour or Theme.stroke, opts.strokeThickness or 1.5, opts.strokeTransparency or 0.2).Parent = card
	if opts.gradient then
		B.gradient(opts.colour or Theme.panelAlt, (opts.colour or Theme.panelAlt):Lerp(Theme.bg, 0.4), 90).Parent = card
	end
	if opts.pad ~= false then
		B.padding(opts.pad or 10).Parent = card
	end
	return card
end

return B
