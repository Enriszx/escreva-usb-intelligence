--!nonstrict
-- First-session guidance.
--
-- Roblox players quit in the first 60 seconds or they stay for hours. The only
-- job here is: by second 30 the player must have planted something and
-- understood that plants become money. So the tutorial is three steps, it is
-- non-blocking, and it disappears forever once completed.

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Economy = require(Shared.Economy)
local Net = require(Shared.Util.Net)
local State = require(script.Parent.Parent.State)
local B = require(script.Parent.Parent.UI.Builder)

local Theme = Config.Theme
local TutorialController = { name = "TutorialController" }

local app
local card: Frame?
local step = 1
local finished = false

local STEPS = {
	{
		title = "1. Plante sua primeira semente",
		body = "Vá até um canteiro na sua fazenda e toque nele. Você já começa com 3 Cenouras.",
		done = function()
			for _, plant in State.tiles do
				if plant then
					return true
				end
			end
			return false
		end,
	},
	{
		title = "2. Espere e colha",
				body = "A planta cresce em tempo real. Quando ficar pronta, toque nela ou use COLHER TUDO. Mutações raras valem até 2500x!",
		done = function()
			return (State.stats and State.stats.harvested or 0) >= 1
		end,
	},
	{
		title = "3. Venda no mercado",
		body = "Leve sua colheita ao MERCADO no centro do mapa (ou use VENDER TUDO) e compre sementes melhores.",
		done = function()
			return (State.stats and State.stats.sold or 0) > 0
		end,
	},
	{
		title = "4. Agora o melhor: roube alguém",
		body = "Visite a fazenda de outro jogador pelo RANKING e roube uma planta pronta. Cuidado: eles recebem um alarme!",
		done = function()
			return (State.stats and State.stats.stolen or 0) >= 1
		end,
	},
}

function TutorialController:init(a)
	app = a
end

local function build()
	local holder = B.new("Frame", {
		Name = "Tutorial",
		Size = UDim2.fromOffset(330, 124),
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 92),
		BackgroundColor3 = Theme.panel,
		ZIndex = Theme.z.overlay,
		Parent = app.HudController:overlayLayer(),
	})
	B.corner(Theme.radius).Parent = holder
	B.stroke(Theme.primary, 3, 0).Parent = holder
	B.gradient(Theme.panelAlt, Theme.panel, 90).Parent = holder
	B.padding(12).Parent = holder

	B.label("", {
		Parent = holder, Size = UDim2.new(1, -24, 0, 22), Font = Theme.fontBlack,
		TextSize = Theme.body, TextColor3 = Theme.primary, Name = "Title",
	})
	B.label("", {
		Parent = holder, Size = UDim2.new(1, 0, 0, 56), Position = UDim2.fromOffset(0, 24),
		TextSize = Theme.small, TextColor3 = Theme.textDim, Font = Theme.fontBody,
		TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top, Name = "Body",
	})
	B.bar({
		parent = holder,
		size = UDim2.new(1, 0, 0, 14),
		position = UDim2.new(0, 0, 1, -14),
		colour = Theme.primary,
		value = 0,
		text = "",
		name = "Progress",
	})
	B.button({
		parent = holder,
		name = "Skip",
		size = UDim2.fromOffset(22, 22),
		position = UDim2.new(1, -22, 0, -2),
		colour = Theme.panelAlt,
		text = "✕",
		textSize = Theme.tiny,
		textColour = Theme.textDim,
		height = 22,
		gradient = false,
		onClick = function()
			finished = true
			if card then
				card:Destroy()
				card = nil
			end
		end,
	})
	return holder
end

function TutorialController:update()
	if finished then
		return
	end
	-- advance past anything already satisfied (covers returning players)
	while step <= #STEPS and STEPS[step].done() do
		step += 1
	end
	if step > #STEPS then
		finished = true
		if card then
			app.FeedbackController:toast({
				kind = "success",
				title = "🎓 Tutorial completo!",
				body = "Agora é só crescer, roubar e renascer. Boa sorte!",
				duration = 6,
			})
			card:Destroy()
			card = nil
		end
		return
	end

	if not card then
		card = build()
	end
	local info = STEPS[step]
	local title = card:FindFirstChild("Title")
	local body = card:FindFirstChild("Body")
	local progress = card:FindFirstChild("Progress")
	if title then
		title.Text = info.title
	end
	if body then
		body.Text = info.body
	end
	if progress then
		B.setBar(progress, (step - 1) / #STEPS, ("Passo %d de %d"):format(step, #STEPS))
	end
end

function TutorialController:start()
	State.onReady:Connect(function()
		-- veterans never see this
		local s = State.stats or {}
		if (s.stolen or 0) >= 1 and (s.sold or 0) > 0 then
			finished = true
			return
		end
		task.wait(1.5)
		self:update()
	end)

	State.changed:Connect(function()
		self:update()
	end)
	State.plotChanged:Connect(function()
		self:update()
	end)
end

return TutorialController
