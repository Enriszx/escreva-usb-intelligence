--!strict
-- THE one place where value, growth time, luck and multipliers are computed.
--
-- Both sides require this module. The server's result is authoritative; the
-- client calls the same functions purely to render accurate previews ("this
-- will sell for ~4.2M"). Because it is literally the same code, the preview can
-- never disagree with the payout, which is the #1 trust complaint in sims.

local Config = require(script.Parent.Config)
local Types = require(script.Parent.Types)
local Weighted = require(script.Parent.Util.WeightedRandom)

local Balance = Config.Balance
local Seeds = Config.Seeds
local Mutations = Config.Mutations
local Rarities = Config.Rarities
local Upgrades = Config.Upgrades
local Passes = Config.Passes
local Pets = Config.Pets

local Economy = {}

export type Context = {
	rebirths: number,
	upgrades: { [string]: number },
	passes: { [string]: boolean },
	pets: { Types.OwnedPet },
	boosts: { Types.Boost },
	event: { [string]: number }?, -- active event modifiers
	serverBoost: { [string]: number }?,
	now: number?,
}

--- Collapse every source of multipliers into one struct. Called once per action
--- rather than per plant, so a 48-tile farm costs one evaluation, not 48.
function Economy.multipliers(ctx: Context): Types.Multipliers
	local now = ctx.now or os.time()
	local m: Types.Multipliers = {
		coin = 1,
		grow = 1,
		luck = Balance.baseLuck,
		defense = 0,
		stealSpeed = 1,
		offlineHours = Balance.offlineHoursBase,
		tiles = Balance.startTiles,
		storage = Balance.startStorage,
		petSlots = Balance.petSlotsBase,
		stealSlots = Balance.stealSlots,
	}

	-- rebirth: additive on coins, which keeps early rebirths meaningful
	m.coin += ctx.rebirths * Balance.rebirthValueBonus

	-- upgrades
	for key, level in ctx.upgrades or {} do
		local u = Upgrades.byKey[key]
		if u and level > 0 then
			local delta = u.perLevel * level
			if u.stat == "tiles" then
				m.tiles += delta
			elseif u.stat == "coinMult" then
				m.coin += delta
			elseif u.stat == "growMult" then
				m.grow += delta
			elseif u.stat == "luckMult" then
				m.luck += delta
			elseif u.stat == "defense" then
				m.defense += delta
			elseif u.stat == "storage" then
				m.storage += delta
			elseif u.stat == "stealSpeed" then
				m.stealSpeed -= delta
			elseif u.stat == "offlineHours" then
				m.offlineHours += delta
			end
		end
	end

	-- gamepasses (multiplicative on the big three, additive on counts)
	for key, owned in ctx.passes or {} do
		if owned then
			local p = Passes.byKey[key]
			if p then
				local e = p.effect
				if e.coinMult then
					m.coin *= e.coinMult
				end
				if e.growMult then
					m.grow *= e.growMult
				end
				if e.luckMult then
					m.luck *= e.luckMult
				end
				if e.extraTiles then
					m.tiles += e.extraTiles
				end
				if e.extraPetSlots then
					m.petSlots += e.extraPetSlots
				end
				if e.stealResist then
					m.defense += e.stealResist
				end
				if e.stealSpeed then
					m.stealSpeed *= e.stealSpeed
				end
				if e.extraStealSlots then
					m.stealSlots += e.extraStealSlots
				end
				if e.offlineHours then
					m.offlineHours = math.max(m.offlineHours, e.offlineHours)
				end
			end
		end
	end

	-- equipped pets
	local slots = math.floor(m.petSlots)
	local used = 0
	for _, owned in ctx.pets or {} do
		if owned.equipped and used < slots then
			local pet = Pets.byId[owned.id]
			if pet then
				used += 1
				local s = Pets.starMultiplier(owned.stars)
				local b = pet.buff
				if b.coins then
					m.coin += (b.coins / 100) * s
				end
				if b.grow then
					m.grow += (b.grow / 100) * s
				end
				if b.luck then
					m.luck += (b.luck / 100) * s
				end
				if b.defense then
					m.defense += (b.defense / 100) * s
				end
				if b.thief then
					m.stealSpeed -= (b.thief / 100) * s
				end
				if b.offline then
					m.offlineHours += (b.offline / 100) * s
				end
			end
		end
	end

	-- timed boosts (potions)
	for _, boost in ctx.boosts or {} do
		if boost.expires > now then
			if boost.stat == "coinMult" then
				m.coin *= boost.value
			elseif boost.stat == "growMult" then
				m.grow *= boost.value
			elseif boost.stat == "luckMult" then
				m.luck *= boost.value
			end
		end
	end

	-- live event + server-wide boost
	for _, src in { ctx.event, ctx.serverBoost } do
		if src then
			if src.coinMult then
				m.coin *= src.coinMult
			end
			if src.growMult then
				m.grow *= src.growMult
			end
			if src.luckMult then
				m.luck *= src.luckMult
			end
			if src.stealSpeed then
				m.stealSpeed *= src.stealSpeed
			end
		end
	end

	-- clamps: keep everything inside sane, exploit-proof bounds
	m.coin = math.clamp(m.coin, 0.1, 1e6)
	m.grow = math.clamp(m.grow, 0.05, 500)
	m.luck = math.clamp(m.luck, 0.01, Balance.maxLuck)
	m.defense = math.clamp(m.defense, 0, 0.95)
	m.stealSpeed = math.clamp(m.stealSpeed, 0.1, 5)
	m.offlineHours = math.clamp(m.offlineHours, 0, 168)
	m.tiles = math.clamp(math.floor(m.tiles), 1, Balance.maxTiles)
	m.storage = math.clamp(math.floor(m.storage), 10, Balance.maxStorage)
	m.petSlots = math.clamp(math.floor(m.petSlots), 1, 10)
	m.stealSlots = math.clamp(math.floor(m.stealSlots), 1, 6)
	return m
end

--- Effective seconds for a seed given a grow multiplier.
function Economy.growDuration(seedId: string, growMult: number): number
	local seed = Seeds.byId[seedId]
	if not seed then
		return 60
	end
	return math.max(2, seed.growTime / math.max(growMult, 0.05))
end

--- Progress 0..1 of a planted tile. Pure function of stored stamps, so it is
--- identical on both sides and costs nothing to evaluate.
function Economy.progress(plant: Types.Plant, now: number?): number
	local t = (now or os.time()) - plant.plantedAt
	return math.clamp(t / math.max(plant.duration, 1), 0, 1)
end

function Economy.isRipe(plant: Types.Plant, now: number?): boolean
	return Economy.progress(plant, now) >= 1
end

function Economy.secondsLeft(plant: Types.Plant, now: number?): number
	local n = now or os.time()
	return math.max(0, (plant.plantedAt + plant.duration) - n)
end

--- Roll the two mutation slots. Luck pushes the rare entries up via the
--- weighted module's luck curve. `unlocked` carries the current event's
--- exclusive mutation, if any.
function Economy.rollMutations(luck: number, unlocked: string?, rng: Random?): (string, string)
	local r = rng or Random.new()

	local function eligible(list)
		local out = {}
		for _, mut in list do
			if not mut.eventOnly or mut.eventOnly == unlocked then
				table.insert(out, mut)
			end
		end
		return out
	end

	local element = Weighted.pick(eligible(Mutations.elements), luck, r)
	local aura = Weighted.pick(eligible(Mutations.auras), luck, r)
	return element.id, aura.id
end

--- Roll the physical size of a crop, including the rare "giant" outcome.
function Economy.rollSize(rng: Random?): (number, boolean)
	local r = rng or Random.new()
	if r:NextNumber() < Balance.giantChance then
		return r:NextNumber(Balance.giantMin, Balance.giantMax), true
	end
	return r:NextNumber(Balance.sizeMin, Balance.sizeMax), false
end

--- Decay applied to a crop left ripe on the vine for too long.
function Economy.ripeDecay(plant: Types.Plant, now: number?): number
	local ripeAt = plant.plantedAt + plant.duration
	local idle = (now or os.time()) - ripeAt
	if idle <= Balance.ripeDecayStart then
		return 1
	end
	local hours = (idle - Balance.ripeDecayStart) / 3600
	return math.max(Balance.ripeDecayFloor, 1 - hours * Balance.ripeDecayPerHour)
end

--- Final sell value. The ONLY function allowed to decide what a crop is worth.
function Economy.cropValue(
	seedId: string,
	element: string?,
	aura: string?,
	size: number,
	coinMult: number,
	decay: number?
): number
	local seed = Seeds.byId[seedId]
	if not seed then
		return 0
	end
	local v = seed.baseValue
	v *= Mutations.multiplier(element, aura)
	v *= size
	v *= coinMult
	v *= decay or 1
	return math.max(1, math.floor(v))
end

--- Value of a plant still in the ground (what the UI shows above a ripe plant,
--- and what a thief is deciding whether to risk).
function Economy.plantValue(plant: Types.Plant, coinMult: number, now: number?): number
	if not plant.element then
		-- not ripe yet: show the expected value with no mutation
		return Economy.cropValue(plant.seed, nil, nil, 1, coinMult)
	end
	return Economy.cropValue(
		plant.seed,
		plant.element,
		plant.aura,
		plant.size or 1,
		coinMult,
		Economy.ripeDecay(plant, now)
	)
end

--- Seconds a thief must channel to take this plant.
function Economy.stealTime(plant: Types.Plant, stealSpeedMult: number, defenderDefense: number): number
	local seed = Seeds.byId[plant.seed]
	local rarity = Rarities.get(seed and seed.rarity or "Common")
	local t = Balance.stealBaseTime * rarity.stealTimeMult
	-- mutation value makes a theft harder: the juicy stuff is also the risky stuff
	local mult = Mutations.multiplier(plant.element, plant.aura)
	t *= 1 + math.log(math.max(mult, 1), 10) * 0.6
	t *= stealSpeedMult
	-- a defended farm slows thieves even when the steal isn't blocked outright
	t *= 1 + defenderDefense
	return math.clamp(t, 0.8, Balance.stealMaxTimeCap)
end

--- Rebirth cost curve.
function Economy.rebirthCost(rebirths: number, discount: number?): number
	if rebirths >= Balance.maxRebirths then
		return math.huge
	end
	local c = Balance.rebirthBase * Balance.rebirthGrowth ^ rebirths
	return math.floor(c * (1 - (discount or 0)))
end

--- XP -> level.
function Economy.levelFromXp(xp: number): (number, number, number)
	local level, need, acc = 1, Balance.xpPerLevelBase, 0
	while level < Balance.maxLevel and xp >= acc + need do
		acc += need
		level += 1
		need = math.floor(Balance.xpPerLevelBase * Balance.xpPerLevelGrowth ^ (level - 1))
	end
	return level, xp - acc, need
end

--- "Best production per minute" — used to scale currency products so a 99
--- Robux coin pack is still meaningful at rebirth 20.
function Economy.productionPerMinute(ctx: Context, tileCount: number): number
	local m = Economy.multipliers(ctx)
	local best = 0
	for _, seed in Seeds.purchasable(ctx.rebirths) do
		local perSec = seed.baseValue * m.coin / Economy.growDuration(seed.id, m.grow)
		best = math.max(best, perSec)
	end
	return math.max(60, best * 60 * math.max(tileCount, 1))
end

Economy.Multipliers = nil :: any
return Economy
