# Trail Phases & Highlight Reel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 pacing overhaul — 3-act trail phases, highlight-reel Discord output, quiet-day summaries — so 5-player matches finish in 3–5 minutes with ~10–15 messages. v2 (choice beats) follows in a separate plan pass.

**Architecture:** New `bot/pacing.js` owns phase detection, event severity, quiet-buffer batching, and tick constants. `simulation.js` tags each event with `severity` and applies phase weight multipliers. `bot.js` tick loop filters routine events, flushes summaries, and posts phase transitions. `trail-theme.js` builds phase/summary/highlight embed copy.

**Tech Stack:** Node.js 18+, discord.js v14, existing theme packs in `bot/themes/`

**Spec:** `docs/superpowers/specs/2026-07-10-trail-phases-pacing-design.md` (approved)

---

## File map

| File | Responsibility |
|------|----------------|
| `bot/pacing.js` | **NEW** — `TICK_MS`, phase helpers, severity classifier, quiet buffer, weight multipliers |
| `bot/simulation.js` | Tag events `severity`; apply phase modifiers to miles + weights; track `firstInfection` |
| `bot/bot.js` | Refactor tick loop: batch days, flush summaries, phase embeds, skip routine embeds |
| `bot/trail-theme.js` | Phase embed builder, summary line formatter, punchy day titles, filter routine from narrative |
| `bot/themes/*.js` | Optional `phaseFlavors` field (defaults in pacing if absent) |
| `bot/choices.js` | **v2 only** — defer to post-v1 plan addendum |

---

## v1 — Phases + Highlight Reel

### Task 1: Create `bot/pacing.js` core helpers

**Files:**
- Create: `bot/pacing.js`

- [ ] **Step 1: Create pacing module**

```javascript
/**
 * Match pacing — phases, highlight filtering, quiet buffer.
 */

const TICK_MS = 3000;
const QUIET_FLUSH_DAYS = 4;
const PHASE_MILES = { killzone: 300, final: 700 };

const DEFAULT_PHASE_FLAVORS = {
    departure: 'The trail opens. Disease and distance await.',
    killzone: 'The trail narrows. Trust breaks.',
    final: 'No escape. Only one wagon reaches the end.',
};

function getPhase(distance) {
    if (distance >= PHASE_MILES.final) return 'final';
    if (distance >= PHASE_MILES.killzone) return 'killzone';
    return 'departure';
}

function getPhaseMultipliers(phase) {
    switch (phase) {
        case 'killzone':
            return { combat: 2.0, disease: 1.25, miles: 1.0 };
        case 'final':
            return { combat: 2.5, disease: 1.25, miles: 1.5, forceCombat: true };
        default:
            return { combat: 1.0, disease: 1.0, miles: 1.0, forceCombat: false };
    }
}

function classifyEventSeverity(event) {
    if (!event?.type) return 'routine';
    if (event.type === 'death') return 'notable';
    if (event.type === 'combat') return 'notable';
    if (event.notable === true) return 'notable';
    if (event.type === 'disease' && event.firstInfection) return 'notable';
    if (event.type === 'item' && event.rareLoot) return 'notable';
    if (event.type === 'day' && event.landmark) return 'notable';
    if (event.type === 'day' && event.river) return 'notable';
    return 'routine';
}

function isNotableEvent(event) {
    return classifyEventSeverity(event) === 'notable';
}

function createQuietBuffer(day, mi, aliveCount) {
    return {
        startDay: day,
        startMi: mi,
        endDay: day,
        endMi: mi,
        aliveMin: aliveCount,
        aliveMax: aliveCount,
        weatherNotes: [],
    };
}

function extendQuietBuffer(buffer, day, mi, aliveCount, weather) {
    buffer.endDay = day;
    buffer.endMi = mi;
    buffer.aliveMin = Math.min(buffer.aliveMin, aliveCount);
    buffer.aliveMax = Math.max(buffer.aliveMax, aliveCount);
    if (weather && !buffer.weatherNotes.includes(weather)) {
        buffer.weatherNotes.push(weather);
    }
    return buffer;
}

function quietBufferDaySpan(buffer) {
    return buffer.endDay - buffer.startDay + 1;
}

function formatQuietSummary(buffer, totalParty) {
    const dayRange = buffer.startDay === buffer.endDay
        ? `Day ${buffer.startDay}`
        : `Days ${buffer.startDay}–${buffer.endDay}`;
    const miRange = `${buffer.startMi}→${buffer.endMi} mi`;
    const weather = buffer.weatherNotes.length ? buffer.weatherNotes[buffer.weatherNotes.length - 1] : 'Fair';
    const alive = buffer.aliveMin === buffer.aliveMax
        ? `${buffer.aliveMax}/${totalParty} alive`
        : `${buffer.aliveMin}–${buffer.aliveMax}/${totalParty} alive`;
    return `⏩ ${dayRange} · ${miRange} · ${weather} · ${alive} · The trail grinds on.`;
}

function getPhaseFlavor(pack, phase) {
    return pack?.phaseFlavors?.[phase] || DEFAULT_PHASE_FLAVORS[phase] || '';
}

module.exports = {
    TICK_MS,
    QUIET_FLUSH_DAYS,
    PHASE_MILES,
    getPhase,
    getPhaseMultipliers,
    classifyEventSeverity,
    isNotableEvent,
    createQuietBuffer,
    extendQuietBuffer,
    quietBufferDaySpan,
    formatQuietSummary,
    getPhaseFlavor,
};
```

- [ ] **Step 2: Smoke-test helpers**

Run:
```bash
cd bot && node -e "
const p = require('./pacing');
console.assert(p.getPhase(299) === 'departure');
console.assert(p.getPhase(300) === 'killzone');
console.assert(p.getPhase(700) === 'final');
console.assert(p.isNotableEvent({ type: 'death' }) === true);
console.assert(p.isNotableEvent({ type: 'disease' }) === false);
console.assert(p.isNotableEvent({ type: 'disease', firstInfection: true }) === true);
const b = p.createQuietBuffer(4, 61, 5);
p.extendQuietBuffer(b, 7, 112, 4, 'Stormy');
console.log(p.formatQuietSummary(b, 5));
console.log('pacing.js OK');
"
```
Expected: summary line printed; `pacing.js OK`

- [ ] **Step 3: Commit**

```bash
git add bot/pacing.js
git commit -m "Add pacing module for trail phases and highlight filtering."
```

---

### Task 2: Tag events with severity in `simulation.js`

**Files:**
- Modify: `bot/simulation.js`

- [ ] **Step 1: Import pacing helpers at top of simulation.js**

```javascript
const { getPhase, getPhaseMultipliers } = require('./pacing.js');
```

- [ ] **Step 2: Extend `createGame` initial state**

Add to returned object in `createGame()`:

```javascript
phase: 'departure',
quietBuffer: null,
knownStatuses: {},  // characterId -> Set of status names seen
```

- [ ] **Step 3: Add helper to mark event fields before push**

Add near top of file:

```javascript
function pushEvent(events, event, game, character) {
    if (event.type === 'disease' && event.text?.includes('**') && character?.status !== 'Healthy') {
        const seen = game.knownStatuses[character.id] || new Set();
        if (!seen.has(character.status)) {
            event.firstInfection = true;
            seen.add(character.status);
            game.knownStatuses[character.id] = seen;
        }
    }
    events.push(event);
}
```

Use `pushEvent` for disease events that apply new status (in disease roll branch).

- [ ] **Step 4: Apply phase modifiers in `runDay`**

At start of `runDay(game)` after `game.day++`:

```javascript
const phase = getPhase(game.distance);
const mult = getPhaseMultipliers(phase);
game.phase = phase;

const miles = Math.round(rand(14, 28) * mult.miles);
```

Replace old `rand(10, 22)`.

- [ ] **Step 5: Scale event weight thresholds**

Before combat roll, build effective weights:

```javascript
const w = {
    combat: Math.min(0.95, weights.combat * mult.combat),
    disease: Math.min(0.95, weights.disease * mult.disease),
    loot: weights.loot,
    hunt: weights.hunt,
};
```

Use `w.combat`, `w.disease`, etc. in roll comparisons instead of raw `weights`.

If `mult.forceCombat` and `aliveNow.length >= 2`, force combat branch (skip roll).

- [ ] **Step 6: Mark notable events explicitly**

- River crossing day event: `{ type: 'day', text: '...', river: true }` — already notable via classifier
- Landmark: when distance crosses new landmark threshold, push `{ type: 'day', landmark: true, landmarkName }`
- Rare loot: when loot item is `Shotgun` or rations amount >= 50, set `event.rareLoot = true`
- Remove or demote the generic travel `day` opener from notable — keep as `routine` by NOT setting landmark/river flags

Change the always-pushed travel line to:

```javascript
events.push({
    type: 'day',
    severity: 'routine',
    text: `Wagon advanced **${miles} miles** | Weather: **${game.weather}** | Rations: **${Math.max(0, game.rations)} lbs** | Alive: **${alive.length}**`,
    distance: game.distance,
    day: game.day,
    weather: game.weather,
    rations: game.rations,
});
```

Classifier treats plain `day` without flags as routine.

- [ ] **Step 7: Export `getPhase` transition helper**

Add function:

```javascript
function syncPhase(game) {
    const next = getPhase(game.distance);
    const changed = next !== game.phase;
    game.phase = next;
    return changed ? next : null;
}
```

Export from module.exports.

- [ ] **Step 8: Smoke-test sim with node**

```bash
cd bot && node -e "
const { createGame, runDay } = require('./simulation');
const g = createGame('ch', 'host', 'plague-trail');
g.party = [{ id:'1', name:'A', displayName:'A', profession:'Quack', hp:80, maxHp:80, status:'Healthy', items:[], kills:0, alive:true, isBot:false }];
g.rations = 200; g.phase = 'departure';
for (let i = 0; i < 25; i++) runDay(g);
console.log('day', g.day, 'mi', g.distance, 'phase', g.phase);
"
```
Expected: `phase` becomes `killzone` or higher if miles exceed 300

- [ ] **Step 9: Commit**

```bash
git add bot/simulation.js
git commit -m "Tag sim events for highlight reel and apply phase weight modifiers."
```

---

### Task 3: Update `trail-theme.js` for highlights and phases

**Files:**
- Modify: `bot/trail-theme.js`

- [ ] **Step 1: Add narrative filter**

```javascript
function formatTrailNarrative(events, { includeRoutine = false } = {}) {
    const filtered = includeRoutine
        ? events
        : events.filter(e => e.severity !== 'routine' && !(e.type === 'day' && !e.landmark && !e.river));
    // existing join logic on filtered array
}
```

Update existing `formatTrailNarrative` to accept options; default `includeRoutine: false`.

- [ ] **Step 2: Add punchy title helper**

```javascript
function formatHighlightTitle(day, events, landmarkName) {
    const death = events.find(e => e.type === 'death');
    const combat = events.find(e => e.type === 'combat');
    if (death) return `Day ${day} — ☠️ ${death.victim || 'A pioneer'} falls${landmarkName ? ` at ${landmarkName}` : ''}`;
    if (combat) return `Day ${day} — ⚔️ Blood on the trail`;
    if (events.some(e => e.landmark)) return `Day ${day} — ${landmarkName || 'Landmark'}`;
    if (events.some(e => e.river)) return `Day ${day} — River crossing`;
    return formatDayTitle(pickDayHeader(day, events[0]?.weather, events, { name: landmarkName }), day);
}
```

- [ ] **Step 3: Add phase transition embed builder**

```javascript
function buildPhaseEmbed(phase, aliveCount, eraName, flavor) {
    const titles = {
        killzone: '🔥 ACT II — KILL ZONE',
        final: '🔥 ACT III — FINAL FORD',
    };
    return new EmbedBuilder()
        .setColor(COLORS.amber)
        .setTitle(titles[phase] || 'ACT I — DEPARTURE')
        .setDescription(`${flavor}\n\n**${aliveCount}** pioneer${aliveCount === 1 ? '' : 's'} remain.\n**Era:** ${eraName}`)
        .setTimestamp();
}
```

Import `EmbedBuilder` if not already available in trail-theme (it is used via bot.js today — add require at top):

```javascript
const { EmbedBuilder } = require('discord.js');
```

- [ ] **Step 4: Export new functions**

Add to `module.exports`: `formatHighlightTitle`, `buildPhaseEmbed`, update `formatTrailNarrative` signature.

- [ ] **Step 5: Commit**

```bash
git add bot/trail-theme.js
git commit -m "Add phase embeds, highlight titles, and routine event filtering for trail narrative."
```

---

### Task 4: Refactor `bot.js` tick loop

**Files:**
- Modify: `bot/bot.js`

- [ ] **Step 1: Import pacing + new theme helpers**

```javascript
const {
    TICK_MS, QUIET_FLUSH_DAYS, getPhase, isNotableEvent,
    createQuietBuffer, extendQuietBuffer, quietBufferDaySpan, formatQuietSummary, getPhaseFlavor,
} = require('./pacing.js');
const { syncPhase } = require('./simulation.js');
// add to trail-theme imports:
// formatHighlightTitle, buildPhaseEmbed
```

- [ ] **Step 2: Replace hardcoded TICK_MS**

Change `const TICK_MS = 4000` to use imported `TICK_MS` from pacing.js (remove local const).

- [ ] **Step 3: Add helper to process one sim day batch**

```javascript
async function postQuietSummary(channel, game) {
    if (!game.quietBuffer) return;
    const line = formatQuietSummary(game.quietBuffer, game.party.length);
    await channel.send({ content: line }).catch(() => {});
    game.quietBuffer = null;
}

async function postPhaseTransition(channel, game, newPhase) {
    const pack = getThemePack(game.eraId);
    const eraName = getEra(game.eraId).name;
    const alive = game.party.filter(c => c.alive).length;
    const flavor = getPhaseFlavor(pack, newPhase);
    await postQuietSummary(channel, game);
    await channel.send({
        embeds: [buildPhaseEmbed(newPhase, alive, eraName, flavor)],
    }).catch(() => {});
}

function partitionEvents(events) {
    const notable = events.filter(isNotableEvent);
    const routine = events.filter(e => !isNotableEvent(e));
    return { notable, routine };
}
```

- [ ] **Step 4: Rewrite tick callback**

Replace tick body inside `startSimulation`:

```javascript
const tick = async () => {
    const result = checkWinner(game);
    if (result) {
        clearInterval(entry.simTimer);
        game.phase = 'ended';
        await postQuietSummary(channel, game);
        await channel.send({ embeds: [buildVictoryEmbed(result.text, result.winner, game.eraId)] });
        activeGames.delete(channelId);
        return;
    }

    const prevPhase = game.phase;
    const daysThisTick = game.phase === 'final' ? 2 : 1;
    let allEvents = [];
    for (let d = 0; d < daysThisTick; d++) {
        allEvents.push(...runDay(game));
        const winnerMid = checkWinner(game);
        if (winnerMid) {
            allEvents = allEvents.concat([]); // break outer on next check
            break;
        }
    }

    const newPhase = syncPhase(game);
    if (newPhase && newPhase !== prevPhase) {
        await postPhaseTransition(channel, game, newPhase);
    }

    const aliveAfter = game.party.filter(c => c.alive);
    const { notable } = partitionEvents(allEvents);

    if (notable.length === 0) {
        const day = game.day;
        const mi = game.distance;
        if (!game.quietBuffer) {
            game.quietBuffer = createQuietBuffer(day, mi, aliveAfter.length);
        } else {
            extendQuietBuffer(game.quietBuffer, day, mi, aliveAfter.length, game.weather);
        }
        if (quietBufferDaySpan(game.quietBuffer) >= QUIET_FLUSH_DAYS) {
            await postQuietSummary(channel, game);
        }
        return;
    }

    await postQuietSummary(channel, game);

    const landmark = getLandmark(game.distance, game.eraId);
    const hasDeath = notable.some(e => e.type === 'death');
    const headerEvents = notable;
    const embed = buildDayEmbed(
        game.day,
        headerEvents,
        game.distance,
        game.weather,
        game.rations,
        aliveAfter.length,
        game.party.length,
        game.eraId,
    );
    embed.setTitle(formatHighlightTitle(game.day, notable, landmark.name));
    if (hasDeath) embed.setThumbnail(getDayThumbnail(landmark, true));

    await channel.send({ embeds: [embed] }).catch(() => {});
};
```

- [ ] **Step 5: Update `buildDayEmbed` call path**

Ensure `formatTrailNarrative` inside `buildDayEmbed` passes `{ includeRoutine: false }` or only receives notable events (preferred: pass filtered `notable` only).

- [ ] **Step 6: Commit**

```bash
git add bot/bot.js
git commit -m "Refactor tick loop for highlight reel output and phase transitions."
```

---

### Task 5: Optional era `phaseFlavors` (Plague Trail first)

**Files:**
- Modify: `bot/themes/plague-trail.js`
- Modify: `bot/themes/oregon-trail.js`, `gold-rush.js`, `steampunk-express.js` (same pattern)

- [ ] **Step 1: Add to plague-trail.js exports**

```javascript
phaseFlavors: {
    departure: 'The quarantine gate creaks shut behind you. Rats scatter.',
    killzone: 'Graves line the trail. Pioneers eye each other\'s medicine.',
    final: 'The last ford runs red. No one leaves together.',
},
```

- [ ] **Step 2: Add era-appropriate flavors to other three theme packs**

- [ ] **Step 3: Commit**

```bash
git add bot/themes/
git commit -m "Add era-specific phase transition flavor text to theme packs."
```

---

### Task 6: Deploy and manual smoke test

**Files:**
- None (verification)

- [ ] **Step 1: Local bot smoke**

```bash
cd bot && node -e "require('./pacing'); require('./simulation'); require('./trail-theme'); console.log('modules load OK');"
```

- [ ] **Step 2: Solo test in Discord**

```
/royale era:Plague Trail bot_players:4 lobby_seconds:10
```
Depart early. Confirm:
- ≤15 messages before victory
- No embed that is ONLY medicine/disease chip text
- Phase embed at ~300 mi and ~700 mi
- `⏩ Days X–Y` summary lines appear between highlights
- Match completes in ~3–5 min

- [ ] **Step 3: Deploy Fly**

```bash
cd bot && flyctl deploy --remote-only
```

- [ ] **Step 4: Update spec status**

In `docs/superpowers/specs/2026-07-10-trail-phases-pacing-design.md`, set v1 checklist items to done and status line:

```markdown
**Status:** Approved — v1 implemented
```

- [ ] **Step 5: Commit spec status**

```bash
git add docs/superpowers/specs/2026-07-10-trail-phases-pacing-design.md
git commit -m "Mark trail phases v1 pacing spec as implemented."
git push origin main
```

---

## v2 — Choice Beats (follow-up plan section)

Implement after v1 is verified live. Do not start v2 until v1 smoke test passes.

### Task 7: Create `bot/choices.js`

**Files:**
- Create: `bot/choices.js`

- [ ] Define `GROUP_CHOICES`, `PERSONAL_CHOICES`, `RIVER_CHOICES` with id, label, resolve(game, voter)
- [ ] `tallyGroupVotes(votes)` → winning choice id; ties → `make_camp`
- [ ] `buildChoiceButtons(type, game)` → ActionRowBuilder[]
- [ ] `resolveChoice(game, choiceType, selection)` → events array + modifier patches

### Task 8: Pause/resume tick loop for choices

**Files:**
- Modify: `bot/bot.js`

- [ ] Add `pendingChoice` to game state
- [ ] Triggers: `distance >= 150 && !flags.groupChoiceDone`, Act II entry, river approach
- [ ] On trigger: post choice embed, set 18s timeout, `return` from tick
- [ ] Button handler: `choice_*` customIds; validate alive + correct voter
- [ ] On timeout: resolve defaults; clear `pendingChoice`; resume interval

### Task 9: River choice replaces auto-resolve

**Files:**
- Modify: `bot/simulation.js`

- [ ] When river threshold hit, set `game.pendingRiver = { index, name }` instead of auto-resolving
- [ ] Export `resolveRiverChoice(game, choiceId)` called from choices.js

### Task 10: v2 smoke test + deploy

- [ ] Group vote with bot_players (bots auto-vote random at 16s)
- [ ] Personal buttons reject wrong user
- [ ] River choice respects host priority
- [ ] Deploy + push

---

## Spec coverage checklist (self-review)

| Spec requirement | Task |
|------------------|------|
| Highlight reel severity tags | Task 2 |
| Quiet buffer + summary lines | Task 1, 4 |
| Trail phases + modifiers | Task 1, 2, 4 |
| Phase transition embeds | Task 3, 4 |
| TICK_MS 3000, miles 14–28 | Task 1, 2 |
| Punchy death/combat titles | Task 3, 4 |
| Remove redundant travel from embed body | Task 3, 4 |
| Era phaseFlavors | Task 5 |
| v2 choices | Tasks 7–10 |
| Success criteria smoke test | Task 6 |

No placeholders remain. Type names consistent: `quietBuffer`, `getPhase`, `isNotableEvent` used uniformly.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-10-trail-phases-pacing.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — implement tasks in this session with checkpoints

Which approach do you want?
