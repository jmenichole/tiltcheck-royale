# Trail Pass & Era SKUs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Trail Pass monetization with Gold Rush as the first paid era; verify launch; add Plague Trail and Steampunk Express as Pass-gated updates.

**Architecture:** Theme packs in `bot/themes/` export events, professions, landmarks, and event weights. `simulation.js` loads the pack via `game.eraId`. `premium.js` gates host eras with `TRAIL_PASS_SKU_ID`. Discord slash `/royale era:` selects the era.

**Tech Stack:** Node.js, discord.js v14, Discord Premium Apps (durable SKU + personal sub), Fly.io

**Phase 1 status:** ✅ Implemented — Trail Pass SKU wired, Gold Rush theme live, Rumble-style embeds, assets in `assets/`.

---

## Phase 1: Launch verification (manual)

### Task 1: Discord portal assets

**Files:**
- Use: `assets/tilt-battle-royale-logo.png`
- Use: `assets/trail-pass-sku.png`
- Use: `assets/pioneer-supporter-sku.png`

- [ ] **Step 1:** Developer Portal → App → **App Icon** → upload `tilt-battle-royale-logo.png`
- [ ] **Step 2:** Monetization → **Trail Pass** SKU (`1524975586601340978`) → upload `trail-pass-sku.png` as cover image
- [ ] **Step 3:** Monetization → **Pioneer Supporter** SKU (`1524938929273311302`) → upload `pioneer-supporter-sku.png` as cover image

### Task 2: Live smoke test in `#test-channel`

- [ ] **Step 1:** Run `/royale` without Trail Pass → Oregon Trail lobby starts, era shows in embed
- [ ] **Step 2:** Run `/royale era:Gold Rush` without pass → ephemeral store link, no game
- [ ] **Step 3:** With Trail Pass on host account → `/royale era:Gold Rush` → professions like Prospector/Sheriff appear on join
- [ ] **Step 4:** Confirm day footer includes `Era: Gold Rush • Alive: ...`
- [ ] **Step 5:** Confirm Pioneer Supporter join line still works independently of Trail Pass

Run deploy if slash `era` option missing:

```bash
cd bot && npm run deploy
```

---

## Phase 2: Plague Trail era

### Task 3: Create plague-trail theme pack

**Files:**
- Create: `bot/themes/plague-trail.js`
- Modify: `bot/themes/index.js`

- [ ] **Step 1:** Create `bot/themes/plague-trail.js` following `gold-rush.js` shape:

```javascript
module.exports = {
    id: 'plague-trail',
    name: 'Plague Trail',
    requiresPass: true,
    landmarks: [ /* 8 entries, mi 0–980, plague-era names */ ],
    classBonuses: {
        Plague Doctor: { maxHp: 100, startItems: ['Medicine', 'Medicine'] },
        Undertaker:    { maxHp: 110, startItems: ['Shotgun'] },
        Apothecary:    { maxHp: 90,  startItems: ['Medicine', 'Canteen'] },
        Grave Robber:  { maxHp: 95,  startItems: ['Shotgun', 'Canteen'] },
        Quack:         { maxHp: 80,  startItems: ['Medicine'] },
    },
    hunterProfession: 'Undertaker',
    tankProfession: 'Plague Doctor',
    venomStatus: 'Rat Bite',
    weathers: ['Rainy', 'Rainy', 'Stormy', 'Stormy', 'Fair', 'Scorching', 'Blizzard'],
    eventWeights: { combat: 0.28, disease: 0.55, loot: 0.62, hunt: 0.72 },
    events: { /* combat, shotgun, instakill, diseases, loot, passive, hunting, rivers, weatherEvents, victory */ },
};
```

Event flavor: quarantine camps, rat swarms, grave robbers, tainted wells. Victory text references surviving the plague frontier.

- [ ] **Step 2:** Register in `bot/themes/index.js`:

```javascript
const plagueTrail = require('./plague-trail.js');

const PACKS = {
    'oregon-trail': oregonTrail,
    'gold-rush': goldRush,
    'plague-trail': plagueTrail,
};
```

- [ ] **Step 3:** Add slash choice in `bot/deploy-commands.js` — `listSelectableEras()` auto-includes new pack after registry update; run `npm run deploy`

- [ ] **Step 4:** Smoke test:

```bash
cd bot && node -e "const {createGame,createCharacter,runDay}=require('./simulation'); const u={id:'1',username:'t',displayName:'T'}; const g=createGame('c','1','plague-trail'); g.party.push(createCharacter(u,'plague-trail')); g.rations=200; for(let i=0;i<5;i++) runDay(g); console.log(g.party[0].profession, g.day);"
```

Expected: profession from plague set, `g.day === 5`

- [ ] **Step 5:** Deploy to Fly:

```bash
cd bot && flyctl deploy --remote-only
```

---

## Phase 3: Steampunk Express era

### Task 4: Create steampunk-express theme pack

**Files:**
- Create: `bot/themes/steampunk-express.js`
- Modify: `bot/themes/index.js`

- [ ] **Step 1:** Create pack with professions: Inventor, Boilerhand, Aerialist, Tinker, Marshal
- [ ] **Step 2:** Event flavor: airship crashes, gear malfunctions, clockwork duels, brass loot
- [ ] **Step 3:** Event weights: `{ combat: 0.42, disease: 0.48, loot: 0.65, hunt: 0.75 }` (more combat/gadgets)
- [ ] **Step 4:** Register in `themes/index.js`, deploy commands, smoke test, Fly deploy (same pattern as Task 3)

---

## Phase 4: Era-aware lobby polish (optional)

### Task 5: Era-specific lobby copy

**Files:**
- Modify: `bot/themes/index.js` — add optional `lobbyTagline` per pack
- Modify: `bot/bot.js` — `buildLobbyEmbed` uses `pack.lobbyTagline` instead of hardcoded Oregon text

- [ ] **Step 1:** Add to each theme pack:

```javascript
lobbyTagline: '*Sacramento → Mother Lode → one claim survives.*',  // gold-rush example
```

- [ ] **Step 2:** In `buildLobbyEmbed`, replace static route line with `getThemePack(game.eraId).lobbyTagline`

- [ ] **Step 3:** Add era-specific `victoryBanner` string per pack (replace shared `VICTORY_BANNER` in `buildVictoryEmbed`)

---

## Spec test plan (mark complete as verified)

From `docs/superpowers/specs/2026-07-10-trail-pass-era-skus-design.md`:

- [ ] `/royale` works without pass
- [ ] `/royale era:Gold Rush` blocked without pass
- [ ] Gold Rush shows Prospector/Sheriff professions and gold-rush events
- [ ] Footer shows correct era name
- [ ] Pioneer Supporter flair still works independently

---

## Self-review notes

| Spec requirement | Plan task |
|------------------|-----------|
| Trail Pass durable SKU | Phase 1 ✅ done in code |
| Pioneer Supporter separate | Phase 1 ✅ done in code |
| Host era gate | Phase 1 ✅ done in code |
| Gold Rush launch era | Phase 1 ✅ done; Task 2 verifies |
| Future eras auto-unlock | Tasks 3–4 |
| Light event weight twists | Theme pack `eventWeights` in each file |
| Rumble-style embeds | Phase 1 ✅ done |
| Store assets | Task 1 |

No placeholders. Phase 2–3 repeat the proven `gold-rush.js` pattern.
