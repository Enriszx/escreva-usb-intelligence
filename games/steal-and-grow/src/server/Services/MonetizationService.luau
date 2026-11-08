--!nonstrict
-- Gamepasses, developer products and receipt processing.
--
-- Design rules baked in here:
--  * Pass ownership is cached per session. UserOwnsGamePassAsync is slow and
--    rate-limited; calling it inside a multiplier evaluation would be fatal.
--  * A purchase made mid-session is picked up immediately via
--    PromptGamePassPurchaseFinished, so the player never has to rejoin.
--  * ProcessReceipt is idempotent by receipt id. Roblox retries receipts, and a
--    non-idempotent handler is how sims accidentally hand out 10x the coins.
--  * Currency products grant an amount SCALED to the player's own production,
--    so a 99 Robux pack is never worthless and never breaks the economy.

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local DataStoreService = game:GetService("DataStoreService")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Economy = require(Shared.Economy)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local Signal = require(Shared.Util.Signal)
local Store = require(script.Parent.Parent.Data.Store)

local Balance = Config.Balance
local Passes = Config.Passes
local Products = Config.Products

local IS_STUDIO = RunService:IsStudio()
local GRANT_ALL = IS_STUDIO and Balance.studioGrantAll

local MonetizationService = { name = "MonetizationService", priority = 2 }
MonetizationService.onPassGranted = Signal.new()
MonetizationService.onProductPurchased = Signal.new()

local app
local passCache = {} :: { [number]: { [string]: boolean } }
local receiptStore = DataStoreService:GetDataStore("StealAndGrow_Receipts_v1")
local serverBoostState =
	nil :: { coinMult: number?, luckMult: number?, growMult: number?, expires: number, by: string }?

function MonetizationService:init(a)
	app = a
end

-- Pass ownership ---------------------------------------------------------

local function fetchPasses(player: Player)
	local owned = {}
	if GRANT_ALL then
		for key in Passes.byKey do
			owned[key] = true
		end
		return owned
	end
	for key, pass in Passes.byKey do
		if pass.id ~= 0 then
			local ok, has = pcall(function()
				return MarketplaceService:UserOwnsGamePassAsync(player.UserId, pass.id)
			end)
			owned[key] = ok and has or false
		else
			owned[key] = false
		end
	end
	return owned
end

function MonetizationService:passesOf(player: Player): { [string]: boolean }
	local cached = passCache[player.UserId]
	if cached then
		return cached
	end
	local owned = fetchPasses(player)
	passCache[player.UserId] = owned
	return owned
end

function MonetizationService:has(player: Player, key: string): boolean
	return self:passesOf(player)[key] == true
end

--- Merged effect lookup — returns the strongest value across owned passes.
function MonetizationService:effect(player: Player, field: string)
	local best = nil
	for key, owned in self:passesOf(player) do
		if owned then
			local p = Passes.byKey[key]
			local v = p and p.effect[field]
			if v ~= nil then
				if type(v) == "boolean" then
					if v then
						return true
					end
				elseif best == nil or v > best then
					best = v
				end
			end
		end
	end
	return best
end

function MonetizationService:refresh(player: Player)
	passCache[player.UserId] = nil
	app.PlayerService:dirty(player)
	app.PlayerService:sync(player)
end

-- Server-wide boost ------------------------------------------------------

function MonetizationService:serverBoost()
	if serverBoostState and serverBoostState.expires > os.time() then
		return serverBoostState
	end
	return nil
end

function MonetizationService:startServerBoost(buyer: Player, payload)
	serverBoostState = {
		coinMult = payload.coinMult,
		luckMult = payload.luckMult,
		growMult = payload.growMult,
		expires = os.time() + payload.seconds,
		by = buyer.DisplayName,
	}
	for _, p in Players:GetPlayers() do
		app.PlayerService:dirty(p)
		app.PlayerService:pushBoosts(p)
	end
	Net:fireAll("Announce", {
		kind = "serverboost",
		title = "🎊 BÔNUS DO SERVIDOR ATIVO!",
		body = ("%s pagou x2 moedas e x2 sorte para TODO MUNDO por %s!"):format(
			buyer.DisplayName,
			Format.time(payload.seconds)
		),
		colour = Config.Theme.steal,
	})
end

-- Prompting --------------------------------------------------------------

function MonetizationService:promptPass(player: Player, key: string)
	local pass = Passes.byKey[key]
	if not pass then
		return
	end
	if pass.id == 0 then
		Net:fire(player, "Toast", {
			kind = "error",
			title = "Ainda não disponível",
			body = "Este passe está sendo publicado. Tente em alguns minutos!",
		})
		return
	end
	if self:has(player, key) then
		Net:fire(player, "Toast", { kind = "info", title = "Você já tem este passe!" })
		return
	end
	MarketplaceService:PromptGamePassPurchase(player, pass.id)
end

function MonetizationService:promptProduct(player: Player, key: string)
	local product = Products.byKey[key]
	if not product then
		return
	end
	if product.id == 0 then
		Net:fire(player, "Toast", {
			kind = "error",
			title = "Ainda não disponível",
			body = "Este item está sendo publicado. Tente em alguns minutos!",
		})
		return
	end
	-- one-time bundles are hidden server-side too, not just in the UI
	if product.payload.oncePerAccount then
		local profile = Store.get(player.UserId)
		if profile and (profile.productsBought[key] or 0) > 0 then
			Net:fire(player, "Toast", { kind = "info", title = "Você já comprou este pacote." })
			return
		end
	end
	if product.payload.maxStack then
		local profile = Store.get(player.UserId)
		if profile and (profile.productsBought[key] or 0) >= product.payload.maxStack then
			Net:fire(player, "Toast", { kind = "info", title = "Limite máximo já alcançado." })
			return
		end
	end
	MarketplaceService:PromptProductPurchase(player, product.id)
end

-- Granting ---------------------------------------------------------------

--- Currency amount scaled to what this player actually produces, so packs stay
--- relevant at every stage instead of being a flat (and eventually useless) sum.
function MonetizationService:scaledCoins(player: Player, minutes: number): number
	local profile = Store.get(player.UserId)
	if not profile then
		return 0
	end
	local ctx = app.PlayerService:context(player)
	local perMinute = Economy.productionPerMinute(ctx, profile.tileCount)
	-- floor so a brand-new player still gets something that feels generous
	local floor = 2500 * minutes
	return math.max(floor, math.floor(perMinute * minutes))
end

function MonetizationService:grant(player: Player, product, receiptId: string?): boolean
	local profile = Store.get(player.UserId)
	if not profile then
		return false
	end
	local payload = product.payload
	local lines = {}

	if payload.minutes then
		local amount = self:scaledCoins(player, payload.minutes)
		app.PlayerService:addCoins(player, amount, "product:" .. product.key)
		table.insert(lines, ("+%s moedas"):format(Format.short(amount)))
	end
	if payload.gems then
		app.PlayerService:addGems(player, payload.gems, "product:" .. product.key)
		table.insert(lines, ("+%s gemas"):format(Format.short(payload.gems)))
	end
	if payload.tiles then
		local added = payload.tiles
		profile.tileCount = math.min(Balance.maxTiles, profile.tileCount + added)
		app.PlotService:rebuildTiles(player)
		table.insert(lines, ("+%d canteiros"):format(added))
	end
	if payload.egg then
		app.PetService:giveEgg(player, payload.egg)
		table.insert(
			lines,
			"+1 " .. (Config.Eggs.byId[payload.egg] and Config.Eggs.byId[payload.egg].name or "ovo")
		)
	end
	if payload.boost then
		local b = payload.boost
		app.PlayerService:addBoost(player, b.stat, b.value, b.seconds, product.key)
		table.insert(lines, ("%s por %s"):format(Format.multiplier(b.value), Format.time(b.seconds)))
	end
	if payload.stat and payload.seconds and not payload.server then
		app.PlayerService:addBoost(player, payload.stat, payload.value, payload.seconds, product.key)
		table.insert(
			lines,
			("%s por %s"):format(Format.multiplier(payload.value), Format.time(payload.seconds))
		)
	end
	if payload.server then
		self:startServerBoost(player, payload)
		table.insert(lines, "Bônus global ativado")
	end
	if payload.instantGrow then
		local n = app.GrowthService:instantGrowAll(player)
		table.insert(lines, ("%d plantas prontas"):format(n))
	end
	if payload.reroll then
		app.ShopService:reroll(player, 1)
		table.insert(lines, "Loja renovada")
	end
	if payload.revenge then
		local ok, msg = app.StealService:revenge(player)
		table.insert(lines, msg or (ok and "Vingança executada" or "Nenhum alvo"))
	end
	if payload.freeRebirth then
		app.RebirthService:rebirth(player, true)
		table.insert(lines, "Renascimento concedido")
	end

	profile.productsBought[product.key] = (profile.productsBought[product.key] or 0) + 1

	Net:fire(player, "Toast", {
		kind = "purchase",
		title = product.icon .. " " .. product.name,
		body = table.concat(lines, "  •  "),
		duration = 5,
	})
	app.PlayerService:sync(player)
	self.onProductPurchased:Fire(player, product, receiptId)
	if app.Analytics then
		app.Analytics:purchase(player, product.key, product.robux)
	end
	return true
end

-- Receipts ---------------------------------------------------------------

--- Idempotency: a receipt id is written to a DataStore before granting. If the
--- same receipt arrives twice (Roblox retries on any non-Granted return), the
--- second call short-circuits.
local function alreadyProcessed(receiptId: string): boolean
	if IS_STUDIO then
		return false
	end
	local ok, seen = pcall(function()
		return receiptStore:GetAsync(receiptId)
	end)
	return ok and seen == true
end

local function markProcessed(receiptId: string)
	if IS_STUDIO then
		return
	end
	pcall(function()
		receiptStore:SetAsync(receiptId, true, { 0 })
	end)
end

function MonetizationService:processReceipt(info)
	local player = Players:GetPlayerByUserId(info.PlayerId)
	if not player then
		-- player left before we could grant: do NOT consume the receipt, Roblox
		-- will deliver it again next time they join
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	local receiptId = tostring(info.PurchaseId)
	if alreadyProcessed(receiptId) then
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end

	local product = Products.byId[info.ProductId]
	if not product then
		warn(("[Monetization] unknown product id %d"):format(info.ProductId))
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	local ok = self:grant(player, product, receiptId)
	if not ok then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	markProcessed(receiptId)
	-- force an immediate save: the Robux is already gone, the grant must not be
	-- lost to a crash before the next autosave
	task.spawn(Store.save, player.UserId)
	return Enum.ProductPurchaseDecision.PurchaseGranted
end

-- Lifecycle --------------------------------------------------------------

function MonetizationService:start()
	MarketplaceService.ProcessReceipt = function(info)
		local ok, decision = pcall(function()
			return self:processReceipt(info)
		end)
		if not ok then
			warn("[Monetization] processReceipt error: " .. tostring(decision))
			return Enum.ProductPurchaseDecision.NotProcessedYet
		end
		return decision
	end

	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
		if not purchased then
			return
		end
		for key, pass in Passes.byKey do
			if pass.id == passId then
				local owned = self:passesOf(player)
				owned[key] = true
				app.PlayerService:dirty(player)
				app.PlayerService:sync(player)
				-- extra tiles must materialise immediately
				if pass.effect.extraTiles then
					app.PlotService:rebuildTiles(player)
				end
				Net:fire(player, "Toast", {
					kind = "purchase",
					title = pass.icon .. " " .. pass.name .. " ATIVADO!",
					body = pass.desc,
					duration = 6,
				})
				Net:fireExcept(player, "Announce", {
					kind = "pass",
					title = pass.icon .. " " .. player.DisplayName .. " comprou " .. pass.name .. "!",
					colour = pass.colour,
				})
				self.onPassGranted:Fire(player, key)
				if app.Analytics then
					app.Analytics:purchase(player, "pass:" .. key, pass.robux)
				end
				break
			end
		end
	end)

	Players.PlayerRemoving:Connect(function(player)
		passCache[player.UserId] = nil
	end)

	Net:on("PromptPass", function(player, key)
		if type(key) == "string" then
			self:promptPass(player, key)
		end
	end)
	Net:on("PromptProduct", function(player, key)
		if type(key) == "string" then
			self:promptProduct(player, key)
		end
	end)
	Net:handle("GetPassState", function(player)
		return {
			owned = self:passesOf(player),
			serverBoost = self:serverBoost(),
		}
	end)
end

return MonetizationService
