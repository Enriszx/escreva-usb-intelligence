--!strict
-- Rebirth ranks. Pure status, which is exactly why players chase them.
return {
	list = {
		{ rebirths = 0, name = "Novato", colour = Color3.fromRGB(176, 190, 197), icon = "🌱" },
		{ rebirths = 1, name = "Agricultor", colour = Color3.fromRGB(102, 187, 106), icon = "🌾" },
		{ rebirths = 3, name = "Fazendeiro", colour = Color3.fromRGB(66, 165, 245), icon = "🚜" },
		{ rebirths = 6, name = "Latifundiário", colour = Color3.fromRGB(171, 71, 188), icon = "🏡" },
		{ rebirths = 10, name = "Magnata", colour = Color3.fromRGB(255, 179, 0), icon = "💼" },
		{ rebirths = 14, name = "Barão Agrícola", colour = Color3.fromRGB(244, 67, 54), icon = "👑" },
		{ rebirths = 19, name = "Imperador Verde", colour = Color3.fromRGB(0, 229, 255), icon = "🌍" },
		{ rebirths = 24, name = "Semideus da Terra", colour = Color3.fromRGB(124, 77, 255), icon = "⚡" },
		{ rebirths = 30, name = "Ω LENDA VIVA Ω", colour = Color3.fromRGB(255, 0, 128), icon = "🌟" },
	},
	for_ = function(self, rebirths: number)
		local best = self.list[1]
		for _, r in self.list do
			if rebirths >= r.rebirths then
				best = r
			end
		end
		return best
	end,
}
