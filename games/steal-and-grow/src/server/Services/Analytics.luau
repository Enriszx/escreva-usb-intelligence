--!nonstrict
-- Analytics. Uses Roblox's first-party AnalyticsService (no external endpoint,
-- so it works with any network policy) plus a lightweight in-memory funnel so
-- you can read the key numbers from the server log during a launch.

local AnalyticsService = game:GetService("AnalyticsService")
local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Format = require(Shared.Util.Format)
local Store = require(script.Parent.Parent.Data.Store)

local Analytics = { name = "Analytics", priority = 15 }
local app
local enabled = Config.Balance.analyticsEnabled

local session = {
	joins = 0,
	firstTimers = 0,
	plants = 0,
	harvests = 0,
	steals = 0,
	rebirths = 0,
	robuxSpent = 0,
	purchases = 0,
}

function Analytics:init(a)
	app = a
end

local function safe(fn)
	if not enabled then
		return
	end
	pcall(fn)
end

--- Funnel step for onboarding. Steps: 1 join, 2 first plant, 3 first harvest,
--- 4 first sell, 5 first upgrade, 6 first rebirth.
function Analytics:funnel(player: Player, step: number, name: string)
	safe(function()
		AnalyticsService:LogOnboardingFunnelStepEvent(player, step, name)
	end)
end

function Analytics:economy(player: Player, currency: string, amount: number, reason: string, balance: number)
	if amount == 0 then
		return
	end
	safe(function()
		AnalyticsService:LogEconomyEvent(
			player,
			amount > 0 and Enum.AnalyticsEconomyFlowType.Source or Enum.AnalyticsEconomyFlowType.Sink,
			currency,
			math.abs(amount),
			math.max(0, balance),
			reason
		)
	end)
end

function Analytics:purchase(player: Player, item: string, robux: number)
	session.purchases += 1
	session.robuxSpent += robux
	safe(function()
		AnalyticsService:LogEconomyEvent(
			player,
			Enum.AnalyticsEconomyFlowType.Source,
			"robux_item",
			robux,
			0,
			item
		)
	end)
end

function Analytics:custom(player: Player, name: string, data: { [string]: any }?)
	if name == "steal" then
		session.steals += 1
	elseif name == "rebirth" then
		session.rebirths += 1
	end
	safe(function()
		AnalyticsService:LogCustomEvent(player, name, 1, data)
	end)
end

function Analytics:snapshot()
	return table.clone(session)
end

function Analytics:start()
	app.PlayerService.onProfileReady:Connect(function(player, profile)
		session.joins += 1
		if os.time() - profile.created < 10 then
			session.firstTimers += 1
			self:funnel(player, 1, "join")
		end
	end)

	app.GrowthService.onHarvest:Connect(function(player, plant, value)
		session.harvests += 1
		local profile = Store.get(player.UserId)
		if profile and profile.stats.harvested == 1 then
			self:funnel(player, 3, "first_harvest")
		end
	end)

	app.RebirthService.onRebirth:Connect(function(player, count)
		if count == 1 then
			self:funnel(player, 6, "first_rebirth")
		end
	end)

	-- periodic log line: the fastest way to read a launch without a dashboard
	task.spawn(function()
		while true do
			task.wait(300)
			print(
				("[Analytics] players=%d joins=%d new=%d harvests=%s steals=%s rebirths=%d purchases=%d robux=%d"):format(
					#Players:GetPlayers(),
					session.joins,
					session.firstTimers,
					Format.short(session.harvests),
					Format.short(session.steals),
					session.rebirths,
					session.purchases,
					session.robuxSpent
				)
			)
		end
	end)
end

return Analytics
