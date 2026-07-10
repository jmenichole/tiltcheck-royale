/**
 * Gold Rush '49 — Trail Pass era theme pack.
 */

const landmarks = [
    { mi: 0, name: 'Sacramento Landing', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Oregon_National_Historic_Trail_in_Wyoming.jpg/500px-Oregon_National_Historic_Trail_in_Wyoming.jpg' },
    { mi: 120, name: 'American River Camp', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Kansas_River.jpg' },
    { mi: 280, name: "Sutter's Mill", thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Chimney_Rock_NE.jpg/500px-Chimney_Rock_NE.jpg' },
    { mi: 420, name: 'Hangtown', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Fort_Laramie_NHS_WY3.jpg/500px-Fort_Laramie_NHS_WY3.jpg' },
    { mi: 560, name: 'Mother Lode Ridge', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Independence_Rock_WY.jpg' },
    { mi: 700, name: 'Sierra Foothills', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/TheDallesBridgeNorth.jpg/500px-TheDallesBridgeNorth.jpg' },
    { mi: 850, name: 'Bear Valley Pass', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Mount_Hood_reflected_in_Mirror_Lake%2C_Oregon.jpg/500px-Mount_Hood_reflected_in_Mirror_Lake%2C_Oregon.jpg' },
    { mi: 980, name: 'Rich Claim Stake', thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Willamette_Valley_Rural_-_Flickr_-_docoverachiever.jpg/500px-Willamette_Valley_Rural_-_Flickr_-_docoverachiever.jpg' },
];

const classBonuses = {
    Prospector:    { maxHp: 110, startItems: ['Canteen'] },
    'Saloon Keeper': { maxHp: 90,  startItems: ['Medicine'] },
    'Claim Jumper':  { maxHp: 100, startItems: ['Shotgun'] },
    Assayer:       { maxHp: 80,  startItems: ['Medicine', 'Canteen'] },
    Sheriff:       { maxHp: 100, startItems: ['Shotgun', 'Medicine'] },
};

const events = {
    combat: [
        '{a} cracked {b} with a mining pan in a saloon brawl! {b} took {dmg} damage.',
        '{a} accused {b} of claim jumping and opened fire! {b} suffered {dmg} damage.',
        '{a} spiked {b}\'s whiskey with laudanum. {b} took {dmg} damage.',
        '{a} and {b} fought over a gold nugget the size of a thumbnail. {b} lost. {dmg} damage.',
        '{a} rolled a boulder downhill at {b}\'s camp. {b} took {dmg} damage.',
        '{a} shorted {b} on a dust weigh-in and got punched through a tent flap. {dmg} damage.',
        '{a} lit dynamite too early near {b}\'s claim. {b} took {dmg} damage.',
        '{a} challenged {b} to a noon street duel. {a} drew faster. {b} took {dmg} damage.',
    ],
    shotgun: [
        '{a} unloaded both barrels on {b} outside the assayer\'s office! {b} took {dmg} damage.',
        '{a} held up {b} at shotgun-point for their claim map. {b} resisted and took {dmg} damage.',
    ],
    instakill: [
        '{a} caught {b} sleeping on their claim and buried them under a rockslide.',
        '{a} swapped {b}\'s dynamite fuse for a shorter one. {b} did not survive the blast.',
        '{a} pushed {b} into a flooded mine shaft. {b} never surfaced.',
        '{a} poisoned {b}\'s coffee at the saloon. {b} died before sunset.',
    ],
    diseases: [
        { status: 'Saloon Fever', msg: '{v} woke up behind the saloon with **saloon fever** and regrets.' },
        { status: 'Bad Whiskey', msg: '{v} drank rotgut whiskey and now has **bad whiskey poisoning**.' },
        { status: 'Scorpion Sting', msg: '{v} reached into a boot and was stung by a scorpion. **Venom** is spreading.', venom: true },
        { status: 'Claim Cough', msg: '{v} inhaled mine dust all week and developed a brutal **claim cough**.' },
        { status: 'Typhoid', msg: '{v} drank from a tainted creek and caught **typhoid**.' },
    ],
    loot: [
        { item: 'Shotgun', msg: '{v} won a shotgun in a poker game. It still smells like cigar smoke.' },
        { item: 'Medicine', msg: '{v} bought miracle tonic from a traveling doctor. **Medicine** acquired.' },
        { item: 'Canteen', msg: '{v} traded dust for a sturdy canteen at the general store.' },
        { item: 'Rations', amount: 40, msg: '{v} panned enough dust to buy supplies. **+40 lbs of rations**.' },
        { item: 'Rations', amount: 55, msg: '{v} found a rich pocket in the creek bed. **+55 lbs of gold dust provisions**.' },
        { item: 'Rations', amount: 30, msg: '{v} discovered an abandoned claim stash. **+30 lbs of rations**.' },
    ],
    passive: [
        '{v} carved their name on a claim stake and felt briefly immortal.',
        '{v} spent all day panning and found three flecks of gold. Morale improved. **+15 HP.**',
        '{v} lost their donkey. Found it later at the saloon. The donkey looked happier.',
        '{v} paid too much for beans and complained about it for six miles.',
        '{v} named their mule Jackpot. Jackpot remains unimpressed.',
    ],
    hunting: [
        { success: true, big: true, msg: '{v} bagged a fat elk near the ridge. **+65 lbs of meat.**' },
        { success: true, big: false, msg: '{v} shot two rabbits and a suspiciously large trout. **+28 lbs of meat.**' },
        { success: true, big: false, msg: '{v} traded tobacco for smoked trout at camp. **+22 lbs of food.**' },
        { success: false, big: false, msg: '{v} tracked deer tracks that turned out to be their own from yesterday.' },
        { success: false, big: false, msg: '{v} fired at a shadow. It was a laundry line. Ammunition wasted.' },
    ],
    rivers: [
        {
            name: 'American River Ford',
            distance: 250,
            outcomes: [
                { type: 'drown', msg: 'The current grabbed {v} mid-ford and pulled them under the American River.' },
                { type: 'damage', dmg: 30, rationLoss: 35, msg: 'A mule slipped! {v} took {dmg} damage and **35 lbs of supplies** washed away.' },
                { type: 'safe', msg: 'The party forded the American River at low water. Boots soaked, spirits high.' },
            ],
        },
        {
            name: 'Feather River Crossing',
            distance: 550,
            outcomes: [
                { type: 'drown', msg: 'The Feather River rose fast. {v} was swept downstream with the pans.' },
                { type: 'damage', dmg: 40, rationLoss: 45, msg: 'Loose rigging snapped! {v} took {dmg} damage and lost **45 lbs of gear**.' },
                { type: 'safe', msg: 'The party crossed the Feather River on a rope line. Terrifying but effective.' },
            ],
        },
        {
            name: 'Sierra Canyon Pass',
            distance: 800,
            outcomes: [
                { type: 'drown', msg: 'A flash flood in the canyon took {v}. The claim papers floated away.' },
                { type: 'damage', dmg: 50, rationLoss: 55, msg: 'A rockslide blocked the trail! {v} took {dmg} damage. **55 lbs of food** buried.' },
                { type: 'safe', msg: 'The party squeezed through Sierra Canyon at dusk, bruised but alive.' },
            ],
        },
    ],
    weatherEvents: {
        Scorching: '{v} passed out panning in the midday heat. **-10 HP.**',
        Blizzard: '{v} got caught in a freak mountain snow squall. **-12 HP.**',
        Stormy: 'Lightning hit a claim post beside {v}. **-8 HP.** from the shock.',
    },
    victory: [
        '🏆 **{v}** stood on the richest claim in the valley, pockets full of dust and enemies full of lead. **Gold Rush champion** with **{kills} kill{s}**!',
        '🎉 **{v}** outlasted claim jumpers, bad whiskey, and Jackpot the mule. **Tilt Battle Royale** winner with **{kills} kill{s}**.',
        '☠️ Every claim went cold. Nobody walked away rich. The saloon closes early tonight.',
    ],
};

module.exports = {
    id: 'gold-rush',
    name: 'Gold Rush',
    requiresPass: true,
    landmarks,
    classBonuses,
    hunterProfession: 'Prospector',
    tankProfession: 'Sheriff',
    venomStatus: 'Scorpion Sting',
    weathers: ['Fair', 'Fair', 'Fair', 'Fair', 'Scorching', 'Stormy', 'Rainy'],
    eventWeights: { combat: 0.30, disease: 0.40, loot: 0.58, hunt: 0.78 },
    events,
    lobbyTagline: '*Sacramento → Mother Lode — one claim survives.*',
    victoryBanner: '**★ Mother Lode ★**\n*The richest claim is yours.*',
};
