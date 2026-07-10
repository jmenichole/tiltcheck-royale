# Trail Phases, Highlight Reel & Choice Beats

**Date:** 2026-07-10  
**Status:** Approved — pending implementation  
**Project:** Tilt Battle Royale (`bot/`)

## Summary

Redesign match pacing so games feel like a **3–5 minute BR story arc** instead of 15–20 repetitive daily embeds. Combine three mechanics:

1. **Highlight reel** — post to Discord only on notable events; batch quiet days into summary lines
2. **Trail phases** — three acts with escalating combat/danger by distance
3. **Light choices** — occasional 15–20s button windows that shift odds, not outcomes

Ship in two slices: **v1** (phases + highlights + faster ticks), **v2** (choice beats).

## Problem

Current matches (observed Plague Trail, 5 players):

- ~19 day-embeds in ~75 seconds of real time; feels longer due to repetition
- Disease chip damage (+13 HP/day) + auto-medicine loop dominates quiet days
- One random event per day; combat rare until late
- Players are passive spectators after joining the lobby
- Footer and day opener duplicate the same stats

**User goals:** BR chaos + dramatic reversals (~under 2 min energy, ~5 min room for story), light mid-game choices, less channel spam.

## Success Criteria

| Metric | Target (5 players) |
|--------|-------------------|
| Real time | 3–5 minutes |
| Discord messages | 10–15 (incl. depart + victory) |
| Player choices | 2–4 meaningful windows per player per match (v2) |
| Notable embed ratio | ≥70% of posts involve death, combat, landmark, phase, or choice |
| Quiet-day spam | Zero standalone embeds for routine disease chips |

## Core Mechanics (unchanged)

- Win condition: **last pioneer standing** (BR)
- Distance tiebreak at 1000 mi remains as fallback (rarely reached)
- Era theme packs, professions, event pools unchanged in content
- `/royale` host options (era, lobby_seconds, bot_players) unchanged
- Pioneer Supporter / Trail Pass gating unchanged

## Trail Phases

Distance-driven acts. Phase transition triggers a dedicated embed and modifier reset.

| Phase | ID | Miles | Flavor | Sim modifiers |
|-------|-----|-------|--------|---------------|
| Act I | `departure` | 0–299 | Survival, disease, loot | Baseline era weights |
| Act II | `killzone` | 300–699 | Trust breaks, rivers | Combat weight ×2; disease weight ×1.25 |
| Act III | `final` | 700+ | No escape | Combat weight ×2.5; forced combat check each tick; miles/tick +50% |

### Phase transition embed

```
🔥 ACT II — KILL ZONE
The trail narrows. 4 pioneers remain.
Combat is no longer optional.
```

Era-specific subtitle pulled from theme pack (`phaseFlavors` — new optional field, sensible defaults in `pacing.js` if missing).

### Phase detection

```js
function getPhase(distance) {
  if (distance >= 700) return 'final';
  if (distance >= 300) return 'killzone';
  return 'departure';
}
```

Store `game.phase` on game object; emit transition when `getPhase()` changes.

## Highlight Reel

Sim still advances day-by-day internally. Discord output is filtered.

### Event severity

Each event from `runDay()` tagged:

| Severity | Types | Discord |
|----------|-------|---------|
| `notable` | death, combat, instakill, river, landmark, first infection, rare loot (shotgun, +50 rations), phase transition | Full embed |
| `routine` | travel line, disease chip, medicine heal, small hunt, passive morale, weather chip | Buffered only |

### Quiet buffer

While no notable event posts, accumulate into `game.quietBuffer`:

```js
{
  startDay: number,
  startMi: number,
  endDay: number,
  endMi: number,
  aliveMin: number,
  aliveMax: number,
  weatherNotes: string[],  // deduped
}
```

Flush buffer as a **summary line** (plain message, not full embed) when:

- A notable event posts (prepend summary before highlight embed), OR
- Buffer spans ≥4 days, OR
- Landmark crossed, OR
- Phase transition

Summary format:

```
⏩ Days 4–7 · 61→112 mi · Stormy · 4/5 alive · The trail grinds on.
```

### Embed titles (notable only)

Punchier headers on death/combat:

- `Day 8 — ☠️ Maureen falls at Rat Warren`
- `Day 11 — ⚔️ Clyde vs Buck`

Reuse existing Rumble-style body formatting (`formatTrailNarrative`).

## Tick & Pacing Config

| Setting | Current | New |
|---------|---------|-----|
| `TICK_MS` | 4000 | **3000** |
| Miles/day | 10–22 | **14–28** (phase modifiers stack) |
| Act III days/tick | 1 | **1–2** (run extra day if no choice pending) |

Constants live in `bot/pacing.js` — not per-era (phases already differentiate eras).

## Light Choices (v2)

Sim **pauses** during choice windows. No day ticks until resolved or timed out.

### Choice window UX

- Embed with 2–4 buttons + countdown in footer: `Choose in 18s…`
- Duration: **18 seconds** (configurable `CHOICE_MS`)
- Only **alive** players may click
- Missed / no click → **neutral default** applied silently
- One active choice per channel at a time

### Choice types

#### 1. Group choice (Act I, once at ~150 mi)

All alive players vote; **plurality wins**; ties → safer option (`make_camp`).

| ID | Label | Effect |
|----|-------|--------|
| `push_pace` | 🏃 Push pace | +20 mi next tick; combat +10%, disease +10% for 2 ticks |
| `make_camp` | 🏕️ Make camp | All alive +10 HP; −12 mi; −10% combat for 2 ticks |
| `hunt` | 🎯 Hunt | +35 rations; random alive 30% exposure (−15 HP) |

Post result embed: `🏕️ Make camp wins 3–2. The party rests.`

#### 2. Personal choice (Act II entry, once per alive player)

Ephemeral-style: each player gets their own button row on a shared embed (filter by `customId` suffix `:{userId}`).

| ID | Label | Effect |
|----|-------|--------|
| `use_medicine` | 💊 Use medicine | 70% clear status +20 HP; 30% no effect |
| `raid_supplies` | 🔫 Raid supplies | 50% random loot item; 50% −20 HP |
| `help_other` | 🤝 Help another | Random other alive +15 HP; self +5 HP |
| `sabotage` | 🗡️ Sabotage | 40% random rival −30 HP; 60% self −10 HP |

Players who don't choose: no effect.

#### 3. River choice (each river crossing)

Replaces auto river resolution. Era-flavored button labels from theme pack.

| ID | Label | Effect |
|----|-------|--------|
| `ford` | 🌊 Ford it | 25% drown, 50% `river.damage` dmg, 25% safe |
| `caulk` | 🛶 Caulk & float | 15% −30 rations, 70% safe, 15% capsize (drown) |
| `wait` | ⏳ Wait | Safe; skip +1 day (extra disease tick, combat roll) |

If multiple alive: **host's choice** wins; if host dead, random alive pioneer.

## Architecture

```
bot/
  simulation.js   — runDay(), severity tags, phase modifiers on weights
  pacing.js       — NEW: phase helpers, highlight filter, quiet buffer, constants
  choices.js      — NEW (v2): choice defs, vote tally, resolve, apply modifiers
  bot.js          — tick loop, choice pause/resume, button handlers
  trail-theme.js  — phase embeds, choice prompts, summary lines
  themes/*.js     — optional phaseFlavors, riverChoiceLabels per era
```

### Game state additions

```js
{
  phase: 'departure' | 'killzone' | 'final',
  quietBuffer: QuietBuffer | null,
  pendingChoice: null | {
    type: 'group' | 'personal' | 'river',
    messageId: string,
    deadline: number,
    votes: Map<userId, choiceId>,
    riverIndex?: number,
  },
  modifiers: {
    combatBias: number,   // additive to weight roll
    diseaseBias: number,
    milesBonus: number,
    ticksRemaining: number,
  },
  flags: {
    groupChoiceDone: boolean,
    personalChoiceDone: boolean,
  },
}
```

### Tick loop (pseudocode)

```
tick():
  if pendingChoice and not expired → return
  if pendingChoice and expired → resolveChoice(defaults)

  run 1–2 days (sim)
  tag events notable vs routine

  if phase changed → post phase embed (notable)
  if choice trigger met → post choice, pause, return

  if any notable → flush quiet summary + post highlight embed
  else if quietBuffer.days >= 4 → flush summary only
  else → extend quietBuffer

  checkWinner()
```

## Embed UX Updates

- **Remove** redundant travel stats line from notable embed bodies (footer already has mi/weather/rations/alive)
- **Keep** death thumbnail on death events; landmark thumbnail on landmark crossings
- **Phase embeds** use era accent color (reuse `dayEmbedColor` or phase-specific)
- **Choice embeds** use `COLOR_AMBER` to stand out from trail green

## Out of Scope

- Full OT-style hunting/river minigames with guaranteed outcomes
- Per-player pace settings (`/royale pace:blitz`) — future if needed
- Spectator `/watch` command
- Persisted stats / leaderboards
- Changing SKU or monetization

## Implementation Slices

### v1 — Phases + Highlight Reel (~2 days)

- [ ] Add `bot/pacing.js` with phase config, severity helpers, quiet buffer
- [ ] Tag events in `runDay()` with `severity`
- [ ] Refactor `bot.js` tick loop for highlight filtering + summaries
- [ ] Phase transition embeds in `trail-theme.js`
- [ ] Tune `TICK_MS`, miles/day, phase weight multipliers
- [ ] Smoke test all 4 eras with `bot_players:4`

### v2 — Choice Beats (~2–3 days)

- [ ] Add `bot/choices.js` with choice definitions and resolvers
- [ ] Choice embed + button components; pause/resume tick loop
- [ ] Group vote tally; personal per-user buttons; river host-priority
- [ ] Timeout → neutral default
- [ ] Era-flavored choice labels (optional theme pack fields)

## Test Plan

### v1

- [ ] 5-player bot match completes in 3–5 min with ≤15 channel messages
- [ ] No standalone embed for routine medicine/disease chip
- [ ] Phase II embed fires at ~300 mi; Act III at ~700 mi
- [ ] Death and combat always produce full embeds
- [ ] Quiet summary flushes before next notable event
- [ ] Victory embed unchanged functionally

### v2

- [ ] Group choice appears once in Act I; result embed shows vote count
- [ ] Personal choice buttons only work for owning player
- [ ] River choice overrides auto river resolution
- [ ] Missing choice applies neutral default; sim resumes
- [ ] No double-tick during choice window
- [ ] Active game with choice pending survives bot restart gracefully (choice lost, sim resumes — document as known limitation v2)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Channel feels dead between highlights | Cap quiet buffer at 4 days; phase embeds break silence |
| Choices missed in busy channels | 18s window + neutral default; future: ping alive players |
| Phase II too lethal | Multipliers tunable in `pacing.js` without era rewrites |
| Button customId length limits | Use short ids + userId suffix pattern |
| Bot restart mid-choice | v2: clear pending choice on startup; post "trail continues" once |
