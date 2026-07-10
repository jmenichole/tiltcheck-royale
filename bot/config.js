/**
 * Tiltcheck Royale — environment validation and shared config.
 */

const REQUIRED = ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID'];

function requireEnv(keys = REQUIRED) {
    const missing = keys.filter((k) => !process.env[k]?.trim());
    if (missing.length > 0) {
        console.error(`Missing required environment variables: ${missing.join(', ')}`);
        console.error('Copy bot/.env.example to bot/.env and fill in your values.');
        process.exit(1);
    }
}

function parseIdList(value) {
    if (!value?.trim()) return [];
    return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function getConfig() {
    const port = parseInt(process.env.PORT || process.env.WS_PORT || '8080', 10);

    return {
        discord: {
            token: process.env.DISCORD_BOT_TOKEN,
            clientId: process.env.DISCORD_CLIENT_ID,
            guildId: process.env.DISCORD_GUILD_ID || '',
        },
        port,
        botUsername: (process.env.BOT_USERNAME || 'tilt-battle-royale').trim(),
        supportServerUrl: process.env.SUPPORT_SERVER_URL || '',
        feedbackUrl: process.env.FEEDBACK_URL || '',
        storeUrl: `https://discord.com/application-directory/${process.env.DISCORD_CLIENT_ID}/store`,
        trailPassBypassUserIds: parseIdList(process.env.TRAIL_PASS_BYPASS_USER_IDS ?? ''),
    };
}

module.exports = { requireEnv, getConfig };
