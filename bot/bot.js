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
const { createGame, createCharacter, createBotCharacter, runDay, checkWinner, syncPhase } = require('./simulation.js');
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
        '**Suggestions** — new modes, balance ideas, or QoL?',
        config.feedbackUrl
            ? `→ Share here: ${config.feedbackUrl}`
            : '→ Use `/support message:your idea` or post in the support server.',
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

async function handleSupportCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const message = interaction.options.getString('message');
    const embed = buildSupportEmbed();

    if (message) {
        console.log(`[support] ${interaction.user.tag} (${interaction.user.id}): ${message}`);
        embed.addFields({
            name: '📝 Your message',
            value: message.length > 200 ? `${message.slice(0, 197)}...` : message,
            inline: false,
        });
    }

    await interaction.editReply({ embeds: [embed] });
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
        const result = checkWinner(game);
        if (result) {
            clearInterval(entry.simTimer);
            game.phase = 'ended';
            await postQuietSummary(channel, game);
            await channel.send({ embeds: [buildVictoryEmbed(result.text, result.winner, game.eraId)] });
            activeGames.delete(channelId);
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
        } else if (game.trailPhase !== prevTrailPhase) {
            await postPhaseTransition(channel, game, game.trailPhase);
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
        const embed = buildDayEmbed(
            game.day, notable, game.distance, game.weather,
            game.rations, aliveAfter.length, game.party.length, game.eraId,
        );
        embed.setTitle(formatHighlightTitle(game.day, notable, landmark.name));
        if (hasDeath) {
            embed.setThumbnail(getDayThumbnail(landmark, true));
        }
        await channel.send({ embeds: [embed] }).catch(() => {});
    };

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
