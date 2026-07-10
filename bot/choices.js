/**
 * Mid-trail player choices — group votes, personal picks, river crossings.
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { COLORS } = require('./trail-theme.js');

const CHOICE_MS = 18000;

const GROUP_CHOICES = [
    { id: 'push_pace', label: '🏃 Push pace', style: ButtonStyle.Danger },
    { id: 'make_camp', label: '🏕️ Make camp', style: ButtonStyle.Success },
    { id: 'hunt', label: '🎯 Hunt', style: ButtonStyle.Primary },
];

const PERSONAL_CHOICES = [
    { id: 'use_medicine', label: '💊 Use medicine', style: ButtonStyle.Success },
    { id: 'raid_supplies', label: '🔫 Raid supplies', style: ButtonStyle.Danger },
    { id: 'help_other', label: '🤝 Help another', style: ButtonStyle.Primary },
    { id: 'sabotage', label: '🗡️ Sabotage', style: ButtonStyle.Secondary },
];

const RIVER_CHOICES = [
    { id: 'ford', label: '🌊 Ford it', style: ButtonStyle.Danger },
    { id: 'caulk', label: '🛶 Caulk & float', style: ButtonStyle.Primary },
    { id: 'wait', label: '⏳ Wait', style: ButtonStyle.Secondary },
];

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function alivePlayers(game) {
    return game.party.filter(c => c.alive);
}

function tallyGroupVotes(votes) {
    const counts = {};
    for (const choiceId of votes.values()) {
        counts[choiceId] = (counts[choiceId] || 0) + 1;
    }
    let winner = 'make_camp';
    let max = 0;
    for (const [id, count] of Object.entries(counts)) {
        if (count > max) {
            max = count;
            winner = id;
        }
    }
    return { winner, counts };
}

function buildChoiceEmbed(type, game, extra = {}) {
    const titles = {
        group: '🗳️ Trail Decision — vote now',
        personal: '🎒 Personal choice — pick your move',
        river: `🌊 River crossing — ${extra.riverName || 'the ford'}`,
    };
    const bodies = {
        group: 'The party must decide how to press on. **Alive pioneers vote** — plurality wins.',
        personal: 'Each survivor chooses alone. Pick one action before time runs out.',
        river: 'How do you cross? **Wagon leader decides** if multiple remain.',
    };
    return new EmbedBuilder()
        .setColor(COLORS.amber)
        .setTitle(titles[type] || 'Choose')
        .setDescription(bodies[type] || '')
        .setFooter({ text: `Choose in ${Math.floor(CHOICE_MS / 1000)}s…` })
        .setTimestamp();
}

function buildChoiceButtons(type) {
    const defs = type === 'group' ? GROUP_CHOICES
        : type === 'personal' ? PERSONAL_CHOICES
            : RIVER_CHOICES;
    const row = new ActionRowBuilder();
    for (const c of defs) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`choice_${type}:${c.id}`)
                .setLabel(c.label)
                .setStyle(c.style),
        );
    }
    return [row];
}

function applyGroupChoice(game, choiceId) {
    const events = [];
    const alive = alivePlayers(game);
    if (choiceId === 'push_pace') {
        game.modifiers.milesBonus += 20;
        game.modifiers.combatBias += 0.10;
        game.modifiers.diseaseBias += 0.10;
        game.modifiers.ticksRemaining = 2;
        events.push({ type: 'passive', notable: true, text: '**The party pushes hard.** Extra miles — extra danger.' });
    } else if (choiceId === 'make_camp') {
        for (const c of alive) c.hp = Math.min(c.maxHp, c.hp + 10);
        game.distance = Math.max(0, game.distance - 12);
        game.modifiers.combatBias -= 0.10;
        game.modifiers.ticksRemaining = 2;
        events.push({ type: 'passive', notable: true, text: '**Camp made.** Rest and repair. The trail waits.' });
    } else if (choiceId === 'hunt') {
        game.rations += 35;
        const unlucky = pick(alive);
        if (Math.random() < 0.30) {
            unlucky.hp = Math.max(0, unlucky.hp - 15);
            events.push({ type: 'disease', notable: true, text: `**${unlucky.name}** took exposure on the hunt. **-15 HP**.` });
            if (unlucky.hp <= 0) unlucky.alive = false;
        }
        events.push({ type: 'item', notable: true, text: '**The hunt succeeds.** **+35 lbs** of rations.' });
    }
    game.flags.groupChoiceDone = true;
    return events;
}

function applyPersonalChoice(game, userId, choiceId) {
    const character = game.party.find(c => c.id === userId && c.alive);
    if (!character) return [];
    const events = [];
    const alive = alivePlayers(game).filter(c => c.id !== userId);

    if (choiceId === 'use_medicine') {
        if (Math.random() < 0.70) {
            character.status = 'Healthy';
            character.hp = Math.min(character.maxHp, character.hp + 20);
            events.push({ type: 'item', notable: true, text: `**${character.name}** used medicine and recovered!` });
        } else {
            events.push({ type: 'passive', notable: true, text: `**${character.name}** wasted a dose. Nothing changed.` });
        }
    } else if (choiceId === 'raid_supplies') {
        if (Math.random() < 0.50) {
            const loot = pick(['Medicine', 'Canteen', 'Shotgun']);
            if (!character.items.includes(loot)) character.items.push(loot);
            events.push({ type: 'item', notable: true, rareLoot: loot === 'Shotgun', text: `**${character.name}** raided supplies and found **${loot}**.` });
        } else {
            character.hp = Math.max(0, character.hp - 20);
            events.push({ type: 'combat', notable: true, text: `**${character.name}** was caught raiding. **-20 HP**.` });
            if (character.hp <= 0) character.alive = false;
        }
    } else if (choiceId === 'help_other' && alive.length > 0) {
        const target = pick(alive);
        target.hp = Math.min(target.maxHp, target.hp + 15);
        character.hp = Math.min(character.maxHp, character.hp + 5);
        events.push({ type: 'passive', notable: true, text: `**${character.name}** helped **${target.name}**. Both gain strength.` });
    } else if (choiceId === 'sabotage' && alive.length > 0) {
        if (Math.random() < 0.40) {
            const target = pick(alive);
            target.hp = Math.max(0, target.hp - 30);
            events.push({ type: 'combat', notable: true, text: `**${character.name}** sabotaged **${target.name}**. **-30 HP**.` });
            if (target.hp <= 0) target.alive = false;
        } else {
            character.hp = Math.max(0, character.hp - 10);
            events.push({ type: 'combat', notable: true, text: `**${character.name}** bungled the sabotage. **-10 HP**.` });
            if (character.hp <= 0) character.alive = false;
        }
    }
    return events;
}

function formatGroupResult(winner, counts) {
    const labels = Object.fromEntries(GROUP_CHOICES.map(c => [c.id, c.label]));
    const tally = Object.entries(counts).map(([id, n]) => `${labels[id] || id} (${n})`).join(', ');
    return `**${labels[winner] || winner}** wins${tally ? ` — ${tally}` : ''}.`;
}

function checkChoiceTriggers(game) {
    if (game.pendingChoice || game.pendingRiver) return null;
    if (!game.flags.groupChoiceDone && game.distance >= 150) return 'group';
    if (!game.flags.personalChoiceDone && game.trailPhase === 'killzone') return 'personal';
    return null;
}

function botAutoVote(game, pendingChoice) {
    const alive = alivePlayers(game).filter(c => c.isBot);
    for (const bot of alive) {
        if (pendingChoice.type === 'group' || pendingChoice.type === 'personal') {
            if (!pendingChoice.votes.has(bot.id)) {
                const options = pendingChoice.type === 'group'
                    ? GROUP_CHOICES.map(c => c.id)
                    : PERSONAL_CHOICES.map(c => c.id);
                pendingChoice.votes.set(bot.id, pick(options));
            }
        }
    }
}

module.exports = {
    CHOICE_MS,
    GROUP_CHOICES,
    PERSONAL_CHOICES,
    RIVER_CHOICES,
    tallyGroupVotes,
    buildChoiceEmbed,
    buildChoiceButtons,
    applyGroupChoice,
    applyPersonalChoice,
    formatGroupResult,
    checkChoiceTriggers,
    botAutoVote,
    alivePlayers,
};
