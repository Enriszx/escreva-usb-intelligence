--!strict
-- Every tuning knob that is not content. Living here means you can rebalance
-- the entire game from one file without touching a service.

return {
	-- Identity -----------------------------------------------------------
	gameName = "STEAL & GROW: Império Mutante",
	version = "1.0.0",

	-- Starting state -----------------------------------------------------
	startCoins = 150,
	startGems = 50,
	startTiles = 6,
	maxTiles = 48,
	startStorage = 40,
	maxStorage = 600,

	-- Plots --------------------------------------------------------------
	plotCount = 12, -- players per server with a farm
	plotSize = 96, -- studs, square
	plotSpacing = 24,
	tileSize = 8,
	tilesPerRow = 8,

	-- Growth -------------------------------------------------------------
	-- The server never runs a loop per plant. It stores plantedAt + duration
	-- and resolves state on demand; a 1 Hz sweep only handles completions.
	growthTickRate = 1,
	-- Plants keep growing while you are offline, capped:
	offlineHoursBase = 4,
	-- A plant left ripe decays in value after this many seconds (anti-hoarding,
	-- and it is what makes stealing matter: ripe crops are exposed).
	ripeDecayStart = 3600,
	ripeDecayFloor = 0.35, -- never below 35% of value
	ripeDecayPerHour = 0.12,

	-- Value math ---------------------------------------------------------
	sizeMin = 0.75,
	sizeMax = 1.45,
	-- chance of a "giant" crop: size 1.8..3.2, announced in chat
	giantChance = 0.012,
	giantMin = 1.8,
	giantMax = 3.2,
	rebirthValueBonus = 0.3, -- +30% sell value per rebirth, additive

	-- Luck ---------------------------------------------------------------
	-- Luck shifts the weighted mutation roll: weight' = weight * (luck ^ luckScale)
	baseLuck = 1,
	maxLuck = 500,

	-- Stealing -----------------------------------------------------------
	stealBaseTime = 4.5, -- seconds to channel, before rarity/pass multipliers
	stealMaxTimeCap = 45,
	stealCooldown = 25, -- per thief, per victim
	stealGlobalCooldown = 6, -- per thief, any victim
	stealRange = 14,
	stealMoveTolerance = 7, -- studs the thief may drift before the channel breaks
	stealSlots = 1, -- simultaneous channels, +passes
	stealValueCut = 0.75, -- thief gets 75% of the crop's value
	stealProtectionAfterJoin = 120, -- new players are untouchable for 2 min
	stealOfflineOwnerAllowed = true,
	-- an offline owner's farm yields less, so farming AFK players isn't optimal
	stealOfflinePenalty = 0.5,
	revengeWindow = 900,

	-- Rebirth ------------------------------------------------------------
	-- cost = rebirthBase * rebirthGrowth ^ rebirths
	--
	-- The growth rate is NOT free to choose: coins are clamped at 9e15 (2^53,
	-- the last integer-exact double), so the whole ladder has to fit under it.
	-- 250k * 2.2^30 = 4.7e15 puts the final rebirth comfortably inside that
	-- budget. maxRebirths is the declared endgame; past it the infinite content
	-- is the collection index, 5-star pets and the global leaderboards.
	rebirthBase = 250000,
	rebirthGrowth = 2.2,
	maxRebirths = 30,
	rebirthKeepPets = true,
	rebirthKeepUpgrades = { "storage", "lanterns" },
	rebirthGemReward = 100, -- * (rebirths + 1)

	-- Shop ---------------------------------------------------------------
	shopSlots = 6,
	shopRestockSeconds = 300,
	-- how far above the player's affordable tier the shop may offer
	shopTierReach = 1,

	-- Pets ---------------------------------------------------------------
	petSlotsBase = 3,
	petStorage = 120,
	fuseCount = 3,

	-- Progression / XP ---------------------------------------------------
	xpPerLevelBase = 60,
	xpPerLevelGrowth = 1.18,
	maxLevel = 200,

	-- Daily --------------------------------------------------------------
	dailyRewards = {
		{ gems = 50 }, { minutes = 15 }, { gems = 120 }, { egg = "rare" },
		{ minutes = 60 }, { gems = 300 }, { egg = "legendary", gems = 500 },
	},
	dailyResetHour = 0, -- UTC

	-- Anti-cheat ---------------------------------------------------------
	remoteBudget = { -- calls per 10s window, per player, per remote
		default = 25,
		Plant = 40,
		Harvest = 60,
		Sell = 20,
		BuySeed = 40,
		StealStart = 12,
		Trade = 10,
		RedeemCode = 4,
		Rebirth = 3,
	},
	maxTeleportSpeed = 180, -- studs/s before a position reset
	suspicionKickThreshold = 12,

	-- Saving -------------------------------------------------------------
	autosaveSeconds = 120,
	saveRetries = 5,
	sessionLockStale = 1800,

	-- Performance --------------------------------------------------------
	-- Client auto-quality tiers: measured FPS decides which one is applied.
	qualityTiers = {
		{ name = "Potato", minFps = 0, maxPlantDetail = 1, particles = false, shadows = false, atmosphere = false, postfx = false, maxVisiblePlants = 90, drawDistance = 180 },
		{ name = "Low", minFps = 24, maxPlantDetail = 1, particles = false, shadows = false, atmosphere = true, postfx = false, maxVisiblePlants = 160, drawDistance = 260 },
		{ name = "Medium", minFps = 38, maxPlantDetail = 2, particles = true, shadows = false, atmosphere = true, postfx = true, maxVisiblePlants = 280, drawDistance = 360 },
		{ name = "High", minFps = 52, maxPlantDetail = 3, particles = true, shadows = true, atmosphere = true, postfx = true, maxVisiblePlants = 480, drawDistance = 520 },
	},
	fpsSampleWindow = 4,
	qualityRecheck = 20,

	-- Dev ----------------------------------------------------------------
	studioGrantAll = true, -- in Studio, treat every pass as owned
	admins = { 
		-- fill with your own UserId; the owner is resolved automatically too
	} :: { number },
	analyticsEnabled = true,
}
