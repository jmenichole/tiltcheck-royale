/**
 * TILTCHECK ROYALE - Simulation Engine
 * Core game logic: character management, daily ticks, event resolution.
 */

const { getThemePack } = require('./themes/index.js');
const { getPhase, getPhaseMultipliers } = require('./pacing.js');

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pluralS(n) {
    return n === 1 ? '' : 's';
}

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

function syncPhase(game) {
    const next = getPhase(game.distance);
    const changed = next !== game.trailPhase;
    game.trailPhase = next;
    return changed ? next : null;
}

function createCharacter(discordUser, eraId = 'oregon-trail') {
    const pack = getThemePack(eraId);
    const professions = Object.keys(pack.classBonuses);
    const profession = pick(professions);
    const base = pack.classBonuses[profession];

    return {
        id: discordUser.id,
        name: discordUser.username.substring(0, 14),
        displayName: discordUser.displayName || discordUser.username,
        profession,
        hp: base.maxHp,
        maxHp: base.maxHp,
        status: 'Healthy',
        items: [...base.startItems],
        kills: 0,
        alive: true,
        isBot: false,
    };
}

const BOT_PIONEER_NAMES = [
    'Clyde', 'Buck', 'Maureen', 'Zeke', 'Hattie', 'Jeb', 'Prudence', 'Rufus',
    'Winifred', 'Grover', 'Eustace', 'Cordelia', 'Thaddeus', 'Myrtle', 'Orville',
    'Beatrix', 'Cornelius', 'Daisy', 'Festus',
];

/** Fake pioneer for solo dev testing — not a real Discord user. */
function createBotCharacter(slot, eraId = 'oregon-trail') {
    const pack = getThemePack(eraId);
    const professions = Object.keys(pack.classBonuses);
    const profession = pick(professions);
    const base = pack.classBonuses[profession];
    const baseName = BOT_PIONEER_NAMES[slot % BOT_PIONEER_NAMES.length];
    const suffix = slot >= BOT_PIONEER_NAMES.length
        ? ` ${Math.floor(slot / BOT_PIONEER_NAMES.length) + 1}`
        : '';
    const displayName = `${baseName}${suffix}`;

    return {
        id: `solo-bot-${String(slot).padStart(3, '0')}`,
        name: displayName.substring(0, 14),
        displayName,
        profession,
        hp: base.maxHp,
        maxHp: base.maxHp,
        status: 'Healthy',
        items: [...base.startItems],
        kills: 0,
        alive: true,
        isBot: true,
    };
}

function createGame(channelId, hostId, eraId = 'oregon-trail') {
    return {
        channelId,
        hostId,
        eraId,
        phase: 'lobby',
        trailPhase: 'departure',
        quietBuffer: null,
        knownStatuses: {},
        pendingChoice: null,
        pendingRiver: null,
        flags: { groupChoiceDone: false, personalChoiceDone: false },
        modifiers: { combatBias: 0, diseaseBias: 0, milesBonus: 0, ticksRemaining: 0 },
        party: [],
        day: 0,
        distance: 0,
        rations: 0,
        weather: 'Fair',
        river1Done: false,
        river2Done: false,
        river3Done: false,
        log: [],
    };
}

function runDay(game) {
    const pack = getThemePack(game.eraId);
    const Events = pack.events;
    const weights = pack.eventWeights;
    const events = [];

    game.day++;
    game.weather = pick(pack.weathers);

    const phase = getPhase(game.distance);
    const mult = getPhaseMultipliers(phase);
    const prevDistance = game.distance;
    const miles = Math.round(rand(14, 28) * mult.miles) + (game.modifiers.milesBonus || 0);
    game.modifiers.milesBonus = 0;
    game.distance += miles;
    game.trailPhase = getPhase(game.distance);

    const alive = game.party.filter((c) => c.alive);
    const consumed = alive.length * 3;
    game.rations = Math.max(0, game.rations - consumed);

    events.push({
        type: 'day',
        severity: 'routine',
        text: `Wagon advanced **${miles} miles** | Weather: **${game.weather}** | Rations: **${Math.max(0, game.rations)} lbs** | Alive: **${alive.length}**`,
        distance: game.distance,
        day: game.day,
        weather: game.weather,
        rations: game.rations,
    });

    for (const mark of pack.landmarks) {
        if (prevDistance < mark.mi && game.distance >= mark.mi) {
            events.push({
                type: 'day',
                landmark: true,
                landmarkName: mark.name,
                text: `**Landmark: ${mark.name}**`,
            });
        }
    }

    for (const c of alive) {
        if (c.status !== 'Healthy') {
            const isVenom = c.status === pack.venomStatus;
            let dmg = isVenom ? 18 : 13;
            if (game.weather === 'Scorching' || game.weather === 'Blizzard') dmg += 5;
            c.hp -= dmg;

            events.push({
                type: 'disease',
                text: `**${c.name}** suffers **${dmg} HP** of damage from ${c.status}. (${Math.max(0, c.hp)}/${c.maxHp} HP remaining)`,
            });

            if (c.hp > 0) {
                const medIdx = c.items.indexOf('Medicine');
                if (medIdx !== -1) {
                    c.items.splice(medIdx, 1);
                    c.status = 'Healthy';
                    c.hp = Math.min(c.maxHp, c.hp + 25);
                    events.push({ type: 'item', text: `**${c.name}** consumed Medicine and recovered! (${c.hp}/${c.maxHp} HP)` });
                } else if (Math.random() < 0.12) {
                    const prevStatus = c.status;
                    c.status = 'Healthy';
                    events.push({
                        type: 'passive',
                        text: `**${c.name}** miraculously recovered from **${prevStatus}** without medicine.`,
                    });
                }
            }

            if (c.hp <= 0) {
                events.push(...killCharacter(c, `${c.status}`));
            }
        }

        if (game.rations <= 0 && c.alive) {
            c.hp -= 10;
            events.push({ type: 'disease', text: `**${c.name}** is starving. **-10 HP**. (${Math.max(0, c.hp)}/${c.maxHp} HP)` });
            if (c.hp <= 0) events.push(...killCharacter(c, 'starvation'));
        }
    }

    const aliveAfterDisease = game.party.filter((c) => c.alive);
    if (['Scorching', 'Blizzard', 'Stormy'].includes(game.weather) && Math.random() < 0.35 && aliveAfterDisease.length > 0) {
        const victim = pick(aliveAfterDisease);
        const template = Events.weatherEvents[game.weather];
        if (template) {
            victim.hp -= 10;
            events.push({ type: 'disease', text: template.replace('{v}', `**${victim.name}**`) });
            if (victim.hp <= 0) events.push(...killCharacter(victim, 'exposure'));
        }
    }

    const stillAlive = game.party.filter((c) => c.alive);
    if (stillAlive.length <= 1) return events;

    for (const river of Events.rivers) {
        const idx = Events.rivers.indexOf(river);
        const key = `river${idx + 1}Done`;
        if (!game[key] && game.distance >= river.distance && game.distance <= river.distance + 25) {
            game[key] = true;
            game.pendingRiver = { index: idx, name: river.name, river, key };
            events.push({ type: 'day', text: `**River crossing: ${river.name}**`, river: true });
            return events;
        }
    }

    const aliveNow = game.party.filter((c) => c.alive);
    if (aliveNow.length < 2) return events;

    const w = {
        combat: Math.min(0.95, weights.combat * mult.combat + (game.modifiers.combatBias || 0)),
        disease: Math.min(0.95, weights.disease * mult.disease + (game.modifiers.diseaseBias || 0)),
        loot: weights.loot,
        hunt: weights.hunt,
    };
    if (game.modifiers.ticksRemaining > 0) game.modifiers.ticksRemaining--;

    if (mult.forceCombat && aliveNow.length >= 2) {
        events.push(...resolveCombat(aliveNow, pack));
    } else {
        const roll = Math.random();

        if (roll < w.combat) {
            events.push(...resolveCombat(aliveNow, pack));
        } else if (roll < w.disease) {
            const victim = pick(aliveNow.filter((c) => c.status === 'Healthy'));
            if (victim) {
                const sickness = pick(Events.diseases);
                victim.status = sickness.status;
                pushEvent(events, { type: 'disease', text: sickness.msg.replace('{v}', `**${victim.name}**`) }, game, victim);
            }
        } else if (roll < w.loot) {
            const finder = pick(aliveNow);
            const loot = pick(Events.loot);
            if (loot.item === 'Rations') {
                game.rations += loot.amount;
            } else if (!finder.items.includes(loot.item)) {
                finder.items.push(loot.item);
            }
            const lootEvent = { type: 'item', text: loot.msg.replace('{v}', `**${finder.name}**`) };
            if (loot.item === 'Shotgun' || (loot.item === 'Rations' && loot.amount >= 50)) {
                lootEvent.rareLoot = true;
            }
            events.push(lootEvent);
        } else if (roll < w.hunt) {
            const hunters = aliveNow.filter((c) => c.profession === pack.hunterProfession);
            const hunter = hunters.length > 0 && Math.random() < 0.65 ? pick(hunters) : pick(aliveNow);
            const result = pick(Events.hunting);
            let msg = result.msg.replace('{v}', `**${hunter.name}**`);
            if (result.success) {
                const gain = result.big ? 60 : rand(15, 30);
                game.rations += gain;
                msg = msg.replace(/\+\d+ lbs/, `+${gain} lbs`);
                events.push({ type: 'item', text: msg });
            } else {
                events.push({ type: 'passive', text: msg });
            }
        } else {
            const subject = pick(aliveNow);
            const template = pick(Events.passive);
            let msg = template.replace('{v}', `**${subject.name}**`);
            if (template.includes('+15 HP')) {
                subject.hp = Math.min(subject.maxHp, subject.hp + 15);
            }
            events.push({ type: 'passive', text: msg });
        }
    }

    return events;
}

function resolveCombat(alive, pack) {
    if (alive.length < 2) return [];
    const Events = pack.events;
    const events = [];

    const attackerIdx = rand(0, alive.length - 1);
    let victimIdx = rand(0, alive.length - 1);
    while (victimIdx === attackerIdx) victimIdx = rand(0, alive.length - 1);

    const attacker = alive[attackerIdx];
    const victim = alive[victimIdx];

    const hasShotgun = attacker.items.includes('Shotgun');
    const instaRoll = Math.random() < (hasShotgun ? 0.15 : 0.08);

    if (instaRoll) {
        const template = pick(Events.instakill);
        const msg = template
            .replace('{a}', `**${attacker.name}**`)
            .replace('{b}', `**${victim.name}**`);
        attacker.kills++;
        events.push({ type: 'combat', text: msg });
        events.push(...killCharacter(victim, `**${attacker.name}**`));
    } else {
        let dmg = hasShotgun ? rand(45, 70) : rand(15, 40);
        if (victim.profession === pack.tankProfession) dmg = Math.floor(dmg * 0.82);

        const templates = hasShotgun ? Events.shotgun : Events.combat;
        const template = pick(templates);
        const msg = template
            .replace(/\{a\}/g, `**${attacker.name}**`)
            .replace(/\{b\}/g, `**${victim.name}**`)
            .replace('{dmg}', dmg);

        victim.hp -= dmg;
        events.push({ type: 'combat', text: msg });

        if (victim.hp <= 0) {
            attacker.kills++;
            events.push(...killCharacter(victim, `**${attacker.name}**`));
        }
    }

    return events;
}

function formatDeathText(name, cause) {
    const trimmed = cause.trim();
    if (/^\*\*.+\*\*$/.test(trimmed)) {
        return `**${name}** was killed by ${trimmed}.`;
    }
    if (trimmed.startsWith('drowning') || trimmed.startsWith('injuries')) {
        return `**${name}** ${trimmed}.`;
    }
    const plain = trimmed.replace(/\*\*/g, '');
    return `**${name}** has died of **${plain}**.`;
}

function killCharacter(character, cause) {
    character.alive = false;
    character.hp = 0;
    return [{
        type: 'death',
        text: formatDeathText(character.name, cause),
        victim: character.name,
    }];
}

function checkWinner(game) {
    const pack = getThemePack(game.eraId);
    const Events = pack.events;
    const alive = game.party.filter((c) => c.alive);

    if (alive.length === 0) {
        return { winner: null, text: pick(Events.victory).replace('{v}', 'Nobody').replace('{kills}', '0').replace('{s}', 's') };
    }
    if (alive.length === 1) {
        const w = alive[0];
        const template = Events.victory[Math.floor(Math.random() * 2)];
        return {
            winner: w,
            text: template
                .replace(/\{v\}/g, w.name)
                .replace('{kills}', w.kills)
                .replace('{s}', pluralS(w.kills)),
        };
    }
    if (game.distance >= 1000) {
        while (alive.length > 1) {
            const a = pick(alive);
            const b = alive.find((c) => c !== a);
            b.alive = false;
            b.hp = 0;
            a.kills++;
            const remaining = alive.filter((c) => c.alive);
            alive.length = 0;
            alive.push(...remaining);
        }
        return checkWinner(game);
    }
    return null;
}

function resolveRiverChoice(game, choiceId) {
    const pending = game.pendingRiver;
    if (!pending) return [];

    const { river, name } = pending;
    game.pendingRiver = null;
    const stillAlive = game.party.filter(c => c.alive);
    if (stillAlive.length === 0) return [];

    const events = [];
    const victim = pick(stillAlive);
    let roll = Math.random();

    if (choiceId === 'ford') {
        if (roll < 0.25) {
            events.push(...killCharacter(victim, `drowning in the ${name}`));
            events.push({ type: 'death', notable: true, text: `**${victim.name}** drowned fording **${name}**.` });
        } else if (roll < 0.75) {
            const dmg = rand(15, 35);
            victim.hp -= dmg;
            events.push({ type: 'combat', notable: true, text: `**${victim.name}** struggled crossing **${name}**. **-${dmg} HP**.` });
            if (victim.hp <= 0) events.push(...killCharacter(victim, `injuries at the ${name}`));
        } else {
            events.push({ type: 'passive', notable: true, text: `The party forded **${name}** without loss.` });
        }
    } else if (choiceId === 'caulk') {
        if (roll < 0.15) {
            game.rations = Math.max(0, game.rations - 30);
            events.push({ type: 'passive', notable: true, text: `Caulk failed at **${name}**. **-30 lbs** rations lost.` });
        } else if (roll < 0.85) {
            events.push({ type: 'passive', notable: true, text: `The wagons floated **${name}** safely.` });
        } else {
            events.push(...killCharacter(victim, `drowning in the ${name}`));
            events.push({ type: 'death', notable: true, text: `**${victim.name}** capsized at **${name}**.` });
        }
    } else {
        events.push({ type: 'passive', notable: true, text: `The party waited out **${name}**. The trail grows colder.` });
        const extra = runDay(game);
        events.push(...extra);
    }

    return events;
}

module.exports = { createGame, createCharacter, createBotCharacter, runDay, checkWinner, syncPhase, resolveRiverChoice };
