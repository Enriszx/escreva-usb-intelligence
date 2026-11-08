--!nonstrict
-- Toasts, global announcements, screen effects, sounds and the steal alarm.
--
-- This is the "juice" layer. It is also where a mobile game is usually ruined,
-- so the rules are:
--   * at most 4 toasts on screen, oldest evicted
--   * announcements queue instead of overlapping
--   * every sound is procedurally generated from Roblox's built-in library
--     (no uploaded assets needed to ship) and respects the sfx setting
--   * particle bursts are skipped entirely on the Potato/Low tiers

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")
local RunService = game:GetService("RunService")
local Lighting = game:GetService("Lighting")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local Layout = require(Shared.Layout)
local State = require(script.Parent.Parent.State)
local Graphics = require(script.Parent.GraphicsController)
local B = require(script.Parent.Parent.UI.Builder)
local C = require(script.Parent.Parent.UI.Components)

local Theme = Config.Theme
local FeedbackController = { name = "FeedbackController" }

local app
local toastHolder: Frame
local announceHolder: Frame
local alarmFrame: Frame
local toasts = {}
local announceQueue = {}
local announcing = false

-- Roblox-provided sound ids: shipping with zero uploaded assets means the
-- experience is playable the moment it is published.
local SOUNDS = {
	click = "rbxassetid://6895079853",
	success = "rbxassetid://6026984224",
	error = "rbxassetid://6926142961",
	coins = "rbxassetid://607665037",
	harvest = "rbxassetid://5852470908",
	levelup = "rbxassetid://6518811702",
	alarm = "rbxassetid://1584831021",
	steal = "rbxassetid://5751522543",
	hatch = "rbxassetid://5953379614",
	event = "rbxassetid://9120386436",
	rebirth = "rbxassetid://6518811702",
}

local soundCache = {}

function FeedbackController:init(a)
	app = a
end

function FeedbackController:play(name: string, volume: number?, pitch: number?)
	if State.settings and State.settings.sfx == false then
		return
	end
	local id = SOUNDS[name]
	if not id then
		return
	end
	local sound = soundCache[name]
	if not sound or not sound.Parent then
		sound = Instance.new("Sound")
		sound.SoundId = id
		sound.Parent = SoundService
		soundCache[name] = sound
	end
	sound.Volume = volume or 0.4
	sound.PlaybackSpeed = pitch or 1
	sound.TimePosition = 0
	sound:Play()
end

-- Toasts -----------------------------------------------------------------

local TOAST_COLOURS = {
	success = Theme.success,
	error = Theme.danger,
	info = Theme.secondary,
	purchase = Theme.coins,
	quest = Theme.warn,
	levelup = Theme.gems,
	offline = Theme.primary,
}

function FeedbackController:toast(payload)
	if not toastHolder then
		return
	end
	local colour = TOAST_COLOURS[payload.kind] or Theme.secondary
	local card = B.card({
		parent = toastHolder,
		size = UDim2.new(1, 0, 0, payload.body and 64 or 46),
		colour = Theme.panel,
		strokeColour = colour,
		strokeThickness = 2.5,
		strokeTransparency = 0,
		order = -os.clock(),
		pad = 10,
	})
	card.BackgroundTransparency = 0.05

	B.label(payload.title or "", {
		Parent = card,
		Size = UDim2.new(1, 0, 0, payload.body and 22 or 26),
		Font = Theme.fontBlack,
		TextSize = Theme.body,
		TextColor3 = colour,
		TextWrapped = not payload.body,
	})
	if payload.body then
		B.label(payload.body, {
			Parent = card,
			Size = UDim2.new(1, 0, 0, 24),
			Position = UDim2.fromOffset(0, 21),
			TextSize = Theme.small,
			TextColor3 = Theme.textDim,
			Font = Theme.fontBody,
			TextWrapped = true,
			TextYAlignment = Enum.TextYAlignment.Top,
		})
	end

	-- slide in
	card.Position = UDim2.fromOffset(40, 0)
	TweenService:Create(card, TweenInfo.new(0.24, Theme.ease, Enum.EasingDirection.Out), {
		Position = UDim2.fromOffset(0, 0),
	}):Play()

	table.insert(toasts, card)
	while #toasts > 4 do
		local old = table.remove(toasts, 1)
		if old then
			old:Destroy()
		end
	end

	self:play(
		payload.kind == "error" and "error" or payload.kind == "purchase" and "coins" or "success",
		0.32
	)

	task.delay(payload.duration or 3.4, function()
		local index = table.find(toasts, card)
		if index then
			table.remove(toasts, index)
		end
		if card.Parent then
			local out = TweenService:Create(card, TweenInfo.new(0.2), {
				Position = UDim2.fromOffset(60, 0),
				BackgroundTransparency = 1,
			})
			out.Completed:Connect(function()
				card:Destroy()
			end)
			out:Play()
		end
	end)
end

-- Announcements ----------------------------------------------------------

local function showAnnouncement(payload)
	announcing = true
	local banner = B.new("Frame", {
		Name = "Announce",
		Size = UDim2.new(1, 0, 0, payload.body and 72 or 54),
		BackgroundColor3 = Theme.panel,
		BackgroundTransparency = 0.06,
		Parent = announceHolder,
	})
	B.corner(Theme.radius).Parent = banner
	B.stroke(payload.colour or Theme.warn, 3, 0).Parent = banner
	B.gradient(Theme.panelAlt, Theme.panel, 90).Parent = banner
	B.padding(10).Parent = banner

	B.label(payload.title or "", {
		Parent = banner,
		Size = UDim2.new(1, 0, 0, payload.body and 28 or 34),
		Font = Theme.fontBlack,
		TextSize = Theme.h3,
		TextColor3 = payload.colour or Theme.warn,
		TextXAlignment = Enum.TextXAlignment.Center,
		TextWrapped = true,
	})
	if payload.body then
		B.label(payload.body, {
			Parent = banner,
			Size = UDim2.new(1, 0, 0, 26),
			Position = UDim2.fromOffset(0, 28),
			TextSize = Theme.small,
			TextColor3 = Theme.textDim,
			Font = Theme.fontBody,
			TextXAlignment = Enum.TextXAlignment.Center,
			TextWrapped = true,
		})
	end

	banner.Position = UDim2.fromOffset(0, -80)
	TweenService:Create(banner, TweenInfo.new(0.34, Theme.ease, Enum.EasingDirection.Out), {
		Position = UDim2.fromOffset(0, 0),
	}):Play()

	local duration = payload.duration or 5
	task.delay(duration, function()
		local out = TweenService:Create(banner, TweenInfo.new(0.24), {
			Position = UDim2.fromOffset(0, -80),
			BackgroundTransparency = 1,
		})
		out.Completed:Connect(function()
			banner:Destroy()
			announcing = false
		end)
		out:Play()
	end)
end

function FeedbackController:announce(payload)
	if State.settings and State.settings.announcements == false and payload.kind ~= "admin" then
		return
	end
	table.insert(announceQueue, payload)
end

-- Steal alarm ------------------------------------------------------------

function FeedbackController:alarm(payload)
	if not alarmFrame then
		return
	end
	local kinds = {
		start = { title = "🚨 ALGUÉM ESTÁ ROUBANDO SUA FAZENDA!", colour = Theme.danger },
		stolen = { title = "😡 VOCÊ FOI ROUBADO!", colour = Theme.danger },
		blocked = { title = "🛡️ ROUBO BLOQUEADO!", colour = Theme.primary },
		cancel = { title = "✅ O ladrão desistiu", colour = Theme.secondary },
		revenge = { title = "😈 VINGANÇA SOFRIDA", colour = Theme.steal },
	}
	local info = kinds[payload.kind] or kinds.start
	local body
	if payload.kind == "stolen" then
		body = ("%s levou sua %s (−%s moedas)"):format(
			payload.thief or "Alguém",
			payload.name or "planta",
			Format.short(payload.value or 0)
		)
	elseif payload.kind == "blocked" then
		body = ("%s tentou roubar e falhou. Seu escudo aguentou!"):format(payload.thief or "Alguém")
	elseif payload.kind == "start" then
		body = ("%s está levando sua planta! Corra até o canteiro %d."):format(
			payload.thief or "Alguém",
			payload.tile or 0
		)
	elseif payload.kind == "revenge" then
		body = ("%s se vingou e levou uma planta sua."):format(payload.thief or "Alguém")
	else
		body = nil
	end

	self:announce({ title = info.title, body = body, colour = info.colour, duration = 6, kind = "alarm" })

	if payload.kind == "start" or payload.kind == "stolen" then
		self:play("alarm", 0.55)
		-- red vignette pulse: unmissable, and costs one frame's worth of work
		self:flash(Theme.danger, 0.3)
		if payload.position then
			self:marker(
				payload.position,
				payload.kind == "start" and "🥷 LADRÃO!" or "💸 ROUBADA",
				Theme.danger
			)
		end
	elseif payload.kind == "blocked" then
		self:play("success", 0.5)
		self:flash(Theme.primary, 0.2)
	end
end

--- Full-screen colour flash. Cheap and extremely readable.
function FeedbackController:flash(colour: Color3, strength: number?)
	if not alarmFrame then
		return
	end
	alarmFrame.BackgroundColor3 = colour
	alarmFrame.BackgroundTransparency = 1 - (strength or 0.25)
	alarmFrame.Visible = true
	local tween = TweenService:Create(alarmFrame, TweenInfo.new(0.7, Enum.EasingStyle.Quad), {
		BackgroundTransparency = 1,
	})
	tween.Completed:Connect(function()
		alarmFrame.Visible = false
	end)
	tween:Play()
end

--- World-space marker so the victim knows WHERE to run.
function FeedbackController:marker(position: Vector3, text: string, colour: Color3)
	local anchor = Instance.new("Part")
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.Transparency = 1
	anchor.Size = Vector3.one
	anchor.Position = position + Vector3.new(0, 6, 0)
	anchor.Parent = workspace

	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromScale(9, 2.6)
	bb.AlwaysOnTop = true
	bb.LightInfluence = 0
	bb.Parent = anchor

	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Theme.fontBlack
	label.Text = text
	label.TextColor3 = colour
	label.TextScaled = true
	label.Parent = bb
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.new(0, 0, 0)
	stroke.Thickness = 3
	stroke.Parent = label

	task.delay(6, function()
		anchor:Destroy()
	end)
end

-- Floating numbers -------------------------------------------------------

function FeedbackController:floatText(position: Vector3, text: string, colour: Color3)
	if not Graphics.tier.particles then
		return
	end
	local anchor = Instance.new("Part")
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.Transparency = 1
	anchor.Size = Vector3.one
	anchor.Position = position
	anchor.Parent = workspace

	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromScale(6, 2)
	bb.AlwaysOnTop = true
	bb.LightInfluence = 0
	bb.Parent = anchor

	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Theme.fontBlack
	label.Text = text
	label.TextColor3 = colour
	label.TextScaled = true
	label.Parent = bb
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.new(0, 0, 0)
	stroke.Thickness = 2.5
	stroke.Parent = label

	TweenService:Create(anchor, TweenInfo.new(1.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Position = position + Vector3.new(0, 7, 0),
	}):Play()
	TweenService:Create(label, TweenInfo.new(1.1), { TextTransparency = 1 }):Play()
	TweenService:Create(stroke, TweenInfo.new(1.1), { Transparency = 1 }):Play()
	task.delay(1.2, function()
		anchor:Destroy()
	end)
end

-- Mutation celebration ---------------------------------------------------

--- The jackpot moment. Scales with how rare the roll was, so a Golden tomato
--- gets a small pop and an Omega gets the full screen takeover.
function FeedbackController:celebrate(payload)
	local Mutations = Config.Mutations
	local Seeds = Config.Seeds
	local mult = payload.mult or 1
	if mult <= 1 then
		return
	end

	local label = Mutations.label(payload.element, payload.aura)
	local seed = Seeds.byId[payload.seed]
	local element = payload.element and Mutations.byId[payload.element]
	local aura = payload.aura and Mutations.byId[payload.aura]
	local colour = (aura and aura.mult > (element and element.mult or 1) and aura.colour)
		or (element and element.colour)
		or Theme.coins

	local tilePos = State.plotId and Layout.tileWorldPosition(State.plotId, payload.tile)
	if tilePos then
		self:floatText(
			tilePos + Vector3.new(0, 4, 0),
			("%s  %s"):format(label, Format.multiplier(mult)),
			colour
		)
	end

	if mult >= 15 then
		self:play("levelup", 0.5, mult >= 400 and 0.8 or 1)
		self:flash(colour, mult >= 400 and 0.5 or 0.22)
		self:toast({
			kind = "purchase",
			title = ("✨ %s %s!"):format(label, seed and seed.name or ""),
			body = ("%s  •  💰 %s moedas"):format(
				Format.multiplier(mult),
				Format.short(payload.value or 0)
			),
			duration = 6,
		})
	else
		self:play("harvest", 0.25, 1.1)
	end
end

-- Lifecycle --------------------------------------------------------------

function FeedbackController:start()
	local overlay = app.HudController:overlayLayer()

	toastHolder = B.new("Frame", {
		Name = "Toasts",
		Size = UDim2.fromOffset(300, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -14, 0, 180),
		BackgroundTransparency = 1,
		Parent = overlay,
	})
	local tl = B.list(Enum.FillDirection.Vertical, 8, Enum.HorizontalAlignment.Right)
	tl.Parent = toastHolder

	announceHolder = B.new("Frame", {
		Name = "Announcements",
		Size = UDim2.fromOffset(560, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 12),
		BackgroundTransparency = 1,
		Parent = overlay,
	})
	local al = B.list(Enum.FillDirection.Vertical, 6, Enum.HorizontalAlignment.Center)
	al.Parent = announceHolder
	if C.isPhone() then
		announceHolder.Size = UDim2.new(1, -160, 0, 0)
	end

	alarmFrame = B.new("Frame", {
		Name = "Flash",
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = Theme.danger,
		BackgroundTransparency = 1,
		Visible = false,
		ZIndex = Theme.z.cinematic,
		Parent = overlay,
	})
	B.gradient(Color3.new(1, 1, 1), Color3.new(0.2, 0.2, 0.2), 90).Parent = alarmFrame

	-- announcement queue pump
	task.spawn(function()
		while true do
			task.wait(0.3)
			if not announcing and #announceQueue > 0 then
				local payload = table.remove(announceQueue, 1)
				pcall(showAnnouncement, payload)
			end
		end
	end)

	Net:listen("Toast", function(payload)
		self:toast(payload)
	end)
	Net:listen("Announce", function(payload)
		self:announce(payload)
		if payload.kind == "event" then
			self:play("event", 0.4)
		end
	end)
	Net:listen("StealAlarm", function(payload)
		self:alarm(payload)
	end)
	Net:listen("MutationRoll", function(payload)
		self:celebrate(payload)
	end)

	Net:listen("Vfx", function(payload)
		if payload.kind == "harvest" and payload.tile and State.plotId then
			local pos = Layout.tileWorldPosition(State.plotId, payload.tile)
			self:floatText(pos + Vector3.new(0, 3, 0), "+" .. Format.short(payload.value or 0), Theme.coins)
			self:play("harvest", 0.3)
		elseif payload.kind == "sell" then
			self:play("coins", 0.45)
		elseif payload.kind == "autoharvest" then
			self:play("harvest", 0.18, 1.3)
		end
	end)

	Net:listen("HatchResult", function(payload)
		local pet = Config.Pets.byId[payload.pet]
		local rarity = Config.Rarities.get(payload.rarity)
		self:play("hatch", 0.5)
		self:flash(rarity.colour, rarity.order >= 5 and 0.4 or 0.15)
		self:toast({
			kind = "purchase",
			title = ("🥚 %s!"):format(pet and pet.name or payload.pet),
			body = ("Raridade: %s"):format(rarity.name),
			duration = 5,
		})
	end)

	Net:listen("RebirthResult", function(payload)
		self:play("rebirth", 0.6)
		self:flash(payload.rank and payload.rank.colour or Theme.steal, 0.55)
		local body = ("+%s gemas"):format(Format.short(payload.gems or 0))
		if payload.unlocked and #payload.unlocked > 0 then
			body ..= ("  •  Desbloqueado: %s"):format(table.concat(payload.unlocked, ", "))
		end
		self:announce({
			title = ("♻️ RENASCIMENTO #%d"):format(payload.rebirths or 0),
			body = body,
			colour = payload.rank and payload.rank.colour or Theme.steal,
			duration = 7,
			kind = "rebirth",
		})
	end)

	Net:listen("StealProgress", function(payload)
		app.HudController:showSteal(payload)
		self:play("steal", 0.3)
	end)

	Net:listen("StealResult", function(payload)
		app.HudController:hideSteal()
		if payload.ok then
			self:play("coins", 0.55)
			self:toast({
				kind = "purchase",
				title = ("🥷 Roubou %s!"):format(payload.name or "uma planta"),
				body = ("+%s moedas  •  de %s"):format(
					Format.short(payload.value or 0),
					payload.victim or "?"
				),
				duration = 5,
			})
		else
			self:toast({
				kind = payload.blocked and "error" or "info",
				title = payload.reason or "Roubo cancelado",
				duration = 3.5,
			})
			if payload.blocked then
				self:flash(Theme.danger, 0.25)
			end
		end
	end)
end

return FeedbackController
