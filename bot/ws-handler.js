/**
 * Channel-scoped WebSocket handler for Tiltcheck Royale spectators.
 */

const { WebSocketServer } = require('ws');

function buildSnapshot(channelId, entry) {
    const { game, lobbySecondsLeft } = entry;
    return {
        type: 'snapshot',
        channelId,
        phase: game.phase,
        party: game.party,
        day: game.day,
        distance: game.distance,
        rations: game.rations,
        weather: game.weather,
        secondsLeft: game.phase === 'lobby' ? lobbySecondsLeft : null,
    };
}

function buildLobbyUpdate(channelId, entry) {
    const { game, lobbySecondsLeft } = entry;
    return {
        type: 'lobby_update',
        channelId,
        party: game.party,
        secondsLeft: lobbySecondsLeft,
        phase: game.phase,
    };
}

function createWsHandler({ getActiveGames }) {
    const subscribers = new Map();

    function addSubscriber(channelId, ws) {
        if (!subscribers.has(channelId)) subscribers.set(channelId, new Set());
        subscribers.get(channelId).add(ws);
        ws.subscribedChannelId = channelId;
    }

    function removeSubscriber(ws) {
        const channelId = ws.subscribedChannelId;
        if (!channelId) return;
        const set = subscribers.get(channelId);
        if (set) {
            set.delete(ws);
            if (set.size === 0) subscribers.delete(channelId);
        }
        ws.subscribedChannelId = null;
    }

    function broadcastToChannel(channelId, payload) {
        const set = subscribers.get(channelId);
        if (!set || set.size === 0) return;
        const msg = JSON.stringify({ ...payload, channelId });
        for (const ws of set) {
            if (ws.readyState === 1) ws.send(msg);
        }
    }

    function attach(server) {
        const wss = new WebSocketServer({ server });

        wss.on('connection', (ws) => {
            ws.on('message', (raw) => {
                let data;
                try {
                    data = JSON.parse(raw.toString());
                } catch {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
                    return;
                }

                if (data.type !== 'subscribe' || !data.channelId) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Send { type: "subscribe", channelId: "..." }' }));
                    return;
                }

                const channelId = String(data.channelId);
                const entry = getActiveGames().get(channelId);

                removeSubscriber(ws);
                addSubscriber(channelId, ws);

                if (entry) {
                    ws.send(JSON.stringify(buildSnapshot(channelId, entry)));
                } else {
                    ws.send(JSON.stringify({
                        type: 'waiting',
                        channelId,
                        message: 'No active game in this channel. Start one with /royale.',
                    }));
                }
            });

            ws.on('close', () => removeSubscriber(ws));
        });

        return wss;
    }

    return { attach, broadcastToChannel, buildLobbyUpdate, buildSnapshot };
}

module.exports = { createWsHandler, buildSnapshot, buildLobbyUpdate };
