# Tilt Battle Royale

Oregon Trail-inspired battle royale for Discord. Players join a wagon lobby with `/royale`; the bot runs the simulation and posts daily embeds. The CRT web UI is a **live spectator** that mirrors the bot via WebSocket.

> Parody work — not affiliated with The Oregon Trail or its rights holders.

## Architecture

```
Discord (/royale) → bot.js (simulation + embeds)
                         ↓ WebSocket (channel-scoped)
                   app.js (CRT spectator on Netlify)
```

## Quick start (local)

### 1. Bot

```bash
cd bot
cp .env.example .env
# Edit .env with your Discord credentials
npm install
npm run deploy   # register /royale in your test guild
npm start
```

### 2. Spectator UI

Edit [`config.js`](config.js) at the repo root:

```js
window.APP_CONFIG = {
    WS_URL: 'ws://localhost:8080',
    API_URL: 'http://localhost:8080',
    DISCORD_CLIENT_ID: 'your_app_id',
};
```

Serve the root folder (any static server), e.g.:

```bash
npx serve .
```

Open `http://localhost:3000/?channelId=YOUR_CHANNEL_ID` after starting `/royale` in that channel.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_BOT_TOKEN` | yes | Bot token |
| `DISCORD_CLIENT_ID` | yes | Application ID |
| `DISCORD_GUILD_ID` | yes | Guild for slash command deploy |
| `DISCORD_CLIENT_SECRET` | for Activity OAuth | OAuth2 client secret |
| `PORT` | no | HTTP + WebSocket port (default 8080) |
| `ACTIVITY_URL` | no | Netlify URL for "Open Retro View" button |
| `WS_PUBLIC_URL` | no | Documented public `wss://` URL for frontend |

## Discord Developer Portal checklist

1. Create application → Bot → enable **Message Content** if needed, **Server Members** not required
2. OAuth2 → add redirect URL for your Activity / static site
3. Activities → set Activity URL to your Netlify deploy
4. Install bot to server with `applications.commands` scope
5. Run `npm run deploy` from `bot/`

## Deployment

### Static UI (Netlify)

Deploy the repo root. Set `config.js` (or a build step) with production `WS_URL` (`wss://your-bot-host`) and `API_URL` (`https://your-bot-host`).

### Bot (Railway / Render / Fly)

- Root directory: `bot`
- Start command: `npm start`
- Set all env vars from `.env.example`
- Platform sets `PORT`; WebSocket shares the same HTTP server

Health check: `GET /api/health`

## Security

- Never commit `bot/.env`
- Rotate bot token if it was ever exposed
- `DISCORD_CLIENT_SECRET` stays on the server only

## License

All rights reserved unless you add an open-source license.
