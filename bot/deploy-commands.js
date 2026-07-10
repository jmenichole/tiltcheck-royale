/**
 * Register slash commands with Discord.
 * Run once: npm run deploy
 */

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { requireEnv, getConfig } = require('./config.js');

requireEnv(['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID']);
const config = getConfig();
const { listSelectableEras } = require('./themes/index.js');

const royaleCommand = new SlashCommandBuilder()
    .setName('royale')
    .setDescription('🪖 Start a game of Tilt Battle Royale!')
    .addStringOption(opt => {
        opt.setName('era')
            .setDescription('Trail era (Trail Pass required for bonus eras)')
            .setRequired(false);
        for (const era of listSelectableEras()) {
            opt.addChoices({ name: era.name, value: era.id });
        }
        return opt;
    })
    .addIntegerOption(opt =>
        opt.setName('lobby_seconds')
            .setDescription('How many seconds to wait for players to join (default: 60)')
            .setMinValue(10)
            .setMaxValue(180)
            .setRequired(false)
    )
    .toJSON();

const supportCommand = new SlashCommandBuilder()
    .setName('support')
    .setDescription('🛟 Get help, send a suggestion, or support development')
    .addStringOption(opt =>
        opt.setName('message')
            .setDescription('Optional bug report or feature idea')
            .setMaxLength(500)
            .setRequired(false)
    )
    .toJSON();

const APP_COMMANDS = [royaleCommand, supportCommand];
const APP_COMMAND_NAMES = APP_COMMANDS.map(cmd => cmd.name);

function preserveOtherCommands(existing) {
    return existing
        .filter(cmd => !APP_COMMAND_NAMES.includes(cmd.name))
        .map(({ id, application_id, version, guild_id, ...cmd }) => cmd);
}

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
    try {
        if (config.discord.guildId) {
            console.log(`Registering commands for guild ${config.discord.guildId}...`);
            await rest.put(
                Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
                { body: APP_COMMANDS },
            );
            console.log('✅ Guild commands registered — visible immediately in that server.');
        } else {
            console.log('Registering commands globally...');
            const existing = await rest.get(Routes.applicationCommands(config.discord.clientId));
            const preserved = preserveOtherCommands(existing);
            if (preserved.length > 0) {
                console.log(`Preserving ${preserved.length} existing command(s): ${preserved.map(c => c.name).join(', ')}`);
            }
            await rest.put(
                Routes.applicationCommands(config.discord.clientId),
                { body: [...preserved, ...APP_COMMANDS] },
            );
            console.log('✅ Global commands registered — /royale and /support');
            console.log('   Discord may take up to ~1 hour to propagate globally.');
        }
        console.log('Start the bot with: npm start');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
        process.exit(1);
    }
})();
