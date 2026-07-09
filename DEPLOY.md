# Deploy: Fly.io (Discord bot)

## Prerequisites

1. Account: https://fly.io/app/sign-up
2. Install CLI — add `C:\Users\YOUR_USER\.fly\bin` to PATH
3. Login: `flyctl auth login`

## Deploy

```powershell
cd bot
flyctl deploy
```

Set secrets (from your `bot/.env`):

```powershell
flyctl secrets set -a tilt-battle-royale DISCORD_BOT_TOKEN="..." DISCORD_CLIENT_ID="..." BOT_USERNAME="tilt-battle-royale"
```

Health check: https://tilt-battle-royale.fly.dev/api/health

Register `/royale` once from your machine (works in every server the bot is invited to):

```powershell
npm run deploy
```

## Notes

- Keep `min_machines_running = 1` so the bot stays online
- Run **one** bot instance only (same token)
- Gameplay is Discord-only — no Netlify or Activity required
