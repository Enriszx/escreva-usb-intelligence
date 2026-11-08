--!strict
-- Rarity ladder. Drives colours, UI glow, steal-channel time and index sorting.

export type Rarity = {
	id: string,
	name: string,
	order: number,
	colour: Color3,
	glow: Color3,
	-- multiplier applied to steal channel time (rarer = slower to steal = riskier)
	stealTimeMult: number,
	-- chance weight used by generic rarity rolls (eggs, crates, shop restock)
	weight: number,
}

local function c(r: number, g: number, b: number): Color3
	return Color3.fromRGB(r, g, b)
end

local Rarities: { [string]: Rarity } = {
	Common = {
		id = "Common",
		name = "Comum",
		order = 1,
		colour = c(176, 190, 197),
		glow = c(207, 216, 220),
		stealTimeMult = 1.0,
		weight = 1000,
	},
	Uncommon = {
		id = "Uncommon",
		name = "Incomum",
		order = 2,
		colour = c(102, 187, 106),
		glow = c(165, 214, 167),
		stealTimeMult = 1.15,
		weight = 460,
	},
	Rare = {
		id = "Rare",
		name = "Raro",
		order = 3,
		colour = c(66, 165, 245),
		glow = c(144, 202, 249),
		stealTimeMult = 1.35,
		weight = 180,
	},
	Epic = {
		id = "Epic",
		name = "Épico",
		order = 4,
		colour = c(171, 71, 188),
		glow = c(206, 147, 216),
		stealTimeMult = 1.6,
		weight = 64,
	},
	Legendary = {
		id = "Legendary",
		name = "Lendário",
		order = 5,
		colour = c(255, 179, 0),
		glow = c(255, 224, 130),
		stealTimeMult = 2.0,
		weight = 20,
	},
	Mythic = {
		id = "Mythic",
		name = "Mítico",
		order = 6,
		colour = c(244, 67, 54),
		glow = c(255, 138, 128),
		stealTimeMult = 2.5,
		weight = 5,
	},
	Divine = {
		id = "Divine",
		name = "Divino",
		order = 7,
		colour = c(0, 229, 255),
		glow = c(178, 255, 255),
		stealTimeMult = 3.2,
		weight = 1.2,
	},
	Cosmic = {
		id = "Cosmic",
		name = "Cósmico",
		order = 8,
		colour = c(124, 77, 255),
		glow = c(179, 136, 255),
		stealTimeMult = 4.0,
		weight = 0.22,
	},
	Secret = {
		id = "Secret",
		name = "SECRETO",
		order = 9,
		colour = c(18, 18, 24),
		glow = c(255, 0, 128),
		stealTimeMult = 6.0,
		weight = 0.02,
	},
}

local ordered: { Rarity } = {}
for _, r in Rarities do
	table.insert(ordered, r)
end
table.sort(ordered, function(a, b)
	return a.order < b.order
end)

return {
	byId = Rarities,
	ordered = ordered,
	get = function(id: string): Rarity
		return Rarities[id] or Rarities.Common
	end,
}
