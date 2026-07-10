/**
 * Pioneer Supporter — Premium Apps SKU entitlement checks.
 * https://docs.discord.com/developers/monetization/implementing-app-subscriptions
 */

const DEFAULT_SUPPORTER_SKU_ID = '1524938929273311302';

function getSupporterSkuId() {
    return process.env.SUPPORTER_SKU_ID || DEFAULT_SUPPORTER_SKU_ID;
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

/** Check entitlements on an interaction payload (preferred at join time). */
function hasSupporterFromEntitlements(entitlements) {
    const skuId = getSupporterSkuId();
    if (!entitlements?.size) return false;

    for (const entitlement of entitlements.values()) {
        if (String(entitlement.skuId) === skuId && isActiveEntitlement(entitlement)) {
            return true;
        }
    }
    return false;
}

/** Fallback: fetch entitlements for a user from the API. */
async function userIsSupporter(client, userId) {
    try {
        const entitlements = await client.entitlements.fetch({ userId });
        return hasSupporterFromEntitlements(entitlements);
    } catch (err) {
        console.warn('Could not fetch entitlements:', err.message);
        return false;
    }
}

function supporterPrefix(isSupporter) {
    return isSupporter ? '⭐ ' : '';
}

module.exports = {
    getSupporterSkuId,
    hasSupporterFromEntitlements,
    userIsSupporter,
    supporterPrefix,
};
