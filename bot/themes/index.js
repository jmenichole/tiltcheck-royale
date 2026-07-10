/**
 * Trail era registry and theme pack loader.
 */

const oregonTrail = require('./oregon-trail.js');
const goldRush = require('./gold-rush.js');
const plagueTrail = require('./plague-trail.js');
const steampunkExpress = require('./steampunk-express.js');

const PACKS = {
    'oregon-trail': oregonTrail,
    'gold-rush': goldRush,
    'plague-trail': plagueTrail,
    'steampunk-express': steampunkExpress,
};

function getThemePack(eraId) {
    return PACKS[eraId] || PACKS['oregon-trail'];
}

function getEra(eraId) {
    const pack = getThemePack(eraId);
    return {
        id: pack.id,
        name: pack.name,
        requiresPass: !!pack.requiresPass,
    };
}

function listSelectableEras() {
    return Object.values(PACKS).map((p) => ({
        id: p.id,
        name: p.name,
        requiresPass: !!p.requiresPass,
    }));
}

function getLandmark(distance, eraId = 'oregon-trail') {
    const landmarks = getThemePack(eraId).landmarks;
    let current = landmarks[0];
    for (const mark of landmarks) {
        if (distance >= mark.mi) current = mark;
        else break;
    }
    return current;
}

module.exports = {
    getThemePack,
    getEra,
    listSelectableEras,
    getLandmark,
};
