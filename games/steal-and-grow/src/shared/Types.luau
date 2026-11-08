--!strict
-- Shared data shapes. The client receives exactly these, which keeps the
-- replication contract obvious and makes the UI code type-checkable.

export type Plant = {
	seed: string,
	plantedAt: number,   -- os.time()
	duration: number,    -- effective seconds to ripen, already multiplied
	element: string?,    -- rolled at ripen time
	aura: string?,
	size: number?,
	giant: boolean?,
	ripeAt: number?,     -- resolved completion stamp
	stolen: boolean?,
	plantedBy: number?,  -- for autoplant attribution / analytics
}

export type Tile = {
	index: number,
	plant: Plant?,
	locked: boolean,
}

export type Crop = {
	seed: string,
	element: string?,
	aura: string?,
	size: number,
	giant: boolean?,
	value: number,       -- resolved at harvest, server-authoritative
	at: number,
}

export type OwnedPet = {
	uid: string,
	id: string,
	stars: number,
	equipped: boolean,
	nickname: string?,
	hatchedAt: number,
}

export type EggSlot = {
	id: string,
	startedAt: number,
	duration: number,
}

export type Boost = {
	stat: string,
	value: number,
	expires: number,
	source: string?,
}

export type QuestState = {
	key: string,
	goal: number,
	progress: number,
	claimed: boolean,
	weekly: boolean?,
}

export type Profile = {
	-- identity
	version: number,
	created: number,
	lastSeen: number,
	playtime: number,

	-- currency
	coins: number,
	gems: number,
	rebirths: number,
	xp: number,
	level: number,

	-- farm
	tiles: { [number]: Plant? },
	tileCount: number,
	inventory: { Crop },
	seeds: { [string]: number },

	-- collection
	pets: { OwnedPet },
	eggs: { EggSlot },
	index: { [string]: number }, -- seedId/petId -> times obtained
	indexClaimed: { [string]: boolean },

	-- progression
	upgrades: { [string]: number },
	boosts: { Boost },
	quests: { QuestState },
	questRolledAt: number,
	daily: { streak: number, lastClaim: number },
	codes: { [string]: boolean },
	productsBought: { [string]: number },

	-- social / pvp
	stats: {
		harvested: number,
		sold: number,
		stolen: number,       -- plants you stole
		robbed: number,       -- plants taken from you
		blocked: number,
		hatched: number,
		mutations: number,
		bestCrop: number,
		totalEarned: number,
		visits: number,
	},
	lastRobbedBy: number?,
	lastRobbedAt: number?,

	-- prefs
	settings: {
		music: boolean,
		sfx: boolean,
		quality: string?,   -- nil = auto
		alarms: boolean,
		announcements: boolean,
		joystickSide: string,
	},

	-- flags
	tutorialStep: number,
	firstJoin: number,
	bannedUntil: number?,
}

export type PlotSnapshot = {
	owner: number,
	ownerName: string,
	online: boolean,
	tileCount: number,
	tiles: { [number]: Plant? },
	defense: number,
	shielded: boolean,
	protectedUntil: number?,
	rank: string,
}

export type Multipliers = {
	coin: number,
	grow: number,
	luck: number,
	defense: number,
	stealSpeed: number,
	offlineHours: number,
	tiles: number,
	storage: number,
	petSlots: number,
	stealSlots: number,
}

return {}
