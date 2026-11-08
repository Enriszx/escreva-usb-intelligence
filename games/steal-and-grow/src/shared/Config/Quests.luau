--!strict
-- Quests: three daily + one weekly, rolled per player from these templates.
-- `goal` is scaled by the player's progression stage so a rebirth-12 player
-- isn't asked to harvest 5 carrots.

export type QuestTemplate = {
	key: string,
	name: string,
	desc: string, -- {goal} is substituted
	icon: string,
	kind: "harvest" | "plant" | "sell" | "steal" | "defend" | "hatch" | "mutate" | "rebirth" | "visit" | "tier",
	baseGoal: number,
	scaling: number, -- goal = baseGoal * (1 + rebirths * scaling)
	reward: { coins: number?, gems: number?, egg: string?, boostSeconds: number? },
	weekly: boolean?,
	param: any?,
}

local Daily: { QuestTemplate } = {
	{ key = "harvest_any", name = "Mão na Terra", desc = "Colha {goal} plantas", icon = "🌾", kind = "harvest", baseGoal = 25, scaling = 0.35, reward = { gems = 40 } },
	{ key = "plant_any", name = "Semeador", desc = "Plante {goal} sementes", icon = "🌱", kind = "plant", baseGoal = 20, scaling = 0.3, reward = { gems = 35 } },
	{ key = "sell_value", name = "Negociante", desc = "Venda colheitas por {goal} moedas", icon = "💰", kind = "sell", baseGoal = 20000, scaling = 3.5, reward = { gems = 50 } },
	{ key = "steal_plants", name = "Visita Indesejada", desc = "Roube {goal} plantas de outros jogadores", icon = "🥷", kind = "steal", baseGoal = 5, scaling = 0.15, reward = { gems = 70 } },
	{ key = "defend_steals", name = "Fazenda Blindada", desc = "Bloqueie {goal} tentativas de roubo", icon = "🛡️", kind = "defend", baseGoal = 3, scaling = 0.12, reward = { gems = 65 } },
	{ key = "hatch_eggs", name = "Criador", desc = "Choque {goal} ovos", icon = "🥚", kind = "hatch", baseGoal = 3, scaling = 0.2, reward = { gems = 55 } },
	{ key = "get_mutations", name = "Geneticista", desc = "Obtenha {goal} plantas com mutação", icon = "🧬", kind = "mutate", baseGoal = 8, scaling = 0.25, reward = { gems = 60 } },
	{ key = "visit_farms", name = "Turista", desc = "Visite {goal} fazendas diferentes", icon = "🚶", kind = "visit", baseGoal = 4, scaling = 0, reward = { gems = 30 } },
}

local Weekly: { QuestTemplate } = {
	{ key = "w_harvest", name = "Colheita Semanal", desc = "Colha {goal} plantas esta semana", icon = "🏆", kind = "harvest", baseGoal = 400, scaling = 0.4, reward = { gems = 600, egg = "legendary" }, weekly = true },
	{ key = "w_steal", name = "Lenda do Crime", desc = "Roube {goal} plantas esta semana", icon = "🏴‍☠️", kind = "steal", baseGoal = 80, scaling = 0.2, reward = { gems = 700, egg = "legendary" }, weekly = true },
	{ key = "w_rebirth", name = "Ciclo Eterno", desc = "Renasça {goal} vez(es) esta semana", icon = "♻️", kind = "rebirth", baseGoal = 1, scaling = 0.1, reward = { gems = 900, egg = "cosmic" }, weekly = true },
	{ key = "w_mutate", name = "Caçador de Auras", desc = "Consiga {goal} mutações esta semana", icon = "✨", kind = "mutate", baseGoal = 120, scaling = 0.3, reward = { gems = 650, egg = "legendary" }, weekly = true },
}

return {
	daily = Daily,
	weekly = Weekly,
	dailyCount = 3,
	goalFor = function(t: QuestTemplate, rebirths: number): number
		return math.max(1, math.floor(t.baseGoal * (1 + rebirths * t.scaling)))
	end,
}
