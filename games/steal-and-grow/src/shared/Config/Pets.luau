--!strict
-- Pets are the second collection layer and the main source of multipliers.
-- They hatch from eggs, can be fused (3 duplicates -> +1 star, +35% stats),
-- and three can be equipped at once (five with the Pet Slots pass).

export type PetBuff = {
	coins: number?,     -- +% sell value
	grow: number?,      -- +% growth speed
	luck: number?,      -- +% mutation luck
	defense: number?,   -- +% steal resistance on your plot
	thief: number?,     -- -% steal channel time when YOU steal
	autoHarvest: number?, -- seconds between auto-harvest pulses (lower = better)
	offline: number?,   -- +% offline growth cap hours
}

export type Pet = {
	id: string,
	name: string,
	rarity: string,
	egg: string,
	weight: number,
	buff: PetBuff,
	-- visual recipe (primitives again — no asset dependency)
	body: Color3,
	accent: Color3,
	shape: "Ball" | "Block" | "Cylinder" | "Cone",
	scale: number,
	emissive: number?,
	float: boolean?, -- hovers instead of hopping
}

local function c(r, g, b)
	return Color3.fromRGB(r, g, b)
end

local P: { Pet } = {
	-- Egg Comum -----------------------------------------------------------
	{ id = "snail", name = "Caracol", rarity = "Common", egg = "basic", weight = 400, buff = { coins = 5 }, body = c(161, 136, 127), accent = c(121, 85, 72), shape = "Ball", scale = 0.8 },
	{ id = "bunny", name = "Coelhinho", rarity = "Common", egg = "basic", weight = 340, buff = { grow = 6 }, body = c(245, 245, 245), accent = c(255, 183, 197), shape = "Ball", scale = 0.9 },
	{ id = "chick", name = "Pintinho", rarity = "Uncommon", egg = "basic", weight = 180, buff = { coins = 10, grow = 4 }, body = c(255, 235, 59), accent = c(255, 143, 0), shape = "Ball", scale = 0.85 },
	{ id = "mole", name = "Toupeira", rarity = "Uncommon", egg = "basic", weight = 120, buff = { luck = 8 }, body = c(93, 64, 55), accent = c(62, 39, 35), shape = "Ball", scale = 0.85 },
	{ id = "guarddog", name = "Cão de Guarda", rarity = "Rare", egg = "basic", weight = 45, buff = { defense = 25 }, body = c(141, 110, 99), accent = c(62, 39, 35), shape = "Block", scale = 1.0 },

	-- Egg Raro ------------------------------------------------------------
	{ id = "fox", name = "Raposa Ladra", rarity = "Rare", egg = "rare", weight = 300, buff = { thief = 15 }, body = c(255, 112, 67), accent = c(255, 255, 255), shape = "Block", scale = 1.0 },
	{ id = "owl", name = "Coruja Sábia", rarity = "Rare", egg = "rare", weight = 240, buff = { luck = 18 }, body = c(120, 144, 156), accent = c(255, 213, 79), shape = "Ball", scale = 0.95 },
	{ id = "bee", name = "Abelha", rarity = "Epic", egg = "rare", weight = 110, buff = { grow = 22, coins = 8 }, body = c(255, 213, 79), accent = c(33, 33, 33), shape = "Ball", scale = 0.6, float = true },
	{ id = "turtle", name = "Tartaruga Cofre", rarity = "Epic", egg = "rare", weight = 70, buff = { defense = 45, offline = 20 }, body = c(85, 139, 47), accent = c(141, 110, 99), shape = "Ball", scale = 1.1 },
	{ id = "robot", name = "Robô Colhedor", rarity = "Legendary", egg = "rare", weight = 20, buff = { autoHarvest = 20 }, body = c(176, 190, 197), accent = c(3, 169, 244), shape = "Block", scale = 1.0, emissive = 0.4 },

	-- Egg Lendário --------------------------------------------------------
	{ id = "griffin", name = "Grifo", rarity = "Legendary", egg = "legendary", weight = 300, buff = { coins = 45, grow = 20 }, body = c(255, 213, 79), accent = c(255, 255, 255), shape = "Block", scale = 1.2, float = true },
	{ id = "shadowcat", name = "Gato Sombrio", rarity = "Legendary", egg = "legendary", weight = 250, buff = { thief = 35 }, body = c(49, 27, 146), accent = c(124, 77, 255), shape = "Block", scale = 1.0, emissive = 0.3 },
	{ id = "golem", name = "Golem de Pedra", rarity = "Mythic", egg = "legendary", weight = 95, buff = { defense = 80 }, body = c(96, 125, 139), accent = c(69, 90, 100), shape = "Block", scale = 1.3 },
	{ id = "phoenix", name = "Fênix", rarity = "Mythic", egg = "legendary", weight = 60, buff = { coins = 90, luck = 40 }, body = c(255, 87, 34), accent = c(255, 235, 59), shape = "Ball", scale = 1.2, emissive = 0.9, float = true },
	{ id = "dragon", name = "Dragão Ancião", rarity = "Divine", egg = "legendary", weight = 12, buff = { coins = 150, grow = 60, luck = 60 }, body = c(183, 28, 28), accent = c(255, 167, 38), shape = "Block", scale = 1.5, emissive = 0.5, float = true },

	-- Egg Cósmico ---------------------------------------------------------
	{ id = "nebula", name = "Nebulosa Viva", rarity = "Divine", egg = "cosmic", weight = 300, buff = { luck = 120, coins = 80 }, body = c(124, 77, 255), accent = c(0, 229, 255), shape = "Ball", scale = 1.2, emissive = 1.0, float = true },
	{ id = "starwhale", name = "Baleia Estelar", rarity = "Divine", egg = "cosmic", weight = 210, buff = { coins = 200, offline = 60 }, body = c(0, 229, 255), accent = c(255, 255, 255), shape = "Ball", scale = 1.7, emissive = 0.8, float = true },
	{ id = "voidreaper", name = "Ceifador do Vazio", rarity = "Cosmic", egg = "cosmic", weight = 70, buff = { thief = 60, defense = 60 }, body = c(18, 18, 24), accent = c(255, 0, 128), shape = "Block", scale = 1.4, emissive = 0.7, float = true },
	{ id = "chronos", name = "Chronos", rarity = "Cosmic", egg = "cosmic", weight = 30, buff = { grow = 250, autoHarvest = 8 }, body = c(255, 215, 64), accent = c(0, 229, 255), shape = "Cylinder", scale = 1.3, emissive = 1.0, float = true },
	{ id = "omegabeast", name = "Ω Besta Omega", rarity = "Secret", egg = "cosmic", weight = 2, buff = { coins = 500, grow = 300, luck = 300, defense = 150, thief = 80, autoHarvest = 5, offline = 120 }, body = c(255, 0, 128), accent = c(18, 18, 24), shape = "Ball", scale = 1.9, emissive = 1.0, float = true },
}

local byId: { [string]: Pet } = {}
local byEgg: { [string]: { Pet } } = {}
for _, p in P do
	byId[p.id] = p
	byEgg[p.egg] = byEgg[p.egg] or {}
	table.insert(byEgg[p.egg], p)
end

-- Star upgrades: fusing 3 identical pets of the same star level -> next star.
local STAR_MULT = { 1.0, 1.35, 1.82, 2.46, 3.32, 4.48 } -- stars 0..5

return {
	all = P,
	byId = byId,
	byEgg = byEgg,
	maxStars = 5,
	starMultiplier = function(stars: number): number
		return STAR_MULT[math.clamp(stars, 0, 5) + 1]
	end,
	get = function(id: string): Pet?
		return byId[id]
	end,
}
