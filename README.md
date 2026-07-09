# Tilt Battle Royale

Oregon Trail-inspired battle royale for Discord. Players join a wagon lobby with `/royale`; the bot runs the simulation and posts daily embeds in the channel.

> Parody work — not affiliated with The Oregon Trail or its rights holders.

## How to play

1. Run `/royale` in a channel (optional: set lobby wait time in seconds)
2. Click **Join the Wagon** (up to 20 players)
3. Wait for the countdown — or the host clicks **Depart Early**
4. Follow daily trail updates in the channel until one pioneer wins

No external app or Activity required — everything happens in Discord.

## Quick start (local)

```bash
cd bot
cp .env.example .env
# Edit .env with your Discord credentials
npm install
npm run deploy   # register /royale in your guild
npm start
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_BOT_TOKEN` | yes | Bot token |
| `DISCORD_CLIENT_ID` | yes | Application ID |
| `DISCORD_GUILD_ID` | yes | Guild for slash command deploy |
| `PORT` | no | HTTP port for health check (default 8080) |
| `BOT_USERNAME` | no | Bot display username |

## Discord Developer Portal checklist

1. Create application → Bot → enable **Message Content** if needed
2. Install bot to server with `applications.commands` scope
3. Run `npm run deploy` from `bot/` for each guild that should have `/royale`

## Deployment (Fly.io)

- Root directory: `bot`
- Start command: `npm start`
- Set env vars from `.env.example`
- Health check: `GET /api/health`

## Security

- Never commit `bot/.env`
- Rotate bot token if it was ever exposed

## License

All rights reserved unless you add an open-source license.
