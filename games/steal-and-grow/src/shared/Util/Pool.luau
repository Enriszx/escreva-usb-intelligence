--!strict
-- Instance pool. On a low-end Android phone, Instance.new + :Destroy churn in
-- the render thread is the single biggest source of stutter when 300 plants are
-- streaming in and out. Pooling removes it entirely.

local Pool = {}
Pool.__index = Pool

function Pool.new(factory: () -> Instance, reset: ((Instance) -> ())?, max: number?)
	return setmetatable({
		_factory = factory,
		_reset = reset,
		_free = {},
		_max = max or 256,
		_created = 0,
		_storage = nil :: Folder?,
	}, Pool)
end

function Pool:_bin(): Folder
	if not self._storage then
		local f = Instance.new("Folder")
		f.Name = "PoolBin"
		f.Parent = game:GetService("ReplicatedStorage")
		self._storage = f
	end
	return self._storage
end

function Pool:get(): Instance
	local item = table.remove(self._free)
	if item then
		return item
	end
	self._created += 1
	return self._factory()
end

function Pool:release(item: Instance)
	if not item or not item.Parent and self._created == 0 then
		return
	end
	if #self._free >= self._max then
		item:Destroy()
		return
	end
	if self._reset then
		pcall(self._reset, item)
	end
	item.Parent = self:_bin()
	table.insert(self._free, item)
end

function Pool:prewarm(n: number)
	for _ = 1, n do
		local item = self._factory()
		if self._reset then
			pcall(self._reset, item)
		end
		item.Parent = self:_bin()
		table.insert(self._free, item)
		self._created += 1
	end
end

function Pool:stats(): (number, number)
	return self._created, #self._free
end

function Pool:destroy()
	for _, item in self._free do
		item:Destroy()
	end
	table.clear(self._free)
end

return Pool
