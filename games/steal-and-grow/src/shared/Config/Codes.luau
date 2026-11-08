--!strict
-- Promo codes. Keep the list short and rotate it — expired codes teach players
-- to stop checking, and checking is what brings them back to your social links.
-- `expires` is a unix timestamp; nil = never.

export type Code = {
	code: string,
	reward: {
		coins: number?,
		gems: number?,
		egg: string?,
		boost: { stat: string, value: number, seconds: number }?,
		minutes: number?,
	},
	expires: number?,
	maxUses: number?, -- nil = unlimited
	note: string?,
}

return {
	list = {
		{ code = "LANCAMENTO", reward = { gems = 500, minutes = 30 }, note = "Código de lançamento" },
		{ code = "BEMVINDO", reward = { gems = 150, minutes = 10 } },
		{ code = "ROUBEI", reward = { gems = 200, boost = { stat = "luckMult", value = 3, seconds = 900 } } },
		{ code = "LUADESANGUE", reward = { gems = 300, egg = "rare" } },
		{
			code = "1MVISITAS",
			reward = { gems = 1000, egg = "legendary" },
			note = "Marco de 1 milhão de visitas",
		},
		{ code = "OBRIGADO", reward = { minutes = 60, gems = 250 } },
	} :: { Code },
}
