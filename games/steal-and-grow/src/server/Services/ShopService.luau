--!nonstrict
-- Seed shop (rotating stock), upgrades and egg purchases.
--
-- The rotating stock is deliberate: a fixed shop list is a solved problem after
-- five minutes, while a 5-minute restock with rarity rolls creates a reason to
-- come back to the hub and a reason to buy the Renovar Loja product. The stock
-- is SERVER-WIDE (everyone sees the same rotation) which makes it a social
-- event — "the shop has Pitaia, go go go" is free marketing in chat.

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local Weighted = require(Shared.Util.WeightedRandom)
local Store = require(script.Parent.Parent.Data.Store)

local Balance = Config.Balance
local Seeds = Config.Seeds
local Upgrades = Config.Upgrades
local Eggs = Config.Eggs

local ShopService = { name = "ShopService", priority = 6 }

local app
local rng = Random.new()
local stock = {} :: { { seed: string, stockLeft: number, price: number } }
local nextRestock = 0
local personalReroll = {} :: { [number]: { stock: any, expires: number } }

function ShopService:init(a)
	app = a
end

-- Stock ------------------------------------------------------------------

--- Build a stock list. `tierBias` nudges the roll toward rarer seeds (used by
--- the paid reroll, which guarantees at least one tier up).
local function rollStock(tierBias: number?)
	local pool = {}
	for _, seed in Seeds.all do
		if seed.cost > 0 then
			-- weight by shopWeight, softened by tier so late-game seeds appear
			-- rarely rather than never
			local w = seed.shopWeight / (seed.tier ^ (1.35 - (tierBias or 0) * 0.4))
			table.insert(pool, { seed = seed, weight = w, luckScale = 0 })
		end
	end
	local picks = Weighted.pickMany(pool, Balance.shopSlots, 1, rng)
	local out = {}
	for _, entry in picks do
		local seed = entry.seed
		-- scarcity on the rare stuff: a limited quantity is what makes a
		-- restock feel like an event
		local maxStock = seed.tier <= 2 and 25 or seed.tier <= 4 and 10 or seed.tier <= 6 and 4 or 2
		table.insert(out, {
			seed = seed.id,
			stockLeft = rng:NextInteger(math.max(1, maxStock // 2), maxStock),
			price = seed.cost,
		})
	end
	table.sort(out, function(a, b)
		return (Seeds.byId[a.seed].cost) < (Seeds.byId[b.seed].cost)
	end)
	return out
end

function ShopService:restock(announce: boolean?)
	stock = rollStock()
	nextRestock = os.time() + Balance.shopRestockSeconds
	personalReroll = {}
	self:push()
	if announce then
		-- shout only when something genuinely rare showed up
		local best = nil
		for _, entry in stock do
			local seed = Seeds.byId[entry.seed]
			if seed and (not best or seed.tier > best.tier) then
				best = seed
			end
		end
		if best and best.tier >= 5 then
			Net:fireAll("Announce", {
				kind = "shop",
				title = "🌱 ESTOQUE NOVO NA LOJA!",
				body = ("%s (%s) disponível agora — estoque limitado!"):format(best.name, best.rarity),
				colour = Config.Rarities.get(best.rarity).colour,
			})
		end
	end
end

function ShopService:stockFor(player: Player)
	local personal = personalReroll[player.UserId]
	if personal and personal.expires > os.time() then
		return personal.stock
	end
	return stock
end

function ShopService:reroll(player: Player, tierBias: number?)
	personalReroll[player.UserId] = {
		stock = rollStock(tierBias or 1),
		expires = nextRestock,
	}
	self:push(player)
end

function ShopService:payload(player: Player)
	local profile = Store.get(player.UserId)
	return {
		stock = self:stockFor(player),
		nextRestock = nextRestock,
		eggs = Eggs.byId,
		upgrades = (function()
			local out = {}
			for _, u in Upgrades.all do
				local level = (profile and profile.upgrades[u.key]) or 0
				out[u.key] = {
					level = level,
					cost = Upgrades.cost(u, level),
					maxed = level >= u.maxLevel,
				}
			end
			return out
		end)(),
	}
end

function ShopService:push(player: Player?)
	if player then
		Net:fire(player, "InventoryUpdate", { shop = self:payload(player) })
	else
		for _, p in Players:GetPlayers() do
			Net:fire(p, "InventoryUpdate", { shop = self:payload(p) })
		end
	end
end

-- Buying -----------------------------------------------------------------

function ShopService:buySeed(player: Player, seedId: string, quantity: number): (boolean, string?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false, "Perfil não carregado"
	end
	local seed = Seeds.byId[seedId]
	if not seed or seed.cost <= 0 then
		return false, "Semente não está à venda"
	end
	if seed.unlockRebirth > profile.rebirths then
		return false, ("Precisa de %d renascimentos"):format(seed.unlockRebirth)
	end

	local list = self:stockFor(player)
	local entry = nil
	for _, e in list do
		if e.seed == seedId then
			entry = e
			break
		end
	end
	if not entry then
		return false, "Essa semente não está no estoque atual"
	end

	quantity = math.clamp(math.floor(quantity or 1), 1, 100)
	quantity = math.min(quantity, entry.stockLeft)
	if quantity <= 0 then
		return false, "Estoque esgotado"
	end

	local total = seed.cost * quantity
	if not app.PlayerService:spendCoins(player, total, "buyseed:" .. seedId) then
		return false, ("Moedas insuficientes (precisa de %s)"):format(Format.short(total))
	end

	entry.stockLeft -= quantity
	profile.seeds[seedId] = (profile.seeds[seedId] or 0) + quantity
	self:push()
	app.PlayerService:sync(player)
	return true
end

function ShopService:buyUpgrade(player: Player, key: string): (boolean, string?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false, "Perfil não carregado"
	end
	local upgrade = Upgrades.byKey[key]
	if not upgrade then
		return false, "Melhoria inválida"
	end
	local level = profile.upgrades[key] or 0
	if level >= upgrade.maxLevel then
		return false, "Nível máximo"
	end
	local cost = Upgrades.cost(upgrade, level)
	if not app.PlayerService:spendCoins(player, cost, "upgrade:" .. key) then
		return false, ("Moedas insuficientes (precisa de %s)"):format(Format.short(cost))
	end

	profile.upgrades[key] = level + 1
	app.PlayerService:dirty(player)

	if upgrade.stat == "tiles" then
		profile.tileCount = math.min(Balance.maxTiles, profile.tileCount + upgrade.perLevel)
		app.PlotService:rebuildTiles(player)
	end

	Net:fire(player, "Toast", {
		kind = "success",
		title = upgrade.icon .. " " .. upgrade.name .. " nível " .. (level + 1),
		body = upgrade.desc,
	})
	self:push(player)
	app.PlayerService:sync(player)
	return true
end

function ShopService:buyEgg(player: Player, eggId: string): (boolean, string?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false, "Perfil não carregado"
	end
	local egg = Eggs.byId[eggId]
	if not egg then
		return false, "Ovo inválido"
	end
	if egg.unlockRebirth > profile.rebirths then
		return false, ("Precisa de %d renascimentos"):format(egg.unlockRebirth)
	end
	if #profile.eggs >= 3 then
		return false, "Você já tem 3 ovos chocando"
	end

	local paid = if egg.currency == "gems"
		then app.PlayerService:spendGems(player, egg.cost, "egg:" .. eggId)
		else app.PlayerService:spendCoins(player, egg.cost, "egg:" .. eggId)
	if not paid then
		return false, ("%s insuficientes"):format(egg.currency == "gems" and "Gemas" or "Moedas")
	end

	app.PetService:giveEgg(player, eggId)
	return true
end

-- Lifecycle --------------------------------------------------------------

function ShopService:start()
	self:restock(false)

	task.spawn(function()
		while true do
			local wait = math.max(1, nextRestock - os.time())
			task.wait(wait)
			self:restock(true)
		end
	end)

	app.PlayerService.onProfileReady:Connect(function(player)
		task.defer(function()
			self:push(player)
		end)
	end)

	Players.PlayerRemoving:Connect(function(player)
		personalReroll[player.UserId] = nil
	end)

	Net:on("BuySeed", function(player, seedId, quantity)
		if type(seedId) ~= "string" then
			return
		end
		local ok, err = self:buySeed(player, seedId, type(quantity) == "number" and quantity or 1)
		if not ok and err then
			Net:fire(player, "Toast", { kind = "error", title = err })
		end
	end)

	Net:on("BuyUpgrade", function(player, key)
		if type(key) ~= "string" then
			return
		end
		local ok, err = self:buyUpgrade(player, key)
		if not ok and err then
			Net:fire(player, "Toast", { kind = "error", title = err })
		end
	end)

	Net:on("BuyEgg", function(player, eggId)
		if type(eggId) ~= "string" then
			return
		end
		local ok, err = self:buyEgg(player, eggId)
		if not ok and err then
			Net:fire(player, "Toast", { kind = "error", title = err })
		end
	end)
end

return ShopService
