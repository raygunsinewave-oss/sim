// Persona generation: every crowd member gets a name, background, taste, goal and a living story.
import { makeRng } from './util.js';
import { ANTHEMS } from './songs.js';

export const GENRES = ['House', 'Tech House', 'Techno', 'Trance', 'Dubstep', 'Drum & Bass', 'Hardstyle', 'Hip-Hop/Trap', 'Pop/EDM', 'Disco/Funk', 'Ambient'];
export const GENRE_MAP = {
  'Progressive House': 'House', 'Big Room': 'Pop/EDM', 'Electro House': 'House', 'Breakbeat': 'Drum & Bass', 'Trap': 'Hip-Hop/Trap'
};
export const canonGenre = (g) => GENRE_MAP[g] || (GENRES.includes(g) ? g : 'Pop/EDM');

const FIRST = [
  'Aaliyah', 'Abdul', 'Ada', 'Adebayo', 'Aiko', 'Alejandro', 'Alexei', 'Amara', 'Amir', 'Ana', 'Andre', 'Anika', 'Arjun', 'Astrid', 'Ayesha', 'Bao',
  'Beatriz', 'Ben', 'Bianca', 'Bilal', 'Bjorn', 'Bruno', 'Camila', 'Carlos', 'Chen', 'Chidi', 'Chloe', 'Dante', 'Darius', 'Daniela', 'Dev', 'Diego',
  'Dimitri', 'Elif', 'Elena', 'Emeka', 'Emma', 'Esi', 'Ethan', 'Fatima', 'Felix', 'Freya', 'Gabriel', 'Gia', 'Hana', 'Hamza', 'Hiro', 'Ines',
  'Isla', 'Ivan', 'Jada', 'Jamal', 'Javier', 'Jess', 'Ji-woo', 'Joao', 'Jonah', 'Kai', 'Kalani', 'Kemal', 'Kenji', 'Keisha', 'Kofi', 'Lars',
  'Layla', 'Leilani', 'Leo', 'Lina', 'Luca', 'Lucia', 'Luis', 'Maya', 'Malik', 'Marcus', 'Mariana', 'Mateo', 'Mei', 'Mia', 'Mohammed', 'Nadia',
  'Naomi', 'Nikhil', 'Nina', 'Noah', 'Nour', 'Oisin', 'Olu', 'Omar', 'Paloma', 'Pedro', 'Priya', 'Quinn', 'Rafael', 'Rania', 'Ravi', 'Rhys',
  'Rosa', 'Ryo', 'Sade', 'Sakura', 'Sam', 'Santiago', 'Sasha', 'Sebastian', 'Selin', 'Shreya', 'Sofia', 'Soren', 'Tariq', 'Tavita', 'Thandiwe', 'Theo',
  'Tomas', 'Valentina', 'Vik', 'Wren', 'Xavier', 'Yara', 'Yusuf', 'Zainab', 'Zara', 'Zion', 'Ezra', 'Ingrid', 'Kwame', 'Lupe', 'Mateus', 'Oksana'
];
const LAST_INITIAL = 'ABCDEFGHIJKLMNOPRSTVWYZ';
const TOWNS = [
  'Berlin', 'Detroit', 'Chicago', 'London', 'Manchester', 'Glasgow', 'Dublin', 'Amsterdam', 'Rotterdam', 'Antwerp', 'Paris', 'Lyon', 'Barcelona', 'Madrid',
  'Lisbon', 'Ibiza', 'Milan', 'Naples', 'Athens', 'Istanbul', 'Tbilisi', 'Kyiv', 'Warsaw', 'Prague', 'Budapest', 'Copenhagen', 'Stockholm', 'Oslo',
  'Reykjavik', 'Lagos', 'Accra', 'Johannesburg', 'Cape Town', 'Nairobi', 'Cairo', 'Dubai', 'Mumbai', 'Bangalore', 'Delhi', 'Seoul', 'Tokyo', 'Osaka',
  'Shanghai', 'Taipei', 'Manila', 'Bangkok', 'Bali', 'Sydney', 'Melbourne', 'Auckland', 'Honolulu', 'Los Angeles', 'San Francisco', 'Las Vegas',
  'Tucson', 'Denver', 'Austin', 'Houston', 'Miami', 'Atlanta', 'Nashville', 'New York', 'Brooklyn', 'Toronto', 'Montreal', 'Vancouver', 'Mexico City',
  'Guadalajara', 'Bogotá', 'Medellín', 'Lima', 'Santiago', 'Buenos Aires', 'São Paulo', 'Rio de Janeiro', 'Havana', 'San Juan', 'Kingston'
];

// Archetypes: trait biases, music taste biases, dance move weights, prop odds
export const ARCHETYPES = {
  superfan: { label: 'Superfan', w: 8, traits: { extra: 0.85, rhythm: 0.6, stamina: 0.8, hype: 0.95, phone: 0.5, chill: 0.1, rowdy: 0.6 }, taste: { 'Pop/EDM': 1, House: 0.6, Trance: 0.5 }, moves: { jump: 3, handsup: 3, fistpump: 3, singalong: 2, bounce: 2 }, props: { phone: 0.4, glowstick: 0.3, flag: 0.1 } },
  veteran: { label: 'Raver Veteran', w: 6, traits: { extra: 0.6, rhythm: 0.9, stamina: 0.9, hype: 0.5, phone: 0.05, chill: 0.6, rowdy: 0.3 }, taste: { Techno: 1, House: 0.9, Trance: 0.6, 'Drum & Bass': 0.5 }, moves: { housejack: 3, twostep: 3, bounce: 2, handsup: 1 }, props: { glowstick: 0.15 } },
  firsttimer: { label: 'First-Timer', w: 6, traits: { extra: 0.5, rhythm: 0.35, stamina: 0.6, hype: 0.85, phone: 0.7, chill: 0.2, rowdy: 0.2 }, taste: { 'Pop/EDM': 1, 'Hip-Hop/Trap': 0.6 }, moves: { bounce: 4, sway: 2, clap: 2, phone: 2 }, props: { phone: 0.6 } },
  purist: { label: 'Techno Purist', w: 6, traits: { extra: 0.2, rhythm: 0.85, stamina: 0.95, hype: 0.3, phone: 0.0, chill: 0.8, rowdy: 0.15 }, taste: { Techno: 1, 'Tech House': 0.5 }, moves: { housejack: 3, stomp: 1, headbang: 1, sway: 2 }, props: {} },
  squad: { label: 'Festival Bestie Squad', w: 8, traits: { extra: 0.9, rhythm: 0.55, stamina: 0.7, hype: 0.9, phone: 0.6, chill: 0.2, rowdy: 0.5 }, taste: { 'Pop/EDM': 1, House: 0.7, 'Disco/Funk': 0.5 }, moves: { jump: 2, handsup: 2, singalong: 3, couple: 1, bounce: 2 }, props: { phone: 0.4, glowstick: 0.3 } },
  couple: { label: 'Couple on a Date', w: 5, traits: { extra: 0.5, rhythm: 0.6, stamina: 0.6, hype: 0.6, phone: 0.3, chill: 0.5, rowdy: 0.1 }, taste: { House: 1, 'Disco/Funk': 0.8, 'Pop/EDM': 0.6 }, moves: { couple: 4, sway: 2, twostep: 2 }, props: { cup: 0.4 } },
  birthday: { label: 'Birthday Crew', w: 4, traits: { extra: 0.9, rhythm: 0.45, stamina: 0.6, hype: 0.9, phone: 0.6, chill: 0.2, rowdy: 0.6 }, taste: { 'Pop/EDM': 1, 'Hip-Hop/Trap': 0.7, House: 0.5 }, moves: { jump: 2, singalong: 2, fistpump: 2, bounce: 2 }, props: { cup: 0.5, hat: 0.4 } },
  bachelorette: { label: 'Bachelorette Party', w: 3, traits: { extra: 0.95, rhythm: 0.5, stamina: 0.55, hype: 0.95, phone: 0.8, chill: 0.1, rowdy: 0.5 }, taste: { 'Pop/EDM': 1, 'Disco/Funk': 0.8 }, moves: { singalong: 3, disco: 2, jump: 2, couple: 1 }, props: { phone: 0.5, cup: 0.4, hat: 0.5 } },
  tourist: { label: 'Tourist', w: 4, traits: { extra: 0.6, rhythm: 0.4, stamina: 0.5, hype: 0.7, phone: 0.8, chill: 0.4, rowdy: 0.2 }, taste: { 'Pop/EDM': 1, House: 0.6 }, moves: { bounce: 3, phone: 3, sway: 2 }, props: { phone: 0.7, hat: 0.3 } },
  insider: { label: 'Industry Insider', w: 3, traits: { extra: 0.4, rhythm: 0.7, stamina: 0.5, hype: 0.25, phone: 0.5, chill: 0.9, rowdy: 0.1 }, taste: { 'Tech House': 1, House: 0.8, Techno: 0.6 }, moves: { sway: 3, twostep: 2, chat: 2 }, props: { cup: 0.6 } },
  battler: { label: 'Dance-Battle Royalty', w: 3, traits: { extra: 0.9, rhythm: 1.0, stamina: 0.9, hype: 0.7, phone: 0.1, chill: 0.3, rowdy: 0.4 }, taste: { 'Hip-Hop/Trap': 1, House: 0.9, 'Disco/Funk': 0.8 }, moves: { shuffle: 3, hiphop: 3, disco: 2, twostep: 2 }, props: {} },
  shuffler: { label: 'Shuffler', w: 4, traits: { extra: 0.7, rhythm: 0.9, stamina: 0.85, hype: 0.7, phone: 0.2, chill: 0.3, rowdy: 0.3 }, taste: { House: 1, Hardstyle: 0.8, 'Pop/EDM': 0.6 }, moves: { shuffle: 5, stomp: 2, bounce: 1 }, props: { glowstick: 0.2 } },
  headbanger: { label: 'Headbanger', w: 4, traits: { extra: 0.6, rhythm: 0.6, stamina: 0.85, hype: 0.8, phone: 0.05, chill: 0.1, rowdy: 0.9 }, taste: { Dubstep: 1, 'Drum & Bass': 0.8, Hardstyle: 0.7, Techno: 0.5 }, moves: { headbang: 4, halftime: 3, pogo: 2, skank: 2 }, props: {} },
  wallflower: { label: 'Wallflower', w: 4, traits: { extra: 0.1, rhythm: 0.4, stamina: 0.5, hype: 0.3, phone: 0.5, chill: 0.8, rowdy: 0.05 }, taste: { Ambient: 1, House: 0.6, Trance: 0.5 }, moves: { sway: 4, bounce: 2, chat: 1 }, props: { cup: 0.5 } },
  filmer: { label: 'Phone Filmer', w: 3, traits: { extra: 0.5, rhythm: 0.3, stamina: 0.5, hype: 0.6, phone: 1.0, chill: 0.4, rowdy: 0.1 }, taste: { 'Pop/EDM': 1, House: 0.5 }, moves: { phone: 6, bounce: 2 }, props: { phone: 1.0 } },
  influencer: { label: 'Influencer', w: 2, traits: { extra: 0.9, rhythm: 0.5, stamina: 0.5, hype: 0.7, phone: 0.95, chill: 0.3, rowdy: 0.2 }, taste: { 'Pop/EDM': 1, 'Tech House': 0.6 }, moves: { phone: 4, singalong: 2, sway: 2 }, props: { phone: 1.0, hat: 0.3 } },
  offdutydj: { label: 'Off-Duty DJ', w: 3, traits: { extra: 0.4, rhythm: 0.95, stamina: 0.7, hype: 0.4, phone: 0.2, chill: 0.7, rowdy: 0.2 }, taste: { House: 1, Techno: 0.9, 'Tech House': 0.9, 'Disco/Funk': 0.6 }, moves: { housejack: 3, twostep: 2, sway: 2 }, props: { cup: 0.3, hat: 0.3 } },
  bartender: { label: 'Bartender on Break', w: 1, traits: { extra: 0.7, rhythm: 0.6, stamina: 0.4, hype: 0.6, phone: 0.3, chill: 0.6, rowdy: 0.2 }, taste: { House: 1, 'Disco/Funk': 0.7 }, moves: { bounce: 3, twostep: 2 }, props: {} },
  sober: { label: 'Sober Raver', w: 3, traits: { extra: 0.6, rhythm: 0.75, stamina: 0.95, hype: 0.7, phone: 0.1, chill: 0.6, rowdy: 0.2 }, taste: { Trance: 1, House: 0.8, 'Drum & Bass': 0.6 }, moves: { trance: 3, handsup: 2, bounce: 2, glow: 2 }, props: { glowstick: 0.5 } },
  coolparent: { label: 'Older Cool Parent', w: 2, traits: { extra: 0.6, rhythm: 0.7, stamina: 0.45, hype: 0.6, phone: 0.3, chill: 0.6, rowdy: 0.1 }, taste: { 'Disco/Funk': 1, House: 0.9, Trance: 0.6 }, moves: { disco: 3, twostep: 3, clap: 2, sway: 1 }, props: { cup: 0.3 } },
  gymbro: { label: 'Gym Bro', w: 3, traits: { extra: 0.8, rhythm: 0.35, stamina: 0.8, hype: 0.85, phone: 0.4, chill: 0.1, rowdy: 0.8 }, taste: { 'Pop/EDM': 1, Hardstyle: 0.8, Dubstep: 0.7 }, moves: { fistpump: 5, jump: 2, pogo: 2 }, props: { cup: 0.3 } },
  goth: { label: 'Goth / Industrial', w: 2, traits: { extra: 0.3, rhythm: 0.7, stamina: 0.8, hype: 0.4, phone: 0.05, chill: 0.6, rowdy: 0.5 }, taste: { Techno: 1, Dubstep: 0.6, Ambient: 0.5 }, moves: { stomp: 2, headbang: 2, sway: 2, housejack: 1 }, props: {} },
  kpopstan: { label: 'K-Pop Stan (Got Dragged Along)', w: 2, traits: { extra: 0.6, rhythm: 0.85, stamina: 0.7, hype: 0.6, phone: 0.8, chill: 0.3, rowdy: 0.1 }, taste: { 'Pop/EDM': 1, 'Hip-Hop/Trap': 0.6 }, moves: { hiphop: 2, disco: 2, phone: 2, clap: 2 }, props: { phone: 0.6, glowstick: 0.5 } },
  crewdancer: { label: 'Dancer from a Crew', w: 2, traits: { extra: 0.8, rhythm: 1.0, stamina: 0.95, hype: 0.6, phone: 0.1, chill: 0.3, rowdy: 0.3 }, taste: { 'Hip-Hop/Trap': 1, House: 0.9, 'Drum & Bass': 0.5 }, moves: { hiphop: 3, shuffle: 2, housejack: 2, twostep: 2 }, props: {} }
};

const BACKSTORY = {
  superfan: ['Has seen this DJ {n} times across {c} countries.', 'Has the DJ\'s logo tattooed on {pos} forearm.', 'Camped outside since 9am to get on the barrier.'],
  veteran: ['Has been raving since the warehouse days in {town}.', 'Still has {pos} first glowstick from 1997 in a drawer.', 'Knows every bouncer at every club in {town} by name.'],
  firsttimer: ['Never been to a show like this. Roommate dragged {obj} here.', 'Bought the ticket on a whim after a terrible week.', 'Learned what a "drop" is on the way here.'],
  purist: ['Only dances to 130+ BPM. Anything slower is "warm-up music".', 'Owns more vinyl than furniture.', 'Will leave if the DJ plays a vocal track. Probably.'],
  squad: ['Six best friends who have done every festival together since uni.', 'Matching outfits planned in a group chat for three months.', 'Promised to stay together all night. Statistically unlikely.'],
  couple: ['Third date. This was {pos} idea, and it is going very well.', 'Married 12 years. Met at a rave exactly like this one.', 'Long-distance couple, finally in the same city for one weekend.'],
  birthday: ['Turning {age} tonight and refusing to act like it.', 'The birthday girl\'s crown has already been lost twice.', 'Organised the whole night as a surprise.'],
  bachelorette: ['Getting married on Saturday. Tonight is the last hurrah.', 'Maid of honour with a 14-point schedule. They are on point 3.'],
  tourist: ['Flew in from {town} for a week and found this on a flyer.', 'Doesn\'t know any of the songs. Having the time of {pos} life anyway.'],
  insider: ['Manages two DJs on the lineup. Pretending not to work.', 'Runs a record label. Taking mental notes on every track.'],
  battler: ['Undefeated in the {town} cypher three years running.', 'Came to find a dance circle and will not leave until {sub} does.'],
  shuffler: ['300k followers for shuffle videos. Brought knee pads.', 'Practised the running man every lunch break for a year.'],
  headbanger: ['Neck will hurt for three days. Worth it.', 'Came for the heaviest drop of the night.'],
  wallflower: ['Usually stands at the back. Tonight might be different.', 'Introvert who loves music more than people. Mostly.'],
  filmer: ['Has filmed 47 minutes of the set so far. Battery at 12%.', 'Recording everything for a friend who couldn\'t make it.'],
  influencer: ['Here for "content". Secretly loving the music.', 'Sponsored outfit. Unsponsored dance moves.'],
  offdutydj: ['Played a set across town earlier. Here to hear a hero play.', 'Trainspotting every transition. Very impressed.'],
  bartender: ['Fifteen-minute break. Spending it on the dancefloor.', 'Has served 400 drinks tonight. Earned this.'],
  sober: ['Four years sober. The music is the whole point.', 'Brought electrolytes for the entire friend group.'],
  coolparent: ['Raved in the 90s. Now raves with {pos} grown-up kids.', 'Took the night off from being responsible.'],
  gymbro: ['Leg day was yesterday. Jumping anyway.', 'Came for the bass. Stayed for the bass.'],
  goth: ['Wearing black on the hottest night of the year. On purpose.', 'Prefers industrial, tolerates techno, secretly loves trance.'],
  kpopstan: ['Was promised there would be K-pop. There is not.', 'Treating this like a concert: lightstick fully charged.'],
  crewdancer: ['Dance crew is rehearsing for nationals. Tonight is "research".', 'Can\'t stop choreographing in {pos} head.']
};

const GOALS = [
  { id: 'barrier', text: 'Get to the barrier before the headliner\'s biggest drop.' },
  { id: 'friend', text: 'Find {friend}, who disappeared near the bar an hour ago.' },
  { id: 'propose', text: 'Propose to {friend} when "their song" plays. The ring is in a sock.' },
  { id: 'circle', text: 'Win a dance circle. Any dance circle.' },
  { id: 'forget', text: 'Dance until the bad week is completely forgotten.' },
  { id: 'content', text: 'Get one perfect clip of the lasers on the drop.' },
  { id: 'newfriend', text: 'Make at least one new friend before closing.' },
  { id: 'lastsong', text: 'Stay until the very last song. No matter what.' },
  { id: 'shoulders', text: 'Get on someone\'s shoulders for a drop.' },
  { id: 'surf', text: 'Crowd surf for the first time.' },
  { id: 'song', text: 'Hear "{song}" played live.' },
  { id: 'dj', text: 'Make eye contact with the DJ.' }
];

const HAIR_STYLES = ['buzz', 'short', 'long', 'ponytail', 'afro', 'bun', 'braids', 'mohawk', 'bald', 'bob', 'curly'];
const SKIN = ['#3b2219', '#4a2c1e', '#5c3a24', '#6e4429', '#83532f', '#9a6439', '#ad7a4d', '#c18c5d', '#d3a273', '#e0b48a', '#ecc4a0', '#f3d2b5', '#f8dfc8', '#a56b45', '#7a4a2c', '#c79a7a'];
const HAIR_NATURAL = ['#0e0b09', '#1d140f', '#2e1d13', '#4a2f1c', '#6b4325', '#8d5b2f', '#b07b3e', '#d0a35c', '#e7c785', '#9a9a9a', '#e8e8e8', '#7a2e17'];
const HAIR_DYED = ['#ff3fd8', '#2ee6ff', '#7cff4f', '#a46bff', '#ff5a5a', '#ffd23f', '#5a7bff', '#ff8fbf'];
const OUTFITS = {
  neutral: ['#111111', '#1c1c22', '#2a2a2f', '#e6e6e6', '#3a3f4a', '#5b5b66', '#f5f0e6', '#222b3a'],
  festival: ['#ff2bd6', '#00f0ff', '#b6ff00', '#ff8a00', '#ffe600', '#8a2bff', '#ff3b3b', '#00ff9c', '#ff7ac8', '#38bdf8'],
  techno: ['#0a0a0a', '#111111', '#161616', '#1f1f1f', '#2b2b2b'],
  casual: ['#2f4b7c', '#665191', '#a05195', '#d45087', '#f95d6a', '#ff7c43', '#ffa600', '#3d9970', '#4e79a7', '#59a14f', '#e15759', '#b07aa1', '#9c755f', '#bab0ac']
};
const PANTS = ['#0d0d10', '#1b2233', '#26324d', '#3b3b3b', '#5a4632', '#6d6d6d', '#20262e', '#c8b89a', '#0f1f3a', '#444b55'];

export function generatePersonas(count, seed = 1234) {
  const rng = makeRng(seed);
  const archetypeWeights = {};
  for (const k in ARCHETYPES) archetypeWeights[k] = ARCHETYPES[k].w;
  const people = [];
  let i = 0;
  let groupId = 0;
  while (i < count) {
    const arch = rng.weighted(archetypeWeights);
    // group sizes depend on archetype
    let size = 1;
    if (arch === 'squad') size = rng.int(4, 7);
    else if (arch === 'couple') size = 2;
    else if (arch === 'birthday' || arch === 'bachelorette') size = rng.int(4, 8);
    else if (arch === 'wallflower' || arch === 'purist') size = rng.chance(0.5) ? 1 : 2;
    else size = rng.chance(0.25) ? 1 : rng.int(2, 4);
    size = Math.min(size, count - i);
    const members = [];
    for (let j = 0; j < size; j++, i++) {
      // mixed groups: mostly share archetype, with occasional mix
      const a = j === 0 || rng.chance(0.7) ? arch : rng.weighted(archetypeWeights);
      const p = makePerson(i, a, rng, groupId);
      members.push(p);
      people.push(p);
    }
    for (const p of members) p.friends = members.filter((m) => m !== p).map((m) => m.id);
    // couples: mark partner
    if (arch === 'couple' && members.length === 2) { members[0].partner = members[1].id; members[1].partner = members[0].id; }
    groupId++;
  }
  // backstories/goals reference friends and songs
  for (const p of people) finalizeStory(p, people, rng);
  return people;
}

function makePerson(id, arch, rng, groupId) {
  const A = ARCHETYPES[arch];
  const t = {};
  for (const k in A.traits) t[k] = Math.max(0, Math.min(1, A.traits[k] + rng.gauss() * 0.15));
  const name = `${rng.pick(FIRST)} ${LAST_INITIAL[rng.int(0, LAST_INITIAL.length - 1)]}.`;
  const age = arch === 'coolparent' ? rng.int(42, 64) : Math.max(18, Math.min(60, Math.round(21 + Math.abs(rng.gauss()) * 8 + (arch === 'veteran' ? 12 : 0))));
  const taste = {};
  for (const g of GENRES) taste[g] = 0.15 + rng() * 0.35;
  for (const g in A.taste) taste[g] = Math.min(1, A.taste[g] * (0.7 + rng() * 0.4));
  const fem = rng.chance(0.5);
  const height = (fem ? 1.64 : 1.77) + rng.gauss() * 0.07;
  const build = rng.weighted({ slim: 3, average: 5, broad: 2, heavy: 1.5 });
  const dyed = rng.chance(arch === 'squad' || arch === 'kpopstan' || arch === 'shuffler' ? 0.45 : 0.12);
  let hairStyle = rng.pick(HAIR_STYLES);
  if (fem && rng.chance(0.5)) hairStyle = rng.pick(['long', 'ponytail', 'bun', 'braids', 'bob', 'curly', 'afro']);
  if (!fem && rng.chance(0.5)) hairStyle = rng.pick(['buzz', 'short', 'bald', 'afro', 'mohawk', 'curly']);
  const palette = arch === 'purist' || arch === 'goth' ? OUTFITS.techno : arch === 'squad' || arch === 'shuffler' || arch === 'sober' || arch === 'kpopstan' ? (rng.chance(0.7) ? OUTFITS.festival : OUTFITS.casual) : rng.chance(0.35) ? OUTFITS.neutral : rng.chance(0.5) ? OUTFITS.casual : OUTFITS.festival;
  const props = { phone: false, glowstick: false, cup: false, hat: false, flag: false };
  for (const k in A.props) if (rng.chance(A.props[k])) props[k] = true;
  if (!props.phone && rng.chance(t.phone * 0.4)) props.phone = true;
  const moveWeights = { ...A.moves };
  // everyone can do the basics
  moveWeights.bounce = (moveWeights.bounce || 0) + 1;
  moveWeights.sway = (moveWeights.sway || 0) + 0.5;
  return {
    id, name, age, fem, arch, archLabel: A.label, groupId,
    hometown: rng.pick(TOWNS),
    traits: t, taste, moveWeights,
    look: {
      height, build, skin: rng.pick(SKIN), hairStyle,
      hair: dyed ? rng.pick(HAIR_DYED) : rng.pick(HAIR_NATURAL),
      top: rng.pick(palette), sleeves: rng.chance(0.55), pants: rng.chance(0.15) ? rng.pick(palette) : rng.pick(PANTS),
      shorts: rng.chance(0.25), hatColor: rng.pick(['#111111', '#e8e8e8', '#c0392b', '#2c3e50', '#d4a017', '#ff2bd6']),
      glowColor: rng.pick(['#00ffea', '#ff00d4', '#7cff00', '#ffe100', '#ff4d00', '#5a7bff'])
    },
    props,
    rhythmOffset: rng.gauss() * (1 - t.rhythm) * 0.09, // seconds off-beat
    amp: 0.6 + rng() * 0.6,
    flair: rng(),
    friends: [], partner: null, theirSongs: [], goal: null, backstory: '',
    // live state
    energy: 0.5 + rng() * 0.3, stamina: 0.8 + rng() * 0.2, mood: 0.55 + rng() * 0.2, hydration: 0.8,
    log: []
  };
}

function finalizeStory(p, people, rng) {
  const A = p.arch;
  const tmpl = BACKSTORY[A] || BACKSTORY.firsttimer;
  const pos = p.fem ? 'her' : 'his', obj = p.fem ? 'her' : 'him', sub = p.fem ? 'she' : 'he';
  // their songs: favour anthems matching their taste
  const scored = ANTHEMS.map((s) => ({ s, v: (p.taste[canonGenreLocal(s.genre)] || 0.2) + rng() * 0.8 })).sort((a, b) => b.v - a.v);
  const nSongs = 1 + (rng.chance(0.5) ? 1 : 0) + (p.arch === 'superfan' ? 1 : 0);
  p.theirSongs = scored.slice(0, nSongs).map((x) => x.s.key);
  const song = scored[0].s;
  const friend = p.friends.length ? people[p.friends[0]].name.split(' ')[0] : rng.pick(FIRST);
  const fill = (s) => s.replace('{n}', rng.int(5, 41)).replace('{c}', rng.int(3, 14)).replace('{town}', p.hometown).replace(/\{pos\}/g, pos)
    .replace('{obj}', obj).replace('{sub}', sub).replace('{age}', p.age).replace('{friend}', friend).replace('{song}', song.title);
  const line1 = fill(rng.pick(tmpl));
  const travel = rng.chance(0.5) ? ` Travelled from ${p.hometown}.` : '';
  p.backstory = line1 + travel;
  let g = rng.pick(GOALS);
  if (g.id === 'propose' && !p.partner) g = GOALS[0];
  if (p.arch === 'filmer' || p.arch === 'influencer') g = GOALS[5];
  if (p.arch === 'battler' || p.arch === 'crewdancer') g = GOALS[3];
  p.goal = { id: g.id, text: fill(g.text), done: false };
  p.favoriteSongTitle = song.title;
}
const canonGenreLocal = (g) => GENRE_MAP[g] || (GENRES.includes(g) ? g : 'Pop/EDM');

// Story event templates
const EV = {
  arrive: ['Walked in, saw the lasers, said "oh wow" out loud.', 'Arrived and found a spot with a good view of the decks.', 'Squeezed through the crowd to join the group.'],
  drop: ['Lost it completely on the drop.', 'Screamed so loud on the drop that {friend} turned around.', 'Jumped higher than {sub} thought possible on the drop.', 'Threw both hands up on the drop and felt the bass in {pos} chest.', 'Hugged {friend} as the drop hit.'],
  theirsong: ['Heard "{song}" and SCREAMED. It\'s {pos} song!', 'Grabbed {friend}\'s arm: "THIS IS MY SONG!"', 'Teared up at the first notes of "{song}".', 'Started filming the moment "{song}" kicked in.'],
  anthem: ['Recognised "{song}" and joined the whole crowd singing.', 'Turned to {friend}: "No way, {song}!"', 'Pointed at the DJ when "{song}" came in.'],
  unknownanthem: ['Didn\'t know "{song}" but the crowd\'s reaction was contagious.'],
  buildup: ['Crouched down with everyone, waiting for the drop.', 'Felt the build-up in {pos} stomach. Here it comes…', 'Held {pos} breath through the snare roll.'],
  breakdown: ['Phone torch up for the breakdown. The whole room glowed.', 'Closed {pos} eyes and swayed through the breakdown.', 'Used the breakdown to catch {pos} breath.'],
  tired: ['Legs giving up. Taking a breather at the edge.', 'Went to get water. Hydration is important.', 'Sat down for a moment. Not done yet though.'],
  secondwind: ['Second wind! Back on the floor.', 'Water helped. Fully recharged.'],
  bar: ['Headed to the bar.', 'Back from the bar with drinks for everyone.'],
  shoulders: ['Climbed onto {friend}\'s shoulders for the drop!', 'Up on {friend}\'s shoulders, waving at the DJ.'],
  carry: ['Lifted {friend} onto {pos} shoulders.'],
  surf: ['Crowd surfing toward the stage!', 'Made it all the way to the barrier on a crowd surf.'],
  mosh: ['Jumped into the mosh pit.', 'Opened up the pit with a running start.'],
  film: ['Filmed the lasers on the drop. It looks incredible.', 'Started a live-stream for followers.'],
  circle: ['A dance circle opened up and {sub} went in. Crowd went wild.', 'Got into a dance battle. Did not lose.'],
  newfriend: ['Made a new friend: {other} from {town2}.', 'Swapped Instagrams with a stranger after a great drop.'],
  lost: ['Lost {friend} in the crowd…', 'Where is {friend}?? Last seen near the sound desk.'],
  found: ['Found {friend}! Huge hug.', 'Reunited with the group just in time.'],
  propose: ['PROPOSED to {friend} during "{song}"! {friend} said YES!'],
  djeye: ['The DJ pointed at {obj}. Best moment of {pos} life.'],
  genrelove: ['Loving this {genre}. Exactly {pos} thing.', 'This {genre} section is incredible.'],
  genremeh: ['Not really feeling the {genre}. Chatting with {friend} instead.', 'Waiting for the DJ to switch it up from {genre}.'],
  barrier: ['Made it all the way to the barrier! Front row.', 'Squeezed through to the barrier. Worth every elbow.'],
  leave: ['Heading home. What a night.', 'Left to catch the last train, still humming the drop.']
};

export function storyLine(type, p, people, ctx = {}, rng = Math.random) {
  const list = EV[type];
  if (!list) return null;
  const pick = list[Math.floor(rng() * list.length)];
  const friendP = ctx.friendId != null ? people[ctx.friendId] : p.friends.length ? people[p.friends[Math.floor(rng() * p.friends.length)]] : null;
  const friend = friendP ? friendP.name.split(' ')[0] : 'a stranger';
  const pos = p.fem ? 'her' : 'his', obj = p.fem ? 'her' : 'him', sub = p.fem ? 'she' : 'he';
  return pick.replace(/\{friend\}/g, friend).replace(/\{pos\}/g, pos).replace(/\{obj\}/g, obj).replace(/\{sub\}/g, sub)
    .replace(/\{song\}/g, ctx.song || 'this track').replace(/\{genre\}/g, ctx.genre || 'music')
    .replace('{other}', ctx.other || FIRST[Math.floor(rng() * FIRST.length)]).replace('{town2}', TOWNS[Math.floor(rng() * TOWNS.length)]);
}
