--!nonstrict
-- Four boards: this server (live), rebirths, total earned, biggest thieves.
-- The server board doubles as the "visit a farm" screen, which is how most
-- stealing actually starts.

local Players = game:GetService("Players")
local Shared = game:GetService("ReplicatedStorage").Shared
local Config = require(Shared.Config)
local Net = require(Shared.Util.Net)
local Format = require(Shared.Util.Format)
local State = require(script.Parent.Parent.Parent.State)
local B = require(script.Parent.Parent.Builder)
local C = require(script.Parent.Parent.Components)

local Theme = Config.Theme
local Panel = {}

local MEDALS = { "🥇", "🥈", "🥉" }

function Panel.build(parent, app)
	local panel = C.panel({
		parent = parent,
		name = "Leaderboard",
		title = "RANKING",
		icon = "🏆",
		tint = Color3.fromRGB(140, 110, 10),
	})
	local api = { panel = panel, mode = 1, data = nil }

	local tabsHolder = B.new("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = panel.body })
	local content = B.new("Frame", {
		Size = UDim2.new(1, 0, 1, -50),
		Position = UDim2.fromOffset(0, 50),
		BackgroundTransparency = 1,
		Parent = panel.body,
	})
	local list = B.scroll({ parent = content, gap = 5 })

	local KEYS = { "server", "rebirths", "earned", "stolen" }
	local _, select = C.tabs(tabsHolder, { "Servidor", "Renascimentos", "Riqueza", "Ladrões" }, function(index)
		api.mode = index
		api.fetch()
	end)

	local function row(entry, order, mode)
		local isMe = entry.userId == Players.LocalPlayer.UserId
		local card = B.card({
			parent = list,
			size = UDim2.new(1, 0, 0, 52),
			colour = isMe and Theme.panel or Theme.panelAlt,
			strokeColour = isMe and Theme.primary or Theme.stroke,
			strokeTransparency = isMe and 0 or 0.5,
			order = order,
			pad = 8,
		})
		B.label(MEDALS[order] or ("#" .. order), {
			Parent = card, Size = UDim2.fromOffset(44, 36), TextSize = order <= 3 and 24 or Theme.small,
			Font = Theme.fontBlack, TextXAlignment = Enum.TextXAlignment.Center,
			TextColor3 = order <= 3 and Theme.coins or Theme.textDim,
		})
		B.label(entry.name or "Jogador", {
			Parent = card, Size = UDim2.new(1, -230, 0, 20), Position = UDim2.fromOffset(48, 0),
			Font = Theme.fontBlack, TextSize = Theme.small,
			TextColor3 = isMe and Theme.primary or Theme.text,
		})

		local detail
		if mode == "server" then
			detail = ("♻️ %d  •  💰 %s  •  🥷 %s"):format(
				entry.rebirths or 0, Format.short(entry.coins or 0), Format.short(entry.stolen or 0)
			)
		elseif mode == "rebirths" then
			detail = ("♻️ %s renascimentos"):format(Format.short(entry.value or 0))
		elseif mode == "earned" then
			detail = ("💰 %s ganhas"):format(Format.short(entry.value or 0))
		else
			detail = ("🥷 %s plantas roubadas"):format(Format.short(entry.value or 0))
		end
		B.label(detail, {
			Parent = card, Size = UDim2.new(1, -230, 0, 16), Position = UDim2.fromOffset(48, 19),
			TextSize = Theme.tiny, TextColor3 = Theme.textDim, Font = Theme.fontBody,
		})

		if mode == "server" and entry.plotId and not isMe then
			B.button({
				parent = card,
				size = UDim2.fromOffset(170, 38),
				position = UDim2.new(1, -170, 0, 0),
				colour = Theme.steal,
				icon = "🥷",
				text = "VISITAR FAZENDA",
				textSize = Theme.tiny,
				height = 38,
				onClick = function()
					Net:send("VisitPlot", entry.plotId)
					panel.close()
				end,
			})
		end
	end

	function api.fetch()
		for _, child in list:GetChildren() do
			if child:IsA("Frame") then
				child:Destroy()
			end
		end
		C.empty(list, "⏳", "Carregando ranking...")
		task.spawn(function()
			local key = KEYS[api.mode]
			local board = Net:request("GetLeaderboard", key)
			if not panel.isOpen then
				return
			end
			for _, child in list:GetChildren() do
				if child:IsA("Frame") then
					child:Destroy()
				end
			end
			if not board or not board.entries or #board.entries == 0 then
				C.empty(list, "🏆", "Nenhum dado ainda.\nO ranking global atualiza a cada poucos minutos.")
				return
			end
			panel.setSubtitle(board.name or "")
			for order, entry in board.entries do
				row(entry, order, key)
			end
		end)
	end

	function api.refresh()
		api.fetch()
	end

	return api
end

return Panel
