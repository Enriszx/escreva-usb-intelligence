--!strict
-- Live events. The scheduler picks one every EVENT_INTERVAL and announces it
-- server-wide; admins can force one. Events are the retention hook: players
-- come back because Blood Moon is at 20:00.

export type Event = {
	key: string,
	name: string,
	desc: string,
	icon: string,
	duration: number, -- seconds
	weight: number,
	colour: Color3,
	-- global modifiers while active
	mods: {
		luckMult: number?,
		coinMult: number?,
		growMult: number?,
		stealSpeed: number?,
		mutationUnlock: string?, -- id of an eventOnly mutation that becomes rollable
	},
	-- lighting override for atmosphere, applied client-side
	lighting: {
		clockTime: number?,
		ambient: Color3?,
		outdoorAmbient: Color3?,
		fogColour: Color3?,
		brightness: number?,
	}?,
}

local function c(r, g, b)
	return Color3.fromRGB(r, g, b)
end

local E: { Event } = {
	{
		key = "BloodMoon",
		name = "LUA DE SANGUE",
		icon = "🌑",
		weight = 26,
		duration = 600,
		desc = "x4 de sorte, mutação Lua de Sangue liberada e roubos 40% mais rápidos. Tranque as cercas.",
		colour = c(183, 28, 28),
		mods = { luckMult = 4, stealSpeed = 0.6, mutationUnlock = "BloodMoon" },
		lighting = {
			clockTime = 0,
			ambient = c(60, 10, 10),
			outdoorAmbient = c(90, 20, 20),
			fogColour = c(80, 10, 10),
			brightness = 1.2,
		},
	},
	{
		key = "MeteorShower",
		name = "CHUVA DE METEOROS",
		icon = "☄️",
		weight = 24,
		duration = 480,
		desc = "x3 de sorte e mutação Meteórica liberada. Meteoros caem nas fazendas e aceleram plantas.",
		colour = c(255, 138, 101),
		mods = { luckMult = 3, growMult = 1.5, mutationUnlock = "Meteoric" },
		lighting = {
			clockTime = 1.5,
			ambient = c(30, 25, 45),
			outdoorAmbient = c(60, 50, 80),
			brightness = 1.6,
		},
	},
	{
		key = "GoldenHour",
		name = "HORA DOURADA",
		icon = "🌅",
		weight = 28,
		duration = 420,
		desc = "x3 em todas as moedas. Guarde a colheita e venda tudo agora.",
		colour = c(255, 179, 0),
		mods = { coinMult = 3 },
		lighting = {
			clockTime = 17.4,
			ambient = c(90, 70, 40),
			outdoorAmbient = c(160, 120, 70),
			brightness = 2.8,
		},
	},
	{
		key = "GrowthSurge",
		name = "EXPLOSÃO DE CRESCIMENTO",
		icon = "🌿",
		weight = 28,
		duration = 420,
		desc = "x5 na velocidade de crescimento. Plante o mais caro que você tiver AGORA.",
		colour = c(102, 187, 106),
		mods = { growMult = 5 },
		lighting = { clockTime = 13, outdoorAmbient = c(120, 160, 110), brightness = 2.6 },
	},
	{
		key = "ThiefNight",
		name = "NOITE DOS LADRÕES",
		icon = "🥷",
		weight = 20,
		duration = 360,
		desc = "Roubos 70% mais rápidos e escudos reduzidos pela metade. Ninguém está seguro.",
		colour = c(69, 39, 160),
		mods = { stealSpeed = 0.3, luckMult = 1.5 },
		lighting = {
			clockTime = 23,
			ambient = c(25, 25, 50),
			outdoorAmbient = c(40, 40, 80),
			brightness = 1.0,
		},
	},
	{
		key = "CosmicRift",
		name = "FENDA CÓSMICA",
		icon = "🌀",
		weight = 8,
		duration = 300,
		desc = "RARO: x8 de sorte. A única janela realista para pegar uma aura Galáctica.",
		colour = c(124, 77, 255),
		mods = { luckMult = 8, coinMult = 1.5 },
		lighting = {
			clockTime = 2,
			ambient = c(45, 25, 80),
			outdoorAmbient = c(80, 50, 140),
			fogColour = c(60, 30, 110),
			brightness = 1.8,
		},
	},
}

local byKey = {}
for _, e in E do
	byKey[e.key] = e
end

return {
	all = E,
	byKey = byKey,
	-- seconds between automatic events
	interval = 900,
	-- how long players get a "coming soon" warning
	warning = 60,
}
