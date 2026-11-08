--!strict
-- Critically-damped-ish spring for UI and camera motion. Springs are what make
-- a menu feel expensive; TweenService alone always reads as "default Roblox".

local Spring = {}
Spring.__index = Spring

function Spring.new(initial: number, stiffness: number?, damping: number?)
	return setmetatable({
		p = initial,
		v = 0,
		target = initial,
		k = stiffness or 170,
		d = damping or 22,
	}, Spring)
end

function Spring:set(target: number)
	self.target = target
end

function Spring:snap(value: number)
	self.p, self.v, self.target = value, 0, value
end

function Spring:step(dt: number): number
	-- sub-step for stability at low framerates (a 15 FPS phone would otherwise
	-- make the spring explode)
	local steps = math.clamp(math.ceil(dt / (1 / 60)), 1, 8)
	local h = dt / steps
	for _ = 1, steps do
		local a = (self.target - self.p) * self.k - self.v * self.d
		self.v += a * h
		self.p += self.v * h
	end
	return self.p
end

function Spring:settled(epsilon: number?): boolean
	local e = epsilon or 0.001
	return math.abs(self.target - self.p) < e and math.abs(self.v) < e
end

return Spring
