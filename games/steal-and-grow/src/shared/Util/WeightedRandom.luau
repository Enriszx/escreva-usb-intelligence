--!strict
-- Weighted picking with a luck curve. This is the single most important piece
-- of maths in the game, so it is isolated and deterministic given a Random.

local WeightedRandom = {}

export type Entry = { weight: number, luckScale: number? }

--- Luck raises the weight of the rare entries only:
---     w' = w * luck ^ luckScale
--- luckScale 0 => unaffected (the "None"/"Plain" filler entries)
--- luckScale 1 => scales linearly with luck
--- Because the filler entries keep their weight while rare ones grow, luck
--- compresses toward the rares smoothly instead of overflowing.
function WeightedRandom.pick<T>(entries: { T & Entry }, luck: number?, rng: Random?): T
	local r = rng or Random.new()
	local l = math.max(luck or 1, 0.0001)
	local total = 0
	local weights = table.create(#entries)
	for i, e in entries do
		local scale = (e :: any).luckScale or 0
		local w = e.weight * (if scale == 0 then 1 else l ^ scale)
		weights[i] = w
		total += w
	end
	if total <= 0 then
		return entries[1]
	end
	local roll = r:NextNumber() * total
	local acc = 0
	for i, w in weights do
		acc += w
		if roll <= acc then
			return entries[i]
		end
	end
	return entries[#entries]
end

--- The resolved probability of each entry at a given luck. Used by the UI to
--- show honest drop rates — players trust a game that shows real odds.
function WeightedRandom.odds<T>(entries: { T & Entry }, luck: number?): { [number]: number }
	local l = math.max(luck or 1, 0.0001)
	local total = 0
	local weights = {}
	for i, e in entries do
		local scale = (e :: any).luckScale or 0
		local w = e.weight * (if scale == 0 then 1 else l ^ scale)
		weights[i] = w
		total += w
	end
	local out = {}
	for i, w in weights do
		out[i] = if total > 0 then w / total else 0
	end
	return out
end

--- Pick n distinct entries (for shop restock).
function WeightedRandom.pickMany<T>(entries: { T & Entry }, n: number, luck: number?, rng: Random?): { T }
	local pool = table.clone(entries)
	local out = {}
	for _ = 1, math.min(n, #pool) do
		local chosen = WeightedRandom.pick(pool, luck, rng)
		table.insert(out, chosen)
		local idx = table.find(pool, chosen)
		if idx then
			table.remove(pool, idx)
		end
	end
	return out
end

return WeightedRandom
