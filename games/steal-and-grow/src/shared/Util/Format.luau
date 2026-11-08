--!strict
-- Number and time formatting. A simulator lives or dies on whether "1.2aa" is
-- readable, so this gets its own tested module.

local SUFFIXES = {
	"",
	"K",
	"M",
	"B",
	"T",
	"Qa",
	"Qi",
	"Sx",
	"Sp",
	"Oc",
	"No",
	"Dc",
	"Ud",
	"Dd",
	"Td",
	"Qad",
	"Qid",
	"Sxd",
	"Spd",
	"Ocd",
	"Nod",
	"Vg",
	"Uvg",
	"Dvg",
	"Tvg",
	"Qavg",
	"Qivg",
	"Sxvg",
	"Spvg",
	"Ocvg",
	"Novg",
	"Tg",
}

local Format = {}

--- 1234567 -> "1.23M". Keeps 3 significant digits, which reads best on phones.
function Format.short(n: number?): string
	n = n or 0
	if n ~= n or n == math.huge then
		return "∞"
	end
	local neg = n < 0
	n = math.abs(n)
	if n < 1000 then
		local s = if n == math.floor(n) then tostring(math.floor(n)) else string.format("%.1f", n)
		return (neg and "-" or "") .. s
	end
	local tier = math.floor(math.log(n, 1000))
	tier = math.clamp(tier, 1, #SUFFIXES - 1)
	local scaled = n / (1000 ^ tier)
	local str
	if scaled >= 100 then
		str = string.format("%.0f", scaled)
	elseif scaled >= 10 then
		str = string.format("%.1f", scaled)
	else
		str = string.format("%.2f", scaled)
	end
	-- trim trailing zeros: "1.20M" -> "1.2M"
	str = str:gsub("%.?0+$", "")
	return (neg and "-" or "") .. str .. SUFFIXES[tier + 1]
end

--- 1234567 -> "1.234.567" (pt-BR grouping) for exact displays like totals.
function Format.comma(n: number): string
	local s = tostring(math.floor(math.abs(n)))
	local out = s:reverse():gsub("(%d%d%d)", "%1."):reverse()
	out = out:gsub("^%.", "")
	return (n < 0 and "-" or "") .. out
end

--- 95 -> "1m 35s", 7400 -> "2h 3m"
function Format.time(seconds: number?): string
	seconds = math.max(0, math.floor(seconds or 0))
	if seconds < 60 then
		return seconds .. "s"
	end
	if seconds < 3600 then
		return ("%dm %ds"):format(seconds // 60, seconds % 60)
	end
	if seconds < 86400 then
		return ("%dh %dm"):format(seconds // 3600, (seconds % 3600) // 60)
	end
	return ("%dd %dh"):format(seconds // 86400, (seconds % 86400) // 3600)
end

--- Compact clock for progress pills: "01:35"
function Format.clock(seconds: number): string
	seconds = math.max(0, math.floor(seconds))
	if seconds >= 3600 then
		return ("%d:%02d:%02d"):format(seconds // 3600, (seconds % 3600) // 60, seconds % 60)
	end
	return ("%02d:%02d"):format(seconds // 60, seconds % 60)
end

function Format.multiplier(m: number): string
	if m >= 100 then
		return "x" .. Format.short(m)
	end
	local s = string.format("%.2f", m):gsub("%.?0+$", "")
	return "x" .. s
end

function Format.percent(p: number, decimals: number?): string
	return string.format("%." .. (decimals or 0) .. "f%%", p * 100)
end

--- "1 in 4.2K" — reads far better than "0.0238%" for a drop rate.
function Format.odds(chance: number): string
	if chance <= 0 then
		return "—"
	end
	if chance >= 1 then
		return "garantido"
	end
	return "1 em " .. Format.short(math.floor(1 / chance + 0.5))
end

function Format.robux(n: number): string
	return "R$ " .. Format.comma(n)
end

return Format
