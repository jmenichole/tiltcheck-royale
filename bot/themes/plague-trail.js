/**
 * Plague Trail — Trail Pass era theme pack.
 */

const landmarks = [
    { mi: 0, name: 'Quarantine Gate', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Oregon_National_Historic_Trail_in_Wyoming.jpg/500px-Oregon_National_Historic_Trail_in_Wyoming.jpg' },
    { mi: 120, name: 'Rat Warren', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Kansas_River.jpg' },
    { mi: 280, name: 'Plague Hospital', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Chimney_Rock_NE.jpg/500px-Chimney_Rock_NE.jpg' },
    { mi: 420, name: 'Mass Grave Ridge', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Fort_Laramie_NHS_WY3.jpg/500px-Fort_Laramie_NHS_WY3.jpg' },
    { mi: 560, name: 'Cremation Fields', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Independence_Rock_WY.jpg' },
    { mi: 700, name: 'Fever Marsh', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/TheDallesBridgeNorth.jpg/500px-TheDallesBridgeNorth.jpg' },
    { mi: 850, name: 'Corpse Ford', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Mount_Hood_reflected_in_Mirror_Lake%2C_Oregon.jpg/500px-Mount_Hood_reflected_in_Mirror_Lake%2C_Oregon.jpg' },
    { mi: 980, name: 'Beyond the Quarantine', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Willamette_Valley_Rural_-_Flickr_-_docoverachiever.jpg/500px-Willamette_Valley_Rural_-_Flickr_-_docoverachiever.jpg' },
];

const classBonuses = {
    'Plague Doctor': { maxHp: 100, startItems: ['Medicine', 'Medicine'] },
    Undertaker:    { maxHp: 110, startItems: ['Shotgun'] },
    Apothecary:    { maxHp: 90,  startItems: ['Medicine', 'Canteen'] },
    'Grave Robber':  { maxHp: 85,  startItems: ['Shotgun', 'Canteen'] },
    Quack:         { maxHp: 80,  startItems: ['Medicine'] },
};

const events = {
    combat: [
        '{a} beat {b} with a plague doctor\'s cane outside the quarantine tent! {b} took {dmg} damage.',
        '{a} threw a sack of infected rags at {b}\'s face. {b} suffered {dmg} damage.',
        '{a} and {b} fought over the last vial of laudanum. {b} lost. {dmg} damage.',
        '{a} swung a shovel at {b} beside an open grave. {b} took {dmg} damage.',
        '{a} accused {b} of spreading the plague and attacked with a wagon hook. {dmg} damage.',
        '{a} doused {b} in carbolic acid during a supply raid. {b} took {dmg} damage.',
        '{a} cornered {b} in the rat warren and struck with an iron bar. {b} took {dmg} damage.',
        '{a} challenged {b} to a knife fight over a stolen body cart. {b} took {dmg} damage.',
        '{a} smashed {b} with a coffin lid during a midnight burial dispute. {b} took {dmg} damage.',
    ],
    shotgun: [
        '{a} unloaded both barrels on {b} at the plague hospital gates! {b} took {dmg} damage.',
        '{a} held {b} at shotgun-point for their medicine chest. {b} resisted and took {dmg} damage.',
    ],
    instakill: [
        '{a} locked {b} in a quarantine ward with the dying. {b} never came out.',
        '{a} swapped {b}\'s plague mask filter for cheesecloth. {b} did not survive the night.',
        '{a} pushed {b} into a mass grave before the lime was spread. {b} was buried alive.',
        '{a} poisoned {b}\'s tonic with mercury. {b} died before dawn.',
    ],
    diseases: [
        { status: 'Bubonic Plague', msg: '{v} was bitten by a flea in the rat warren. **Bubonic plague** has taken hold.' },
        { status: 'Consumption', msg: '{v} coughed blood into their handkerchief. **Consumption** is spreading through their lungs.' },
        { status: 'Rat Bite', msg: '{v} reached into a grain sack and was bitten by a plague rat. **Venom** is spreading.', venom: true },
        { status: 'Typhus', msg: '{v} slept in a lice-ridden bunk at the plague hospital. **Typhus** has them in its grip.' },
        { status: 'Black Lung', msg: '{v} inhaled cremation ash all week and developed a brutal **black lung** cough.' },
    ],
    loot: [
        { item: 'Shotgun', msg: '{v} pried a shotgun from a dead guard\'s hands. The barrel still smells of powder.' },
        { item: 'Medicine', msg: '{v} looted a sealed medicine chest from an abandoned apothecary. **Medicine** acquired.' },
        { item: 'Canteen', msg: '{v} found a boiled-water canteen beside a quarantine checkpoint.' },
        { item: 'Rations', amount: 35, msg: '{v} scavenged preserved rations from a sealed wagon. **+35 lbs of rations**.' },
        { item: 'Rations', amount: 50, msg: '{v} traded grave-goods for clean food at a black market. **+50 lbs of rations**.' },
        { item: 'Rations', amount: 25, msg: '{v} found an untouched supply crate in the cremation fields. **+25 lbs of rations**.' },
    ],
    passive: [
        '{v} scrubbed their hands with carbolic acid and felt briefly safe.',
        '{v} spent the day boiling water and bandaging wounds. Morale improved. **+15 HP.**',
        '{v} found a clean plague mask in the mud. It still fits. Barely.',
        '{v} burned their infected bedding and slept cold but hopeful.',
        '{v} named their mule Lazarus. Lazarus coughed once and kept walking.',
    ],
    hunting: [
        { success: true, big: true, msg: '{v} shot a fat boar beyond the fever marsh. **+60 lbs of meat.**' },
        { success: true, big: false, msg: '{v} trapped three rats and a suspiciously large crow. **+20 lbs of meat.**' },
        { success: true, big: false, msg: '{v} traded sulfur candles for smoked fish at camp. **+24 lbs of food.**' },
        { success: false, big: false, msg: '{v} tracked movement in the marsh. It was a bloated log.' },
        { success: false, big: false, msg: '{v} fired at a shadow near the grave ridge. It was a scarecrow. Ammunition wasted.' },
    ],
    rivers: [
        {
            name: 'Bloody Creek Ford',
            distance: 250,
            outcomes: [
                { type: 'drown', msg: 'The creek ran red with runoff from the mass graves. {v} was pulled under and never surfaced.' },
                { type: 'damage', dmg: 30, rationLoss: 35, msg: 'A wagon wheel snapped mid-ford! {v} took {dmg} damage and **35 lbs of supplies** washed downstream.' },
                { type: 'safe', msg: 'The party forded Bloody Creek at low water. Boots soaked in something worse than mud.' },
            ],
        },
        {
            name: 'Fever Marsh Crossing',
            distance: 550,
            outcomes: [
                { type: 'drown', msg: 'The fever marsh swallowed {v} whole. Bubbles rose once, then stilled.' },
                { type: 'damage', dmg: 40, rationLoss: 45, msg: 'Sinking peat pulled the wagon under! {v} took {dmg} damage and lost **45 lbs of gear**.' },
                { type: 'safe', msg: 'The party crossed the fever marsh on a rope of lashed coffin boards. Terrifying but effective.' },
            ],
        },
        {
            name: 'Corpse Ford',
            distance: 800,
            outcomes: [
                { type: 'drown', msg: 'A swollen corpse blocked the ford and tipped the wagon. {v} was swept away with the dead.' },
                { type: 'damage', dmg: 50, rationLoss: 55, msg: 'The current shifted a burial cart into the trail! {v} took {dmg} damage. **55 lbs of food** contaminated.' },
                { type: 'safe', msg: 'The party squeezed through Corpse Ford at dusk, gagging but alive.' },
            ],
        },
    ],
    weatherEvents: {
        Rainy: '{v} stood in pouring rain at an open grave. **-9 HP.** from exposure.',
        Stormy: 'Lightning struck a quarantine tent beside {v}. **-8 HP.** from the shock.',
        Blizzard: '{v} got caught in a freak snow squall over the mass graves. **-12 HP.**',
    },
    victory: [
        '🏆 **{v}** staggered beyond the quarantine line, plague mask cracked and enemies in the ground. **Plague Trail champion** with **{kills} kill{s}**!',
        '🎉 **{v}** outlasted the rats, the fever, and Lazarus the mule. **Tilt Battle Royale** winner with **{kills} kill{s}**.',
        '☠️ Every wagon went silent. Nobody crossed the quarantine. The undertakers work overtime tonight.',
    ],
};

module.exports = {
    id: 'plague-trail',
    name: 'Plague Trail',
    requiresPass: true,
    landmarks,
    classBonuses,
    hunterProfession: 'Undertaker',
    tankProfession: 'Plague Doctor',
    venomStatus: 'Rat Bite',
    weathers: ['Rainy', 'Rainy', 'Stormy', 'Stormy', 'Stormy', 'Fair', 'Blizzard'],
    eventWeights: { combat: 0.28, disease: 0.55, loot: 0.62, hunt: 0.72 },
    events,
    phaseFlavors: {
        departure: 'The quarantine gate creaks shut behind you. Rats scatter.',
        killzone: 'Graves line the trail. Pioneers eye each other\'s medicine.',
        final: 'The last ford runs red. No one leaves together.',
    },
    lobbyTagline: '*The wagon creaks. Someone coughs. Only one survives the plague trail.*',
    victoryBanner: '**★ Beyond the Quarantine ★**\n*You outlasted the plague.*',
};
