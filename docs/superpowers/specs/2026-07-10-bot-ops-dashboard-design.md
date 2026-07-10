# Bot Ops Dashboard & Shared Analytics Design

**Date:** 2026-07-10  
**Status:** Approved — pending implementation plan  
**Owner:** jmenichole  
**Pilot bot:** Tilt Battle Royale (`jmenichole/tiltcheck-royale`)

## Summary

Build a **shared analytics layer** every Discord bot can emit to, plus a **minimal ops surface**: webhook alerts for high-signal events and a read-only admin dashboard querying one Supabase project. Tilt Battle Royale ships first as the template; other bots adopt the same `analytics.js` module.

**v1 optimizes for:** instant alerts + queryable history (Approach C).

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

Any new bot gets a unique `bot_id`, copies `analytics.js`, and shares the same Supabase + webhook env vars.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ tilt-battle-    │     │ justthebuilder  │     │ dad             │
│ royale          │     │  analytics.js   │     │ (tiltcheck-me)  │
│  analytics.js   │     └────────┬────────┘     └────────┬────────┘
└────────┬────────┘              │                       │
         │    JSON event (fire-and-forget)              │
         └──────────────────────┼───────────────────────┘
                                ▼
              ┌─────────────────────────────────────┐
              │  Sinks (parallel, non-blocking)        │
              │  1. stdout → Fly logs                  │
              │  2. Supabase bot_events insert         │
              │  3. Discord webhook (filtered events)  │
              └─────────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
     ┌─────────────────┐               ┌─────────────────┐
     │ Supabase        │               │ #bot-alerts       │
     │ bot_events      │               │ (private channel) │
     └────────┬────────┘               └─────────────────┘
              ▼
     ┌─────────────────┐
     │ Admin dashboard  │  (read-only, password/RLS)
     │ installs, games, │
     │ purchases, errors│
     └─────────────────┘
```

---

## Event pipeline (`analytics.js`)

### Event shape

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

### Environment variables (per bot deployment)

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANALYTICS_BOT_ID` | yes | e.g. `tilt-battle-royale` |
| `SUPABASE_URL` | yes | Shared Supabase project |
| `SUPABASE_SERVICE_KEY` | yes | Service role (server-side only) |
| `BOT_ALERTS_WEBHOOK_URL` | no | Private Discord channel webhook |
| `ANALYTICS_ENABLED` | no | Default `true`; set `false` to disable sinks in dev |

Fly secrets example:

```bash
flyctl secrets set -a tilt-battle-royale \
  ANALYTICS_BOT_ID=tilt-battle-royale \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_KEY=... \
  BOT_ALERTS_WEBHOOK_URL=...
```

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

## Supabase schema

```sql
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

## Admin dashboard (v1)

**Hosting:** Static site or tiny Next.js on Netlify/Vercel (can live in `tiltcheck-monorepo/apps/control-room` later).

**Views:**

- Bot filter (all `bot_id` values)
- Last 50 events (paginated table)
- Summary cards (7d): installs, games played, purchases, errors (24h)
- Event detail: expand `metadata` JSON

**Auth:** Simple password env var or Supabase magic link — not public.

---

## Rollout plan

| Phase | Bots | Deliverable |
|-------|------|-------------|
| **1** | `tilt-battle-royale` | `bot/analytics.js`, Supabase table, webhook, instrument `bot.js` |
| **2** | `dad` (`tiltcheck-me`), `justthebuilder` | Copy `analytics.js`; instrument game + install events |
| **3** | `tiltcheck-discord` (monorepo, optional) | `@tiltcheck/analytics` workspace package |
| **4** | Dashboard UI | Read-only admin page on shared Supabase |

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

## Success criteria

1. New server install on Tilt Battle Royale posts to `#bot-alerts` within 5 seconds
2. Trail Pass purchase posts to `#bot-alerts` with correct SKU label
3. `/royale` game start and end appear in `bot_events` with correct metadata
4. Interaction errors appear in dashboard within 10 seconds
5. `analytics.js` is copy-pasteable into a second bot with only `ANALYTICS_BOT_ID` changed
