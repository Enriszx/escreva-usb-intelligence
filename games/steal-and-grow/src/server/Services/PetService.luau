--!nonstrict
-- Eggs, hatching, equipping, fusing. Pets are the long-tail collection goal
-- and the main non-coin multiplier source, which is why fusion exists: it gives
-- duplicate pets a purpose instead of making a rare drop feel like a dud.

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local Weighted = require(Shared.Util.WeightedRandom)
local Signal = require(Shared.Util.Signal)
local Store = require(script.Parent.Parent.Data.Store)

local Balance = Config.Balance
local Pets = Config.Pets
local Eggs = Config.Eggs
local Rarities = Config.Rarities

local PetService = { name = "PetService", priority = 7 }
PetService.onHatch = Signal.new()

local app
local rng = Random.new()

function PetService:init(a)
	app = a
end

function PetService:giveEgg(player: Player, eggId: string): boolean
	local profile = Store.get(player.UserId)
	local egg = Eggs.byId[eggId]
	if not profile or not egg then
		return false
	end
	if #profile.eggs >= 3 then
		-- don't silently eat a purchased egg: refund-equivalent is to hatch it
		-- instantly into the pet list
		self:hatchInto(player, eggId)
		return true
	end
	-- hatch speed from pets/passes shortens the timer at insert time
	local m = app.PlayerService:multipliers(player)
	local duration = egg.hatchTime / math.clamp(m.grow * 0.5 + 0.5, 1, 6)
	table.insert(profile.eggs, { id = eggId, startedAt = os.time(), duration = duration })
	app.PlayerService:sync(player)
	return true
end

--- Roll a pet from an egg's pool and add it to the collection.
function PetService:hatchInto(player: Player, eggId: string)
	local profile = Store.get(player.UserId)
	if not profile then
		return nil
	end
	local pool = Pets.byEgg[eggId]
	if not pool or #pool == 0 then
		return nil
	end

	local m = app.PlayerService:multipliers(player)
	-- luck applies to hatching too, scaled down: pets are a slower economy than
	-- mutations and shouldn't be trivialised by a luck potion
	local luck = 1 + (m.luck - 1) * 0.35
	local entries = {}
	for _, pet in pool do
		local rarity = Rarities.get(pet.rarity)
		table.insert(entries, {
			pet = pet,
			weight = pet.weight,
			luckScale = math.max(0, (rarity.order - 2) * 0.25),
		})
	end
	local chosen = Weighted.pick(entries, luck, rng).pet

	if #profile.pets >= Balance.petStorage then
		-- storage full: auto-sell the worst duplicate for gems instead of
		-- blocking the hatch
		self:autoCull(profile)
	end

	local owned = {
		uid = HttpService:GenerateGUID(false),
		id = chosen.id,
		stars = 0,
		equipped = false,
		hatchedAt = os.time(),
	}
	table.insert(profile.pets, owned)
	profile.stats.hatched += 1
	profile.index[chosen.id] = (profile.index[chosen.id] or 0) + 1

	-- auto-equip if a slot is free, so a new player immediately feels the buff
	local m2 = app.PlayerService:multipliers(player)
	local equippedCount = 0
	for _, p in profile.pets do
		if p.equipped then
			equippedCount += 1
		end
	end
	if equippedCount < m2.petSlots then
		owned.equipped = true
		app.PlayerService:dirty(player)
	end

	app.QuestService:progress(player, "hatch", 1)
	Net:fire(player, "HatchResult", {
		egg = eggId,
		pet = chosen.id,
		uid = owned.uid,
		rarity = chosen.rarity,
	})

	local rarity = Rarities.get(chosen.rarity)
	if rarity.order >= 5 then
		Net:fireAll("Announce", {
			kind = "hatch",
			title = ("🥚 %s chocou %s!"):format(player.DisplayName, chosen.name),
			body = ("Raridade: %s"):format(rarity.name),
			colour = rarity.colour,
		})
	end

	self.onHatch:Fire(player, chosen)
	app.PlayerService:sync(player)
	return chosen
end

--- Remove the least valuable unequipped duplicate, paying out gems.
function PetService:autoCull(profile)
	local counts = {}
	for _, p in profile.pets do
		counts[p.id] = (counts[p.id] or 0) + 1
	end
	local worstIndex, worstOrder = nil, math.huge
	for i, p in profile.pets do
		if not p.equipped and (counts[p.id] or 0) > 1 and p.stars == 0 then
			local pet = Pets.byId[p.id]
			local order = pet and Rarities.get(pet.rarity).order or 1
			if order < worstOrder then
				worstIndex, worstOrder = i, order
			end
		end
	end
	if worstIndex then
		table.remove(profile.pets, worstIndex)
		return true
	end
	return false
end

function PetService:hatch(player: Player, index: number): (boolean, string?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false, "Perfil não carregado"
	end
	local slot = profile.eggs[index]
	if not slot then
		return false, "Ovo não encontrado"
	end
	if os.time() < slot.startedAt + slot.duration then
		local left = (slot.startedAt + slot.duration) - os.time()
		return false, ("Ainda chocando — faltam %s"):format(Format.time(left))
	end
	table.remove(profile.eggs, index)
	self:hatchInto(player, slot.id)
	return true
end

function PetService:equip(player: Player, uid: string): (boolean, string?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false
	end
	local m = app.PlayerService:multipliers(player)
	local target, equipped = nil, 0
	for _, p in profile.pets do
		if p.equipped then
			equipped += 1
		end
		if p.uid == uid then
			target = p
		end
	end
	if not target then
		return false, "Pet não encontrado"
	end
	if target.equipped then
		return false
	end
	if equipped >= m.petSlots then
		return false, ("Você só pode equipar %d pets (compre +2 slots na loja VIP)"):format(m.petSlots)
	end
	target.equipped = true
	app.PlayerService:dirty(player)
	app.PlayerService:sync(player)
	Net:fire(player, "PetsUpdate", { pets = profile.pets })
	return true
end

function PetService:unequip(player: Player, uid: string): boolean
	local profile = Store.get(player.UserId)
	if not profile then
		return false
	end
	for _, p in profile.pets do
		if p.uid == uid and p.equipped then
			p.equipped = false
			app.PlayerService:dirty(player)
			app.PlayerService:sync(player)
			Net:fire(player, "PetsUpdate", { pets = profile.pets })
			return true
		end
	end
	return false
end

--- Fuse N duplicates of the same pet at the same star level into one star up.
function PetService:fuse(player: Player, uid: string): (boolean, string?)
	local profile = Store.get(player.UserId)
	if not profile then
		return false
	end
	local base = nil
	for _, p in profile.pets do
		if p.uid == uid then
			base = p
			break
		end
	end
	if not base then
		return false, "Pet não encontrado"
	end
	if base.stars >= Pets.maxStars then
		return false, "Esse pet já está no nível máximo de estrelas"
	end

	local fodder = {}
	for i = #profile.pets, 1, -1 do
		local p = profile.pets[i]
		if p.uid ~= uid and p.id == base.id and p.stars == base.stars and not p.equipped then
			table.insert(fodder, i)
			if #fodder >= Balance.fuseCount - 1 then
				break
			end
		end
	end
	if #fodder < Balance.fuseCount - 1 then
		return false, ("Precisa de %d cópias iguais (você tem %d)"):format(Balance.fuseCount, #fodder + 1)
	end

	table.sort(fodder, function(a, b)
		return a > b
	end)
	for _, i in fodder do
		table.remove(profile.pets, i)
	end
	base.stars += 1
	app.PlayerService:dirty(player)

	local pet = Pets.byId[base.id]
	Net:fire(player, "Toast", {
		kind = "success",
		title = ("%s agora tem %d ⭐"):format(pet and pet.name or base.id, base.stars),
		body = ("Status multiplicados por %s"):format(Format.multiplier(Pets.starMultiplier(base.stars))),
	})
	app.PlayerService:sync(player)
	Net:fire(player, "PetsUpdate", { pets = profile.pets })
	return true
end

function PetService:delete(player: Player, uid: string): boolean
	local profile = Store.get(player.UserId)
	if not profile then
		return false
	end
	for i, p in profile.pets do
		if p.uid == uid then
			if p.equipped then
				return false
			end
			local pet = Pets.byId[p.id]
			local order = pet and Rarities.get(pet.rarity).order or 1
			-- deleting pays a small gem amount so the button is never a pure loss
			local gems = math.floor(5 * order ^ 1.8 * (1 + p.stars))
			table.remove(profile.pets, i)
			app.PlayerService:addGems(player, gems, "petdelete")
			app.PlayerService:dirty(player)
			app.PlayerService:sync(player)
			Net:fire(player, "PetsUpdate", { pets = profile.pets })
			return true
		end
	end
	return false
end

function PetService:start()
	Net:on("HatchEgg", function(player, index)
		if type(index) ~= "number" then
			return
		end
		local ok, err = self:hatch(player, math.floor(index))
		if not ok and err then
			Net:fire(player, "Toast", { kind = "error", title = err })
		end
	end)

	Net:on("EquipPet", function(player, uid)
		if type(uid) ~= "string" then
			return
		end
		local ok, err = self:equip(player, uid)
		if not ok and err then
			Net:fire(player, "Toast", { kind = "error", title = err })
		end
	end)

	Net:on("UnequipPet", function(player, uid)
		if type(uid) == "string" then
			self:unequip(player, uid)
		end
	end)

	Net:on("FusePets", function(player, uid)
		if type(uid) ~= "string" then
			return
		end
		local ok, err = self:fuse(player, uid)
		if not ok and err then
			Net:fire(player, "Toast", { kind = "error", title = err })
		end
	end)

	Net:on("DeletePet", function(player, uid)
		if type(uid) == "string" then
			self:delete(player, uid)
		end
	end)
end

return PetService
