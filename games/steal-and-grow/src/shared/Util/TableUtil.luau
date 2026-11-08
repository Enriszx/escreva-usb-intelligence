--!strict
local TableUtil = {}

function TableUtil.deepCopy<T>(t: T): T
	if type(t) ~= "table" then
		return t
	end
	local out = {}
	for k, v in t :: any do
		out[k] = if type(v) == "table" then TableUtil.deepCopy(v) else v
	end
	return out :: any
end

--- Fill missing keys from a template without clobbering existing values.
--- This is the save-migration workhorse: add a field to the template and every
--- old profile gains it on next load.
function TableUtil.reconcile(data: { [any]: any }, template: { [any]: any }): { [any]: any }
	for k, v in template do
		if data[k] == nil then
			data[k] = if type(v) == "table" then TableUtil.deepCopy(v) else v
		elseif type(v) == "table" and type(data[k]) == "table" then
			-- only reconcile dictionaries, never arrays (arrays are player data)
			if next(v) ~= nil and type(next(v)) == "string" then
				TableUtil.reconcile(data[k], v)
			end
		end
	end
	return data
end

function TableUtil.count(t: { [any]: any }): number
	local n = 0
	for _ in t do
		n += 1
	end
	return n
end

function TableUtil.keys(t: { [any]: any }): { any }
	local out = {}
	for k in t do
		table.insert(out, k)
	end
	return out
end

function TableUtil.values(t: { [any]: any }): { any }
	local out = {}
	for _, v in t do
		table.insert(out, v)
	end
	return out
end

function TableUtil.filter<T>(t: { T }, fn: (T, number) -> boolean): { T }
	local out = {}
	for i, v in t do
		if fn(v, i) then
			table.insert(out, v)
		end
	end
	return out
end

function TableUtil.map<T, R>(t: { T }, fn: (T, number) -> R): { R }
	local out = {}
	for i, v in t do
		out[i] = fn(v, i)
	end
	return out
end

function TableUtil.sum<T>(t: { T }, fn: ((T) -> number)?): number
	local n = 0
	for _, v in t do
		n += if fn then fn(v) else (v :: any)
	end
	return n
end

function TableUtil.find<T>(t: { T }, fn: (T) -> boolean): (T?, number?)
	for i, v in t do
		if fn(v) then
			return v, i
		end
	end
	return nil, nil
end

function TableUtil.shuffle<T>(t: { T }, rng: Random?): { T }
	local r = rng or Random.new()
	local out = table.clone(t)
	for i = #out, 2, -1 do
		local j = r:NextInteger(1, i)
		out[i], out[j] = out[j], out[i]
	end
	return out
end

--- Shallow equality, used to skip no-op network replication.
function TableUtil.shallowEqual(a: { [any]: any }, b: { [any]: any }): boolean
	for k, v in a do
		if b[k] ~= v then
			return false
		end
	end
	for k, v in b do
		if a[k] ~= v then
			return false
		end
	end
	return true
end

return TableUtil
