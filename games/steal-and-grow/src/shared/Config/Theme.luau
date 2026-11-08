--!strict
-- One source of truth for the whole UI. Changing a value here restyles the
-- entire game, which is what makes a cohesive look cheap to maintain.

local function c(r, g, b)
	return Color3.fromRGB(r, g, b)
end

return {
	-- surfaces
	bg = c(16, 18, 27),
	panel = c(24, 27, 40),
	panelAlt = c(31, 35, 51),
	stroke = c(48, 54, 76),
	strokeBright = c(86, 96, 130),

	-- text
	text = c(236, 240, 248),
	textDim = c(150, 160, 184),
	textFaint = c(100, 110, 134),

	-- brand / accents
	primary = c(96, 220, 140),
	primaryDark = c(38, 150, 86),
	secondary = c(124, 170, 255),
	coins = c(255, 205, 70),
	gems = c(96, 226, 255),
	danger = c(255, 92, 104),
	warn = c(255, 176, 60),
	success = c(96, 220, 140),
	steal = c(176, 118, 255),

	-- type scale (px at 1080p; scaled by UIScale)
	font = Enum.Font.GothamBold,
	fontBlack = Enum.Font.GothamBlack,
	fontBody = Enum.Font.GothamMedium,
	h1 = 34,
	h2 = 26,
	h3 = 20,
	body = 17,
	small = 14,
	tiny = 12,

	-- geometry
	radius = 14,
	radiusSm = 9,
	radiusLg = 22,
	pad = 12,
	gap = 8,
	-- never let a tappable element be smaller than this on a phone
	minTouch = 46,

	-- motion
	fast = 0.12,
	normal = 0.22,
	slow = 0.42,
	ease = Enum.EasingStyle.Quint,

	-- z-order
	z = { hud = 1, panel = 10, overlay = 50, toast = 80, modal = 100, cinematic = 200 },
}
