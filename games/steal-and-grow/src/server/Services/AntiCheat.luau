--!nonstrict
-- Server-side sanity checks.
--
-- Philosophy: the game is already exploit-resistant by construction — the
-- client never sends a value, only an intent ("plant seed X on tile Y"), and
-- every payout is recomputed by Economy on the server. This service catches the
-- remaining two classes: remote spam and movement/teleport abuse.
--
-- It deliberately does NOT kick on a single anomaly. Mobile players on bad
-- connections produce false positives constantly, and kicking paying customers
-- over a lag spike is far more expensive than one slow exploiter.

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local RateLimiter = require(Shared.Util.RateLimiter)
local Store = require(script.Parent.Parent.Data.Store)

local Balance = Config.Balance

local AntiCheat = { name = "AntiCheat", priority = 0 }
local app
local limiter = RateLimiter.new()
local lastPos = {} :: { [number]: { pos: Vector3, at: number } }

function AntiCheat:init(a)
	app = a
	Net:setLimiter(limiter)

	limiter.onSuspicion = function(player, bucket, score)
		if score == 4 or score == 8 then
			warn(("[AntiCheat] %s suspicion %d (%s)"):format(player.Name, score, bucket))
		end
		if score >= Balance.suspicionKickThreshold then
			-- not a ban: a disconnect. If it was a false positive the player
			-- rejoins and keeps everything.
			player:Kick(
				"Atividade anormal detectada. Entre novamente.\n(Se isso foi um erro, nada foi perdido.)"
			)
		end
	end
end

function AntiCheat:limiter()
	return limiter
end

--- Position watchdog. Teleports beyond the plausible speed are snapped back
--- rather than punished, because the common cause is a physics glitch.
function AntiCheat:checkMovement()
	local now = os.clock()
	for _, player in Players:GetPlayers() do
		local char = player.Character
		local root = char and char:FindFirstChild("HumanoidRootPart")
		if root then
			local prev = lastPos[player.UserId]
			if prev then
				local dt = now - prev.at
				if dt > 0.05 then
					local speed = (root.Position - prev.pos).Magnitude / dt
					-- allow a generous threshold: legitimate teleports (GoHome,
					-- VisitPlot) are server-driven and happen between samples
					if speed > Balance.maxTeleportSpeed and not self._teleporting then
						local humanoid = char:FindFirstChildWhichIsA("Humanoid")
						local falling = humanoid and humanoid:GetState() == Enum.HumanoidStateType.Freefall
						if not falling then
							limiter:flag(player, "movement", 0.5)
						end
					end
				end
			end
			lastPos[player.UserId] = { pos = root.Position, at = now }
		end
	end
end

--- Profile integrity pass: clamps anything that drifted out of legal range.
--- This is the net that catches a bug in our own code, not just cheaters.
function AntiCheat:auditProfiles()
	for _, player in Players:GetPlayers() do
		local profile = Store.get(player.UserId)
		if profile then
			local m = app.PlayerService:multipliers(player)
			profile.coins = math.clamp(profile.coins, 0, 9e15)
			profile.gems = math.clamp(profile.gems, 0, 9e12)
			profile.rebirths = math.clamp(math.floor(profile.rebirths), 0, 10000)
			profile.tileCount = math.clamp(math.floor(profile.tileCount), 1, Balance.maxTiles)

			-- tiles beyond the unlocked count are illegal
			local allowed = app.PlotService:tileCount(player)
			for index in profile.tiles do
				if type(index) ~= "number" or index < 1 or index > allowed then
					profile.tiles[index] = nil
				end
			end

			-- inventory overflow (can only happen via a bug) is trimmed, not lost:
			-- the excess is auto-sold so the player is compensated
			if #profile.inventory > m.storage then
				local excess = #profile.inventory - m.storage
				local total = 0
				for _ = 1, excess do
					local crop = table.remove(profile.inventory, 1)
					if crop then
						total += crop.value or 0
					end
				end
				if total > 0 then
					app.PlayerService:addCoins(player, total, "overflow_autosell")
				end
			end

			-- equipped pets beyond the slot count get unequipped
			local equipped = 0
			for _, pet in profile.pets do
				if pet.equipped then
					equipped += 1
					if equipped > m.petSlots then
						pet.equipped = false
					end
				end
			end
		end
	end
end

function AntiCheat:start()
	Players.PlayerRemoving:Connect(function(player)
		limiter:clear(player)
		lastPos[player.UserId] = nil
	end)

	task.spawn(function()
		while true do
			task.wait(1)
			pcall(function()
				self:checkMovement()
			end)
		end
	end)

	task.spawn(function()
		while true do
			task.wait(30)
			pcall(function()
				self:auditProfiles()
			end)
		end
	end)
end

return AntiCheat
