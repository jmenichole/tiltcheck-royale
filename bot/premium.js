/**
 * Premium Apps SKU entitlement checks.
 * https://docs.discord.com/developers/monetization/implementing-app-subscriptions
 */

const DEFAULT_SUPPORTER_SKU_ID = '1524938929273311302';
const DEFAULT_TRAIL_PASS_SKU_ID = '1524975586601340978';

function getSupporterSkuId() {
    return process.env.SUPPORTER_SKU_ID || DEFAULT_SUPPORTER_SKU_ID;
}

function getTrailPassSkuId() {
    return process.env.TRAIL_PASS_SKU_ID || DEFAULT_TRAIL_PASS_SKU_ID;
}

function isActiveEntitlement(entitlement) {
    if (!entitlement) return false;
    if (typeof entitlement.isActive === 'function') return entitlement.isActive();
    if (entitlement.deleted) return false;
    if (entitlement.endsTimestamp != null) {
        return entitlement.endsTimestamp > Date.now();
    }
    return true;
}

function hasEntitlementForSku(entitlements, skuId) {
    if (!entitlements?.size) return false;

    for (const entitlement of entitlements.values()) {
        if (String(entitlement.skuId) === String(skuId) && isActiveEntitlement(entitlement)) {
            return true;
        }
    }
    return false;
}

/** Pioneer Supporter — cosmetic personal sub. */
function hasSupporterFromEntitlements(entitlements) {
    return hasEntitlementForSku(entitlements, getSupporterSkuId());
}

/** Trail Pass — durable unlock for all host eras. */
function hasTrailPassFromEntitlements(entitlements) {
    return hasEntitlementForSku(entitlements, getTrailPassSkuId());
}

/** Host may run Pass eras if entitled OR on bypass list (owner/test accounts). */
function hasTrailPassAccess(userId, entitlements, bypassUserIds = []) {
    if (bypassUserIds.map(String).includes(String(userId))) return true;
    return hasTrailPassFromEntitlements(entitlements);
}

/** Fallback: fetch entitlements for a user from the API. */
async function userHasEntitlement(client, userId, skuId) {
    try {
        const entitlements = await client.entitlements.fetch({ userId });
        return hasEntitlementForSku(entitlements, skuId);
    } catch (err) {
        console.warn('Could not fetch entitlements:', err.message);
        return false;
    }
}

async function userIsSupporter(client, userId) {
    return userHasEntitlement(client, userId, getSupporterSkuId());
}

/**
 * Async Trail Pass check (API fetch). For slash-command gating prefer
 * hasTrailPassAccess(userId, interaction.entitlements, bypassUserIds).
 */
async function userHasTrailPass(client, userId, bypassUserIds = []) {
    if (bypassUserIds.map(String).includes(String(userId))) return true;
    return userHasEntitlement(client, userId, getTrailPassSkuId());
}

function supporterPrefix(isSupporter) {
    return isSupporter ? '⭐ ' : '';
}

module.exports = {
    getSupporterSkuId,
    getTrailPassSkuId,
    hasSupporterFromEntitlements,
    hasTrailPassFromEntitlements,
    hasTrailPassAccess,
    userIsSupporter,
    userHasTrailPass,
    supporterPrefix,
};
