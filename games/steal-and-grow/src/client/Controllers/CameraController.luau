--!nonstrict
-- Camera tuning.
--
-- Default Roblox camera settings are wrong for a top-down-ish farm game on a
-- phone: too close, too twitchy, and the player loses their plot. This sets a
-- comfortable pulled-back third-person view, raises the max zoom so a whole
-- farm fits on screen, and adds a soft look-at nudge when a steal alarm fires
-- so the victim's eyes are pointed at the problem.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local StarterPlayer = game:GetService("StarterPlayer")

local Shared = game:GetService("ReplicatedStorage").Shared
local Net = require(Shared.Util.Net)
local Spring = require(Shared.Util.Spring)
local State = require(script.Parent.Parent.State)

local CameraController = { name = "CameraController" }

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local fovSpring = Spring.new(70, 90, 18)
local shake = 0

function CameraController:start()
	camera = workspace.CurrentCamera

	player.CameraMaxZoomDistance = 110
	player.CameraMinZoomDistance = 12
	player.CameraMode = Enum.CameraMode.Classic

	-- start pulled back so a new player can see their whole farm
	task.defer(function()
		local char = player.Character or player.CharacterAdded:Wait()
		task.wait(0.4)
		if camera then
			camera.FieldOfView = 70
		end
	end)

	workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(function()
		camera = workspace.CurrentCamera
	end)

	-- FOV punch on big moments: cheap, and it reads as impact
	Net:listen("MutationRoll", function(payload)
		if (payload.mult or 1) >= 15 then
			fovSpring:set(80)
			task.delay(0.35, function()
				fovSpring:set(70)
			end)
		end
	end)
	Net:listen("StealAlarm", function(payload)
		if payload.kind == "start" or payload.kind == "stolen" then
			shake = 1
		end
	end)
	Net:listen("RebirthResult", function()
		fovSpring:set(92)
		task.delay(0.6, function()
			fovSpring:set(70)
		end)
	end)

	RunService.RenderStepped:Connect(function(dt)
		if not camera then
			return
		end
		camera.FieldOfView = fovSpring:step(dt)
		if shake > 0.001 then
			shake = math.max(0, shake - dt * 1.6)
			local amount = shake * 0.55
			camera.CFrame = camera.CFrame
				* CFrame.Angles(
					(math.random() - 0.5) * amount * 0.02,
					(math.random() - 0.5) * amount * 0.02,
					(math.random() - 0.5) * amount * 0.02
				)
		end
	end)
end

return CameraController
