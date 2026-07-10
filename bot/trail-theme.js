/**
 * Oregon Trail-inspired embed styling (parody — not affiliated with Oregon Trail).
 */

const COLORS = {
    trail: 0x2d8a2d,  // green CRT / prairie
    amber: 0xffaa00,  // classic terminal amber
    red:   0xcc2222,
    gold:  0xffd700,
};

const LANDMARKS = [
    {
        mi: 0,
        name: 'Independence, Missouri',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Kiosk_in_Independence%2C_Missouri_where_three_National_Historic_Trails_meet_-_005.jpg/500px-Kiosk_in_Independence%2C_Missouri_where_three_National_Historic_Trails_meet_-_005.jpg',
    },
    {
        mi: 120,
        name: 'Kansas River Crossing',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Kansas_River.jpg',
    },
    {
        mi: 280,
        name: 'Fort Kearney',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Old_Fort_Kearny_Historical_Marker%2C_Nebraska_City.jpg/500px-Old_Fort_Kearny_Historical_Marker%2C_Nebraska_City.jpg',
    },
    {
        mi: 420,
        name: 'Chimney Rock',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Chimney_Rock_NE.jpg/500px-Chimney_Rock_NE.jpg',
    },
    {
        mi: 560,
        name: 'Fort Laramie',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Fort_Laramie_NHS_WY3.jpg/500px-Fort_Laramie_NHS_WY3.jpg',
    },
    {
        mi: 700,
        name: 'Independence Rock',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Independence_Rock_WY.jpg',
    },
    {
        mi: 850,
        name: 'The Dalles',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/TheDallesBridgeNorth.jpg/500px-TheDallesBridgeNorth.jpg',
    },
    {
        mi: 980,
        name: 'Willamette Valley',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Willamette_Valley_Rural_-_Flickr_-_docoverachiever.jpg/500px-Willamette_Valley_Rural_-_Flickr_-_docoverachiever.jpg',
    },
];

const LOBBY_THUMBNAIL =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Oregon_National_Historic_Trail_in_Wyoming.jpg/500px-Oregon_National_Historic_Trail_in_Wyoming.jpg';

const VICTORY_THUMBNAIL =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Mount_Hood_reflected_in_Mirror_Lake%2C_Oregon.jpg/500px-Mount_Hood_reflected_in_Mirror_Lake%2C_Oregon.jpg';

const DEATH_THUMBNAIL =
    'https://upload.wikimedia.org/wikipedia/commons/d/d1/Graves_at_Boot_Hill%2C_Dodge_City%2C_KS%2C_1959%281%29.jpg';

const WEATHER_FLAVOR = {
    Fair: 'Clear skies. Oxen plod onward.',
    Rainy: 'Muddy trail. Wheels sink deep.',
    Scorching: 'Brutal heat. Water rations critical.',
    Stormy: 'Thunder on the prairie. Wagon cover flaps wildly.',
    Blizzard: 'Snow and wind. Visibility near zero.',
};

const TRAIL_FOOTERS = [
    'Wagons ho! • Parody trail sim',
    'Rest here? The trail waits for no one.',
    'Fording river ahead? Choose wisely.',
    'You may die of dysentery. • Parody',
];

const HEADER_FLAVORS = {
    ford: [
        'The wagons line up at the bank. How deep is it?',
        'Caissons float unevenly. Everyone holds their breath.',
    ],
    hunt: [
        'Rifle shots echo across the prairie.',
        'You return with game — rations look better tonight.',
    ],
    rest: [
        'The party mends wounds and checks the oxen.',
        'A brief pause before the trail calls again.',
    ],
    travel: [
        'Dust rises behind the wagon train.',
        'Miles tick by under an endless sky.',
    ],
    storm: [
        'Lightning splits the horizon.',
        'The trail disappears into rain and mud.',
    ],
    burial: [
        'A shallow grave is dug beside the trail.',
        'Names are scratched onto a wooden marker.',
    ],
};

const DAY_HEADERS = {
    ford:    { emoji: '🌊', label: 'FORDING THE RIVER' },
    hunt:    { emoji: '🏹', label: 'HUNT FOR FOOD' },
    rest:    { emoji: '⛺', label: 'REST HERE' },
    travel:  { emoji: '🚶', label: 'CONTINUE ON TRAIL' },
    storm:   { emoji: '⛈️', label: 'STORM ON THE TRAIL' },
    burial:  { emoji: '⚰️', label: 'BURIAL ON THE TRAIL' },
};

const ICONS = {
    day: '📅',
    combat: '⚔️',
    death: '☠️',
    disease: '🤢',
    item: '📦',
    passive: '📜',
};

function pickFlavor(key) {
    const lines = HEADER_FLAVORS[key];
    return lines[Math.floor(Math.random() * lines.length)];
}

function isRiverLandmark(name) {
    const lower = name.toLowerCase();
    return lower.includes('river') || lower.includes('dalles');
}

function pickDayHeader(day, weather, events, landmark) {
    const hasDeath = events.some((e) => e.type === 'death');
    if (hasDeath) {
        return { ...DAY_HEADERS.burial, flavor: pickFlavor('burial') };
    }

    if (isRiverLandmark(landmark.name) && Math.random() < 0.55) {
        return { ...DAY_HEADERS.ford, flavor: pickFlavor('ford') };
    }

    if (['Stormy', 'Blizzard', 'Scorching'].includes(weather) && Math.random() < 0.45) {
        return { ...DAY_HEADERS.storm, flavor: pickFlavor('storm') };
    }

    if (weather === 'Fair') {
        const roll = Math.random();
        if (roll < 0.28) return { ...DAY_HEADERS.hunt, flavor: pickFlavor('hunt') };
        if (roll < 0.48) return { ...DAY_HEADERS.rest, flavor: pickFlavor('rest') };
    }

    if (Math.random() < 0.35) {
        return { ...DAY_HEADERS.travel, flavor: pickFlavor('travel') };
    }

    return {
        emoji: '📅',
        label: `DAY ${day}`,
        flavor: weatherLine(weather),
    };
}

function formatDayTitle(header, day) {
    return `${header.emoji} ${header.label} — Day ${day}`;
}

function dayEmbedColor(weather, hasDeath) {
    if (hasDeath) return COLORS.red;
    if (weather === 'Fair') return COLORS.amber;
    return COLORS.trail;
}

function getDayThumbnail(landmark, hasDeath) {
    if (hasDeath) return DEATH_THUMBNAIL;
    return landmark.thumbnail || LOBBY_THUMBNAIL;
}

function getLandmark(distance) {
    let current = LANDMARKS[0];
    for (const mark of LANDMARKS) {
        if (distance >= mark.mi) current = mark;
        else break;
    }
    return current;
}

function pickTrailFooter() {
    return TRAIL_FOOTERS[Math.floor(Math.random() * TRAIL_FOOTERS.length)];
}

function weatherLine(weather) {
    return WEATHER_FLAVOR[weather] || 'Another day on the Oregon Trail.';
}

/** Monospace trail log block for embed descriptions. */
function formatTrailLog(events) {
    const lines = events
        .filter((e) => e.type !== 'day')
        .map((e) => `${ICONS[e.type] || '•'} ${e.text}`);

    if (lines.length === 0) {
        lines.push('The trail is quiet. Oxen breathe heavy in the cold air.');
    }

    const body = lines.map((l) => `│ ${l}`).join('\n');
    return (
        '```\n' +
        '╔══ TRAIL LOG ══════════════════╗\n' +
        `${body}\n` +
        '╚════════════════════════════════╝\n' +
        '```'
    );
}

function progressBar(distance, max = 1000, width = 20) {
    const pct = Math.min(1, distance / max);
    const filled = Math.round(pct * width);
    return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${distance}/${max} mi`;
}

const WAGON_ASCII =
    '```\n' +
    '  ox~~\\\\\\\ wagon train\n' +
    ' ______     _ _ _\n' +
    '__/_|[]|_\\___//_|_|_\\\n' +
    '|  _     _     _   _  |\n' +
    '`-(_)---(_)---(_)-(_)-\'\n' +
    '```';

const DEPART_ASCII =
    '```\n' +
    '  INDEPENDENCE, MISSOURI — 1848\n' +
    '  ─────────────────────────────\n' +
    '  > WAGON TRAIN FORMING\n' +
    '  > DESTINATION: OREGON\n' +
    '```';

const VICTORY_ASCII =
    '```\n' +
    '  ★ OREGON TERRITORY ★\n' +
    '  _________________________\n' +
    '  YOU HAVE REACHED THE VALLEY\n' +
    '```';

module.exports = {
    COLORS,
    getLandmark,
    pickDayHeader,
    formatDayTitle,
    dayEmbedColor,
    getDayThumbnail,
    pickTrailFooter,
    weatherLine,
    formatTrailLog,
    progressBar,
    WAGON_ASCII,
    DEPART_ASCII,
    VICTORY_ASCII,
    LOBBY_THUMBNAIL,
    VICTORY_THUMBNAIL,
};
