// Anthem library: metadata only (title, artist, genre, crowd reaction signature).
// Reaction signatures: singalong, handsup, jump, phonelights, mosh, couple, chant, crouchjump, skank
import { normalizeTitle } from './util.js';

export const ANTHEMS = [
  ['Levels', 'Avicii', 'Progressive House', 'handsup'],
  ['Wake Me Up', 'Avicii', 'Progressive House', 'singalong'],
  ['Hey Brother', 'Avicii', 'Progressive House', 'singalong'],
  ['Titanium', 'David Guetta ft. Sia', 'Pop/EDM', 'singalong'],
  ['Animals', 'Martin Garrix', 'Big Room', 'jump'],
  ["Don't You Worry Child", 'Swedish House Mafia', 'Progressive House', 'singalong'],
  ['One', 'Swedish House Mafia', 'Progressive House', 'handsup'],
  ['Greyhound', 'Swedish House Mafia', 'Progressive House', 'jump'],
  ['Clarity', 'Zedd ft. Foxes', 'Pop/EDM', 'singalong'],
  ['Bangarang', 'Skrillex', 'Dubstep', 'mosh'],
  ['Scary Monsters and Nice Sprites', 'Skrillex', 'Dubstep', 'mosh'],
  ['Rumble', 'Skrillex, Fred again.. & Flowdan', 'Dubstep', 'mosh'],
  ['Turn Down for What', 'DJ Snake & Lil Jon', 'Trap', 'jump'],
  ['Lean On', 'Major Lazer & DJ Snake', 'Pop/EDM', 'couple'],
  ['Strobe', 'deadmau5', 'Progressive House', 'phonelights'],
  ['Ghosts n Stuff', 'deadmau5', 'Electro House', 'jump'],
  ['I Remember', 'deadmau5 & Kaskade', 'Progressive House', 'phonelights'],
  ['Sandstorm', 'Darude', 'Trance', 'jump'],
  ['Insomnia', 'Faithless', 'Trance', 'handsup'],
  ['Children', 'Robert Miles', 'Trance', 'phonelights'],
  ['Adagio for Strings', 'Tiësto', 'Trance', 'handsup'],
  ['For an Angel', 'Paul van Dyk', 'Trance', 'handsup'],
  ['Silence', 'Delerium ft. Sarah McLachlan', 'Trance', 'phonelights'],
  ['Opus', 'Eric Prydz', 'Progressive House', 'handsup'],
  ['Pjanoo', 'Eric Prydz', 'House', 'handsup'],
  ['Call on Me', 'Eric Prydz', 'House', 'jump'],
  ['Show Me Love', 'Robin S', 'House', 'singalong'],
  ["Gypsy Woman (She's Homeless)", 'Crystal Waters', 'House', 'singalong'],
  ['Finally', 'CeCe Peniston', 'House', 'singalong'],
  ['Music Sounds Better With You', 'Stardust', 'Disco/Funk', 'couple'],
  ['One More Time', 'Daft Punk', 'House', 'singalong'],
  ['Around the World', 'Daft Punk', 'House', 'chant'],
  ['Get Lucky', 'Daft Punk ft. Pharrell Williams', 'Disco/Funk', 'couple'],
  ['Blue (Da Ba Dee)', 'Eiffel 65', 'Pop/EDM', 'singalong'],
  ['Rhythm Is a Dancer', 'Snap!', 'Pop/EDM', 'singalong'],
  ['You Got the Love', 'Candi Staton', 'House', 'singalong'],
  ['Losing It', 'Fisher', 'Tech House', 'jump'],
  ['Cola', 'CamelPhat & Elderbrook', 'Tech House', 'singalong'],
  ['Latch', 'Disclosure ft. Sam Smith', 'House', 'singalong'],
  ['Rather Be', 'Clean Bandit ft. Jess Glynne', 'Pop/EDM', 'singalong'],
  ['Where Are Ü Now', 'Jack Ü ft. Justin Bieber', 'Pop/EDM', 'singalong'],
  ['Baianá', 'Bakermat', 'House', 'couple'],
  ['Midnight City', 'M83', 'Pop/EDM', 'singalong'],
  ['Strings of Life', 'Derrick May', 'Techno', 'handsup'],
  ['Energy Flash', 'Joey Beltram', 'Techno', 'jump'],
  ['Spastik', 'Plastikman', 'Techno', 'jump'],
  ['Born Slippy NUXX', 'Underworld', 'Techno', 'chant'],
  ['Firestarter', 'The Prodigy', 'Breakbeat', 'mosh'],
  ['Breathe', 'The Prodigy', 'Breakbeat', 'mosh'],
  ['Satisfaction', 'Benny Benassi', 'Electro House', 'jump'],
  ['Freed from Desire', 'Gala', 'Pop/EDM', 'chant'],
  ['Mr. Brightside', 'The Killers', 'Pop/EDM', 'singalong'],
  ['Sweet Disposition', 'The Temper Trap', 'Pop/EDM', 'singalong'],
  ['Tremor', 'Dimitri Vegas & Like Mike, Martin Garrix', 'Big Room', 'crouchjump'],
  ['Tsunami', 'DVBBS & Borgeous', 'Big Room', 'crouchjump'],
  ['Epic', 'Sandro Silva & Quintino', 'Big Room', 'crouchjump'],
  ['Rattle', 'Bingo Players', 'Big Room', 'jump'],
  ['In My Mind', 'Ivan Gough & Feenixpawl', 'Progressive House', 'singalong'],
  ['Faded', 'Alan Walker', 'Pop/EDM', 'phonelights'],
  ['Bonkers', 'Dizzee Rascal & Armand Van Helden', 'Electro House', 'jump'],
  ['Gecko (Overdrive)', 'Oliver Heldens', 'House', 'jump'],
  ['Ferrari', 'James Hype & Miggy Dela Rosa', 'Tech House', 'jump'],
  ['Marea (We’ve Lost Dancing)', 'Fred again.. & The Blessed Madonna', 'House', 'singalong'],
  ['Delilah (pull me out of this)', 'Fred again..', 'House', 'phonelights'],
  ['Baddadan', 'Chase & Status', 'Drum & Bass', 'skank'],
  ['Tarantula', 'Pendulum', 'Drum & Bass', 'mosh'],
  ['Witchcraft', 'Pendulum', 'Drum & Bass', 'mosh'],
  ['Gold Dust', 'DJ Fresh', 'Drum & Bass', 'skank'],
  ['Feel the Love', 'Rudimental ft. John Newman', 'Drum & Bass', 'singalong'],
  ['Ocean Drive', 'Duke Dumont', 'House', 'singalong'],
  ['Kernkraft 400', 'Zombie Nation', 'Techno', 'chant'],
  ['Jump Around', 'House of Pain', 'Hip-Hop/Trap', 'jump'],
  ['Rasputin', 'Boney M.', 'Disco/Funk', 'chant'],
  ['Higher Ground', 'ODESZA ft. Naomi Wild', 'Pop/EDM', 'phonelights'],
  ['Heroes (we could be)', 'Alesso ft. Tove Lo', 'Progressive House', 'singalong'],
  ['Calabria 2007', 'Enur ft. Natasja', 'House', 'jump'],
  ['Pump It Up', 'Danzel', 'Pop/EDM', 'jump'],
  ['Show Me', 'Kid Ink', 'Hip-Hop/Trap', 'couple']
].map(([title, artist, genre, reaction]) => ({ title, artist, genre, reaction, key: normalizeTitle(title) }));

export const REACTION_LABELS = {
  singalong: 'Sing-along', handsup: 'Hands up', jump: 'Jump', phonelights: 'Phone lights', mosh: 'Mosh pit',
  couple: 'Couples dance', chant: 'Chant', crouchjump: 'Crouch & jump', skank: 'Skank'
};

// Fuzzy matching: title must appear as a whole-word phrase; artist match boosts.
export function matchAnthem(title, artist = '') {
  const t = normalizeTitle(title);
  const a = normalizeTitle(artist);
  if (!t) return null;
  let best = null, bestScore = 0;
  for (const song of ANTHEMS) {
    if (!song.key) continue;
    const re = new RegExp(`(^| )${song.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`);
    let score = 0;
    if (t === song.key) score = 3;
    else if (re.test(t)) score = 1.5 + song.key.length / 40;
    if (!score) continue;
    const artistKey = normalizeTitle(song.artist).split(' ')[0];
    if (artistKey && (a.includes(artistKey) || t.includes(artistKey))) score += 2;
    // very short titles need artist confirmation
    if (song.key.length <= 4 && score < 3) continue;
    if (score > bestScore) { bestScore = score; best = song; }
  }
  return best;
}

export function searchAnthems(query, limit = 8) {
  const q = normalizeTitle(query);
  if (!q) return ANTHEMS.slice(0, limit);
  return ANTHEMS.filter((s) => s.key.includes(q) || normalizeTitle(s.artist).includes(q)).slice(0, limit);
}
