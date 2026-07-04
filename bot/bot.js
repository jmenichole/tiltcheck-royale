/**
 * TILT BATTLE ROYALE - Discord Bot
 * Slash commands, lobby, simulation, embeds, and channel-scoped WebSocket sync.
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
const { createWsHandler, buildLobbyUpdate } = require('./ws-handler.js');
const { createAuthRoutes } = require('./auth-routes.js');
const { createGame, createCharacter, runDay, checkWinner } = require('./simulation.js');

requireEnv();
const config = getConfig();

const FOOTER = 'Tilt Battle Royale';
const BRAND = 'TILT BATTLE ROYALE';

// ─── Discord Client ───────────────────────────────────────────────────────────
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// ─── Active Games ─────────────────────────────────────────────────────────────
const activeGames = new Map();

const ws = createWsHandler({ getActiveGames: () => activeGames });

function broadcast(channelId, payload) {
    ws.broadcastToChannel(channelId, payload);
}

function emitLobbyUpdate(channelId) {
    const entry = activeGames.get(channelId);
    if (entry && entry.game.phase === 'lobby') {
        broadcast(channelId, buildLobbyUpdate(channelId, entry));
    }
}

// ─── HTTP + WebSocket Server ──────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
app.options('*', (_req, res) => res.sendStatus(204));
createAuthRoutes(app, config.discord);

const server = http.createServer(app);
ws.attach(server);

// ─── Embed Helpers ────────────────────────────────────────────────────────────
const COLOR_GREEN = 0x00ff41;
const COLOR_RED   = 0xff2222;
const COLOR_GOLD  = 0xffd700;

function buildLobbyEmbed(game, secondsLeft) {
    const names = game.party.length > 0
        ? game.party.map((c, i) => `\`${i + 1}.\` ${c.displayName} *(${c.profession})*`).join('\n')
        : '*No pioneers yet. Be the first to board!*';

    return new EmbedBuilder()
        .setColor(COLOR_GREEN)
        .setTitle(`🪖 ${BRAND} — LOBBY OPEN`)
        .setDescription(
            '```\n' +
            ' ______     _ _ _\n' +
            '__/_|[]|_\\___//_|_|_\\\n' +
            '|  _     _     _   _  |\n' +
            '`-(_)---(_)---(_)-(_)-\'\n' +
            '```\n' +
            `A wagon train is forming. The trail is dangerous.\n` +
            `Only **one** will reach Oregon.\n\n` +
            `**Departing in ${secondsLeft} seconds...**`
        )
        .addFields({ name: `🪙 Pioneers (${game.party.length}/20)`, value: names })
        .setFooter({ text: `Click "Join the Wagon" to enter • ${FOOTER}` })
        .setTimestamp();
}

function buildDayEmbed(day, events, distance, weather, rations, aliveCount, total) {
    const ICONS = { day: '📅', combat: '⚔️', death: '☠️', disease: '🤢', item: '📦', passive: '📜' };
    const pct = Math.min(1, distance / 1000);
    const bars = Math.round(pct * 20);
    const progressBar = `[${'█'.repeat(bars)}${'░'.repeat(20 - bars)}] ${distance}/1000 mi`;

    const lines = events
        .filter(e => e.type !== 'day')
        .map(e => `${ICONS[e.type] || '•'} ${e.text}`)
        .join('\n') || '*A quiet day on the trail.*';

    return new EmbedBuilder()
        .setColor(events.some(e => e.type === 'death') ? COLOR_RED : COLOR_GREEN)
        .setTitle(`Day ${day} — ${weather}`)
        .setDescription(lines)
        .addFields(
            { name: '🗺️ Progress', value: `\`${progressBar}\``, inline: false },
            { name: '🍖 Rations', value: `${Math.max(0, rations)} lbs`, inline: true },
            { name: '💀 Alive', value: `${aliveCount} / ${total}`, inline: true },
        )
        .setFooter({ text: FOOTER });
}

function buildVictoryEmbed(text, winner) {
    const embed = new EmbedBuilder()
        .setColor(COLOR_GOLD)
        .setTitle(`🏆 ${BRAND} — FINAL RESULT`)
        .setDescription(
            '```\n' +
            '  ____   ___  _   _ _____\n' +
            ' |  _ \\ / _ \\| \\ | | ____|\n' +
            ' | | | | | | |  \\| |  _|\n' +
            ' | |_| | |_| | |\\  | |___\n' +
            ' |____/ \\___/|_| \\_|_____|\n' +
            '```\n' +
            text
        )
        .setTimestamp()
        .setFooter({ text: `${FOOTER} — Thanks for playing!` });

    if (winner) {
        embed.addFields(
            { name: '💀 Final Kill Count', value: `${winner.kills} kill${winner.kills === 1 ? '' : 's'}`, inline: true },
            { name: '🪖 Profession', value: winner.profession, inline: true },
        );
    }
    return embed;
}

function activityUrl(channelId) {
    return `${config.activityUrl}/?channelId=${channelId}`;
}

function buildLobbyButtons(channelId, gameStarted = false) {
    return new ActionRowBuilder().addComponents(
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
        new ButtonBuilder()
            .setLabel('🖥️ Open Retro View')
            .setStyle(ButtonStyle.Link)
            .setURL(activityUrl(channelId)),
    );
}

// ─── Start Simulation ─────────────────────────────────────────────────────────
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
            embeds: [buildLobbyEmbed(game, 0).setTitle(`🪖 ${BRAND} — DEPARTED!`).setDescription('The wagon has left. May the trail have mercy.')],
            components: [buildLobbyButtons(channelId, true)],
        });
    } catch (_) {}

    broadcast(channelId, { type: 'game_start', party: game.party });

    await channel.send({
        content: `🟢 **Tilt Battle Royale has begun!** ${game.party.length} pioneers set off west.\n> *Use \`🖥️ Open Retro View\` above to watch in the retro CRT interface!*`,
    });

    const TICK_MS = 4000;

    const tick = async () => {
        const result = checkWinner(game);
        if (result) {
            clearInterval(entry.simTimer);
            game.phase = 'ended';
            await channel.send({ embeds: [buildVictoryEmbed(result.text, result.winner)] });
            broadcast(channelId, { type: 'game_end', result });
            activeGames.delete(channelId);
            return;
        }

        const dayEvents = runDay(game);
        const aliveAfter = game.party.filter(c => c.alive);

        const embed = buildDayEmbed(
            game.day, dayEvents, game.distance, game.weather,
            game.rations, aliveAfter.length, game.party.length,
        );
        await channel.send({ embeds: [embed] }).catch(() => {});

        broadcast(channelId, {
            type: 'day_update',
            day: game.day,
            events: dayEvents,
            party: game.party,
            distance: game.distance,
            rations: game.rations,
            weather: game.weather,
        });
    };

    entry.simTimer = setInterval(tick, TICK_MS);
}

// ─── Countdown Timer ──────────────────────────────────────────────────────────
async function startCountdown(channelId, lobbyMessageId, seconds) {
    const entry = activeGames.get(channelId);
    if (!entry) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    entry.lobbySecondsLeft = seconds;
    emitLobbyUpdate(channelId);

    const updateIntervals = new Set([seconds, Math.floor(seconds / 2), 30, 15, 10, 5].filter(s => s < seconds && s > 0));

    const countdown = setInterval(async () => {
        entry.lobbySecondsLeft -= 5;

        if (entry.lobbySecondsLeft <= 0) {
            clearInterval(countdown);
            await startSimulation(channelId, lobbyMessageId);
            return;
        }

        emitLobbyUpdate(channelId);

        if (updateIntervals.has(entry.lobbySecondsLeft)) {
            const msg = await channel.messages.fetch(lobbyMessageId).catch(() => null);
            if (msg) {
                await msg.edit({
                    embeds: [buildLobbyEmbed(entry.game, entry.lobbySecondsLeft)],
                    components: [buildLobbyButtons(channelId)],
                }).catch(() => {});
            }
        }
    }, 5000);

    entry.countdownTimer = countdown;
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
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

// ─── Event Handlers ───────────────────────────────────────────────────────────
client.once(DEvents.ClientReady, async () => {
    console.log(`✅ Tilt Battle Royale bot online as ${client.user.tag}`);
    console.log(`📡 HTTP + WebSocket on port ${config.port}`);
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
        const game = createGame(channelId, interaction.user.id);
        game.party.push(createCharacter(interaction.user));

        const embed = buildLobbyEmbed(game, seconds);
        const reply = await interaction.reply({
            embeds: [embed],
            components: [buildLobbyButtons(channelId)],
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

    if (!interaction.isButton()) return;

    const channelId = interaction.channelId;
    const entry = activeGames.get(channelId);

    if (!entry || entry.game.phase !== 'lobby') {
        return interaction.reply({ content: '❌ No active lobby in this channel.', ephemeral: true });
    }

    const { game, lobbyMessageId } = entry;
    const user = interaction.user;

    if (interaction.customId === 'join_wagon') {
        if (game.party.find(c => c.id === user.id)) {
            return interaction.reply({ content: '✅ You\'re already in the wagon!', ephemeral: true });
        }
        if (game.party.length >= 20) {
            return interaction.reply({ content: '❌ The wagon is full! (20 max)', ephemeral: true });
        }
        const character = createCharacter(user);
        game.party.push(character);

        const msg = await interaction.channel.messages.fetch(lobbyMessageId).catch(() => null);
        if (msg) {
            await msg.edit({
                embeds: [buildLobbyEmbed(game, entry.lobbySecondsLeft)],
                components: [buildLobbyButtons(channelId)],
            });
        }
        emitLobbyUpdate(channelId);

        return interaction.reply({
            content: `🪙 **${user.displayName}** boarded the wagon as a **${character.profession}**!`,
            ephemeral: false,
        });
    }

    if (interaction.customId === 'leave_wagon') {
        const idx = game.party.findIndex(c => c.id === user.id);
        if (idx === -1) {
            return interaction.reply({ content: '❌ You\'re not in the wagon.', ephemeral: true });
        }
        game.party.splice(idx, 1);

        const msg = await interaction.channel.messages.fetch(lobbyMessageId).catch(() => null);
        if (msg) {
            await msg.edit({
                embeds: [buildLobbyEmbed(game, entry.lobbySecondsLeft)],
                components: [buildLobbyButtons(channelId)],
            });
        }
        emitLobbyUpdate(channelId);

        return interaction.reply({ content: `🚪 **${user.displayName}** stepped off the wagon.`, ephemeral: false });
    }

    if (interaction.customId === 'depart_early') {
        if (user.id !== game.hostId) {
            return interaction.reply({ content: '❌ Only the wagon leader can depart early!', ephemeral: true });
        }
        clearInterval(entry.countdownTimer);
        await interaction.reply({ content: '🚀 Departing early!', ephemeral: false });
        return startSimulation(channelId, lobbyMessageId);
    }
    } catch (err) {
        console.error('Interaction error:', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Something went wrong. Try again in a moment.', ephemeral: true }).catch(() => {});
        }
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(config.port, '0.0.0.0', () => {
    console.log(`🌐 Health check: http://0.0.0.0:${config.port}/api/health`);
});

client.login(config.discord.token);
