/**
 * Oregon Trail-inspired embed styling (parody — not affiliated with Oregon Trail).
 */

const { EmbedBuilder } = require('discord.js');

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

/** Dry OT-style lines — occasional wink at `/support`, never a hard sell. */
const SUPPORT_WINKS = [
    'The oxen union says tips are optional. `/support` if you feel guilty.',
    'Spare wagon wheel donations accepted. No gameplay advantage. Obviously.',
    'This trail runs on beans, spite, and the kindness of strangers.',
    'You may die of dysentery. Your wallet might survive.',
    'General store is `/support`. We sell nothing useful on purpose.',
    'Rations are simulated. Developer snacks are not.',
    'Tip the oxen. They cannot read Stripe receipts.',
    'Fort Kearney gift shop is closed. `/support` is the gift shop.',
    'No pay-to-win. Pay-to-laugh is also not a thing. Yet.',
    'The trail remembers tippers. The trail also forgets everything else.',
];

function pickSupportWink() {
    return SUPPORT_WINKS[Math.floor(Math.random() * SUPPORT_WINKS.length)];
}

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
    ford:    { label: 'Fording the River' },
    hunt:    { label: 'Hunt for Food' },
    rest:    { label: 'Rest Here' },
    travel:  { label: 'Continue on Trail' },
    storm:   { label: 'Storm on the Trail' },
    burial:  { label: 'Burial on the Trail' },
};

const EVENT_ICONS = {
    combat: '⚔️',
    death: '☠️',
    disease: '🤒',
    item: '📦',
    passive: '🌾',
};

function stripLeadingEmoji(text) {
    return text.replace(/^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]+/u, '').trim();
}

function formatDayTitle(header, day) {
    if (header.label === `Day ${day}` || header.label === `DAY ${day}`) {
        return `Day ${day}`;
    }
    return `Day ${day} — ${header.label}`;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
        label: `Day ${day}`,
        flavor: weatherLine(weather),
    };
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

function pickTrailFooter() {
    return TRAIL_FOOTERS[Math.floor(Math.random() * TRAIL_FOOTERS.length)];
}

function weatherLine(weather) {
    return WEATHER_FLAVOR[weather] || 'Another day on the Oregon Trail.';
}

/** Rumble-style narrative — prose with bold names (no code blocks). */
function formatTrailNarrative(events, options = {}) {
    const { includeRoutine = false } = options;
    const filtered = includeRoutine
        ? events
        : events.filter(
            (e) => e.severity !== 'routine' && !(e.type === 'day' && !e.landmark && !e.river),
        );

    const lines = filtered
        .filter((e) => e.type !== 'day')
        .map((e) => {
            let text = stripLeadingEmoji(e.text);
            if (e.type === 'death' && e.victim) {
                text = text.replace(
                    new RegExp(`\\*\\*${escapeRegex(e.victim)}\\*\\*`),
                    `~~**${e.victim}**~~`,
                );
            }
            const icon = EVENT_ICONS[e.type] || '•';
            return `${icon} ${text}`;
        });

    if (lines.length === 0) {
        return 'The trail is quiet. Oxen breathe heavy in the cold air.';
    }

    return lines.join('\n');
}

function formatHighlightTitle(day, events, landmarkName) {
    const death = events.find((e) => e.type === 'death');
    const combat = events.find((e) => e.type === 'combat');
    if (death) {
        return `Day ${day} — ☠️ ${death.victim || 'A pioneer'} falls${landmarkName ? ` at ${landmarkName}` : ''}`;
    }
    if (combat) return `Day ${day} — ⚔️ Blood on the trail`;
    if (events.some((e) => e.landmark)) return `Day ${day} — ${landmarkName || 'Landmark'}`;
    if (events.some((e) => e.river)) return `Day ${day} — River crossing`;
    return formatDayTitle(
        pickDayHeader(day, events[0]?.weather, events, { name: landmarkName }),
        day,
    );
}

function buildPhaseEmbed(phase, aliveCount, eraName, flavor) {
    const titles = {
        killzone: '🔥 ACT II — KILL ZONE',
        final: '🔥 ACT III — FINAL FORD',
    };
    return new EmbedBuilder()
        .setColor(COLORS.amber)
        .setTitle(titles[phase] || 'ACT I — DEPARTURE')
        .setDescription(
            `${flavor}\n\n**${aliveCount}** pioneer${aliveCount === 1 ? '' : 's'} remain.\n**Era:** ${eraName}`,
        )
        .setTimestamp();
}

/** Compact stats line like Rumble's "Players Left: X • Era: Y" footer. */
function formatDayFooter(distance, weather, rations, aliveCount, total, landmarkName, eraName) {
    const era = eraName ? `Era: ${eraName} • ` : '';
    return (
        `${era}Alive: ${aliveCount}/${total} • ${distance}/1000 mi • ${weather} • ` +
        `${Math.max(0, rations)} lbs rations • Near ${landmarkName}`
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

const VICTORY_BANNER = '**★ Oregon Territory ★**\n*You have reached the valley.*';

module.exports = {
    COLORS,
    pickDayHeader,
    formatDayTitle,
    dayEmbedColor,
    getDayThumbnail,
    pickTrailFooter,
    pickSupportWink,
    weatherLine,
    formatTrailNarrative,
    formatHighlightTitle,
    buildPhaseEmbed,
    formatDayFooter,
    progressBar,
    WAGON_ASCII,
    DEPART_ASCII,
    VICTORY_BANNER,
    LOBBY_THUMBNAIL,
    VICTORY_THUMBNAIL,
};
