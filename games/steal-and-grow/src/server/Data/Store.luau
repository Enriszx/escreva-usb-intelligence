--!nonstrict
-- Session-locked profile store.
--
-- Why hand-rolled instead of ProfileService: this project ships with zero
-- external dependencies so `rojo build` works on a clean machine with no Wally
-- step. The guarantees that actually matter are reproduced here:
--   * one live session per key (no duplicate-coin exploits across servers)
--   * UpdateAsync-only writes (atomic read-modify-write)
--   * retry with backoff on throttles
--   * BindToClose flush so a shutdown never eats progress
--   * template reconciliation + explicit version migrations
--
-- If you later want ProfileService/ProfileStore, the public surface here
-- (load/get/save/release) maps onto it one-to-one.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local TableUtil = require(Shared.Util.TableUtil)
local Signal = require(Shared.Util.Signal)
local Template = require(script.Parent.Template)

local Balance = Config.Balance
local LIVE = not RunService:IsStudio()

local Store = {}
Store.profiles = {} :: { [number]: any }
Store.onLoaded = Signal.new()
Store.onReleased = Signal.new()

local ds = DataStoreService:GetDataStore("StealAndGrow_Players_v3")
local sessionId = tostring(game.JobId ~= "" and game.JobId or "studio")

local function key(userId: number): string
	return "u_" .. userId
end

--- Exponential-backoff wrapper for every DataStore call.
local function retry<T>(label: string, fn: () -> T): (boolean, T?)
	local delay = 0.6
	for attempt = 1, Balance.saveRetries do
		local ok, res = pcall(fn)
		if ok then
			return true, res
		end
		warn(("[Store] %s attempt %d failed: %s"):format(label, attempt, tostring(res)))
		if attempt < Balance.saveRetries then
			task.wait(delay)
			delay *= 2
		end
	end
	return false, nil
end

--- Explicit, ordered migrations. Each step must be idempotent.
local function migrate(data)
	local v = data.version or 1
	if v < 2 then
		-- v1 stored a flat list of plants; v2 keys them by tile index
		if data.plants then
			data.tiles = {}
			for i, p in data.plants do
				data.tiles[i] = p
			end
			data.plants = nil
		end
		data.version = 2
	end
	if v < 3 then
		-- v2 had a single `mutation` field; v3 splits element/aura
		for _, plant in data.tiles or {} do
			if plant.mutation then
				plant.element = plant.mutation
				plant.aura = "Plain"
				plant.mutation = nil
			end
		end
		for _, crop in data.inventory or {} do
			if crop.mutation then
				crop.element = crop.mutation
				crop.aura = "Plain"
				crop.mutation = nil
			end
		end
		data.version = 3
	end
	return data
end

local function fresh()
	local p = TableUtil.deepCopy(Template)
	p.created = os.time()
	p.firstJoin = os.time()
	return p
end

--- Load (or create) a profile and take the session lock.
function Store.load(player: Player): any?
	local userId = player.UserId
	if Store.profiles[userId] then
		return Store.profiles[userId]
	end

	if not LIVE then
		-- Studio: in-memory profile so you can iterate without DataStore access
		local p = fresh()
		p.lastSeen = os.time()
		Store.profiles[userId] = p
		Store.onLoaded:Fire(player, p)
		return p
	end

	local ok, result = retry("load:" .. userId, function()
		return ds:UpdateAsync(key(userId), function(old)
			local data = old or fresh()

			-- session lock: refuse if another live server holds it and the lock
			-- is fresh. A stale lock (server crashed) is stolen after a timeout.
			local lock = data.__lock
			if lock and lock.id ~= sessionId and (os.time() - (lock.at or 0)) < Balance.sessionLockStale then
				return nil -- abort the write; caller sees the conflict
			end

			data.__lock = { id = sessionId, at = os.time() }
			data = migrate(data)
			TableUtil.reconcile(data, Template)
			data.lastSeen = os.time()
			return data
		end)
	end)

	if not ok or not result then
		-- Either DataStore is down or another server holds the lock. Both cases
		-- must NOT silently hand out a fresh profile, or the player loses their
		-- farm. Kick with a clear message instead.
		return nil
	end

	result.__lock = nil
	Store.profiles[userId] = result
	Store.onLoaded:Fire(player, result)
	return result
end

function Store.get(userId: number): any?
	return Store.profiles[userId]
end

--- Persist without releasing the lock (autosave).
function Store.save(userId: number): boolean
	local profile = Store.profiles[userId]
	if not profile or not LIVE then
		return true
	end
	profile.lastSeen = os.time()
	local snapshot = TableUtil.deepCopy(profile)
	local ok = retry("save:" .. userId, function()
		return ds:UpdateAsync(key(userId), function(old)
			-- keep the lock alive and refuse to overwrite a newer session
			if old and old.__lock and old.__lock.id ~= sessionId then
				local age = os.time() - (old.__lock.at or 0)
				if age < Balance.sessionLockStale then
					return nil
				end
			end
			snapshot.__lock = { id = sessionId, at = os.time() }
			return snapshot
		end)
	end)
	return ok
end

--- Persist and drop the lock (player leaving / shutdown).
function Store.release(userId: number): boolean
	local profile = Store.profiles[userId]
	if not profile then
		return true
	end
	profile.lastSeen = os.time()
	Store.onReleased:Fire(userId, profile)

	if not LIVE then
		Store.profiles[userId] = nil
		return true
	end

	local snapshot = TableUtil.deepCopy(profile)
	snapshot.__lock = nil
	local ok = retry("release:" .. userId, function()
		return ds:UpdateAsync(key(userId), function(old)
			if old and old.__lock and old.__lock.id ~= sessionId then
				local age = os.time() - (old.__lock.at or 0)
				if age < Balance.sessionLockStale then
					return nil
				end
			end
			return snapshot
		end)
	end)
	Store.profiles[userId] = nil
	return ok
end

--- Read another player's profile without taking the lock (offline plots).
function Store.peek(userId: number): any?
	if Store.profiles[userId] then
		return Store.profiles[userId]
	end
	if not LIVE then
		return nil
	end
	local ok, data = retry("peek:" .. userId, function()
		return ds:GetAsync(key(userId))
	end)
	if ok and data then
		data.__lock = nil
		return migrate(TableUtil.reconcile(data, Template))
	end
	return nil
end

--- Write back a change to an OFFLINE player's profile (used when their crops
--- are stolen while they are away). Read-modify-write under UpdateAsync so we
--- never clobber a concurrent session.
function Store.mutateOffline(userId: number, mutator: (any) -> boolean?): boolean
	if Store.profiles[userId] then
		local changed = mutator(Store.profiles[userId])
		return changed ~= false
	end
	if not LIVE then
		return false
	end
	local ok = retry("mutateOffline:" .. userId, function()
		return ds:UpdateAsync(key(userId), function(old)
			if not old then
				return nil
			end
			-- someone else owns a live session: let that server handle it
			if old.__lock and (os.time() - (old.__lock.at or 0)) < Balance.sessionLockStale then
				return nil
			end
			migrate(TableUtil.reconcile(old, Template))
			if mutator(old) == false then
				return nil
			end
			return old
		end)
	end)
	return ok
end

-- autosave loop
task.spawn(function()
	while true do
		task.wait(Balance.autosaveSeconds)
		for userId in Store.profiles do
			task.spawn(Store.save, userId)
		end
	end
end)

game:BindToClose(function()
	local pending = 0
	for userId in Store.profiles do
		pending += 1
		task.spawn(function()
			Store.release(userId)
			pending -= 1
		end)
	end
	local waited = 0
	while pending > 0 and waited < 25 do
		waited += task.wait(0.2)
	end
end)

Players.PlayerRemoving:Connect(function(player)
	task.spawn(Store.release, player.UserId)
end)

return Store
