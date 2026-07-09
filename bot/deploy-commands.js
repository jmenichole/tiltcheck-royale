/**
 * Register /royale slash command with Discord.
 * Run once: npm run deploy
 *
 * By default registers GLOBALLY — works in every server the bot is invited to.
 * May take up to ~1 hour to appear everywhere (usually much faster).
 *
 * Optional: set DISCORD_GUILD_ID in .env for instant guild-only testing.
 */

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { requireEnv, getConfig } = require('./config.js');

requireEnv(['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID']);
const config = getConfig();

const commands = [
    new SlashCommandBuilder()
        .setName('royale')
        .setDescription('🪖 Start a game of Tilt Battle Royale!')
        .addIntegerOption(opt =>
            opt.setName('lobby_seconds')
               .setDescription('How many seconds to wait for players to join (default: 60)')
               .setMinValue(10)
               .setMaxValue(180)
               .setRequired(false)
        ),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
    try {
        if (config.discord.guildId) {
            console.log(`Registering /royale for guild ${config.discord.guildId} (instant)...`);
            await rest.put(
                Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
                { body: commands },
            );
            console.log('✅ Guild command registered — visible immediately in that server.');
        } else {
            console.log('Registering /royale globally (all servers)...');
            await rest.put(
                Routes.applicationCommands(config.discord.clientId),
                { body: commands },
            );
            console.log('✅ Global command registered — works in every server the bot is in.');
            console.log('   Discord may take up to ~1 hour to propagate globally.');
        }
        console.log('Start the bot with: npm start');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
        process.exit(1);
    }
})();
