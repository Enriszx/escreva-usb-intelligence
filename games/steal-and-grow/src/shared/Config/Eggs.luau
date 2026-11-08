--!strict
-- Eggs: the gacha. Hatch time is real-time and shortened by pets/passes.
return {
	order = { "basic", "rare", "legendary", "cosmic" },
	byId = {
		basic = {
			id = "basic", name = "Ovo Comum", cost = 2500, currency = "coins",
			hatchTime = 45, colour = Color3.fromRGB(245, 245, 245), accent = Color3.fromRGB(255, 183, 197),
			unlockRebirth = 0,
		},
		rare = {
			id = "rare", name = "Ovo Raro", cost = 450000, currency = "coins",
			hatchTime = 150, colour = Color3.fromRGB(66, 165, 245), accent = Color3.fromRGB(144, 202, 249),
			unlockRebirth = 1,
		},
		legendary = {
			id = "legendary", name = "Ovo Lendário", cost = 120000000, currency = "coins",
			hatchTime = 420, colour = Color3.fromRGB(255, 179, 0), accent = Color3.fromRGB(255, 224, 130),
			unlockRebirth = 3,
		},
		cosmic = {
			id = "cosmic", name = "Ovo Cósmico", cost = 250, currency = "gems",
			hatchTime = 900, colour = Color3.fromRGB(124, 77, 255), accent = Color3.fromRGB(0, 229, 255),
			unlockRebirth = 8,
		},
	},
}
