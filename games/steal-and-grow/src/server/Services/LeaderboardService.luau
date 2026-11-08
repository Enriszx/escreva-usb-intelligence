--!nonstrict
-- Global leaderboards via OrderedDataStore, plus the live in-server board.
--
-- Three boards, because a single "richest" board is demoralising: a new player
-- can realistically chase "Ladrões da Semana" on day one.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Shared = game:GetService("ReplicatedStorage").Shared
local Net = require(Shared.Util.Net)
local Store = require(script.Parent.Parent.Data.Store)

local LeaderboardService = { name = "LeaderboardService", priority = 12 }
local app

local LIVE = not RunService:IsStudio()
local REFRESH = 120

local BOARDS = {
	{
		key = "rebirths",
		name = "♻️ Mais Renascimentos",
		store = "LB_Rebirths_v1",
		stat = function(p)
			return p.rebirths
		end,
	},
	{
		key = "earned",
		name = "💰 Mais Moedas Ganhas",
		store = "LB_Earned_v1",
		stat = function(p)
			return math.min(p.stats.totalEarned, 2 ^ 31 - 1)
		end,
	},
	{
		key = "stolen",
		name = "🥷 Maiores Ladrões",
		store = "LB_Stolen_v1",
		stat = function(p)
			return p.stats.stolen
		end,
	},
}

local stores = {}
local cache = {} :: { [string]: { entries: any, at: number } }

function LeaderboardService:init(a)
	app = a
	if LIVE then
		for _, b in BOARDS do
			stores[b.key] = DataStoreService:GetOrderedDataStore(b.store)
		end
	end
end

function LeaderboardService:publish(player: Player)
	if not LIVE then
		return
	end
	local profile = Store.get(player.UserId)
	if not profile then
		return
	end
	for _, b in BOARDS do
		local store = stores[b.key]
		if store then
			local value = math.floor(math.max(0, b.stat(profile)))
			task.spawn(function()
				pcall(function()
					store:SetAsync(tostring(player.UserId), value)
				end)
			end)
		end
	end
end

function LeaderboardService:fetch(key: string)
	local cached = cache[key]
	if cached and os.clock() - cached.at < REFRESH then
		return cached.entries
	end
	local entries = {}
	if LIVE and stores[key] then
		local ok, pages = pcall(function()
			return stores[key]:GetSortedAsync(false, 25)
		end)
		if ok and pages then
			for rank, item in pages:GetCurrentPage() do
				local userId = tonumber(item.key)
				local name = "Jogador"
				if userId then
					local okName, resolved = pcall(function()
						return Players:GetNameFromUserIdAsync(userId)
					end)
					if okName then
						name = resolved
					end
				end
				table.insert(entries, { rank = rank, userId = userId, name = name, value = item.value })
			end
		end
	else
		-- Studio: synthesise from the live server so the UI is testable
		for _, player in Players:GetPlayers() do
			local profile = Store.get(player.UserId)
			if profile then
				local board = nil
				for _, b in BOARDS do
					if b.key == key then
						board = b
					end
				end
				if board then
					table.insert(entries, {
						userId = player.UserId,
						name = player.DisplayName,
						value = board.stat(profile),
					})
				end
			end
		end
		table.sort(entries, function(a, b)
			return a.value > b.value
		end)
		for i, e in entries do
			e.rank = i
		end
	end
	cache[key] = { entries = entries, at = os.clock() }
	return entries
end

--- Live board of everyone in this server, which updates fast and drives the
--- local rivalry that keeps a session going.
function LeaderboardService:serverBoard()
	local out = {}
	for _, player in Players:GetPlayers() do
		local profile = Store.get(player.UserId)
		if profile then
			table.insert(out, {
				userId = player.UserId,
				name = player.DisplayName,
				coins = profile.coins,
				rebirths = profile.rebirths,
				stolen = profile.stats.stolen,
				plotId = app.PlotService:plotIdOf(player),
			})
		end
	end
	table.sort(out, function(a, b)
		if a.rebirths ~= b.rebirths then
			return a.rebirths > b.rebirths
		end
		return a.coins > b.coins
	end)
	return out
end

function LeaderboardService:start()
	Net:handle("GetLeaderboard", function(_, key)
		if key == "server" then
			return { key = "server", name = "🏠 Neste Servidor", entries = self:serverBoard() }
		end
		for _, b in BOARDS do
			if b.key == key then
				return { key = b.key, name = b.name, entries = self:fetch(b.key) }
			end
		end
		-- default: everything at once for the leaderboard kiosk
		local all = { { key = "server", name = "🏠 Neste Servidor", entries = self:serverBoard() } }
		for _, b in BOARDS do
			table.insert(all, { key = b.key, name = b.name, entries = self:fetch(b.key) })
		end
		return all
	end)

	-- publish on leave and periodically; SetAsync is rate-limited so never
	-- publish on every coin change
	Players.PlayerRemoving:Connect(function(player)
		self:publish(player)
	end)
	task.spawn(function()
		while true do
			task.wait(180)
			for _, player in Players:GetPlayers() do
				self:publish(player)
			end
			Net:fireAll("Leaderboard", { server = self:serverBoard() })
		end
	end)
end

return LeaderboardService
