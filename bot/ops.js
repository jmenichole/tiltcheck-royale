/**
 * Bot ops logging — posts to channels in the bot-test guild.
 * Fire-and-forget: never throw into gameplay / slash handlers.
 */

const { EmbedBuilder } = require('discord.js');

const COLORS = {
    error: 0xe74c3c,
    analytics: 0x3498db,
    support: 0x9b59b6,
    purchase: 0xf1c40f,
    install: 0x2ecc71,
};

let _client = null;
let _config = null;

function initOps(client, config) {
    _client = client;
    _config = config;
    const ops = config.ops || {};
    if (!ops.errorChannelId && !ops.analyticsChannelId && !ops.supportChannelId) {
        console.warn('[ops] No OPS_*_CHANNEL_ID set — channel logging disabled');
        return;
    }
    console.log(
        `[ops] Logging guild ${ops.guildId || '(any)'} | ` +
        `errors=${ops.errorChannelId || 'off'} ` +
        `analytics=${ops.analyticsChannelId || 'off'} ` +
        `support=${ops.supportChannelId || 'off'}`,
    );
}

function truncate(text, max = 500) {
    const s = String(text ?? '');
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

async function sendToChannel(channelId, payload) {
    if (!_client || !channelId) return;
    try {
        const channel = await _client.channels.fetch(channelId);
        if (!channel?.isTextBased?.()) return;
        await channel.send(payload);
    } catch (err) {
        console.warn(`[ops] Failed to post to ${channelId}: ${err.message}`);
    }
}

function postOps(kind, build) {
    const ops = _config?.ops || {};
    const channelId =
        kind === 'error' ? ops.errorChannelId
            : kind === 'support' ? ops.supportChannelId
                : ops.analyticsChannelId;
    if (!channelId) return;
    Promise.resolve()
        .then(() => build())
        .then((payload) => sendToChannel(channelId, payload))
        .catch((err) => console.warn(`[ops] ${kind} dropped: ${err.message}`));
}

function postError({ context, message, stack }) {
    postOps('error', () => {
        const embed = new EmbedBuilder()
            .setColor(COLORS.error)
            .setTitle('🔴 Bot error')
            .setDescription(`**${truncate(context, 100)}**\n\`\`\`\n${truncate(message, 800)}\n\`\`\``)
            .setFooter({ text: 'tilt-battle-royale' })
            .setTimestamp();
        if (stack) {
            embed.addFields({ name: 'Stack', value: `\`\`\`\n${truncate(stack, 900)}\n\`\`\`` });
        }
        return { embeds: [embed] };
    });
}

function postAnalytics({ event, title, description, fields = [], color }) {
    postOps('analytics', () => ({
        embeds: [
            new EmbedBuilder()
                .setColor(color ?? COLORS.analytics)
                .setTitle(title || event)
                .setDescription(description || null)
                .addFields(fields.filter(Boolean).slice(0, 10))
                .setFooter({ text: `tilt-battle-royale · ${event}` })
                .setTimestamp(),
        ],
    }));
}

function postSupport({ type, user, guild, details }) {
    const typeLabel = {
        bug_report: '🐛 Bug report',
        suggestion: '💡 Suggestion',
        say_hi: '👋 Say hi',
        donate: '☕ Donate',
    }[type] || type;

    postOps('support', () => ({
        embeds: [
            new EmbedBuilder()
                .setColor(COLORS.support)
                .setTitle(typeLabel)
                .setDescription(details ? truncate(details, 1500) : '_No details_')
                .addFields(
                    { name: 'User', value: `${user.tag} (<@${user.id}>)`, inline: true },
                    { name: 'Guild', value: guild ? `${guild.name}\n\`${guild.id}\`` : 'DM / unknown', inline: true },
                )
                .setFooter({ text: 'tilt-battle-royale · /support' })
                .setTimestamp(),
        ],
    }));
}

function postGuildInstall(guild) {
    postAnalytics({
        event: 'guild_install',
        title: '🟢 Bot added to server',
        description: `**${guild.name}**`,
        color: COLORS.install,
        fields: [
            { name: 'Guild ID', value: `\`${guild.id}\``, inline: true },
            { name: 'Members', value: String(guild.memberCount ?? '?'), inline: true },
        ],
    });
}

function postPurchase({ userId, skuId, skuLabel }) {
    postAnalytics({
        event: 'purchase',
        title: '💰 Purchase',
        description: `<@${userId}> bought **${skuLabel || skuId}**`,
        color: COLORS.purchase,
        fields: [
            { name: 'SKU', value: `\`${skuId}\``, inline: true },
            { name: 'User ID', value: `\`${userId}\``, inline: true },
        ],
    });
}

function postGameStarted({ guildId, channelId, era, players }) {
    postAnalytics({
        event: 'game_started',
        title: '🛤️ Game started',
        fields: [
            { name: 'Era', value: era || '?', inline: true },
            { name: 'Players', value: String(players), inline: true },
            { name: 'Guild', value: `\`${guildId || '?'}\``, inline: true },
            { name: 'Channel', value: `<#${channelId}>`, inline: true },
        ],
    });
}

function postGameEnded({ guildId, channelId, era, winnerTag, days }) {
    postAnalytics({
        event: 'game_ended',
        title: '🏆 Game ended',
        fields: [
            { name: 'Winner', value: winnerTag || '?', inline: true },
            { name: 'Days', value: String(days ?? '?'), inline: true },
            { name: 'Era', value: era || '?', inline: true },
            { name: 'Guild', value: `\`${guildId || '?'}\``, inline: true },
            { name: 'Channel', value: `<#${channelId}>`, inline: true },
        ],
    });
}

module.exports = {
    initOps,
    postError,
    postSupport,
    postGuildInstall,
    postPurchase,
    postGameStarted,
    postGameEnded,
};
