/**
 * Tiltcheck Royale — environment validation and shared config.
 */

const REQUIRED = ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID'];

function requireEnv(keys = REQUIRED) {
    const missing = keys.filter((k) => !process.env[k]?.trim());
    if (missing.length > 0) {
        console.error(`Missing required environment variables: ${missing.join(', ')}`);
        console.error('Copy bot/.env.example to bot/.env and fill in your values.');
        process.exit(1);
    }
}

function getConfig() {
    const port = parseInt(process.env.PORT || process.env.WS_PORT || '8080', 10);

    return {
        discord: {
            token: process.env.DISCORD_BOT_TOKEN,
            clientId: process.env.DISCORD_CLIENT_ID,
            guildId: process.env.DISCORD_GUILD_ID,
        },
        port,
        botUsername: (process.env.BOT_USERNAME || 'tilt-battle-royale').trim(),
    };
}

module.exports = { requireEnv, getConfig };
