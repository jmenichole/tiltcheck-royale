/**
 * TILTCHECK ROYALE - Simulation Engine
 * Core game logic: character management, daily ticks, event resolution.
 */

const Events = require('./events.js');

// --- Class Definitions ---
const CLASS_BONUSES = {
    Banker:    { maxHp: 80,  startItems: ['Medicine'],          label: 'Banker'    },
    Carpenter: { maxHp: 100, startItems: ['Canteen', 'Shotgun'],label: 'Carpenter' },
    Farmer:    { maxHp: 120, startItems: ['Canteen'],           label: 'Farmer'    },
    Teacher:   { maxHp: 90,  startItems: ['Medicine', 'Canteen'],label: 'Teacher'  },
    Doctor:    { maxHp: 100, startItems: ['Medicine', 'Medicine'],label: 'Doctor'  },
};

const CLASSES = Object.keys(CLASS_BONUSES);
const WEATHERS = ['Fair', 'Fair', 'Fair', 'Rainy', 'Scorching', 'Stormy', 'Blizzard'];

// --- Utility Helpers ---
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pluralS(n) {
    return n === 1 ? '' : 's';
}

// --- Character Factory ---
function createCharacter(discordUser) {
    const profession = pick(CLASSES);
    const base = CLASS_BONUSES[profession];
    return {
        id:         discordUser.id,
        name:       discordUser.username.substring(0, 14),
        displayName: discordUser.displayName || discordUser.username,
        profession,
        hp:         base.maxHp,
        maxHp:      base.maxHp,
        status:     'Healthy',
        items:      [...base.startItems],
        kills:      0,
        alive:      true,
    };
}

// --- Game State Factory ---
function createGame(channelId, hostId) {
    return {
        channelId,
        hostId,
        phase:      'lobby',   // lobby | running | ended
        party:      [],        // array of character objects
        day:        0,
        distance:   0,
        rations:    0,
        weather:    'Fair',
        river1Done: false,
        river2Done: false,
        river3Done: false,
        log:        [],        // array of { type, text } for WebSocket sync
    };
}

// --- Simulation Step ---
// Returns an array of { type, text } event objects for one day.
function runDay(game) {
    const events = [];
    game.day++;
    game.weather = pick(WEATHERS);

    // Travel
    const miles = rand(10, 22);
    game.distance += miles;

    const alive = game.party.filter(c => c.alive);

    // Consume rations
    const consumed = alive.length * 3;
    game.rations = Math.max(0, game.rations - consumed);

    events.push({
        type: 'day',
        text: `Wagon advanced **${miles} miles** | Weather: **${game.weather}** | Rations: **${Math.max(0, game.rations)} lbs** | Alive: **${alive.length}**`,
        distance: game.distance,
        day: game.day,
        weather: game.weather,
        rations: game.rations,
    });

    // --- Disease Tick ---
    for (const c of alive) {
        if (c.status !== 'Healthy') {
            let dmg = c.status === 'Rattlesnake Bite' ? 18 : 13;
            if (game.weather === 'Scorching' || game.weather === 'Blizzard') dmg += 5;
            c.hp -= dmg;

            events.push({
                type: 'disease',
                text: `🤢 **${c.name}** suffers **${dmg} HP** of damage from ${c.status}. (${Math.max(0, c.hp)}/${c.maxHp} HP remaining)`,
            });

            // Try to self-cure
            if (c.hp > 0) {
                const medIdx = c.items.indexOf('Medicine');
                if (medIdx !== -1) {
                    c.items.splice(medIdx, 1);
                    c.status = 'Healthy';
                    c.hp = Math.min(c.maxHp, c.hp + 25);
                    events.push({ type: 'item', text: `💊 **${c.name}** consumed Medicine and recovered! (${c.hp}/${c.maxHp} HP)` });
                } else if (Math.random() < 0.12) {
                    c.status = 'Healthy';
                    events.push({ type: 'passive', text: `😮 **${c.name}** miraculously recovered from ${c.status} without medicine.` });
                }
            }

            if (c.hp <= 0) {
                events.push(...killCharacter(c, `${c.status}`));
            }
        }

        // Starvation
        if (game.rations <= 0 && c.alive) {
            c.hp -= 10;
            events.push({ type: 'disease', text: `😫 **${c.name}** is starving. **-10 HP**. (${Math.max(0,c.hp)}/${c.maxHp} HP)` });
            if (c.hp <= 0) events.push(...killCharacter(c, 'starvation'));
        }
    }

    // --- Weather Damage (chance) ---
    const aliveAfterDisease = game.party.filter(c => c.alive);
    if (['Scorching', 'Blizzard', 'Stormy'].includes(game.weather) && Math.random() < 0.35 && aliveAfterDisease.length > 0) {
        const victim = pick(aliveAfterDisease);
        const template = Events.weatherEvents[game.weather];
        if (template) {
            victim.hp -= 10;
            events.push({ type: 'disease', text: template.replace('{v}', `**${victim.name}**`) });
            if (victim.hp <= 0) events.push(...killCharacter(victim, 'exposure'));
        }
    }

    // Re-check alive count
    const stillAlive = game.party.filter(c => c.alive);
    if (stillAlive.length <= 1) return events;

    // --- River Crossing Check ---
    for (const river of Events.rivers) {
        const key = `river${Events.rivers.indexOf(river) + 1}Done`;
        if (!game[key] && game.distance >= river.distance && game.distance <= river.distance + 25) {
            game[key] = true;
            events.push({ type: 'day', text: `\`\`\`\n━━━ RIVER CROSSING: ${river.name.toUpperCase()} ━━━\n\`\`\`` });

            const roll = Math.random();
            const victim = pick(stillAlive);
            let outcome;

            if (roll < 0.25)      outcome = river.outcomes[0]; // drown
            else if (roll < 0.60) outcome = river.outcomes[1]; // damage
            else                  outcome = river.outcomes[2]; // safe

            let msg = outcome.msg
                .replace('{v}', `**${victim.name}**`)
                .replace('{dmg}', outcome.dmg || 0);

            if (outcome.type === 'drown') {
                events.push(...killCharacter(victim, `drowning in the ${river.name}`));
                events.push({ type: 'death', text: msg });
            } else if (outcome.type === 'damage') {
                victim.hp -= outcome.dmg;
                game.rations = Math.max(0, game.rations - (outcome.rationLoss || 0));
                events.push({ type: 'combat', text: msg });
                if (victim.hp <= 0) events.push(...killCharacter(victim, `injuries at the ${river.name}`));
            } else {
                events.push({ type: 'passive', text: msg });
            }

            return events; // Only one river event per day
        }
    }

    // --- Random Event ---
    const aliveNow = game.party.filter(c => c.alive);
    if (aliveNow.length < 2) return events;

    const roll = Math.random();

    if (roll < 0.38) {
        // Combat
        events.push(...resolveCombat(aliveNow));
    } else if (roll < 0.52) {
        // Disease
        const victim = pick(aliveNow.filter(c => c.status === 'Healthy'));
        if (victim) {
            const sickness = pick(Events.diseases);
            victim.status = sickness.status;
            events.push({ type: 'disease', text: sickness.msg.replace('{v}', `**${victim.name}**`) });
        }
    } else if (roll < 0.67) {
        // Loot
        const finder = pick(aliveNow);
        const loot = pick(Events.loot);
        if (loot.item === 'Rations') {
            game.rations += loot.amount;
        } else if (!finder.items.includes(loot.item)) {
            finder.items.push(loot.item);
        }
        events.push({ type: 'item', text: loot.msg.replace('{v}', `**${finder.name}**`) });
    } else if (roll < 0.82) {
        // Hunting
        const hunters = aliveNow.filter(c => c.profession === 'Farmer');
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
        // Passive
        const subject = pick(aliveNow);
        let template = pick(Events.passive);
        let msg = template.replace('{v}', `**${subject.name}**`);
        if (template.includes('+15 HP')) {
            subject.hp = Math.min(subject.maxHp, subject.hp + 15);
        }
        events.push({ type: 'passive', text: msg });
    }

    return events;
}

// --- Combat Resolution ---
function resolveCombat(alive) {
    if (alive.length < 2) return [];
    const events = [];

    const attackerIdx = rand(0, alive.length - 1);
    let victimIdx = rand(0, alive.length - 1);
    while (victimIdx === attackerIdx) victimIdx = rand(0, alive.length - 1);

    const attacker = alive[attackerIdx];
    const victim   = alive[victimIdx];

    const hasShotgun = attacker.items.includes('Shotgun');
    const instaRoll  = Math.random() < (hasShotgun ? 0.15 : 0.08);

    if (instaRoll) {
        // Instakill
        const template = pick(Events.instakill);
        const msg = template
            .replace('{a}', `**${attacker.name}**`)
            .replace('{b}', `**${victim.name}**`);
        attacker.kills++;
        events.push({ type: 'combat', text: msg });
        events.push(...killCharacter(victim, `**${attacker.name}**`));
    } else {
        // Normal hit
        let dmg = hasShotgun ? rand(45, 70) : rand(15, 40);
        if (victim.profession === 'Doctor') dmg = Math.floor(dmg * 0.82);

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

// --- Kill a character ---
function killCharacter(character, cause) {
    character.alive = false;
    character.hp = 0;
    return [{
        type: 'death',
        text: `☠️ **${character.name}** has died of ${cause}.`,
        victim: character.name,
    }];
}

// --- Check Win Condition ---
function checkWinner(game) {
    const alive = game.party.filter(c => c.alive);
    if (alive.length === 0) {
        return { winner: null, text: pick(Events.victory).replace('{v}', 'Nobody').replace('{kills}', '0').replace('{s}', 's') };
    }
    if (alive.length === 1) {
        const w = alive[0];
        const template = Events.victory[Math.floor(Math.random() * 2)]; // only non-dead templates
        return {
            winner: w,
            text: template
                .replace(/\{v\}/g, w.name)
                .replace('{kills}', w.kills)
                .replace('{s}', pluralS(w.kills)),
        };
    }
    if (game.distance >= 1000) {
        // Final shootout
        while (alive.length > 1) {
            const a = pick(alive);
            const b = alive.find(c => c !== a);
            b.alive = false;
            b.hp = 0;
            a.kills++;
            const remaining = alive.filter(c => c.alive);
            alive.length = 0;
            alive.push(...remaining);
        }
        return checkWinner(game);
    }
    return null;
}

module.exports = { createGame, createCharacter, runDay, checkWinner };
