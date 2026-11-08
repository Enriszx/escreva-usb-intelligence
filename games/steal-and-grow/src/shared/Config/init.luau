--!strict
-- Single entry point: `local Config = require(Shared.Config)`
local m = script

return {
	Balance = require(m.Balance),
	Theme = require(m.Theme),
	Rarities = require(m.Rarities),
	Mutations = require(m.Mutations),
	Seeds = require(m.Seeds),
	Pets = require(m.Pets),
	Eggs = require(m.Eggs),
	Upgrades = require(m.Upgrades),
	Passes = require(m.Passes),
	Products = require(m.Products),
	Quests = require(m.Quests),
	Events = require(m.Events),
	Codes = require(m.Codes),
	Ranks = require(m.Ranks),
}
