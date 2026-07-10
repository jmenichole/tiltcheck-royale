/**
 * Oregon Trail — default free era theme pack.
 */

const landmarks = [
    { mi: 0, name: 'Independence, Missouri', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Kiosk_in_Independence%2C_Missouri_where_three_National_Historic_Trails_meet_-_005.jpg/500px-Kiosk_in_Independence%2C_Missouri_where_three_National_Historic_Trails_meet_-_005.jpg' },
    { mi: 120, name: 'Kansas River Crossing', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Kansas_River.jpg' },
    { mi: 280, name: 'Fort Kearney', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Old_Fort_Kearny_Historical_Marker%2C_Nebraska_City.jpg/500px-Old_Fort_Kearny_Historical_Marker%2C_Nebraska_City.jpg' },
    { mi: 420, name: 'Chimney Rock', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Chimney_Rock_NE.jpg/500px-Chimney_Rock_NE.jpg' },
    { mi: 560, name: 'Fort Laramie', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Fort_Laramie_NHS_WY3.jpg/500px-Fort_Laramie_NHS_WY3.jpg' },
    { mi: 700, name: 'Independence Rock', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Independence_Rock_WY.jpg' },
    { mi: 850, name: 'The Dalles', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/TheDallesBridgeNorth.jpg/500px-TheDallesBridgeNorth.jpg' },
    { mi: 980, name: 'Willamette Valley', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Willamette_Valley_Rural_-_Flickr_-_docoverachiever.jpg/500px-Willamette_Valley_Rural_-_Flickr_-_docoverachiever.jpg' },
];

const classBonuses = {
    Banker:    { maxHp: 80,  startItems: ['Medicine'] },
    Carpenter: { maxHp: 100, startItems: ['Canteen', 'Shotgun'] },
    Farmer:    { maxHp: 120, startItems: ['Canteen'] },
    Teacher:   { maxHp: 90,  startItems: ['Medicine', 'Canteen'] },
    Doctor:    { maxHp: 100, startItems: ['Medicine', 'Medicine'] },
};

const events = {
    combat: [
        '{a} cracked {b} over the head with a cast iron skillet! {b} took {dmg} damage.',
        '{a} shot {b} in the kneecap with a rusty revolver! {b} suffered {dmg} damage.',
        '{a} poisoned {b}\'s canteen with nightshade berries! {b} took {dmg} damage.',
        '{a} challenged {b} to a duel at dawn. {a} shot first. {b} took {dmg} damage.',
        '{a} beat {b} with a wagon tongue over a stolen tin of peaches! {b} took {dmg} damage.',
        '{a} and {b} brawled over the last strip of beef jerky. {b} lost badly. {dmg} damage.',
        '{a} set fire to {b}\'s sleeping bag! {b} took {dmg} damage.',
        '{a} pushed {b} into a river rapid! {b} barely survived with {dmg} damage.',
        '{a} ambushed {b} from behind a barrel cactus. {b} took {dmg} damage.',
        '{a} threw a rusted horseshoe at {b}\'s face. {b} took {dmg} damage.',
    ],
    shotgun: [
        '{a} unloaded a double-barrel shotgun on {b} at close range! {b} took {dmg} damage.',
        '{a} cornered {b} and demanded their rations at gunpoint. {b} resisted and took {dmg} damage.',
    ],
    instakill: [
        '{a} challenged {b} to a duel. {a} drew faster. {b} did not survive.',
        '{a} snuck into {b}\'s tent at midnight. {b} did not wake up.',
        '{a} pushed {b} off the wagon while fording a deep river. {b} drowned.',
        '{a} laced {b}\'s supper with arsenic from the medicine chest. {b} died overnight.',
    ],
    diseases: [
        { status: 'Dysentery', msg: '{v} drank from a stagnant pond. They have contracted **dysentery**.' },
        { status: 'Cholera', msg: '{v} ate undercooked prairie dog meat and now has **cholera**.' },
        { status: 'Rattlesnake Bite', msg: '{v} reached into their boot and was bitten by a rattlesnake. **Venom** is spreading.', venom: true },
        { status: 'Measles', msg: '{v} has broken out in **measles**. The rest of the wagon is nervous.' },
        { status: 'Typhoid', msg: '{v} has developed **typhoid fever** from contaminated water.' },
        { status: 'Frostbite', msg: '{v} lost three toes to **frostbite** overnight. Movement is painful.' },
    ],
    loot: [
        { item: 'Shotgun', msg: '{v} found a shotgun in an abandoned settler wagon. Loaded and ready.' },
        { item: 'Medicine', msg: '{v} gathered wild medicinal herbs. They now carry a **Medicine** pouch.' },
        { item: 'Canteen', msg: '{v} fashioned a leather canteen. They can carry clean water now.' },
        { item: 'Rations', amount: 35, msg: '{v} discovered a hidden crate of salt-pork. **+35 lbs of rations**.' },
        { item: 'Rations', amount: 20, msg: '{v} traded a spare axle for a bag of dried beans. **+20 lbs of rations**.' },
    ],
    passive: [
        '{v} carved their initials into Independence Rock. History will remember them.',
        '{v} walked 12 miles in wet boots and has three blisters the size of coins.',
        '{v} slept under a clear sky and woke up feeling strangely hopeful. **+15 HP.**',
        '{v} named the lead ox Gerald. Gerald seems indifferent.',
        '{v} found a nickel in the dirt and felt rich for the first time in weeks.',
    ],
    hunting: [
        { success: true, big: true, msg: '{v} tracked a massive bison for six hours and brought it down. **+60 lbs of meat.**' },
        { success: true, big: false, msg: '{v} bagged a wild turkey and three rabbits. **+25 lbs of meat.**' },
        { success: true, big: false, msg: '{v} found a creek full of fish and smoked them all night. **+20 lbs of food.**' },
        { success: false, big: false, msg: '{v} went hunting and fired four shots. All four missed. Ammunition wasted.' },
        { success: false, big: false, msg: '{v} stalked a deer for two hours before stepping on a branch. The deer left.' },
    ],
    rivers: [
        {
            name: 'Kansas River',
            distance: 250,
            outcomes: [
                { type: 'drown', msg: 'The wagon capsized in the current. {v} was swept downstream and drowned.' },
                { type: 'damage', dmg: 35, rationLoss: 40, msg: 'The wagon tipped! {v} took {dmg} damage and **40 lbs of rations** were lost to the river.' },
                { type: 'safe', msg: 'The wagon caulked and floated across the Kansas River safely. Everyone is soaked but alive.' },
            ],
        },
        {
            name: 'Snake River',
            distance: 550,
            outcomes: [
                { type: 'drown', msg: 'The Snake River lived up to its name. {v} fought the current and lost.' },
                { type: 'damage', dmg: 45, rationLoss: 50, msg: 'A wheel broke mid-crossing! {v} took {dmg} damage and the current claimed **50 lbs of supplies**.' },
                { type: 'safe', msg: 'The party found a shallow ford and crossed the Snake River without incident.' },
            ],
        },
        {
            name: 'Columbia River Gorge',
            distance: 800,
            outcomes: [
                { type: 'drown', msg: 'The Columbia\'s rapids finally claimed {v}. No body was recovered.' },
                { type: 'damage', dmg: 55, rationLoss: 60, msg: 'The raft broke apart in the gorge! {v} took {dmg} damage. **60 lbs of food** sank to the bottom.' },
                { type: 'safe', msg: 'The party navigated the Columbia River Gorge on a raft of lashed logs. Gruelling but successful.' },
            ],
        },
    ],
    weatherEvents: {
        Scorching: '{v} collapsed from heat exhaustion in the midday sun. **-10 HP.**',
        Blizzard: '{v} lost feeling in their fingers during the blizzard. **-12 HP.**',
        Stormy: 'Lightning struck near the wagon. Everyone scattered. {v} twisted their ankle. **-8 HP.**',
    },
    victory: [
        '🏆 **{v}** staggered into the Willamette Valley, sunburned, half-starved, and the last one standing. **{v} wins Tilt Battle Royale** with **{kills} kill{s}**!',
        '🎉 Against all odds — dysentery, gunfire, and Gerald the ox — **{v}** has reached Oregon alive. **Tilt Battle Royale Champion** with **{kills} kill{s}**.',
        '☠️ The frontier claimed everyone. No one reached Oregon. The crows feast well tonight.',
    ],
};

module.exports = {
    id: 'oregon-trail',
    name: 'Oregon Trail',
    requiresPass: false,
    landmarks,
    classBonuses,
    hunterProfession: 'Farmer',
    tankProfession: 'Doctor',
    venomStatus: 'Rattlesnake Bite',
    weathers: ['Fair', 'Fair', 'Fair', 'Rainy', 'Scorching', 'Stormy', 'Blizzard'],
    eventWeights: { combat: 0.38, disease: 0.52, loot: 0.67, hunt: 0.82 },
    events,
    lobbyTagline: '*Independence, Missouri → Oregon Territory — one pioneer survives.*',
    victoryBanner: '**★ Oregon Territory ★**\n*You have reached the valley.*',
};
