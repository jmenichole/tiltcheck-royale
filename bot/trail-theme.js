/**
 * Oregon Trail-inspired embed styling (parody — not affiliated with Oregon Trail).
 */

const LANDMARKS = [
    { mi: 0, name: 'Independence, Missouri' },
    { mi: 120, name: 'Kansas River Crossing' },
    { mi: 280, name: 'Fort Kearney' },
    { mi: 420, name: 'Chimney Rock' },
    { mi: 560, name: 'Fort Laramie' },
    { mi: 700, name: 'Independence Rock' },
    { mi: 850, name: 'The Dalles' },
    { mi: 980, name: 'Willamette Valley' },
];

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

const ICONS = {
    day: '📅',
    combat: '⚔️',
    death: '☠️',
    disease: '🤢',
    item: '📦',
    passive: '📜',
};

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
        .filter(e => e.type !== 'day')
        .map(e => `${ICONS[e.type] || '•'} ${e.text}`);

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
    getLandmark,
    pickTrailFooter,
    weatherLine,
    formatTrailLog,
    progressBar,
    WAGON_ASCII,
    DEPART_ASCII,
    VICTORY_ASCII,
};
