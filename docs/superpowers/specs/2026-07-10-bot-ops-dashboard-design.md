# Bot Ops Dashboard & Shared Analytics Design

**Date:** 2026-07-10  
**Status:** Approved — v1 simplified to webhook alerts  
**Owner:** jmenichole  
**Pilot bot:** Tilt Battle Royale (`jmenichole/tiltcheck-royale`)

## Summary

Post **high-signal bot events** to a private Discord channel via webhook — your bot-test server. Tilt Battle Royale ships first; copy a tiny `alerts.js` module to DAD and JustTheBuilder later.

**v1:** Discord webhook only (no Supabase, no dashboard UI).  
**v2 (optional later):** Supabase `bot_events` table + read-only admin page if you want history and charts.

---

## Bot inventory (from GitHub audit)

Repos under `jmenichole` scanned 2026-07-10. **In scope** for the shared dashboard:

### Tier 1 — Standalone bots (dedicated Discord applications)

| `bot_id` | Repo | Role | Hosting | Monetization | Notes |
|----------|------|------|---------|--------------|-------|
| `tilt-battle-royale` | [tiltcheck-royale](https://github.com/jmenichole/tiltcheck-royale) | Oregon Trail battle royale | Fly.io (`tilt-battle-royale`) | Trail Pass + Pioneer Supporter SKUs | **v1 pilot** — `bot/analytics.js` lands here first |
| `justthebuilder` | [justthebuilder](https://github.com/jmenichole/justthebuilder) | AI Discord server builder | Fly (per repo) | TBD | `src/bot.js`, discord.js v14 |
| `dad` | [tiltcheck-me](https://github.com/jmenichole/tiltcheck-me) | Degens Against Decency | TBD | TBD | DAD card game bot — separate repo from TiltCheck monorepo |

### Tier 2 — Ecosystem (optional later)

| `bot_id` | Repo | Role | Notes |
|----------|------|------|-------|
| `tiltcheck-discord` | [tiltcheck-monorepo](https://github.com/jmenichole/tiltcheck-monorepo) `apps/discord-bot` | TiltCheck ecosystem bot | TypeScript — suslink, casino, buddy, tipping, trust engines, etc. Private repo. **DAD is not here** — see `tiltcheck-me`. |

### Explicitly out of dashboard scope

| Repo | Reason |
|------|--------|
| `titantreasurebot` | Owner opted out |
| `FreeSpinsChannelBot` | Owner opted out |
| `onboarding-discord-bot` | Owner opted out |
| `tiltcheckmvp` `apps/discord` | Superseded / not prioritized |
| `B.O.T` | BakeOps web — not a Discord bot |
| `trivia.live` `apps/show-runner` | Game engine runner — not a Discord bot |
| `BakeOps` | Web app with chatbot UI, not a Discord bot |

### Future additions

Any new bot copies `alerts.js` and sets `BOT_ALERTS_WEBHOOK_URL` + `ALERTS_BOT_ID`.

---

## Architecture (v1)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ tilt-battle-    │     │ justthebuilder  │     │ dad             │
│ royale          │     │  alerts.js      │     │ (tiltcheck-me)  │
│  alerts.js      │     └────────┬────────┘     └────────┬────────┘
└────────┬────────┘              │                       │
         │         fire-and-forget POST (no await in hot path)
         └──────────────────────┼───────────────────────┘
                                ▼
                    ┌───────────────────────┐
                    │ BOT_ALERTS_WEBHOOK_URL │
                    │ → #bot-alerts channel  │
                    │   (bot test server)    │
                    └───────────────────────┘
```

**Also:** `console.log` JSON lines → Fly logs for debugging. No database in v1.

---

## Alert module (`alerts.js`)

### API

```javascript
const { postAlert } = require('./alerts.js');

postAlert('guild_install', { guildName, guildId });
postAlert('purchase', { userId, skuLabel });
postAlert('game_started', { era, players });
postAlert('error', { context, message });
```

Fire-and-forget — never `await` in slash handlers; never throw on webhook failure.

### Environment variables (per bot)

| Variable | Required | Purpose |
|----------|----------|---------|
| `BOT_ALERTS_WEBHOOK_URL` | yes (prod) | Channel webhook in bot-test server |
| `ALERTS_BOT_ID` | yes | Display name in messages, e.g. `tilt-battle-royale` |
| `ALERTS_ENABLED` | no | Default `true`; set `false` in local dev |

Fly secrets example:

```bash
flyctl secrets set -a tilt-battle-royale \
  BOT_ALERTS_WEBHOOK_URL="https://discord.com/api/webhooks/..." \
  ALERTS_BOT_ID=tilt-battle-royale
```

**Setup (one time):** In your bot-test Discord server → create `#bot-alerts` → Channel Settings → Integrations → Webhooks → New Webhook → copy URL.

---

## Event pipeline (v2 — deferred)

<details>
<summary>Supabase + dashboard (optional later)</summary>

If you outgrow webhook-only, add `bot_events` table and dashboard per original design. `alerts.js` can gain a second sink without changing call sites.
</details>

### Event shape (stdout + future DB)

```json
{
  "bot_id": "tilt-battle-royale",
  "level": "info",
  "event": "game_started",
  "guild_id": "1358552411718942913",
  "user_id": "1153034319271559328",
  "metadata": { "era": "plague-trail", "players": 4 },
  "created_at": "2026-07-10T04:00:00.000Z"
}
```

- `level`: `info` | `warn` | `error`
- `event`: stable snake_case string (see catalog below)
- `metadata`: bot-specific JSON; never store secrets or full PII
- Logging is **async fire-and-forget** — never block gameplay or slash replies

---

## Event catalog

### Universal (all bots)

| Event | Level | Webhook | When |
|-------|-------|---------|------|
| `guild_install` | info | yes | `guildCreate` |
| `guild_remove` | info | no | `guildDelete` |
| `purchase` | info | yes | `entitlementCreate` (Premium Apps) |
| `purchase_revoked` | info | no | entitlement deleted/expired |
| `error` | error | yes | Uncaught handler failures |

### Tilt Battle Royale

| Event | Webhook | Metadata |
|-------|---------|----------|
| `game_lobby_created` | no | era, host_id, bot_players |
| `game_started` | no | era, player_count |
| `game_ended` | no | winner_id, kills, days, era |
| `choice_resolved` | no | type, winner |
| `support_bug` | no | details (truncated 500 chars) |
| `support_suggestion` | no | details (truncated) |

### DAD — Degens Against Decency (`tiltcheck-me`)

| Event | Webhook | Metadata |
|-------|---------|----------|
| `game_lobby_created` | no | host_id, player_count |
| `game_started` | no | player_count, game_type |
| `game_ended` | no | winner_id, rounds |
| `round_submitted` | no | round, submission_count |

### TiltCheck Discord (monorepo — Phase 3, optional)

Tag `metadata.module` (`suslink`, `justthetip`, `casino`, etc.). Reuse universal events; add module-specific events as needed (`tip_sent`, `link_flagged`).

**Not logged in v1:** per-tick sim events, every button click, full message bodies.

**Purchase revenue:** Discord entitlement events do not include dollar amounts. Dashboard shows purchase *counts*; dollar totals remain in Developer Portal Monetization tab per application.

---

## Supabase schema (v2 — deferred)

```sql
-- Optional later; not required for webhook v1
create table bot_events (
  id          uuid primary key default gen_random_uuid(),
  bot_id      text not null,
  level       text not null check (level in ('info', 'warn', 'error')),
  event       text not null,
  guild_id    text,
  user_id     text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index bot_events_bot_time_idx on bot_events (bot_id, created_at desc);
create index bot_events_event_time_idx on bot_events (event, created_at desc);
```

**RLS:** service role inserts from bots; dashboard uses anon key + RLS policy or server-side API with owner auth. Table is **not** public.

---

## Webhook alerts (`#bot-alerts`)

High-signal only (configurable per `event`):

| Event | Message template |
|-------|------------------|
| `guild_install` | 🟢 **{bot_id}** added to **{guild_name}** (`{guild_id}`) |
| `purchase` | 💰 **{bot_id}** — {sku_label} by <@{user_id}> |
| `error` | 🔴 **{bot_id}** — `{context}`: {message} |

Optional: UptimeRobot on each bot's `/api/health` → separate uptime webhook (no code change).

---

## Admin dashboard (v2 — deferred)

Read-only admin page on Supabase when webhook history isn't enough.

---

## Rollout plan

| Phase | Bots | Deliverable |
|-------|------|-------------|
| **1** | `tilt-battle-royale` | `bot/alerts.js`, webhook env on Fly, wire install / purchase / error / game events |
| **2** | `dad`, `justthebuilder` | Copy `alerts.js`, same webhook URL, different `ALERTS_BOT_ID` |
| **3** | `tiltcheck-discord` (optional) | TypeScript port of `alerts.js` |
| **4** | Dashboard (optional) | Supabase + admin UI only if needed |

---

## Error handling

- Supabase insert failure → log to stdout only; never throw into request path
- Webhook failure → single retry after 1s; then drop
- Missing env vars → analytics disabled with one startup warning (bot still runs)

---

## Security

- `SUPABASE_SERVICE_KEY` only on server (Fly secrets), never in client
- Webhook URL is a secret (Fly secrets)
- Truncate user-submitted text in `metadata` (500 chars max)
- Do not log tokens, webhook URLs, or full stack traces to Supabase (truncate stacks to 2 KB in `metadata.stack`)

---

## Out of scope (v1)

- Dollar revenue aggregation (use Discord Portal)
- Per-bot Fly log shipping to external SIEM
- Public stats page
- Player-facing analytics
- Automated paging beyond Discord webhook

---

## Success criteria (v1)

1. Bot added to a server → message in `#bot-alerts` within a few seconds
2. Trail Pass purchase → 💰 message with user + SKU
3. `/royale` game ends → optional info post (configurable; can skip to reduce noise)
4. Interaction crash → 🔴 error post with command name
5. `alerts.js` copy-pasteable to a second bot with only `ALERTS_BOT_ID` changed
