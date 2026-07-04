/**
 * TILTCHECK ROYALE - Slash Command Registration
 * Run this file ONCE with: node deploy-commands.js
 * This registers the /royale command with Discord.
 */

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { requireEnv, getConfig } = require('./config.js');

requireEnv();
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
        console.log('Registering /royale slash command...');

        await rest.put(
            Routes.applicationGuildCommands(
                config.discord.clientId,
                config.discord.guildId,
            ),
            { body: commands }
        );

        console.log('✅ /royale command registered successfully!');
        console.log('You can now start the bot with: node bot.js');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
})();
