--!strict
-- Sliding-window rate limiter keyed by (player, bucket). Every server-bound
-- remote passes through this; an exploiter spamming Plant 2000 times a second
-- gets dropped at the door and accrues suspicion instead of touching a service.

local Config = require(script.Parent.Parent.Config)
local Budget = Config.Balance.remoteBudget

local WINDOW = 10

local RateLimiter = {}
RateLimiter.__index = RateLimiter

export type Limiter = typeof(setmetatable({} :: {
	_hits: { [number]: { [string]: { number } } },
	_suspicion: { [number]: number },
	onSuspicion: any,
}, RateLimiter))

function RateLimiter.new()
	local self = setmetatable({
		_hits = {},
		_suspicion = {},
		onSuspicion = nil, -- set by AntiCheat: function(player, bucket, score)
	}, RateLimiter)
	return self
end

function RateLimiter:allow(player: Player, bucket: string): boolean
	local uid = player.UserId
	local perPlayer = self._hits[uid]
	if not perPlayer then
		perPlayer = {}
		self._hits[uid] = perPlayer
	end
	local stamps = perPlayer[bucket]
	if not stamps then
		stamps = {}
		perPlayer[bucket] = stamps
	end

	local now = os.clock()
	-- drop expired stamps from the front
	local keepFrom = 1
	for i, t in stamps do
		if now - t < WINDOW then
			keepFrom = i
			break
		end
		keepFrom = i + 1
	end
	if keepFrom > 1 then
		local kept = table.create(#stamps - keepFrom + 1)
		for i = keepFrom, #stamps do
			table.insert(kept, stamps[i])
		end
		perPlayer[bucket] = kept
		stamps = kept
	end

	local limit = Budget[bucket] or Budget.default
	if #stamps >= limit then
		self:flag(player, bucket)
		return false
	end
	table.insert(stamps, now)
	return true
end

function RateLimiter:flag(player: Player, bucket: string, weight: number?)
	local uid = player.UserId
	local score = (self._suspicion[uid] or 0) + (weight or 1)
	self._suspicion[uid] = score
	if self.onSuspicion then
		self.onSuspicion(player, bucket, score)
	end
end

function RateLimiter:suspicion(player: Player): number
	return self._suspicion[player.UserId] or 0
end

function RateLimiter:clear(player: Player)
	self._hits[player.UserId] = nil
	self._suspicion[player.UserId] = nil
end

return RateLimiter
