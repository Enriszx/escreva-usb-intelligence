--!strict
-- GAMEPASSES.
--
-- IMPORTANT: `id` must be filled with the real Game Pass ID from
-- create.roblox.com -> your experience -> Monetization -> Passes.
-- Leave it at 0 during development: every pass then resolves to false in live
-- servers but can be force-granted in Studio via Config.Balance.studioGrantAll.
--
-- Pricing follows the Roblox 2026 sweet spots: a 49-149 Robux impulse tier, a
-- 199-499 Robux core tier, and one 999+ Robux whale anchor. The anchor exists
-- mostly to make the 499 passes look cheap.

export type Pass = {
	key: string,
	id: number,
	name: string,
	desc: string,
	robux: number,
	icon: string, -- emoji fallback; replace with a decal id when you have art
	colour: Color3,
	order: number,
	-- mechanical effect, read by the services. Anything not listed is cosmetic.
	effect: {
		coinMult: number?,
		growMult: number?,
		luckMult: number?,
		extraTiles: number?,
		extraPetSlots: number?,
		stealResist: number?,  -- 0..1 chance to fully block a steal
		stealSpeed: number?,   -- multiplier on your own steal channel time
		autoHarvest: boolean?,
		autoPlant: boolean?,
		autoSell: boolean?,
		offlineHours: number?,
		gemPerHour: number?,
		radar: boolean?,
		chatTag: string?,
		rebirthDiscount: number?, -- 0..1 reduction of rebirth cost
		extraStealSlots: number?,
	},
}

local function c(r, g, b)
	return Color3.fromRGB(r, g, b)
end

local Passes: { [string]: Pass } = {
	vip = {
		key = "vip", id = 0, name = "VIP", robux = 399, order = 1,
		desc = "x2 moedas, x1.25 crescimento, área VIP exclusiva, tag no chat, +2 slots de armazém e 25 gemas por dia.",
		icon = "👑", colour = c(255, 179, 0),
		effect = { coinMult = 2, growMult = 1.25, chatTag = "VIP", gemPerHour = 1, offlineHours = 6 },
	},
	autoHarvest = {
		key = "autoHarvest", id = 0, name = "Colheita Automática", robux = 299, order = 2,
		desc = "Colhe sozinho tudo que ficar pronto na sua fazenda, mesmo quando você está roubando os outros.",
		icon = "🤖", colour = c(3, 169, 244),
		effect = { autoHarvest = true },
	},
	autoPlant = {
		key = "autoPlant", id = 0, name = "Plantio Automático", robux = 349, order = 3,
		desc = "Replanta automaticamente a melhor semente que você tem assim que um canteiro fica livre.",
		icon = "🌱", colour = c(102, 187, 106),
		effect = { autoPlant = true },
	},
	extraTiles = {
		key = "extraTiles", id = 0, name = "+6 Canteiros", robux = 449, order = 4,
		desc = "Seis canteiros permanentes a mais na sua fazenda. Mais canteiros = mais moedas por minuto, para sempre.",
		icon = "🧱", colour = c(141, 110, 99),
		effect = { extraTiles = 6 },
	},
	megaLuck = {
		key = "megaLuck", id = 0, name = "Mega Sorte", robux = 499, order = 5,
		desc = "x2.5 de sorte permanente nas mutações. Arco-Íris, Vazio e Celestial ficam muito mais prováveis.",
		icon = "🍀", colour = c(118, 255, 3),
		effect = { luckMult = 2.5 },
	},
	fastGrow = {
		key = "fastGrow", id = 0, name = "Crescimento Turbo", robux = 399, order = 6,
		desc = "x2 na velocidade de crescimento de TODAS as plantas, para sempre.",
		icon = "⚡", colour = c(255, 241, 118),
		effect = { growMult = 2 },
	},
	shield = {
		key = "shield", id = 0, name = "Escudo da Fazenda", robux = 299, order = 7,
		desc = "60% de chance de bloquear qualquer roubo na sua fazenda + alarme sonoro quando alguém tentar.",
		icon = "🛡️", colour = c(66, 165, 245),
		effect = { stealResist = 0.6 },
	},
	masterThief = {
		key = "masterThief", id = 0, name = "Mestre Ladrão", robux = 449, order = 8,
		desc = "Rouba 2x mais rápido, +2 roubos simultâneos e seu nome fica oculto para a vítima.",
		icon = "🥷", colour = c(69, 39, 160),
		effect = { stealSpeed = 0.5, extraStealSlots = 2 },
	},
	petSlots = {
		key = "petSlots", id = 0, name = "+2 Slots de Pet", robux = 349, order = 9,
		desc = "Equipe 5 pets ao mesmo tempo em vez de 3. Os multiplicadores somam.",
		icon = "🐾", colour = c(236, 64, 122),
		effect = { extraPetSlots = 2 },
	},
	autoSell = {
		key = "autoSell", id = 0, name = "Venda Automática", robux = 249, order = 10,
		desc = "Vende a colheita na hora, sem precisar ir até o mercado. Nunca mais perde espaço no armazém.",
		icon = "💸", colour = c(0, 200, 83),
		effect = { autoSell = true },
	},
	radar = {
		key = "radar", id = 0, name = "Radar de Raridades", robux = 199, order = 11,
		desc = "Mostra setas na tela apontando para as plantas mutadas mais valiosas do servidor.",
		icon = "📡", colour = c(0, 229, 255),
		effect = { radar = true },
	},
	offlineGrowth = {
		key = "offlineGrowth", id = 0, name = "Fazenda Eterna", robux = 399, order = 12,
		desc = "Sua fazenda cresce por até 24 horas offline em vez de 4. Volte rico todo dia.",
		icon = "🌙", colour = c(121, 134, 203),
		effect = { offlineHours = 24 },
	},
	ultimate = {
		key = "ultimate", id = 0, name = "⭐ PACOTE SUPREMO ⭐", robux = 1999, order = 0,
		desc = "TUDO de uma vez: x3 moedas, x3 crescimento, x4 sorte, +10 canteiros, +3 pets, colheita e plantio automáticos, escudo 85%, roubo 3x mais rápido, 72h offline, tag SUPREMO e 100 gemas por dia.",
		icon = "🌟", colour = c(255, 0, 128),
		effect = {
			coinMult = 3, growMult = 3, luckMult = 4, extraTiles = 10, extraPetSlots = 3,
			autoHarvest = true, autoPlant = true, autoSell = true, stealResist = 0.85,
			stealSpeed = 0.33, extraStealSlots = 3, offlineHours = 72, gemPerHour = 4,
			radar = true, chatTag = "SUPREMO", rebirthDiscount = 0.25,
		},
	},
}

local ordered = {}
for _, p in Passes do
	table.insert(ordered, p)
end
table.sort(ordered, function(a, b)
	return a.order < b.order
end)

return {
	byKey = Passes,
	ordered = ordered,
	-- every pass whose id was actually configured
	live = function(): { Pass }
		local out = {}
		for _, p in ordered do
			if p.id ~= 0 then
				table.insert(out, p)
			end
		end
		return out
	end,
}
