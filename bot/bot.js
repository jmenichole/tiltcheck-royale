/**
 * TILT BATTLE ROYALE - Discord Bot
 * Slash commands, lobby, simulation, and daily embeds — Discord-only (no Activity).
 */

require('dotenv').config();
const http = require('http');
const express = require('express');
const {
    Client, GatewayIntentBits, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    Events: DEvents,
} = require('discord.js');
const { requireEnv, getConfig } = require('./config.js');
const { createGame, createCharacter, createBotCharacter, runDay, checkWinner, syncPhase, resolveRiverChoice } = require('./simulation.js');
const {
    CHOICE_MS, buildChoiceEmbed, buildChoiceButtons,
    applyGroupChoice, applyPersonalChoice, formatGroupResult,
    checkChoiceTriggers, botAutoVote, tallyGroupVotes, alivePlayers,
} = require('./choices.js');
const {
    TICK_MS, QUIET_FLUSH_DAYS, isNotableEvent,
    createQuietBuffer, extendQuietBuffer, quietBufferDaySpan, formatQuietSummary, getPhaseFlavor,
} = require('./pacing.js');
const {
    hasSupporterFromEntitlements,
    hasTrailPassAccess,
} = require('./premium.js');
const { getEra, getLandmark, getThemePack } = require('./themes/index.js');
const {
    COLORS,
    pickDayHeader,
    formatDayTitle,
    dayEmbedColor,
    getDayThumbnail,
    pickSupportWink,
    formatTrailNarrative,
    formatHighlightTitle,
    buildPhaseEmbed,
    formatDayFooter,
    WAGON_ASCII,
    DEPART_ASCII,
    LOBBY_THUMBNAIL,
    VICTORY_THUMBNAIL,
} = require('./trail-theme.js');

requireEnv();
const config = getConfig();

const FOOTER = 'Tilt Battle Royale';
const BRAND = 'TILT BATTLE ROYALE';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const activeGames = new Map();

const app = express();
app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'tilt-battle-royale-bot', games: activeGames.size });
});
const server = http.createServer(app);

const COLOR_TRAIL = COLORS.trail;
const COLOR_GOLD  = COLORS.gold;

function formatRosterLine(c, index) {
    const botTag = c.isBot ? ' 🤖' : '';
    const tag = c.isSupporter ? ' *(packed extra bacon)*' : '';
    return `\`${index + 1}.\` ${c.displayName} *(${c.profession})*${tag}${botTag}`;
}

function buildLobbyEmbed(game, secondsLeft) {
    const era = getEra(game.eraId);
    const pack = getThemePack(game.eraId);
    const botCount = game.party.filter(c => c.isBot).length;
    const names = game.party.length > 0
        ? game.party.map((c, i) => formatRosterLine(c, i)).join('\n')
        : '*No pioneers yet. Be the first to board!*';

    const soloNote = botCount > 0
        ? `\n🤖 **Solo test:** ${botCount} fake pioneer${botCount === 1 ? '' : 's'} boarded.\n`
        : '';

    return new EmbedBuilder()
        .setColor(COLOR_TRAIL)
        .setTitle('🛤️ WAGON DEPOT — LOBBY OPEN')
        .setDescription(
            `${WAGON_ASCII}\n` +
            `${DEPART_ASCII}\n` +
            `*${pack.lobbyTagline || 'The trail is long.'}*\n` +
            `**Era:** ${era.name}\n` +
            `The trail is long. **Only one pioneer survives.**\n` +
            soloNote +
            `\n⏳ **Departing in ${secondsLeft} seconds...**\n` +
            `> *${pickSupportWink()}*`
        )
        .addFields({ name: `🪙 Party roster (${game.party.length}/20)`, value: names })
        .setThumbnail(LOBBY_THUMBNAIL)
        .setFooter({ text: `Join the Wagon • ${FOOTER} • Parody trail sim` })
        .setTimestamp();
}

function buildDayEmbed(day, events, distance, weather, rations, aliveCount, total, eraId) {
    const landmark = getLandmark(distance, eraId);
    const hasDeath = events.some(e => e.type === 'death');
    const header = pickDayHeader(day, weather, events, landmark);
    const eraName = getEra(eraId).name;

    const embed = new EmbedBuilder()
        .setColor(dayEmbedColor(weather, hasDeath))
        .setTitle(formatDayTitle(header, day))
        .setDescription(
            `*${header.flavor}*\n\n` +
            formatTrailNarrative(events)
        )
        .setFooter({
            text: formatDayFooter(distance, weather, rations, aliveCount, total, landmark.name, eraName),
        })
        .setTimestamp();

    if (hasDeath) {
        embed.setThumbnail(getDayThumbnail(landmark, true));
    }

    return embed;
}

function buildVictoryEmbed(text, winner, eraId = 'oregon-trail') {
    const pack = getThemePack(eraId);
    const banner = pack.victoryBanner || '**★ Trail Complete ★**';
    const footer = winner?.isSupporter
        ? `${FOOTER} — The oxen remember you fondly.`
        : `${FOOTER} — ${pickSupportWink()}`;

    const embed = new EmbedBuilder()
        .setColor(COLOR_GOLD)
        .setTitle('🏆 Trail Complete')
        .setDescription(`${banner}\n\n${text}`)
        .setThumbnail(VICTORY_THUMBNAIL)
        .setTimestamp()
        .setFooter({ text: footer });

    if (winner) {
        embed.addFields(
            { name: '💀 Final Kill Count', value: `${winner.kills} kill${winner.kills === 1 ? '' : 's'}`, inline: true },
            { name: '🪖 Profession', value: winner.profession, inline: true },
        );
        if (winner.isSupporter) {
            embed.addFields({
                name: '🐂 Spare Oxen Club',
                value: 'You brought a second ox nobody asked for. The trail salutes you.',
                inline: false,
            });
        }
    }
    return embed;
}

function buildSupportEmbed() {
    const lines = [
        '**Technical help** — bot not responding, `/royale` missing, or match stuck?',
        config.supportServerUrl
            ? `→ Join the support server: ${config.supportServerUrl}`
            : '→ Ask your server admin to contact the bot owner, or open the bot profile → Message.',
        '',
        '**Feedback** — use `/support` with a type:',
        '→ 🐛 **Bug report** — something broke',
        '→ 💡 **Suggestion** — ideas for the trail',
        '→ 👋 **Say hi to dev** — just being friendly',
        '→ ☕ **Donation link** — Ko-fi tip jar sent to your DMs',
        '',
        '**Trail Pass** — unlock all trail eras forever (host-only).',
        `→ [Get Trail Pass](${config.storeUrl})`,
        '',
        '**Feed the oxen** — optional Pioneer Supporter tip jar. Zero gameplay perks.',
        `→ [General store](${config.storeUrl})`,
    ];

    return new EmbedBuilder()
        .setColor(COLOR_TRAIL)
        .setTitle(`🛟 ${BRAND} — Trail Support`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'We read every suggestion — thanks for playing!' })
        .setTimestamp();
}

function buildDonateDmEmbed() {
    return new EmbedBuilder()
        .setColor(COLOR_GOLD)
        .setTitle('☕ Feed the oxen')
        .setDescription(
            'Optional tip jar — **zero gameplay perks**, just good trail vibes.\n\n' +
            `→ [**Support on Ko-fi**](${config.kofiUrl})\n\n` +
            'Thanks for playing Tilt Battle Royale!',
        )
        .setFooter({ text: 'The oxen remember every kindness.' })
        .setTimestamp();
}

async function handleSupportCommand(interaction) {
    const type = interaction.options.getString('type', true);
    const details = interaction.options.getString('details')?.trim() || '';

    if (type === 'donate') {
        await interaction.deferReply({ ephemeral: true });
        try {
            await interaction.user.send({ embeds: [buildDonateDmEmbed()] });
            await interaction.editReply({ content: '✅ Sent the Ko-fi link to your DMs!' });
        } catch {
            await interaction.editReply({
                content: '⚠️ Couldn\'t DM you — your privacy settings may block bot messages. Here\'s the link:',
                embeds: [buildDonateDmEmbed()],
            });
        }
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    if (type === 'say_hi') {
        const note = details || '(waved from the trail)';
        console.log(`[support:hi] ${interaction.user.tag} (${interaction.user.id}): ${note}`);
        await interaction.editReply({
            content: (
                `👋 **Howdy, ${interaction.user.username}!**\n` +
                'The dev sees you. Thanks for playing — the oxen appreciate every pioneer.\n\n' +
                (details ? `_You said: ${details}_` : '_Trail on, pioneer._')
            ),
        });
        return;
    }

    if (type === 'bug_report' || type === 'suggestion') {
        if (!details) {
            return interaction.editReply({
                content: `❌ Please add **details** for your ${type === 'bug_report' ? 'bug report' : 'suggestion'}.`,
            });
        }

        const label = type === 'bug_report' ? 'bug' : 'suggestion';
        console.log(`[support:${label}] ${interaction.user.tag} (${interaction.user.id}): ${details}`);

        const embed = buildSupportEmbed();
        embed.addFields({
            name: '📝 Your message',
            value: details.length > 1024 ? `${details.slice(0, 1021)}...` : details,
            inline: false,
        });

        const ack = type === 'bug_report'
            ? '🐛 **Bug logged.** We\'ll look into it — thank you!'
            : '💡 **Suggestion logged.** We read every one!';

        await interaction.editReply({ content: ack, embeds: [embed] });
    }
}

function buildLobbyButtons(gameStarted = false) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('join_wagon')
            .setLabel('🪙 Join the Wagon')
            .setStyle(ButtonStyle.Success)
            .setDisabled(gameStarted),
        new ButtonBuilder()
            .setCustomId('leave_wagon')
            .setLabel('🚪 Leave')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(gameStarted),
        new ButtonBuilder()
            .setCustomId('depart_early')
            .setLabel('🚀 Depart Early')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(gameStarted),
    );

    return [row];
}

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
    await channel.send({ embeds: [buildPhaseEmbed(newPhase, alive, eraName, flavor)] }).catch(() => {});
}

function partitionEvents(events) {
    const notable = events.filter(isNotableEvent);
    return { notable };
}

async function postNotableEvents(channel, game, events) {
    const { notable } = partitionEvents(events);
    if (notable.length === 0) return;

    await postQuietSummary(channel, game);
    const aliveAfter = game.party.filter(c => c.alive);
    const landmark = getLandmark(game.distance, game.eraId);
    const hasDeath = notable.some(e => e.type === 'death');
    const embed = buildDayEmbed(
        game.day, notable, game.distance, game.weather,
        game.rations, aliveAfter.length, game.party.length, game.eraId,
    );
    embed.setTitle(formatHighlightTitle(game.day, notable, landmark.name));
    if (hasDeath) embed.setThumbnail(getDayThumbnail(landmark, true));
    await channel.send({ embeds: [embed] }).catch(() => {});
}

async function finishChoiceAndResume(channelId, entry, channel) {
    entry.simTimer = setInterval(entry.tickFn, TICK_MS);
}

function parseChoiceCustomId(customId) {
    const colon = customId.indexOf(':');
    if (colon === -1) return null;
    const type = customId.slice('choice_'.length, colon);
    const choiceId = customId.slice(colon + 1);
    return type && choiceId ? { type, choiceId } : null;
}

async function resolvePendingChoice(channelId, entry, channel) {
    if (entry.resolvingChoice) return;
    entry.resolvingChoice = true;
    try {
    const { game } = entry;
    const pc = game.pendingChoice;
    if (!pc) return;

    if (entry.choiceTimeout) {
        clearTimeout(entry.choiceTimeout);
        entry.choiceTimeout = null;
    }
    if (entry.choiceCountdownTimer) {
        clearInterval(entry.choiceCountdownTimer);
        entry.choiceCountdownTimer = null;
    }

    let events = [];
    if (pc.type === 'group') {
        botAutoVote(game, pc);
        const { winner, counts } = tallyGroupVotes(pc.votes);
        events = applyGroupChoice(game, winner);
        await channel.send({ content: formatGroupResult(winner, counts) }).catch(() => {});
    } else if (pc.type === 'personal') {
        botAutoVote(game, pc);
        for (const [userId, choiceId] of pc.votes) {
            events.push(...applyPersonalChoice(game, userId, choiceId));
        }
        game.flags.personalChoiceDone = true;
        await channel.send({ content: '**Personal choices locked in.**' }).catch(() => {});
    } else if (pc.type === 'river') {
        events = resolveRiverChoice(game, pc.riverChoice || 'wait');
    }

    game.pendingChoice = null;
    try {
        const msg = await channel.messages.fetch(pc.messageId);
        await msg.edit({ components: [] });
    } catch (_) {}

    await postNotableEvents(channel, game, events);

    const result = checkWinner(game);
    if (result) {
        clearInterval(entry.simTimer);
        game.phase = 'ended';
        await postQuietSummary(channel, game);
        await channel.send({ embeds: [buildVictoryEmbed(result.text, result.winner, game.eraId)] });
        activeGames.delete(channelId);
        return;
    }

    await finishChoiceAndResume(channelId, entry, channel);
    } finally {
        entry.resolvingChoice = false;
    }
}

async function refreshChoiceMessage(entry, channel, type, options = {}) {
    const pc = entry.game?.pendingChoice;
    if (!pc) return;

    const alive = alivePlayers(entry.game);
    const secondsLeft = Math.max(0, Math.ceil((pc.deadline - Date.now()) / 1000));
    const msg = await channel.messages.fetch(pc.messageId).catch(() => null);
    if (!msg) return;

    await msg.edit({
        embeds: [buildChoiceEmbed(type, entry.game, {
            ...options,
            secondsLeft,
            voteCount: pc.votes.size,
            voteTotal: alive.length,
        })],
        components: buildChoiceButtons(type),
    }).catch(() => {});
}

function startChoiceCountdown(channelId, entry, channel, type, options = {}) {
    if (entry.choiceCountdownTimer) clearInterval(entry.choiceCountdownTimer);

    entry.choiceCountdownTimer = setInterval(async () => {
        const pc = entry.game?.pendingChoice;
        if (!pc) {
            clearInterval(entry.choiceCountdownTimer);
            entry.choiceCountdownTimer = null;
            return;
        }

        const secondsLeft = Math.max(0, Math.ceil((pc.deadline - Date.now()) / 1000));
        if (secondsLeft <= 0) {
            clearInterval(entry.choiceCountdownTimer);
            entry.choiceCountdownTimer = null;
            return;
        }

        if (secondsLeft % 3 === 0 || secondsLeft <= 5) {
            await refreshChoiceMessage(entry, channel, type, options);
        }
    }, 1000);
}

async function startChoiceWindow(channelId, entry, channel, type, extra = {}) {
    clearInterval(entry.simTimer);

    const { game } = entry;
    const options = type === 'river' ? { riverName: extra.riverName } : {};
    const embed = buildChoiceEmbed(type, game, {
        ...options,
        secondsLeft: Math.floor(CHOICE_MS / 1000),
    });
    const msg = await channel.send({
        embeds: [embed],
        components: buildChoiceButtons(type),
    });

    game.pendingChoice = {
        type,
        messageId: msg.id,
        deadline: Date.now() + CHOICE_MS,
        votes: new Map(),
        riverChoice: null,
    };

    startChoiceCountdown(channelId, entry, channel, type, options);

    entry.choiceTimeout = setTimeout(() => {
        resolvePendingChoice(channelId, entry, channel).catch(err => console.error('Choice timeout error:', err));
    }, CHOICE_MS);

    if (type === 'group' || type === 'personal') {
        setTimeout(() => {
            if (!game.pendingChoice || game.pendingChoice.messageId !== msg.id) return;
            botAutoVote(game, game.pendingChoice);
            const alive = alivePlayers(game);
            if (alive.every(c => game.pendingChoice.votes.has(c.id))) {
                resolvePendingChoice(channelId, entry, channel).catch(err => console.error('Choice resolve error:', err));
            }
        }, CHOICE_MS - 2000);
    }
}

async function startSimulation(channelId, lobbyMessageId) {
    const entry = activeGames.get(channelId);
    if (!entry) return;

    const { game } = entry;

    if (game.party.length < 2) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) channel.send({ content: '❌ Not enough pioneers to start. Need at least 2!' });
        activeGames.delete(channelId);
        return;
    }

    game.phase = 'running';
    game.rations = 100 + game.party.length * 20;
    game.day = 0;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    try {
        const lobbyMsg = await channel.messages.fetch(lobbyMessageId);
        await lobbyMsg.edit({
            embeds: [buildLobbyEmbed(game, 0)
                .setTitle('🛤️ WAGON DEPARTED')
                .setDescription(
                    `${DEPART_ASCII}\n` +
                    '*The oxen strain forward. There is no turning back.*\n' +
                    '**Press onward. May fortune favor the ruthless.**'
                )],
            components: buildLobbyButtons(true),
        });
    } catch (_) {}

    await channel.send({
        content: (
            '🟢 **The wagon train has departed Independence!**\n' +
            `> ${game.party.length} pioneer${game.party.length === 1 ? '' : 's'} on the trail. ` +
            'Watch for daily **Trail Log** updates below.\n' +
            '> *You have died of dysentery.* (just kidding. maybe.)'
        ),
    });

    const tick = async () => {
        if (game.pendingChoice) return;

        const result = checkWinner(game);
        if (result) {
            clearInterval(entry.simTimer);
            game.phase = 'ended';
            await postQuietSummary(channel, game);
            await channel.send({ embeds: [buildVictoryEmbed(result.text, result.winner, game.eraId)] });
            activeGames.delete(channelId);
            return;
        }

        const preTrigger = checkChoiceTriggers(game);
        if (preTrigger) {
            await startChoiceWindow(channelId, entry, channel, preTrigger);
            return;
        }

        const prevTrailPhase = game.trailPhase;
        const daysThisTick = game.trailPhase === 'final' ? 2 : 1;
        let allEvents = [];
        for (let d = 0; d < daysThisTick; d++) {
            allEvents.push(...runDay(game));
            if (checkWinner(game)) break;
        }

        const newPhase = syncPhase(game);
        if (newPhase && newPhase !== prevTrailPhase) {
            await postPhaseTransition(channel, game, newPhase);
            if (newPhase === 'killzone' && !game.flags.personalChoiceDone) {
                await startChoiceWindow(channelId, entry, channel, 'personal');
                return;
            }
        } else if (game.trailPhase !== prevTrailPhase) {
            await postPhaseTransition(channel, game, game.trailPhase);
            if (game.trailPhase === 'killzone' && !game.flags.personalChoiceDone) {
                await startChoiceWindow(channelId, entry, channel, 'personal');
                return;
            }
        }

        if (game.pendingRiver) {
            await postNotableEvents(channel, game, allEvents);
            await startChoiceWindow(channelId, entry, channel, 'river', { riverName: game.pendingRiver.name });
            return;
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

        await postNotableEvents(channel, game, allEvents);
    };

    entry.tickFn = tick;
    entry.simTimer = setInterval(tick, TICK_MS);
}

async function startCountdown(channelId, lobbyMessageId, seconds) {
    const entry = activeGames.get(channelId);
    if (!entry) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    entry.lobbySecondsLeft = seconds;

    const updateIntervals = new Set([seconds, Math.floor(seconds / 2), 30, 15, 10, 5].filter(s => s < seconds && s > 0));

    const countdown = setInterval(async () => {
        entry.lobbySecondsLeft -= 5;

        if (entry.lobbySecondsLeft <= 0) {
            clearInterval(countdown);
            await startSimulation(channelId, lobbyMessageId);
            return;
        }

        if (updateIntervals.has(entry.lobbySecondsLeft)) {
            const msg = await channel.messages.fetch(lobbyMessageId).catch(() => null);
            if (msg) {
                await msg.edit({
                    embeds: [buildLobbyEmbed(entry.game, entry.lobbySecondsLeft)],
                    components: buildLobbyButtons(),
                }).catch(() => {});
            }
        }
    }, 5000);

    entry.countdownTimer = countdown;
}

function shutdown() {
    console.log('Shutting down...');
    for (const entry of activeGames.values()) {
        if (entry.countdownTimer) clearInterval(entry.countdownTimer);
        if (entry.simTimer) clearInterval(entry.simTimer);
        if (entry.choiceTimeout) clearTimeout(entry.choiceTimeout);
        if (entry.choiceCountdownTimer) clearInterval(entry.choiceCountdownTimer);
        if (entry.game) entry.game.pendingChoice = null;
    }
    activeGames.clear();
    server.close();
    client.destroy();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

client.once(DEvents.ClientReady, async () => {
    console.log(`✅ Tilt Battle Royale bot online as ${client.user.tag}`);
    console.log(`🌐 Health check on port ${config.port}`);
    client.user.setActivity('Tilt Battle Royale 🪖', { type: 0 });

    if (client.user.username !== config.botUsername) {
        try {
            await client.user.setUsername(config.botUsername);
            console.log(`✅ Bot username updated to ${config.botUsername}`);
        } catch (err) {
            console.warn(
                `Could not auto-rename bot to "${config.botUsername}". ` +
                `Set it manually in Discord Developer Portal → Bot → Username. (${err.message})`,
            );
        }
    }
});

client.on(DEvents.InteractionCreate, async (interaction) => {
    try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'royale') {
        const channelId = interaction.channelId;

        if (activeGames.has(channelId)) {
            return interaction.reply({
                content: '❌ A game is already running in this channel! Wait for it to finish.',
                ephemeral: true,
            });
        }

        const seconds = interaction.options.getInteger('lobby_seconds') ?? 60;
        const eraId = interaction.options.getString('era') ?? 'oregon-trail';
        const botPlayers = interaction.options.getInteger('bot_players') ?? 0;
        const era = getEra(eraId);

        if (botPlayers > 0) {
            const allowed = config.soloTestUserIds.map(String).includes(String(interaction.user.id));
            if (!allowed) {
                return interaction.reply({
                    content: '❌ `bot_players` is for solo testing and is not enabled for your account.',
                    ephemeral: true,
                });
            }
            if (botPlayers > 19) {
                return interaction.reply({
                    content: '❌ Max 19 bot players (20 total including you).',
                    ephemeral: true,
                });
            }
        }

        if (era.requiresPass && !hasTrailPassAccess(
            interaction.user.id,
            interaction.entitlements,
            config.trailPassBypassUserIds,
        )) {
            return interaction.reply({
                content: (
                    `🔒 **${era.name}** requires **Trail Pass** — unlock all trail eras forever.\n` +
                    `→ [Open the store](${config.storeUrl})`
                ),
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        const game = createGame(channelId, interaction.user.id, eraId);
        const hostChar = createCharacter(interaction.user, eraId);
        hostChar.isSupporter = hasSupporterFromEntitlements(interaction.entitlements);
        game.party.push(hostChar);

        for (let i = 0; i < botPlayers; i++) {
            game.party.push(createBotCharacter(i, eraId));
        }

        const embed = buildLobbyEmbed(game, seconds);
        const reply = await interaction.editReply({
            embeds: [embed],
            components: buildLobbyButtons(),
            fetchReply: true,
        });

        activeGames.set(channelId, {
            game,
            lobbyMessageId: reply.id,
            simTimer: null,
            countdownTimer: null,
            lobbySecondsLeft: seconds,
        });
        startCountdown(channelId, reply.id, seconds);
        return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'support') {
        return handleSupportCommand(interaction);
    }

    if (!interaction.isButton()) return;

    const channelId = interaction.channelId;
    const entry = activeGames.get(channelId);

    if (interaction.customId.startsWith('choice_') && entry?.game?.phase === 'running') {
        const user = interaction.user;
        const game = entry.game;
        const pc = game.pendingChoice;
        if (!pc) {
            return interaction.reply({ content: '❌ That choice window closed.', ephemeral: true });
        }

        const parsed = parseChoiceCustomId(interaction.customId);
        if (!parsed || pc.type !== parsed.type) {
            return interaction.reply({ content: '❌ That choice window closed.', ephemeral: true });
        }
        const { type, choiceId } = parsed;

        const pioneer = game.party.find(c => c.id === user.id && c.alive);
        if (!pioneer && type !== 'river') {
            return interaction.reply({ content: '❌ Only living pioneers can choose.', ephemeral: true });
        }

        if (type === 'river') {
            const host = game.party.find(c => c.id === game.hostId && c.alive);
            if (host && user.id !== host.id) {
                return interaction.reply({ content: '❌ Only the wagon leader picks the crossing.', ephemeral: true });
            }
            pc.riverChoice = choiceId;
            await interaction.deferUpdate();
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel) await resolvePendingChoice(channelId, entry, channel);
            return;
        }

        pc.votes.set(user.id, choiceId);
        await interaction.reply({ content: '✅ Choice locked in.', ephemeral: true });

        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) await refreshChoiceMessage(entry, channel, type);

        const alive = alivePlayers(game);
        if (alive.every(c => pc.votes.has(c.id))) {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel) await resolvePendingChoice(channelId, entry, channel);
        }
        return;
    }

    if (!entry || entry.game.phase !== 'lobby') {
        return interaction.reply({ content: '❌ No active lobby in this channel.', ephemeral: true });
    }

    const { game, lobbyMessageId } = entry;
    const user = interaction.user;

    if (interaction.customId === 'join_wagon') {
        await interaction.deferReply();
        if (game.party.find(c => c.id === user.id)) {
            return interaction.editReply({ content: '✅ You\'re already in the wagon!' });
        }
        if (game.party.length >= 20) {
            return interaction.editReply({ content: '❌ The wagon is full! (20 max)' });
        }
        const character = createCharacter(user, game.eraId);
        character.isSupporter = hasSupporterFromEntitlements(interaction.entitlements);
        game.party.push(character);

        const msg = await interaction.channel.messages.fetch(lobbyMessageId).catch(() => null);
        if (msg) {
            await msg.edit({
                embeds: [buildLobbyEmbed(game, entry.lobbySecondsLeft)],
                components: buildLobbyButtons(),
            });
        }

        return interaction.editReply({
            content: character.isSupporter
                ? `🪙 **${user.displayName}** joins the wagon as a **${character.profession}** — swears the oxen look better fed already.`
                : `🪙 **${user.displayName}** joins the wagon as a **${character.profession}** from Independence.`,
        });
    }

    if (interaction.customId === 'leave_wagon') {
        await interaction.deferReply();
        const idx = game.party.findIndex(c => c.id === user.id);
        if (idx === -1) {
            return interaction.editReply({ content: '❌ You\'re not in the wagon.' });
        }
        game.party.splice(idx, 1);

        const msg = await interaction.channel.messages.fetch(lobbyMessageId).catch(() => null);
        if (msg) {
            await msg.edit({
                embeds: [buildLobbyEmbed(game, entry.lobbySecondsLeft)],
                components: buildLobbyButtons(),
            });
        }

        return interaction.editReply({ content: `🚪 **${user.displayName}** stepped off the wagon.` });
    }

    if (interaction.customId === 'depart_early') {
        if (user.id !== game.hostId) {
            return interaction.reply({ content: '❌ Only the wagon leader can depart early!', ephemeral: true });
        }
        clearInterval(entry.countdownTimer);
        await interaction.deferReply();
        await interaction.editReply({ content: '🚀 Departing early!' });
        return startSimulation(channelId, lobbyMessageId);
    }
    } catch (err) {
        console.error('Interaction error:', err.message || err, err.stack);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Something went wrong. Try again in a moment.', ephemeral: true }).catch(() => {});
        } else if (interaction.isRepliable()) {
            await interaction.editReply({ content: '❌ Something went wrong. Try again in a moment.' }).catch(() => {});
        }
    }
});

server.listen(config.port, '0.0.0.0', () => {
    console.log(`🌐 Health check: http://0.0.0.0:${config.port}/api/health`);
});

client.login(config.discord.token).catch((err) => {
    console.error('❌ Discord login failed:', err.message);
    process.exit(1);
});
