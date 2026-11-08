--!nonstrict
-- Panel manager.
--
-- Panels are built lazily on first open — that keeps the join-to-playable time
-- low on a phone (you do not pay for the Index screen's 60 cards until you
-- open it) — then cached. Only one panel is open at a time, which on a small
-- screen is the only layout that works.

local Shared = game:GetService("ReplicatedStorage").Shared
local Net = require(Shared.Util.Net)
local State = require(script.Parent.Parent.State)
local PanelController = { name = "PanelController" }

local app
local built = {}
local current = nil
local layer

local FACTORIES = {
	shop = "Shop",
	inventory = "Inventory",
	pets = "Pets",
	upgrades = "Upgrades",
	quests = "Quests",
	rebirth = "Rebirth",
	index = "Index",
	leaderboard = "Leaderboard",
	shopvip = "VipShop",
	settings = "Settings",
	events = "Events",
	trade = "Trade",
}

function PanelController:init(a)
	app = a
end

local function ensure(key: string)
	if built[key] then
		return built[key]
	end
	local moduleName = FACTORIES[key]
	if not moduleName then
		return nil
	end
	local module = script.Parent.Parent.UI.Panels:FindFirstChild(moduleName)
	if not module then
		warn("[PanelController] missing panel module " .. moduleName)
		return nil
	end
	local ok, factory = pcall(require, module)
	if not ok then
		warn(("[PanelController] %s failed to load: %s"):format(moduleName, tostring(factory)))
		return nil
	end
	local okBuild, api = pcall(factory.build, layer, app)
	if not okBuild then
		warn(("[PanelController] %s failed to build: %s"):format(moduleName, tostring(api)))
		return nil
	end
	built[key] = api
	return api
end

function PanelController:open(key: string)
	local api = ensure(key)
	if not api then
		return
	end
	if current and current ~= api then
		current.panel.close()
	end
	current = api
	if api.refresh then
		pcall(api.refresh)
	end
	api.panel.open()
	app.FeedbackController:play("click", 0.2)
end

function PanelController:close()
	if current then
		current.panel.close()
		current = nil
	end
end

function PanelController:toggle(key: string)
	local api = built[key]
	if api and api.panel.isOpen then
		self:close()
		return
	end
	self:open(key)
end

function PanelController:isOpen(key: string): boolean
	local api = built[key]
	return api ~= nil and api.panel.isOpen
end

--- Jump straight into the seed picker for a specific tile.
function PanelController:openPlanting(tileIndex: number)
	local api = ensure("inventory")
	if not api then
		return
	end
	if current and current ~= api then
		current.panel.close()
	end
	current = api
	api.openPlanting(tileIndex)
end

function PanelController:start()
	layer = app.HudController:panelLayer()

	-- refresh whatever is open when the state behind it changes
	State.changed:Connect(function()
		if current and current.refresh and current.panel.isOpen then
			pcall(current.refresh)
		end
	end)
	State.plotChanged:Connect(function()
		if current and current.refresh and current.panel.isOpen then
			-- only the screens that show tiles care
			if current == built.inventory then
				pcall(current.refresh)
			end
		end
	end)

	-- live countdowns inside open panels (shop restock, egg timers, events)
	task.spawn(function()
		while true do
			task.wait(1)
			if current and current.panel.isOpen then
				if current == built.shop or current == built.pets or current == built.events then
					pcall(current.refresh)
				end
			end
		end
	end)

	-- a trade invite must surface even if the player is in another menu
	Net:listen("TradeUpdate", function(payload)
		if payload.state == "invite" or payload.state == "open" then
			self:open("trade")
		elseif payload.state == "closed" and self:isOpen("trade") then
			self:close()
		end
	end)

	-- Escape / B closes the top panel
	local UserInputService = game:GetService("UserInputService")
	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.Escape or input.KeyCode == Enum.KeyCode.ButtonB then
			self:close()
		end
	end)
end

return PanelController
