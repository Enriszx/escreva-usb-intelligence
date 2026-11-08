--!strict
-- Coin sinks that are bought repeatedly. Every one of these exists to give the
-- player something to spend on between seed tiers, so the coin counter never
-- just sits there growing.

export type Upgrade = {
	key: string,
	name: string,
	desc: string,
	icon: string,
	colour: Color3,
	maxLevel: number,
	baseCost: number,
	costGrowth: number, -- cost = baseCost * costGrowth ^ level
	perLevel: number,   -- stat delta per level
	stat: "tiles" | "coinMult" | "growMult" | "luckMult" | "defense" | "storage" | "stealSpeed" | "offlineHours",
	order: number,
}

local function c(r, g, b)
	return Color3.fromRGB(r, g, b)
end

local U: { Upgrade } = {
	{ key = "tiles", name = "Expandir Fazenda", desc = "+1 canteiro por nível.", icon = "🧱", colour = c(141, 110, 99), maxLevel = 24, baseCost = 500, costGrowth = 2.15, perLevel = 1, stat = "tiles", order = 1 },
	{ key = "fertilizer", name = "Fertilizante", desc = "+4% de velocidade de crescimento por nível.", icon = "💩", colour = c(109, 76, 65), maxLevel = 50, baseCost = 1200, costGrowth = 1.42, perLevel = 0.04, stat = "growMult", order = 2 },
	{ key = "market", name = "Contatos no Mercado", desc = "+5% no valor de venda por nível.", icon = "📈", colour = c(0, 200, 83), maxLevel = 50, baseCost = 2000, costGrowth = 1.45, perLevel = 0.05, stat = "coinMult", order = 3 },
	{ key = "greenhouse", name = "Estufa Genética", desc = "+6% de sorte nas mutações por nível.", icon = "🧬", colour = c(118, 255, 3), maxLevel = 40, baseCost = 15000, costGrowth = 1.55, perLevel = 0.06, stat = "luckMult", order = 4 },
	{ key = "fence", name = "Cerca Elétrica", desc = "+2% de resistência a roubo por nível.", icon = "🚧", colour = c(255, 241, 118), maxLevel = 30, baseCost = 25000, costGrowth = 1.6, perLevel = 0.02, stat = "defense", order = 5 },
	{ key = "storage", name = "Armazém", desc = "+10 de espaço de colheita por nível.", icon = "📦", colour = c(161, 136, 127), maxLevel = 40, baseCost = 3500, costGrowth = 1.38, perLevel = 10, stat = "storage", order = 6 },
	{ key = "boots", name = "Botas Silenciosas", desc = "-1.5% no tempo de roubo por nível.", icon = "👟", colour = c(69, 39, 160), maxLevel = 30, baseCost = 40000, costGrowth = 1.62, perLevel = 0.015, stat = "stealSpeed", order = 7 },
	{ key = "lanterns", name = "Lanternas Solares", desc = "+15min de crescimento offline por nível.", icon = "🏮", colour = c(255, 179, 0), maxLevel = 32, baseCost = 60000, costGrowth = 1.5, perLevel = 0.25, stat = "offlineHours", order = 8 },
}

local byKey: { [string]: Upgrade } = {}
for _, u in U do
	byKey[u.key] = u
end

return {
	all = U,
	byKey = byKey,
	cost = function(u: Upgrade, level: number): number
		return math.floor(u.baseCost * u.costGrowth ^ level)
	end,
}
