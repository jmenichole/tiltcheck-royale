/**
 * Steampunk Express — Trail Pass era theme pack.
 */

const landmarks = [
    { mi: 0, name: 'Brass Junction', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Oregon_National_Historic_Trail_in_Wyoming.jpg/500px-Oregon_National_Historic_Trail_in_Wyoming.jpg' },
    { mi: 120, name: 'Gearford Station', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Kansas_River.jpg' },
    { mi: 280, name: 'Clockwork Canyon', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Chimney_Rock_NE.jpg/500px-Chimney_Rock_NE.jpg' },
    { mi: 420, name: 'Copper Spire Depot', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Fort_Laramie_NHS_WY3.jpg/500px-Fort_Laramie_NHS_WY3.jpg' },
    { mi: 560, name: 'Airship Graveyard', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Independence_Rock_WY.jpg' },
    { mi: 700, name: 'Piston Valley', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/TheDallesBridgeNorth.jpg/500px-TheDallesBridgeNorth.jpg' },
    { mi: 850, name: 'Ironcloud Pass', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Mount_Hood_reflected_in_Mirror_Lake%2C_Oregon.jpg/500px-Mount_Hood_reflected_in_Mirror_Lake%2C_Oregon.jpg' },
    { mi: 980, name: 'Terminus Prime', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Willamette_Valley_Rural_-_Flickr_-_docoverachiever.jpg/500px-Willamette_Valley_Rural_-_Flickr_-_docoverachiever.jpg' },
];

const classBonuses = {
    Inventor:   { maxHp: 80,  startItems: ['Medicine', 'Canteen'] },
    Boilerhand: { maxHp: 110, startItems: ['Canteen'] },
    Aerialist:  { maxHp: 90,  startItems: ['Shotgun'] },
    Tinker:     { maxHp: 95,  startItems: ['Medicine'] },
    Marshal:    { maxHp: 105, startItems: ['Shotgun', 'Medicine'] },
};

const events = {
    combat: [
        '{a} clocked {b} with a brass wrench on the observation deck! {b} took {dmg} damage.',
        '{a} vented superheated steam at {b}\'s face from a ruptured boiler pipe! {b} suffered {dmg} damage.',
        '{a} hurled a spinning gear at {b} across the luggage car! {b} took {dmg} damage.',
        '{a} and {b} fought over the last canister of coal. {b} lost. {dmg} damage.',
        '{a} shorted {b}\'s pressure gauge and the gauge exploded in their hands. {dmg} damage.',
        '{a} challenged {b} to a midnight duel on the caboose roof. {a} drew faster. {b} took {dmg} damage.',
        '{a} sabotaged {b}\'s safety valve. The blast scorched {b} for {dmg} damage.',
        '{a} swung a copper fire poker at {b} in the dining car brawl! {b} took {dmg} damage.',
        '{a} dropped a crate of clockwork spiders on {b}. The spiders did their work. {dmg} damage.',
    ],
    shotgun: [
        '{a} unloaded both barrels on {b} at the platform gates! {b} took {dmg} damage.',
        '{a} held {b} at shotgun-point for their airship boarding pass. {b} resisted and took {dmg} damage.',
    ],
    instakill: [
        '{a} cut {b}\'s safety tether during a sky-bridge crossing. {b} fell into the canyon below.',
        '{a} swapped {b}\'s oxygen canister for an empty one on the airship. {b} did not survive the ascent.',
        '{a} locked {b} inside a boiler room and opened every valve. {b} was found hours later.',
        '{a} laced {b}\'s tea with mercury from the inventor\'s lab. {b} died before the next whistle.',
    ],
    diseases: [
        { status: 'Boiler Lung', msg: '{v} inhaled coal dust in the engine room and developed **boiler lung**.' },
        { status: 'Rust Fever', msg: '{v} drank from a corroded canteen and caught **rust fever**.' },
        { status: 'Steam Burn', msg: '{v} was scalded by a burst steam pipe. **Venom**-like heat is spreading through their veins.', venom: true },
        { status: 'Clockwork Cough', msg: '{v} breathed gear oil fumes all week and now has a brutal **clockwork cough**.' },
        { status: 'Copper Plague', msg: '{v} handled unshielded copper wiring and contracted **copper plague**.' },
    ],
    loot: [
        { item: 'Shotgun', msg: '{v} found a polished double-barrel in a marshal\'s abandoned berth. Loaded and ready.' },
        { item: 'Medicine', msg: '{v} traded brass fittings for a vial of inventor\'s tonic. **Medicine** acquired.' },
        { item: 'Canteen', msg: '{v} salvaged a copper-lined canteen from a wrecked luggage car.' },
        { item: 'Rations', amount: 40, msg: '{v} bartered clockwork parts for preserved rations. **+40 lbs of supplies**.' },
        { item: 'Rations', amount: 55, msg: '{v} discovered a hidden coal cache behind the furnace. **+55 lbs of fuel and food**.' },
        { item: 'Rations', amount: 30, msg: '{v} found an unclaimed provision crate on the platform. **+30 lbs of rations**.' },
    ],
    passive: [
        '{v} tuned their pocket watch and felt briefly in control of time.',
        '{v} spent the evening watching stars from the observation car. Morale improved. **+15 HP.**',
        '{v} lost their goggles. Found them on a passing airship. The goggles looked smug.',
        '{v} paid too much for coal biscuits and complained about it for six miles.',
        '{v} named their pressure gauge Prudence. Prudence remains unimpressed.',
    ],
    hunting: [
        { success: true, big: true, msg: '{v} shot a sky-bison grazing near the rail line. **+65 lbs of meat.**' },
        { success: true, big: false, msg: '{v} bagged three pheasants and a suspiciously large mechanical trout. **+28 lbs of meat.**' },
        { success: true, big: false, msg: '{v} traded tobacco for smoked eel at a wayside platform. **+22 lbs of food.**' },
        { success: false, big: false, msg: '{v} tracked hoof prints that turned out to be their own from yesterday\'s patrol.' },
        { success: false, big: false, msg: '{v} fired at a shadow on the trestle. It was a laundry line. Ammunition wasted.' },
    ],
    rivers: [
        {
            name: 'Copper Gorge Trestle',
            distance: 250,
            outcomes: [
                { type: 'drown', msg: 'The trestle gave way mid-crossing. {v} plunged into the gorge with the rails.' },
                { type: 'damage', dmg: 30, rationLoss: 35, msg: 'A coupling snapped! {v} took {dmg} damage and **35 lbs of supplies** tumbled into the canyon.' },
                { type: 'safe', msg: 'The party crossed the Copper Gorge trestle at low wind. Boots rattling, spirits high.' },
            ],
        },
        {
            name: 'Clockwork Canyon Bridge',
            distance: 550,
            outcomes: [
                { type: 'drown', msg: 'The canyon bridge collapsed under the weight of the coal car. {v} went down with the gears.' },
                { type: 'damage', dmg: 40, rationLoss: 45, msg: 'Loose rigging snapped! {v} took {dmg} damage and lost **45 lbs of gear**.' },
                { type: 'safe', msg: 'The party inched across the Clockwork Canyon bridge on a rope line. Terrifying but effective.' },
            ],
        },
        {
            name: 'Ironcloud Rail Crossing',
            distance: 800,
            outcomes: [
                { type: 'drown', msg: 'A flash flood in the rail cut took {v}. Their ticket floated away on the current.' },
                { type: 'damage', dmg: 50, rationLoss: 55, msg: 'A rockslide blocked the tracks! {v} took {dmg} damage. **55 lbs of food** buried under debris.' },
                { type: 'safe', msg: 'The party squeezed through the Ironcloud rail cut at dusk, bruised but alive.' },
            ],
        },
    ],
    weatherEvents: {
        Scorching: '{v} collapsed on the sun-baked platform between cars. **-10 HP.**',
        Stormy: 'Lightning struck the conductor\'s bell beside {v}. **-8 HP.** from the shock.',
        Fair: 'A sudden calm settled over the rails. {v} caught their breath on the caboose steps. **+5 HP.**',
    },
    victory: [
        '🏆 **{v}** stood alone on the platform at Terminus Prime, soot-stained and surrounded by wreckage. **Steampunk Express champion** with **{kills} kill{s}**!',
        '🎉 **{v}** outlasted boiler explosions, airship crashes, and Prudence the pressure gauge. **Tilt Battle Royale** winner with **{kills} kill{s}**.',
        '☠️ Every car went cold. Nobody reached Terminus Prime. The last whistle echoes into silence.',
    ],
};

module.exports = {
    id: 'steampunk-express',
    name: 'Steampunk Express',
    requiresPass: true,
    landmarks,
    classBonuses,
    hunterProfession: 'Aerialist',
    tankProfession: 'Marshal',
    venomStatus: 'Steam Burn',
    weathers: ['Fair', 'Fair', 'Fair', 'Scorching', 'Scorching', 'Stormy', 'Stormy'],
    eventWeights: { combat: 0.42, disease: 0.48, loot: 0.65, hunt: 0.75 },
    events,
    phaseFlavors: {
        departure: 'Steam hisses. Gears turn. The express won\'t wait.',
        killzone: 'Sabotage and boiler explosions thin the ranks.',
        final: 'All aboard — or off the train.',
    },
    lobbyTagline: '*All aboard the Steampunk Express. One ticket. One survivor.*',
    victoryBanner: '**★ Terminus Reached ★**\n*The last conductor standing.*',
};
