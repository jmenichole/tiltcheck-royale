# Deploy: Netlify (UI) + Fly.io (bot)

Deploy **Fly.io first** so you have the bot URL for Netlify env vars.

## Part 1 — Fly.io (bot + WebSocket + OAuth)

### Prerequisites

1. Account: https://fly.io/app/sign-up
2. Install CLI (PowerShell) — if the official installer fails with a locked `flyctl.zip`, download manually:
   ```powershell
   $flyBin = "$env:USERPROFILE\.fly\bin"
   New-Item -ItemType Directory -Force -Path $flyBin | Out-Null
   curl.exe -L -o "$env:TEMP\flyctl-win.zip" "https://github.com/superfly/flyctl/releases/latest/download/flyctl_0.4.66_Windows_x86_64.zip"
   Expand-Archive -Path "$env:TEMP\flyctl-win.zip" -DestinationPath $flyBin -Force
   ```
   Or use the install script (only one terminal at a time):
   ```powershell
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```
3. Add to PATH (once): `C:\Users\YOUR_USER\.fly\bin` — then use `flyctl` (or `fly.cmd`)
4. Login:
   ```powershell
   flyctl auth login
   ```

### Deploy

```powershell
cd bot
flyctl launch
```

When prompted:

- Use app name `tiltcheck-royale` (or pick another — update `fly.toml` to match)
- **Do not** deploy PostgreSQL/Redis
- **Yes** deploy now (or deploy after secrets)

Set secrets (replace values from your `.env`):

```powershell
flyctlsecrets set DISCORD_BOT_TOKEN="your_token" DISCORD_CLIENT_ID="1507876760686039071" DISCORD_GUILD_ID="your_guild_id" DISCORD_CLIENT_SECRET="your_secret" ACTIVITY_URL="https://YOUR-SITE.netlify.app"
```

Deploy:

```powershell
flyctldeploy
```

Check health:

```powershell
flyctlopen /api/health
```

Your bot URL will be like: `https://tiltcheck-royale.fly.dev`

Re-register slash commands **once** from your machine (guild deploy):

```powershell
# In bot/.env set nothing new; flyctlsecrets are for the server only
npm run deploy
```

> Guild command deploy runs locally against Discord API — your local `.env` is fine for `npm run deploy`.

### Fly free tier notes

- Keep `min_machines_running = 1` so the bot stays online
- 256MB VM fits this bot; watch usage at https://fly.io/dashboard

---

## Part 2 — Netlify (CRT spectator UI)

### Option A — Git (recommended)

1. Push repo to GitHub
2. https://app.netlify.com → **Add new site** → **Import from Git**
3. Build settings (auto-read from `netlify.toml`):
   - Build command: `node scripts/generate-config.js`
   - Publish directory: `.`
4. **Environment variables** (Site settings → Environment variables):

   | Key | Value |
   |-----|--------|
   | `WS_URL` | `wss://tiltcheck-royale.fly.dev` |
   | `API_URL` | `https://tiltcheck-royale.fly.dev` |
   | `DISCORD_CLIENT_ID` | `1507876760686039071` |

5. Deploy site. Note your URL, e.g. `https://tiltcheck-royale.netlify.app`

### Option B — Drag and drop

1. Locally, set env vars and generate config:
   ```powershell
   $env:WS_URL="wss://tiltcheck-royale.fly.dev"
   $env:API_URL="https://tiltcheck-royale.fly.dev"
   node scripts/generate-config.js
   ```
2. Zip repo root files (`index.html`, `app.js`, `style.css`, `config.js`, `privacy.html`, `terms.html`, `logo.png`) — **not** `bot/`
3. Netlify → Deploy manually

---

## Part 3 — Wire Discord + Fly together

1. **Fly secret** — update Activity URL after Netlify is live:
   ```powershell
   flyctlsecrets set ACTIVITY_URL="https://YOUR-SITE.netlify.app"
   ```

2. **Discord Developer Portal** → your application:
   - **OAuth2 → Redirects**: add `https://YOUR-SITE.netlify.app`
   - **Activities / URL Mappings**: set Activity URL to `https://YOUR-SITE.netlify.app`
   - **Embedded App** launch URL → same Netlify URL

3. Test:
   - `/royale` in Discord
   - Click **Open Retro View** (should include `?channelId=`)
   - CRT UI should show lobby → live feed

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Spectator says "Cannot reach bot" | Check Netlify `WS_URL` uses `wss://` and Fly app is running (`flyctlstatus`) |
| Open Retro View shows wrong/old UI | Redeploy Netlify after env var changes |
| OAuth 503 | Set `DISCORD_CLIENT_SECRET` on Fly: `flyctlsecrets set DISCORD_CLIENT_SECRET=...` |
| Bot offline | `flyctllogs` — token invalid or machine stopped |
| CORS errors | Bot already sends `Access-Control-Allow-Origin: *` on `/api/auth/discord` |

---

## URLs checklist

After deploy, you should have:

- **UI:** `https://______.netlify.app`
- **Bot:** `https://______.fly.dev`
- **Health:** `https://______.fly.dev/api/health`
- **WebSocket:** `wss://______.fly.dev`
