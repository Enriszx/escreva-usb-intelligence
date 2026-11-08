--!strict
-- The profile template. Adding a field here is the whole migration: every
-- existing save gains it (with this default) the next time it loads, via
-- TableUtil.reconcile. Never rename a field — add a new one and migrate in
-- Store.migrate instead.

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Balance = Config.Balance

return {
	version = 3,
	created = 0,
	lastSeen = 0,
	playtime = 0,

	coins = Balance.startCoins,
	gems = Balance.startGems,
	rebirths = 0,
	xp = 0,
	level = 1,

	tiles = {}, -- [tileIndex] = Plant
	tileCount = Balance.startTiles,
	inventory = {},
	seeds = { carrot = 3 }, -- a seeded start: you can plant in the first 5 seconds

	pets = {},
	eggs = {},
	index = {},
	indexClaimed = {},

	upgrades = {},
	boosts = {},
	quests = {},
	questRolledAt = 0,
	daily = { streak = 0, lastClaim = 0 },
	codes = {},
	productsBought = {},

	stats = {
		harvested = 0,
		sold = 0,
		stolen = 0,
		robbed = 0,
		blocked = 0,
		hatched = 0,
		mutations = 0,
		bestCrop = 0,
		totalEarned = 0,
		visits = 0,
	},
	lastRobbedBy = nil,
	lastRobbedAt = nil,

	settings = {
		music = true,
		sfx = true,
		quality = nil,
		alarms = true,
		announcements = true,
		joystickSide = "left",
	},

	tutorialStep = 0,
	firstJoin = 0,
	bannedUntil = nil,
}
