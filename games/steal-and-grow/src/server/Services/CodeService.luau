--!nonstrict
-- Promo codes. One-use per account, validated server-side, case-insensitive
-- and whitespace-tolerant because players paste them from YouTube comments.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local Store = require(script.Parent.Parent.Data.Store)

local Codes = Config.Codes

local CodeService = { name = "CodeService", priority = 11 }
local app

function CodeService:init(a)
	app = a
end

local function normalise(s: string): string
	return (s:upper():gsub("%s+", ""))
end

function CodeService:redeem(player: Player, input: string): (boolean, string)
	local profile = Store.get(player.UserId)
	if not profile then
		return false, "Perfil não carregado"
	end
	if type(input) ~= "string" or #input == 0 or #input > 40 then
		return false, "Código inválido"
	end
	local code = normalise(input)

	local entry = nil
	for _, c in Codes.list do
		if normalise(c.code) == code then
			entry = c
			break
		end
	end
	if not entry then
		return false, "Código inválido ou expirado"
	end
	if entry.expires and os.time() > entry.expires then
		return false, "Esse código expirou"
	end
	if profile.codes[code] then
		return false, "Você já usou esse código"
	end

	profile.codes[code] = true
	local lines = {}
	local r = entry.reward
	if r.gems then
		app.PlayerService:addGems(player, r.gems, "code:" .. code)
		table.insert(lines, ("+%s gemas"):format(Format.short(r.gems)))
	end
	if r.coins then
		app.PlayerService:addCoins(player, r.coins, "code:" .. code)
		table.insert(lines, ("+%s moedas"):format(Format.short(r.coins)))
	end
	if r.minutes then
		local amount = app.MonetizationService:scaledCoins(player, r.minutes)
		app.PlayerService:addCoins(player, amount, "code:" .. code)
		table.insert(lines, ("+%s moedas"):format(Format.short(amount)))
	end
	if r.egg then
		app.PetService:giveEgg(player, r.egg)
		table.insert(lines, "+1 " .. Config.Eggs.byId[r.egg].name)
	end
	if r.boost then
		app.PlayerService:addBoost(player, r.boost.stat, r.boost.value, r.boost.seconds, "code")
		table.insert(lines, ("%s por %s"):format(Format.multiplier(r.boost.value), Format.time(r.boost.seconds)))
	end

	app.PlayerService:sync(player)
	return true, table.concat(lines, "  •  ")
end

function CodeService:start()
	Net:on("RedeemCode", function(player, input)
		local ok, message = self:redeem(player, input)
		Net:fire(player, "Toast", {
			kind = ok and "success" or "error",
			title = ok and "🎉 Código resgatado!" or message,
			body = ok and message or nil,
			duration = ok and 6 or 4,
		})
	end)
end

return CodeService
