--!nonstrict
--[[
	STEAL & GROW: Império Mutante — client bootstrap.

	Same two-pass pattern as the server (init -> start) with the same `app`
	container, so a controller can reach any other by name without require
	cycles. Order within the table matters only for `start`, which is why the
	HUD builds before anything that needs a layer to parent into.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterGui = game:GetService("StarterGui")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)

local State = require(script.State)
local player = Players.LocalPlayer

-- a loading veil so the player never sees an unstyled world pop in
local veil = Instance.new("ScreenGui")
veil.Name = "Boot"
veil.IgnoreGuiInset = true
veil.DisplayOrder = 1000
veil.ResetOnSpawn = false
veil.Parent = player:WaitForChild("PlayerGui")

local back = Instance.new("Frame")
back.Size = UDim2.fromScale(1, 1)
back.BackgroundColor3 = Config.Theme.bg
back.BorderSizePixel = 0
back.Parent = veil

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, 0, 0, 70)
title.Position = UDim2.new(0, 0, 0.42, 0)
title.BackgroundTransparency = 1
title.Font = Config.Theme.fontBlack
title.Text = "STEAL & GROW"
title.TextColor3 = Config.Theme.primary
title.TextScaled = true
title.Parent = back
local tc = Instance.new("UITextSizeConstraint")
tc.MaxTextSize = 64
tc.Parent = title

local sub = Instance.new("TextLabel")
sub.Size = UDim2.new(1, 0, 0, 28)
sub.Position = UDim2.new(0, 0, 0.52, 0)
sub.BackgroundTransparency = 1
sub.Font = Config.Theme.fontBody
sub.Text = "Preparando sua fazenda..."
sub.TextColor3 = Config.Theme.textDim
sub.TextScaled = true
sub.Parent = back
local sc = Instance.new("UITextSizeConstraint")
sc.MaxTextSize = 22
sc.Parent = sub

-- Controllers ------------------------------------------------------------

local app = {}
local controllers = {}

local ORDER = {
	"GraphicsController",
	"CameraController",
	"InteractionController",
	"HudController",
	"FeedbackController",
	"PanelController",
	"PlotRenderer",
	"TutorialController",
}

for _, name in ORDER do
	local module = script.Controllers:FindFirstChild(name)
	if module then
		local ok, controller = pcall(require, module)
		if ok and type(controller) == "table" then
			app[name] = controller
			table.insert(controllers, controller)
		else
			warn(("[Client] %s falhou: %s"):format(name, tostring(controller)))
		end
	else
		warn("[Client] controller não encontrado: " .. name)
	end
end

for _, controller in controllers do
	if controller.init then
		local ok, err = pcall(controller.init, controller, app)
		if not ok then
			warn(("[Client] init %s: %s"):format(controller.name, tostring(err)))
		end
	end
end

State.connect()

for _, controller in controllers do
	if controller.start then
		local ok, err = pcall(controller.start, controller)
		if not ok then
			warn(("[Client] start %s: %s"):format(controller.name, tostring(err)))
		end
	end
end

-- Core GUI tweaks --------------------------------------------------------

pcall(function()
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Health, false)
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.EmotesMenu, false)
end)

-- Drop the veil once the profile has arrived (or after a timeout, so a
-- backend hiccup never traps the player on a loading screen).
task.spawn(function()
	local waited = 0
	while not State.ready and waited < 12 do
		waited += task.wait(0.1)
		sub.Text = waited > 5 and "Conectando ao servidor..." or "Preparando sua fazenda..."
	end
	task.wait(0.3)
	local TweenService = game:GetService("TweenService")
	local info = TweenInfo.new(0.5)
	TweenService:Create(back, info, { BackgroundTransparency = 1 }):Play()
	TweenService:Create(title, info, { TextTransparency = 1 }):Play()
	TweenService:Create(sub, info, { TextTransparency = 1 }):Play()
	task.wait(0.6)
	veil:Destroy()
end)

print(("[Client] %d controladores prontos"):format(#controllers))
