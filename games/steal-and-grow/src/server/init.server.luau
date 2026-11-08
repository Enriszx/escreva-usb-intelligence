--!nonstrict
--[[
	STEAL & GROW: Império Mutante — server bootstrap.

	Boot order matters, so services declare a `priority` and are initialised in
	two passes:
	   1. init(app)  — wire up references only. No cross-service calls yet, so
	                   the order within a pass cannot bite us.
	   2. start()    — connect remotes, spawn loops, build the world.

	Every service receives the same `app` table and reaches its peers by name
	(app.PlotService, app.GrowthService, ...). It is a tiny dependency-injection
	container: no require cycles, no load-order landmines, and any service can
	be swapped or stubbed for a test.
]]

local ServerScriptService = game:GetService("ServerScriptService")
local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)

local Balance = Config.Balance
local startClock = os.clock()

print(("[Boot] %s v%s iniciando..."):format(Balance.gameName, Balance.version))

-- Collect services -------------------------------------------------------

local app = {}
local services = {}

for _, module in script.Services:GetChildren() do
	if module:IsA("ModuleScript") then
		local ok, service = pcall(require, module)
		if ok and type(service) == "table" and service.name then
			app[service.name] = service
			table.insert(services, service)
		else
			warn(("[Boot] serviço %s falhou ao carregar: %s"):format(module.Name, tostring(service)))
		end
	end
end

table.sort(services, function(a, b)
	return (a.priority or 99) < (b.priority or 99)
end)

-- Pass 1: init -----------------------------------------------------------

for _, service in services do
	if service.init then
		local ok, err = pcall(service.init, service, app)
		if not ok then
			warn(("[Boot] init %s falhou: %s"):format(service.name, tostring(err)))
		end
	end
end

-- Pass 2: start ----------------------------------------------------------

for _, service in services do
	if service.start then
		local ok, err = pcall(service.start, service)
		if not ok then
			warn(("[Boot] start %s falhou: %s"):format(service.name, tostring(err)))
		end
	end
end

-- Chat tags for pass owners ---------------------------------------------
-- TextChatService lets us decorate messages without a custom chat system,
-- which keeps the mobile chat native (and therefore fast).

local TextChatService = game:GetService("TextChatService")
TextChatService.OnIncomingMessage = function(message: TextChatMessage)
	local props = Instance.new("TextChatMessageProperties")
	local source = message.TextSource
	if not source then
		return props
	end
	local player = Players:GetPlayerByUserId(source.UserId)
	if not player then
		return props
	end

	local tag, colour = nil, nil
	if app.AdminService and app.AdminService:isAdmin(player) then
		tag, colour = "DEV", Color3.fromRGB(255, 92, 104)
	else
		local best = nil
		for key, owned in app.MonetizationService:passesOf(player) do
			if owned then
				local pass = Config.Passes.byKey[key]
				if pass and pass.effect.chatTag then
					if not best or pass.robux > best.robux then
						best = pass
					end
				end
			end
		end
		if best then
			tag, colour = best.effect.chatTag, best.colour
		end
	end

	local profile = require(script.Data.Store).get(player.UserId)
	local rank = Config.Ranks:for_(profile and profile.rebirths or 0)

	local prefix = ('<font color="#%s">[%s]</font> '):format(
		rank.colour:ToHex(),
		rank.icon .. " " .. rank.name
	)
	if tag and colour then
		prefix = ('<font color="#%s">[%s]</font> '):format(colour:ToHex(), tag) .. prefix
	end
	props.PrefixText = prefix .. message.PrefixText
	return props
end

print(("[Boot] %d serviços prontos em %.0fms"):format(#services, (os.clock() - startClock) * 1000))
