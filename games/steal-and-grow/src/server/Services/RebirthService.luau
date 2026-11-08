--!nonstrict
-- Rebirth: the prestige loop. Resetting must feel like a reward, so it is
-- loud, it grants gems, it bumps a visible rank, and it unlocks seed tiers the
-- player has been staring at (and failing to buy) for the last half hour.

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Economy = require(Shared.Economy)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local Signal = require(Shared.Util.Signal)
local Store = require(script.Parent.Parent.Data.Store)

local Balance = Config.Balance
local Ranks = Config.Ranks
local Seeds = Config.Seeds

local RebirthService = { name = "RebirthService", priority = 10 }
RebirthService.onRebirth = Signal.new()

local app

function RebirthService:init(a)
	app = a
end

function RebirthService:cost(player: Player): number
	local profile = Store.get(player.UserId)
	if not profile then
		return math.huge
	end
	local discount = app.MonetizationService:effect(player, "rebirthDiscount") or 0
	return Economy.rebirthCost(profile.rebirths, discount)
end

function RebirthService:rebirth(player: Player, free: boolean?): (boolean, string?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false, "Perfil não carregado"
	end
	if profile.rebirths >= Balance.maxRebirths then
		return false, ("Você alcançou o renascimento máximo (%d). Lenda viva!"):format(Balance.maxRebirths)
	end
	local cost = self:cost(player)
	if not free then
		if profile.coins < cost then
			return false, ("Precisa de %s moedas para renascer"):format(Format.short(cost))
		end
	end

	local before = profile.rebirths
	local keptCoins = free and math.floor(profile.coins * 0.25) or 0

	-- what resets
	profile.coins = math.max(Balance.startCoins, keptCoins)
	profile.tiles = {}
	profile.inventory = {}
	profile.seeds = { carrot = 5 }
	profile.tileCount = Balance.startTiles

	-- what survives: pets (always), and a whitelist of upgrades so progress
	-- never feels fully erased
	local keptUpgrades = {}
	for _, key in Balance.rebirthKeepUpgrades do
		if profile.upgrades[key] then
			keptUpgrades[key] = profile.upgrades[key]
		end
	end
	profile.upgrades = keptUpgrades
	if not Balance.rebirthKeepPets then
		profile.pets = {}
	end

	profile.rebirths = before + 1

	local gems = Balance.rebirthGemReward * profile.rebirths
	app.PlayerService:addGems(player, gems, "rebirth")
	app.PlayerService:dirty(player)
	app.PlotService:rebuildTiles(player)

	-- what did this unlock?
	local unlocked = {}
	for _, seed in Seeds.all do
		if seed.unlockRebirth == profile.rebirths and seed.cost > 0 then
			table.insert(unlocked, seed.name)
		end
	end

	local rankBefore = Ranks:for_(before)
	local rankAfter = Ranks:for_(profile.rebirths)

	Net:fire(player, "RebirthResult", {
		rebirths = profile.rebirths,
		gems = gems,
		unlocked = unlocked,
		rank = rankAfter,
		rankChanged = rankAfter.name ~= rankBefore.name,
		nextCost = self:cost(player),
	})

	if rankAfter.name ~= rankBefore.name then
		Net:fireAll("Announce", {
			kind = "rebirth",
			title = ("%s %s alcançou o rank %s!"):format(rankAfter.icon, player.DisplayName, rankAfter.name),
			body = ("Renascimento #%d"):format(profile.rebirths),
			colour = rankAfter.colour,
		})
	end

	app.QuestService:progress(player, "rebirth", 1)
	app.PlayerService:sync(player)
	app.ShopService:push(player)
	task.spawn(Store.save, player.UserId)
	self.onRebirth:Fire(player, profile.rebirths)
	if app.Analytics then
		app.Analytics:custom(player, "rebirth", { count = profile.rebirths, free = free })
	end
	return true
end

function RebirthService:start()
	Net:on("Rebirth", function(player)
		local ok, err = self:rebirth(player, false)
		if not ok and err then
			Net:fire(player, "Toast", { kind = "error", title = err })
		end
	end)
end

return RebirthService
