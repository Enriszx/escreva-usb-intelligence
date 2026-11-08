--!strict
-- Mutations are rolled the moment a plant finishes growing. They are the game's
-- dopamine engine: multiplicative value, visual flair, and the thing players
-- scream about in the chat. Stackable in slots: one ELEMENT + one AURA.
--
-- finalMult = elementMult * auraMult

export type Mutation = {
	id: string,
	name: string,
	slot: "Element" | "Aura",
	mult: number,
	weight: number, -- relative roll weight before luck
	colour: Color3,
	-- particle preset name resolved client-side (keeps assets out of config)
	vfx: string?,
	-- some mutations only roll during a live event
	eventOnly: string?,
	-- luck from pets/passes/potions scales rarer mutations harder
	luckScale: number,
	announce: boolean?, -- global chat announcement on roll
}

local function c(r, g, b)
	return Color3.fromRGB(r, g, b)
end

local Mutations: { [string]: Mutation } = {
	-- ELEMENT slot --------------------------------------------------------
	None = { id = "None", name = "", slot = "Element", mult = 1, weight = 7200, colour = c(255, 255, 255), luckScale = 0 },
	Wet = { id = "Wet", name = "Molhada", slot = "Element", mult = 2, weight = 900, colour = c(79, 195, 247), vfx = "Drip", luckScale = 0.4 },
	Chilled = { id = "Chilled", name = "Gelada", slot = "Element", mult = 3, weight = 520, colour = c(178, 235, 242), vfx = "Frost", luckScale = 0.6 },
	Shocked = { id = "Shocked", name = "Eletrizada", slot = "Element", mult = 6, weight = 190, colour = c(255, 241, 118), vfx = "Spark", luckScale = 0.9 },
	Burning = { id = "Burning", name = "Flamejante", slot = "Element", mult = 8, weight = 120, colour = c(255, 112, 67), vfx = "Ember", luckScale = 1.0 },
	Frozen = { id = "Frozen", name = "Congelada", slot = "Element", mult = 12, weight = 64, colour = c(129, 212, 250), vfx = "IceShell", luckScale = 1.1 },
	Windstruck = { id = "Windstruck", name = "Ventania", slot = "Element", mult = 16, weight = 38, colour = c(176, 190, 197), vfx = "Gust", luckScale = 1.2 },
	Molten = { id = "Molten", name = "Derretida", slot = "Element", mult = 24, weight = 18, colour = c(255, 61, 0), vfx = "Lava", luckScale = 1.35, announce = true },
	Radioactive = { id = "Radioactive", name = "Radioativa", slot = "Element", mult = 35, weight = 9, colour = c(118, 255, 3), vfx = "Toxic", luckScale = 1.5, announce = true },
	Meteoric = {
		id = "Meteoric", name = "Meteórica", slot = "Element", mult = 60, weight = 14,
		colour = c(255, 138, 101), vfx = "Meteor", luckScale = 1.6, eventOnly = "MeteorShower", announce = true,
	},
	BloodMoon = {
		id = "BloodMoon", name = "Lua de Sangue", slot = "Element", mult = 90, weight = 10,
		colour = c(183, 28, 28), vfx = "BloodAura", luckScale = 1.7, eventOnly = "BloodMoon", announce = true,
	},

	-- AURA slot -----------------------------------------------------------
	Plain = { id = "Plain", name = "", slot = "Aura", mult = 1, weight = 8600, colour = c(255, 255, 255), luckScale = 0 },
	Silver = { id = "Silver", name = "Prateada", slot = "Aura", mult = 2.5, weight = 760, colour = c(207, 216, 220), vfx = "ShineSoft", luckScale = 0.5 },
	Golden = { id = "Golden", name = "Dourada", slot = "Aura", mult = 5, weight = 300, colour = c(255, 215, 64), vfx = "Shine", luckScale = 0.85 },
	Rainbow = { id = "Rainbow", name = "Arco-Íris", slot = "Aura", mult = 15, weight = 48, colour = c(255, 110, 199), vfx = "Rainbow", luckScale = 1.3, announce = true },
	Void = { id = "Void", name = "Vazio", slot = "Aura", mult = 40, weight = 11, colour = c(69, 39, 160), vfx = "Void", luckScale = 1.55, announce = true },
	Celestial = { id = "Celestial", name = "Celestial", slot = "Aura", mult = 120, weight = 2.2, colour = c(0, 229, 255), vfx = "Celestial", luckScale = 1.8, announce = true },
	Galactic = { id = "Galactic", name = "Galáctica", slot = "Aura", mult = 400, weight = 0.35, colour = c(124, 77, 255), vfx = "Galaxy", luckScale = 2.0, announce = true },
	Omega = { id = "Omega", name = "Ω OMEGA Ω", slot = "Aura", mult = 2500, weight = 0.02, colour = c(255, 0, 128), vfx = "Omega", luckScale = 2.4, announce = true },
}

local elements, auras = {}, {}
for _, m in Mutations do
	if m.slot == "Element" then
		table.insert(elements, m)
	else
		table.insert(auras, m)
	end
end
local function byMult(a, b)
	return a.mult < b.mult
end
table.sort(elements, byMult)
table.sort(auras, byMult)

return {
	byId = Mutations,
	elements = elements,
	auras = auras,
	get = function(id: string?): Mutation?
		return if id then Mutations[id] else nil
	end,
	-- Combined display label, e.g. "Congelada Arco-Íris Tomate"
	label = function(elementId: string?, auraId: string?): string
		local out = {}
		local e = elementId and Mutations[elementId]
		local a = auraId and Mutations[auraId]
		if e and e.name ~= "" then table.insert(out, e.name) end
		if a and a.name ~= "" then table.insert(out, a.name) end
		return table.concat(out, " ")
	end,
	multiplier = function(elementId: string?, auraId: string?): number
		local e = (elementId and Mutations[elementId]) or Mutations.None
		local a = (auraId and Mutations[auraId]) or Mutations.Plain
		return e.mult * a.mult
	end,
}
