--!nonstrict
-- Admin console. Essential for live-ops: you will need to compensate a player,
-- force an event for a YouTuber, or test a drop rate without rebuilding.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local Store = require(script.Parent.Parent.Data.Store)

local Balance = Config.Balance

local AdminService = { name = "AdminService", priority = 14 }
local app

function AdminService:init(a)
	app = a
end

function AdminService:isAdmin(player: Player): boolean
	if RunService:IsStudio() then
		return true
	end
	if game.CreatorType == Enum.CreatorType.User and player.UserId == game.CreatorId then
		return true
	end
	if game.CreatorType == Enum.CreatorType.Group then
		local ok, rank = pcall(function()
			return player:GetRankInGroup(game.CreatorId)
		end)
		if ok and rank >= 200 then
			return true
		end
	end
	return table.find(Balance.admins, player.UserId) ~= nil
end

local function resolve(name: string): Player?
	if not name or name == "" then
		return nil
	end
	local lower = name:lower()
	for _, p in Players:GetPlayers() do
		if p.Name:lower():sub(1, #lower) == lower or p.DisplayName:lower():sub(1, #lower) == lower then
			return p
		end
	end
	return nil
end

local COMMANDS = {}

COMMANDS.help = function(_player)
	local names = {}
	for key in COMMANDS do
		table.insert(names, key)
	end
	table.sort(names)
	return "Comandos: " .. table.concat(names, ", ")
end

COMMANDS.coins = function(player, args)
	local target = resolve(args[1] or "") or player
	local amount = tonumber(args[2]) or 0
	app.PlayerService:addCoins(target, amount, "admin")
	return ("%s moedas para %s"):format(Format.short(amount), target.DisplayName)
end

COMMANDS.gems = function(player, args)
	local target = resolve(args[1] or "") or player
	local amount = tonumber(args[2]) or 0
	app.PlayerService:addGems(target, amount, "admin")
	return ("%s gemas para %s"):format(Format.short(amount), target.DisplayName)
end

COMMANDS.seed = function(player, args)
	local target = resolve(args[1] or "") or player
	local seedId = args[2]
	local count = tonumber(args[3]) or 1
	if not Config.Seeds.byId[seedId] then
		return "Semente desconhecida: " .. tostring(seedId)
	end
	local profile = Store.get(target.UserId)
	profile.seeds[seedId] = (profile.seeds[seedId] or 0) + count
	app.PlayerService:sync(target)
	return ("%dx %s para %s"):format(count, seedId, target.DisplayName)
end

COMMANDS.egg = function(player, args)
	local target = resolve(args[1] or "") or player
	local eggId = args[2] or "basic"
	if not Config.Eggs.byId[eggId] then
		return "Ovo desconhecido"
	end
	app.PetService:giveEgg(target, eggId)
	return "Ovo entregue"
end

COMMANDS.pet = function(player, args)
	local target = resolve(args[1] or "") or player
	local petId = args[2]
	local pet = Config.Pets.byId[petId]
	if not pet then
		return "Pet desconhecido"
	end
	local profile = Store.get(target.UserId)
	table.insert(profile.pets, {
		uid = game:GetService("HttpService"):GenerateGUID(false),
		id = petId,
		stars = tonumber(args[3]) or 0,
		equipped = false,
		hatchedAt = os.time(),
	})
	app.PlayerService:sync(target)
	return "Pet entregue"
end

COMMANDS.event = function(_player, args)
	local key = args[1]
	if not key or not Config.Events.byKey[key] then
		local keys = {}
		for k in Config.Events.byKey do
			table.insert(keys, k)
		end
		return "Eventos: " .. table.concat(keys, ", ")
	end
	app.EventService:startEvent(key, tonumber(args[2]))
	return "Evento iniciado: " .. key
end

COMMANDS.endevent = function()
	app.EventService:endEvent()
	return "Evento encerrado"
end

COMMANDS.restock = function()
	app.ShopService:restock(true)
	return "Loja renovada"
end

COMMANDS.rebirth = function(player, args)
	local target = resolve(args[1] or "") or player
	local times = tonumber(args[2]) or 1
	for _ = 1, times do
		app.RebirthService:rebirth(target, true)
	end
	return ("%d renascimentos"):format(times)
end

COMMANDS.grow = function(player, args)
	local target = resolve(args[1] or "") or player
	local n = app.GrowthService:instantGrowAll(target)
	return ("%d plantas prontas"):format(n)
end

COMMANDS.boost = function(player, args)
	local target = resolve(args[1] or "") or player
	local stat = args[2] or "coinMult"
	local value = tonumber(args[3]) or 2
	local seconds = tonumber(args[4]) or 600
	app.PlayerService:addBoost(target, stat, value, seconds, "admin")
	return ("Boost %s %s por %s"):format(stat, Format.multiplier(value), Format.time(seconds))
end

COMMANDS.tiles = function(player, args)
	local target = resolve(args[1] or "") or player
	local count = tonumber(args[2]) or Balance.maxTiles
	local profile = Store.get(target.UserId)
	profile.tileCount = math.clamp(count, 1, Balance.maxTiles)
	app.PlotService:rebuildTiles(target)
	app.PlayerService:sync(target)
	return "Canteiros: " .. profile.tileCount
end

COMMANDS.reset = function(_player, args)
	local target = resolve(args[1] or "")
	if not target then
		return "Especifique o jogador (isso apaga tudo dele)"
	end
	local profile = Store.get(target.UserId)
	local template = require(script.Parent.Parent.Data.Template)
	for k, v in require(Shared.Util.TableUtil).deepCopy(template) do
		profile[k] = v
	end
	profile.created = os.time()
	profile.firstJoin = os.time()
	app.PlayerService:dirty(target)
	app.PlayerService:sync(target)
	return "Perfil de " .. target.DisplayName .. " resetado"
end

COMMANDS.save = function(player, args)
	local target = resolve(args[1] or "") or player
	local ok = Store.save(target.UserId)
	return ok and "Salvo" or "Falha ao salvar"
end

COMMANDS.stats = function(player, args)
	local target = resolve(args[1] or "") or player
	local profile = Store.get(target.UserId)
	local m = app.PlayerService:multipliers(target)
	return ("%s — moedas %s, gemas %s, rb %d, x%.2f moedas, x%.2f cresc, sorte %.1f, canteiros %d"):format(
		target.DisplayName,
		Format.short(profile.coins),
		Format.short(profile.gems),
		profile.rebirths,
		m.coin,
		m.grow,
		m.luck,
		m.tiles
	)
end

COMMANDS.announce = function(_player, args)
	local message = table.concat(args, " ")
	if message == "" then
		return "Escreva a mensagem"
	end
	Net:fireAll("Announce", {
		kind = "admin",
		title = "📣 " .. message,
		colour = Config.Theme.warn,
		duration = 10,
	})
	return "Anunciado"
end

function AdminService:start()
	Net:on("AdminCommand", function(player, raw)
		if not self:isAdmin(player) or type(raw) ~= "string" then
			return
		end
		local parts = {}
		for word in raw:gmatch("%S+") do
			table.insert(parts, word)
		end
		local cmd = table.remove(parts, 1)
		if not cmd then
			return
		end
		local handler = COMMANDS[cmd:lower()]
		if not handler then
			Net:fire(player, "Toast", { kind = "error", title = "Comando desconhecido: " .. cmd })
			return
		end
		local ok, result = pcall(handler, player, parts)
		Net:fire(player, "Toast", {
			kind = ok and "success" or "error",
			title = ok and tostring(result) or ("Erro: " .. tostring(result)),
			duration = 6,
		})
	end)
end

return AdminService
