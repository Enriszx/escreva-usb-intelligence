--!strict
-- Minimal, allocation-light signal. Fires handlers in the order connected and
-- survives a handler erroring (a thrown error in one listener must never stop
-- a plant from finishing growing).

local Signal = {}
Signal.__index = Signal

export type Connection = { Disconnect: (Connection) -> (), Connected: boolean }

function Signal.new()
	return setmetatable({ _handlers = {} }, Signal)
end

function Signal:Connect(fn: (...any) -> ())
	local conn = { Connected = true }
	conn.Disconnect = function()
		if not conn.Connected then
			return
		end
		conn.Connected = false
		local i = table.find(self._handlers, conn)
		if i then
			table.remove(self._handlers, i)
		end
	end
	conn._fn = fn
	table.insert(self._handlers, conn)
	return conn
end

function Signal:Once(fn: (...any) -> ())
	local conn
	conn = self:Connect(function(...)
		conn:Disconnect()
		fn(...)
	end)
	return conn
end

function Signal:Fire(...)
	-- iterate a copy: handlers may disconnect themselves mid-fire
	local snapshot = table.clone(self._handlers)
	for _, conn in snapshot do
		if conn.Connected then
			local ok, err = pcall(conn._fn, ...)
			if not ok then
				warn(("[Signal] handler error: %s"):format(tostring(err)))
			end
		end
	end
end

function Signal:Wait()
	local thread = coroutine.running()
	self:Once(function(...)
		task.spawn(thread, ...)
	end)
	return coroutine.yield()
end

function Signal:Destroy()
	for _, conn in table.clone(self._handlers) do
		conn:Disconnect()
	end
	table.clear(self._handlers)
end

return Signal
