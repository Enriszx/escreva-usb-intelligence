--!nonstrict
-- Player-to-player trading for pets and crops.
--
-- Trade is where sims leak value and get scammed, so the rules are strict:
--  * both sides must explicitly confirm, and ANY change to either offer
--    un-confirms both. This single rule kills the classic "swap the item at
--    the last second" scam.
--  * the server re-verifies ownership of every item at execution time
--  * one active trade per player, both must be in range, 90s timeout
--  * equipped pets cannot be offered (prevents an accidental loss of buffs)

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local Store = require(script.Parent.Parent.Data.Store)

local TradeService = { name = "TradeService", priority = 13 }
local app

local MAX_ITEMS = 6
local TIMEOUT = 90
local RANGE = 40

local trades = {} :: { [string]: any }
local byPlayer = {} :: { [number]: string }

function TradeService:init(a)
	app = a
end

local function keyOf(a: number, b: number): string
	return math.min(a, b) .. "-" .. math.max(a, b)
end

local function inRange(a: Player, b: Player): boolean
	local ra = a.Character and a.Character:FindFirstChild("HumanoidRootPart")
	local rb = b.Character and b.Character:FindFirstChild("HumanoidRootPart")
	if not ra or not rb then
		return false
	end
	return (ra.Position - rb.Position).Magnitude <= RANGE
end

local function push(trade)
	for _, side in { "a", "b" } do
		local player = trade[side].player
		local other = trade[side == "a" and "b" or "a"]
		if player.Parent then
			Net:fire(player, "TradeUpdate", {
				state = trade.state,
				partner = other.player.DisplayName,
				partnerId = other.player.UserId,
				yourOffer = trade[side].offer,
				theirOffer = other.offer,
				youConfirmed = trade[side].confirmed,
				theyConfirmed = other.confirmed,
				expiresAt = trade.expiresAt,
			})
		end
	end
end

local function close(trade, reason: string?)
	trades[trade.key] = nil
	byPlayer[trade.a.player.UserId] = nil
	byPlayer[trade.b.player.UserId] = nil
	for _, side in { "a", "b" } do
		local player = trade[side].player
		if player.Parent then
			Net:fire(player, "TradeUpdate", { state = "closed", reason = reason })
		end
	end
end

function TradeService:request(from: Player, toId: number)
	if byPlayer[from.UserId] then
		Net:fire(from, "Toast", { kind = "error", title = "Você já está em uma troca" })
		return
	end
	local to = Players:GetPlayerByUserId(toId)
	if not to or to == from then
		return
	end
	if byPlayer[to.UserId] then
		Net:fire(from, "Toast", { kind = "error", title = "Esse jogador já está trocando" })
		return
	end
	if not inRange(from, to) then
		Net:fire(from, "Toast", { kind = "error", title = "Chegue mais perto do jogador" })
		return
	end
	Net:fire(to, "TradeUpdate", {
		state = "invite",
		partner = from.DisplayName,
		partnerId = from.UserId,
	})
	Net:fire(from, "Toast", { kind = "info", title = "Convite de troca enviado" })
end

function TradeService:accept(player: Player, fromId: number)
	local from = Players:GetPlayerByUserId(fromId)
	if not from or byPlayer[player.UserId] or byPlayer[from.UserId] then
		return
	end
	if not inRange(player, from) then
		return
	end
	local key = keyOf(player.UserId, from.UserId)
	local trade = {
		key = key,
		state = "open",
		expiresAt = os.time() + TIMEOUT,
		a = { player = from, offer = { pets = {}, crops = {} }, confirmed = false },
		b = { player = player, offer = { pets = {}, crops = {} }, confirmed = false },
	}
	trades[key] = trade
	byPlayer[player.UserId] = key
	byPlayer[from.UserId] = key
	push(trade)

	task.delay(TIMEOUT + 1, function()
		if trades[key] and trades[key].state ~= "done" then
			close(trades[key], "Tempo esgotado")
		end
	end)
end

local function sideFor(trade, player: Player)
	if trade.a.player == player then
		return trade.a, trade.b
	end
	return trade.b, trade.a
end

function TradeService:offer(player: Player, kind: string, id: any)
	local key = byPlayer[player.UserId]
	local trade = key and trades[key]
	if not trade or trade.state ~= "open" then
		return
	end
	local profile = Store.get(player.UserId)
	if not profile then
		return
	end
	local mine = sideFor(trade, player)

	if kind == "pet" then
		if type(id) ~= "string" then
			return
		end
		local owned = nil
		for _, p in profile.pets do
			if p.uid == id then
				owned = p
			end
		end
		if not owned then
			return
		end
		if owned.equipped then
			Net:fire(player, "Toast", { kind = "error", title = "Desequipe o pet antes de oferecer" })
			return
		end
		local existing = table.find(mine.offer.pets, id)
		if existing then
			table.remove(mine.offer.pets, existing)
		elseif #mine.offer.pets + #mine.offer.crops < MAX_ITEMS then
			table.insert(mine.offer.pets, id)
		end
	elseif kind == "crop" then
		if type(id) ~= "number" then
			return
		end
		id = math.floor(id)
		if not profile.inventory[id] then
			return
		end
		local existing = table.find(mine.offer.crops, id)
		if existing then
			table.remove(mine.offer.crops, existing)
		elseif #mine.offer.pets + #mine.offer.crops < MAX_ITEMS then
			table.insert(mine.offer.crops, id)
		end
	else
		return
	end

	-- ANY change resets both confirmations. This is the anti-scam rule.
	trade.a.confirmed = false
	trade.b.confirmed = false
	push(trade)
end

function TradeService:confirm(player: Player)
	local key = byPlayer[player.UserId]
	local trade = key and trades[key]
	if not trade or trade.state ~= "open" then
		return
	end
	local mine, theirs = sideFor(trade, player)
	mine.confirmed = true
	push(trade)
	if mine.confirmed and theirs.confirmed then
		self:execute(trade)
	end
end

function TradeService:execute(trade)
	local pa, pb = trade.a.player, trade.b.player
	local prA, prB = Store.get(pa.UserId), Store.get(pb.UserId)
	if not prA or not prB then
		close(trade, "Erro ao carregar perfis")
		return
	end
	if not inRange(pa, pb) then
		close(trade, "Vocês se afastaram")
		return
	end

	-- re-verify and extract, newest index first so removals stay valid
	local function extract(profile, offer)
		local pets, crops = {}, {}
		for _, uid in offer.pets do
			for i, p in profile.pets do
				if p.uid == uid and not p.equipped then
					table.insert(pets, { index = i, data = p })
					break
				end
			end
		end
		if #pets ~= #offer.pets then
			return nil
		end
		local sortedCrops = table.clone(offer.crops)
		table.sort(sortedCrops, function(x, y)
			return x > y
		end)
		for _, idx in sortedCrops do
			local crop = profile.inventory[idx]
			if not crop then
				return nil
			end
			table.insert(crops, { index = idx, data = crop })
		end
		return pets, crops
	end

	local petsA, cropsA = extract(prA, trade.a.offer)
	local petsB, cropsB = extract(prB, trade.b.offer)
	if not petsA or not petsB then
		close(trade, "Um dos itens não está mais disponível")
		return
	end

	-- remove
	local function removeAll(profile, pets, crops)
		table.sort(pets, function(x, y)
			return x.index > y.index
		end)
		for _, e in pets do
			table.remove(profile.pets, e.index)
		end
		for _, e in crops do
			table.remove(profile.inventory, e.index)
		end
	end
	removeAll(prA, petsA, cropsA)
	removeAll(prB, petsB, cropsB)

	-- give
	for _, e in petsA do
		e.data.equipped = false
		table.insert(prB.pets, e.data)
		prB.index[e.data.id] = (prB.index[e.data.id] or 0) + 1
	end
	for _, e in petsB do
		e.data.equipped = false
		table.insert(prA.pets, e.data)
		prA.index[e.data.id] = (prA.index[e.data.id] or 0) + 1
	end
	for _, e in cropsA do
		table.insert(prB.inventory, e.data)
	end
	for _, e in cropsB do
		table.insert(prA.inventory, e.data)
	end

	trade.state = "done"
	app.PlayerService:dirty(pa)
	app.PlayerService:dirty(pb)
	app.PlayerService:sync(pa)
	app.PlayerService:sync(pb)
	for _, p in { pa, pb } do
		Net:fire(p, "Toast", { kind = "success", title = "✅ Troca concluída!" })
	end
	close(trade, "Troca concluída")
	task.spawn(Store.save, pa.UserId)
	task.spawn(Store.save, pb.UserId)
end

function TradeService:start()
	Net:on("TradeAction", function(player, action, arg1, arg2)
		if action == "request" and type(arg1) == "number" then
			self:request(player, math.floor(arg1))
		elseif action == "accept" and type(arg1) == "number" then
			self:accept(player, math.floor(arg1))
		elseif action == "offer" then
			self:offer(player, arg1, arg2)
		elseif action == "confirm" then
			self:confirm(player)
		elseif action == "cancel" then
			local key = byPlayer[player.UserId]
			if key and trades[key] then
				close(trades[key], player.DisplayName .. " cancelou")
			end
		end
	end)

	Players.PlayerRemoving:Connect(function(player)
		local key = byPlayer[player.UserId]
		if key and trades[key] then
			close(trades[key], "O outro jogador saiu")
		end
	end)
end

return TradeService
