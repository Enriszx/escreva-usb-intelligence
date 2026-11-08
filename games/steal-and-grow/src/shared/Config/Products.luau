--!strict
-- DEVELOPER PRODUCTS (consumable, repeat purchase — the real revenue driver).
-- Fill `id` from create.roblox.com -> Monetization -> Developer Products.

export type Product = {
	key: string,
	id: number,
	name: string,
	desc: string,
	robux: number,
	icon: string,
	colour: Color3,
	order: number,
	kind: "coins" | "gems" | "boost" | "utility" | "bundle",
	payload: { [string]: any },
	bestValue: boolean?,
}

local function c(r, g, b)
	return Color3.fromRGB(r, g, b)
end

local Products: { [string]: Product } = {
	-- Currency: amounts are RELATIVE to the player's economy stage so the packs
	-- never become worthless late game. See EconomyService.grantScaled.
	coinsS = { key = "coinsS", id = 0, name = "Saco de Moedas", desc = "Moedas equivalentes a 20 minutos da sua melhor produção.", robux = 99, icon = "💰", colour = c(255, 213, 79), order = 1, kind = "coins", payload = { minutes = 20 } },
	coinsM = { key = "coinsM", id = 0, name = "Baú de Moedas", desc = "Moedas equivalentes a 2 horas da sua melhor produção.", robux = 299, icon = "🪙", colour = c(255, 179, 0), order = 2, kind = "coins", payload = { minutes = 120 } },
	coinsL = { key = "coinsL", id = 0, name = "Cofre de Moedas", desc = "Moedas equivalentes a 8 horas da sua melhor produção.", robux = 799, icon = "🏦", colour = c(255, 143, 0), order = 3, kind = "coins", payload = { minutes = 480 }, bestValue = true },
	coinsXL = { key = "coinsXL", id = 0, name = "Montanha de Moedas", desc = "Moedas equivalentes a 36 horas da sua melhor produção.", robux = 2499, icon = "⛰️", colour = c(255, 111, 0), order = 4, kind = "coins", payload = { minutes = 2160 } },

	gemsS = { key = "gemsS", id = 0, name = "250 Gemas", desc = "Gemas compram Ovos Cósmicos, potions e reroll de loja.", robux = 149, icon = "💎", colour = c(0, 229, 255), order = 5, kind = "gems", payload = { gems = 250 } },
	gemsM = { key = "gemsM", id = 0, name = "1.400 Gemas", desc = "+12% de bônus em gemas.", robux = 749, icon = "💠", colour = c(0, 184, 212), order = 6, kind = "gems", payload = { gems = 1400 } },
	gemsL = { key = "gemsL", id = 0, name = "4.000 Gemas", desc = "+33% de bônus em gemas. Melhor custo-benefício.", robux = 1999, icon = "🔷", colour = c(0, 151, 167), order = 7, kind = "gems", payload = { gems = 4000 }, bestValue = true },

	-- Boosts: timed, stackable in duration, visible in the HUD
	boostCoins = { key = "boostCoins", id = 0, name = "Poção de Ouro (30min)", desc = "x3 moedas em tudo que você vender por 30 minutos.", robux = 199, icon = "🧪", colour = c(255, 215, 64), order = 8, kind = "boost", payload = { stat = "coinMult", value = 3, seconds = 1800 } },
	boostLuck = { key = "boostLuck", id = 0, name = "Poção de Sorte (30min)", desc = "x5 de sorte nas mutações por 30 minutos.", robux = 249, icon = "🍀", colour = c(118, 255, 3), order = 9, kind = "boost", payload = { stat = "luckMult", value = 5, seconds = 1800 } },
	boostGrow = { key = "boostGrow", id = 0, name = "Poção de Crescimento (30min)", desc = "x4 na velocidade de crescimento por 30 minutos.", robux = 199, icon = "⚡", colour = c(255, 241, 118), order = 10, kind = "boost", payload = { stat = "growMult", value = 4, seconds = 1800 } },
	boostServer = { key = "boostServer", id = 0, name = "🎉 BÔNUS DO SERVIDOR (15min)", desc = "x2 moedas e x2 sorte para TODOS no servidor. Seu nome aparece no anúncio global.", robux = 399, icon = "🎊", colour = c(255, 110, 199), order = 11, kind = "boost", payload = { server = true, coinMult = 2, luckMult = 2, seconds = 900 } },

	-- Utility: the convenience money
	instantGrow = { key = "instantGrow", id = 0, name = "Crescer Tudo Agora", desc = "Termina instantaneamente TODAS as plantas da sua fazenda e rola as mutações.", robux = 149, icon = "⏩", colour = c(3, 169, 244), order = 12, kind = "utility", payload = { instantGrow = true } },
	shopReroll = { key = "shopReroll", id = 0, name = "Renovar Loja", desc = "Força um novo estoque de sementes na loja agora, com +1 nível de raridade garantido.", robux = 99, icon = "🔄", colour = c(171, 71, 188), order = 13, kind = "utility", payload = { reroll = true } },
	extraPlot = { key = "extraPlot", id = 0, name = "+1 Canteiro Permanente", desc = "Adiciona um canteiro permanente. Pode comprar várias vezes (até 24).", robux = 199, icon = "➕", colour = c(141, 110, 99), order = 14, kind = "utility", payload = { tiles = 1, maxStack = 24 } },
	revengeSteal = { key = "revengeSteal", id = 0, name = "Vingança", desc = "Roubo instantâneo garantido na fazenda de quem te roubou por último, ignorando escudos.", robux = 249, icon = "😈", colour = c(183, 28, 28), order = 15, kind = "utility", payload = { revenge = true } },
	rebirthToken = { key = "rebirthToken", id = 0, name = "Ficha de Renascimento", desc = "Renasce na hora sem pagar o custo em moedas e mantém 25% das moedas.", robux = 599, icon = "♻️", colour = c(124, 77, 255), order = 16, kind = "utility", payload = { freeRebirth = true } },

	-- Bundles: the single best-converting item in a Roblox sim
	starterPack = {
		key = "starterPack", id = 0, name = "🎁 PACOTE INICIANTE", order = 0,
		desc = "Só na sua primeira hora: 2 horas de moedas, 500 gemas, 3 canteiros, 1 Ovo Raro e x2 moedas por 24 horas. Vale 5x o preço.",
		robux = 199, icon = "🎁", colour = c(0, 200, 83), kind = "bundle",
		payload = { minutes = 120, gems = 500, tiles = 3, egg = "rare", boost = { stat = "coinMult", value = 2, seconds = 86400 }, oncePerAccount = true },
		bestValue = true,
	},
	comebackPack = {
		key = "comebackPack", id = 0, name = "🔥 PACOTE DE VOLTA", order = 17,
		desc = "Para quem ficou 3+ dias fora: 6 horas de moedas, 1.000 gemas, 1 Ovo Lendário e x3 por 12 horas.",
		robux = 499, icon = "🔥", colour = c(255, 87, 34), kind = "bundle",
		payload = { minutes = 360, gems = 1000, egg = "legendary", boost = { stat = "coinMult", value = 3, seconds = 43200 } },
	},
}

local ordered = {}
for _, p in Products do
	table.insert(ordered, p)
end
table.sort(ordered, function(a, b)
	return a.order < b.order
end)

local byId: { [number]: Product } = {}
for _, p in Products do
	if p.id ~= 0 then
		byId[p.id] = p
	end
end

return { byKey = Products, byId = byId, ordered = ordered }
