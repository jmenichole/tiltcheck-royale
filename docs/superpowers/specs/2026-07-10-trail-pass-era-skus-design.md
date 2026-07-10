# Trail Pass & Era SKU Design

**Date:** 2026-07-10  
**Status:** Approved — Phase 1 implemented  
**Project:** Tilt Battle Royale (`bot/`)

## Summary

Monetize host-owned trail **eras** via a single durable **Trail Pass** SKU that unlocks all bonus modes forever. Keep **Pioneer Supporter** as a separate cosmetic subscription. Base **Oregon Trail** remains free.

## SKU Catalog

| SKU | ID | Type | Unlocks |
|-----|-----|------|---------|
| Oregon Trail | — | Free | Default mode |
| Trail Pass | `1524975586601340978` | Durable (one-time) | All host eras, present and future |
| Pioneer Supporter | `1524938929273311302` | Personal subscription | Cosmetic flair only |

## Host Flow

1. `/royale` → Oregon Trail (no pass required)
2. `/royale era:Gold Rush` → requires Trail Pass on **host**
3. Missing pass → ephemeral store link; game does not start
4. Pioneer Supporter checked per-player at join (unchanged)

## Mechanics

- Same win condition: last pioneer standing
- Same core loop: travel, rations, disease, combat, rivers, events
- **Light twists per era:** event weight deltas only (±15% max), no pay-to-win stats

### Launch Eras

| Era | Pass | Twist |
|-----|------|-------|
| Oregon Trail | Free | Baseline weights |
| Gold Rush | Trail Pass | +loot/hunt, −combat/disease |
| Plague Trail | Trail Pass | +disease, −combat |
| Steampunk Express | Trail Pass | +combat/gadget loot |

Future eras ship in Pass updates at no extra cost.

## Architecture

```
bot/themes/
  index.js          # registry, getThemePack(), getLandmark()
  oregon-trail.js   # free default pack
  gold-rush.js      # first Pass era
bot/premium.js      # hasTrailPassFromEntitlements(), hasSupporterFromEntitlements()
bot/simulation.js   # loads pack by game.eraId
```

### Theme Pack Interface

Each era exports:

- `id`, `name`, `requiresPass`
- `classBonuses`, `hunterProfession`, `tankProfession`, `venomStatus`
- `weathers`, `eventWeights`, `events`, `landmarks`

## Embed UX

- Rumble-style narrative (no code blocks) — bold names render correctly
- Footer: `Era: Gold Rush • Alive: 2/5 • 64/1000 mi • ...`
- Death-day thumbnail only; victory thumbnail on win screen

## Store Assets

- `assets/tilt-battle-royale-logo.png` — bot avatar
- `assets/trail-pass-sku.png` — Trail Pass cover
- `assets/pioneer-supporter-sku.png` — Supporter cover

## Out of Scope (v1)

- Trail Pass bundle subscription (future when 3+ eras exist)
- Server-wide guild subscriptions
- Pay-to-win items or stat boosts

## Test Plan

- [ ] `/royale` works without pass
- [ ] `/royale era:Gold Rush` blocked without pass
- [ ] Gold Rush shows Prospector/Sheriff professions and gold-rush events
- [ ] Footer shows correct era name
- [ ] Pioneer Supporter flair still works independently
