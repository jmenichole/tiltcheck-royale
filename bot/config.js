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
    const activityUrl = (process.env.ACTIVITY_URL || 'https://tiltroyale.netlify.app').replace(/\/$/, '');

    return {
        discord: {
            token: process.env.DISCORD_BOT_TOKEN,
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
            guildId: process.env.DISCORD_GUILD_ID,
        },
        port,
        activityUrl,
        wsPublicUrl: process.env.WS_PUBLIC_URL || `ws://localhost:${port}`,
    };
}

module.exports = { requireEnv, getConfig };
