--!nonstrict
-- Adaptive quality.
--
-- The brief is "beautiful on a weak phone". Those are only compatible if the
-- expensive things are the ones you drop first and the cheap things carry the
-- art direction. So:
--
--   kept at every tier  — saturated palette, strong silhouettes, colour
--                         grading, gradients, soft UI, readable typography
--   dropped first       — post-processing, shadows, particles, atmosphere
--   scaled continuously — plant model detail (3 LODs), number of visible
--                         plants, render distance
--
-- Tier selection is based on measured FPS over a rolling window, re-checked
-- every 20s, with hysteresis so a single stutter doesn't downgrade the look
-- permanently. A manual override in settings always wins.

local RunService = game:GetService("RunService")
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Signal = require(Shared.Util.Signal)
local State = require(script.Parent.Parent.State)

local Balance = Config.Balance
local TIERS = Balance.qualityTiers

local GraphicsController = { name = "GraphicsController" }
GraphicsController.onTierChanged = Signal.new()
GraphicsController.tier = TIERS[3]

local samples = {}
local lastCheck = 0
local manual = nil
local baseLighting = {}
local eventTween = nil

local function captureBaseLighting()
	baseLighting = {
		Ambient = Lighting.Ambient,
		OutdoorAmbient = Lighting.OutdoorAmbient,
		Brightness = Lighting.Brightness,
		ClockTime = Lighting.ClockTime,
		FogColor = Lighting.FogColor,
	}
end

local function postFx(enabled: boolean)
	for _, effect in Lighting:GetChildren() do
		if effect:IsA("PostEffect") then
			-- colour correction is the cheapest and does the most for the look,
			-- so it survives even on the lowest tier
			if effect:IsA("ColorCorrectionEffect") then
				effect.Enabled = true
			else
				effect.Enabled = enabled
			end
		end
	end
end

local function applyTier(tier)
	GraphicsController.tier = tier

	Lighting.GlobalShadows = tier.shadows
	local atmosphere = Lighting:FindFirstChildWhichIsA("Atmosphere")
	if atmosphere then
		atmosphere.Density = tier.atmosphere and 0.32 or 0
		atmosphere.Haze = tier.atmosphere and 1.4 or 0
	end
	postFx(tier.postfx)

	-- fog doubles as the draw-distance mask: pulling it in hides the pop-in
	-- that a short streaming radius would otherwise reveal
	Lighting.FogEnd = tier.drawDistance * 3.2
	Lighting.FogStart = tier.drawDistance * 0.7

	if tier.name == "Potato" then
		Lighting.ShadowSoftness = 0
		Lighting.EnvironmentSpecularScale = 0
		Lighting.EnvironmentDiffuseScale = 0.3
	else
		Lighting.ShadowSoftness = 0.35
		Lighting.EnvironmentSpecularScale = 0.45
		Lighting.EnvironmentDiffuseScale = 0.55
	end

	pcall(function()
		settings().Rendering.QualityLevel = Enum.QualityLevel.Automatic
	end)

	GraphicsController.onTierChanged:Fire(tier)
end

local function tierForFps(fps: number)
	local chosen = TIERS[1]
	for _, tier in TIERS do
		if fps >= tier.minFps then
			chosen = tier
		end
	end
	return chosen
end

function GraphicsController:setManual(name: string?)
	manual = nil
	if name and name ~= "auto" then
		for _, tier in TIERS do
			if tier.name == name then
				manual = tier
				break
			end
		end
	end
	if manual then
		applyTier(manual)
	end
end

function GraphicsController:tierNames(): { string }
	local out = { "auto" }
	for _, tier in TIERS do
		table.insert(out, tier.name)
	end
	return out
end

--- Live event lighting: the whole world changes colour for Blood Moon etc.
--- Tweened over 2s because an instant swap reads as a glitch.
function GraphicsController:applyEventLighting(lighting)
	if eventTween then
		eventTween:Cancel()
	end
	local goal = {}
	if lighting then
		if lighting.clockTime then
			goal.ClockTime = lighting.clockTime
		end
		if lighting.ambient then
			goal.Ambient = lighting.ambient
		end
		if lighting.outdoorAmbient then
			goal.OutdoorAmbient = lighting.outdoorAmbient
		end
		if lighting.fogColour then
			goal.FogColor = lighting.fogColour
		end
		if lighting.brightness then
			goal.Brightness = lighting.brightness
		end
	else
		goal = {
			ClockTime = baseLighting.ClockTime,
			Ambient = baseLighting.Ambient,
			OutdoorAmbient = baseLighting.OutdoorAmbient,
			FogColor = baseLighting.FogColor,
			Brightness = baseLighting.Brightness,
		}
	end
	eventTween = TweenService:Create(Lighting, TweenInfo.new(2.2, Enum.EasingStyle.Sine), goal)
	eventTween:Play()
end

function GraphicsController:start()
	captureBaseLighting()
	-- start at Medium, not High: it is far better to upgrade a player into
	-- pretty than to show them 12 FPS for the first 4 seconds
	applyTier(TIERS[3])

	RunService.RenderStepped:Connect(function(dt)
		table.insert(samples, 1 / math.max(dt, 1 / 1000))
		if #samples > 240 then
			table.remove(samples, 1)
		end
		local now = os.clock()
		if now - lastCheck < Balance.qualityRecheck then
			return
		end
		lastCheck = now
		if manual or #samples < 60 then
			return
		end

		-- use the 20th percentile, not the mean: stutter is what players feel
		local sorted = table.clone(samples)
		table.sort(sorted)
		local p20 = sorted[math.max(1, math.floor(#sorted * 0.2))]
		table.clear(samples)

		local target = tierForFps(p20)
		if target.name ~= self.tier.name then
			-- hysteresis: only upgrade if we are comfortably above the gate
			local upgrading = target.minFps > self.tier.minFps
			if not upgrading or p20 >= target.minFps + 8 then
				applyTier(target)
			end
		end
	end)

	State.onReady:Connect(function()
		if State.settings and State.settings.quality then
			self:setManual(State.settings.quality)
		end
	end)

	Net:listen("EventStarted", function(payload)
		self:applyEventLighting(payload and payload.lighting)
	end)
	Net:listen("EventEnded", function()
		self:applyEventLighting(nil)
	end)
end

return GraphicsController
