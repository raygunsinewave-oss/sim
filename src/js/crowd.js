// The crowd: instanced articulated bodies, procedural dancing, behaviour AI and per-person stories.
import * as THREE from 'three';
import { clamp, lerp, makeRng, TAU, formatClock } from './util.js';
import { storyLine, canonGenre } from './personas.js';

// ---- pose channels ----
const Y = 0, CR = 1, LX = 2, LZ = 3, TW = 4, HX = 5, HY = 6, HZ = 7, ALP = 8, ALR = 9, ALE = 10, ARP = 11, ARR = 12, ARE = 13,
  LLP = 14, LLK = 15, LRP = 16, LRK = 17, DX = 18, DZ = 19, LIE = 20, LLR = 21, LRR = 22, YAW = 23, NCH = 24;

export const MOVE_LABELS = {
  bounce: 'Bouncing', fistpump: 'Fist-pumping', handsup: 'Hands in the air', jump: 'Jumping', pogo: 'Pogoing', headbang: 'Headbanging',
  twostep: 'Two-stepping', housejack: 'Jacking', shuffle: 'Shuffling', stomp: 'Hardstyle stomping', skank: 'Skanking', halftime: 'Half-time head nod',
  trance: 'Trance hands', hiphop: 'Hip-hop bop', disco: 'Disco pointing', sway: 'Swaying', glow: 'Glowstick twirling', clap: 'Clapping',
  phone: 'Filming / phone light', singalong: 'Singing along', crouch: 'Crouching for the drop', chat: 'Chatting', rest: 'Catching breath',
  couple: 'Dancing with partner', hug: 'Hugging', walk: 'Walking', surf: 'Crowd surfing', ride: 'On someone\'s shoulders', carry: 'Carrying a friend',
  mosh: 'Moshing', drink: 'Having a drink', battle: 'Dance battling'
};

const GENRE_FIT = {
  Techno: { housejack: 2.5, stomp: 1.4, headbang: 1, bounce: 1, sway: 1.2, jump: 0.4, shuffle: 0.5, skank: 0.3, halftime: 0.2, trance: 0.4, hiphop: 0.2, disco: 0.2, couple: 0.3 },
  'Tech House': { housejack: 2.5, bounce: 1.6, twostep: 1.6, clap: 1, shuffle: 1, disco: 0.6, hiphop: 0.6 },
  House: { housejack: 2, twostep: 2, bounce: 1.5, clap: 1.2, handsup: 1, disco: 0.9, shuffle: 1.2, couple: 1.2 },
  Trance: { trance: 3, handsup: 2.2, jump: 1, bounce: 1, glow: 1.5, sway: 1 },
  Dubstep: { halftime: 3, headbang: 2.5, pogo: 1.4, jump: 0.8, housejack: 0.3, mosh: 1.2, hiphop: 0.6 },
  'Drum & Bass': { skank: 3, pogo: 1.5, jump: 1, headbang: 1.2, bounce: 1, fistpump: 1 },
  Hardstyle: { stomp: 3, shuffle: 2.2, fistpump: 2, jump: 1, pogo: 1 },
  'Hip-Hop/Trap': { hiphop: 3, bounce: 1.5, jump: 0.9, headbang: 0.6, halftime: 0.8, couple: 0.8 },
  'Pop/EDM': { jump: 2, fistpump: 2, handsup: 2, singalong: 1.5, bounce: 1.5, clap: 1.2, phone: 1.2 },
  'Disco/Funk': { disco: 3, twostep: 2, couple: 2, clap: 1.5, sway: 1, hiphop: 0.8 },
  Ambient: { sway: 3, trance: 1, chat: 1.5, phone: 1 }
};
const SECTION_FIT = {
  INTRO: { chat: 2.2, sway: 2, bounce: 1.2, drink: 1.5, jump: 0.15, pogo: 0.1, headbang: 0.3, handsup: 0.4, fistpump: 0.5 },
  GROOVE: { chat: 0.4, drink: 0.5 },
  BREAKDOWN: { sway: 2.5, phone: 3, trance: 2, handsup: 1.4, chat: 1.2, jump: 0.05, pogo: 0.05, headbang: 0.2, skank: 0.3, stomp: 0.3, glow: 2, couple: 1.8, hug: 1.2 },
  BUILDUP: { clap: 3, handsup: 1.8, fistpump: 2.2, jump: 0.3, pogo: 0.3, chat: 0.05, sway: 0.4, crouch: 0.5 },
  DROP: { jump: 3, fistpump: 2, handsup: 2, headbang: 2, pogo: 2, skank: 1.6, stomp: 1.6, chat: 0.03, sway: 0.15, drink: 0.05, phone: 0.5 },
  OUTRO: { sway: 1.8, chat: 1.6, hug: 1.4, bounce: 1.2, drink: 1.2, jump: 0.3 }
};
const DANCE_MOVES = ['bounce', 'fistpump', 'handsup', 'jump', 'pogo', 'headbang', 'twostep', 'housejack', 'shuffle', 'stomp', 'skank', 'halftime', 'trance', 'hiphop', 'disco', 'sway', 'glow', 'clap', 'phone', 'singalong', 'chat', 'couple', 'drink'];
const REACTION_MOVE = { singalong: 'singalong', handsup: 'handsup', jump: 'jump', phonelights: 'phone', mosh: 'pogo', couple: 'couple', chant: 'fistpump', crouchjump: 'jump', skank: 'skank' };

// ---------------------------------------------------------------- geometry
function capsule(r, len, down = true) {
  const g = new THREE.CapsuleGeometry(r, len, 3, 8);
  g.translate(0, down ? -(len / 2 + r) : (len / 2 + r), 0);
  return g;
}
const PART_DEFS = [
  ['pelvis', () => { const g = new THREE.BoxGeometry(0.3, 0.17, 0.19); g.translate(0, 0.02, 0); return g; }],
  ['torso', () => capsule(0.15, 0.27, false)],
  ['head', () => new THREE.SphereGeometry(0.105, 12, 9)],
  ['hair', () => new THREE.SphereGeometry(0.115, 10, 8)],
  ['uarmL', () => capsule(0.05, 0.22)], ['uarmR', () => capsule(0.05, 0.22)],
  ['farmL', () => capsule(0.043, 0.21)], ['farmR', () => capsule(0.043, 0.21)],
  ['thighL', () => capsule(0.078, 0.3)], ['thighR', () => capsule(0.078, 0.3)],
  ['shinL', () => capsule(0.062, 0.33)], ['shinR', () => capsule(0.062, 0.33)],
  ['hat', () => { const g = new THREE.CylinderGeometry(0.115, 0.125, 0.08, 10); return g; }],
  ['cup', () => { const g = new THREE.CylinderGeometry(0.04, 0.034, 0.12, 8); g.translate(0, 0.02, 0); return g; }]
];
const GLOW_DEFS = [
  ['phone', () => new THREE.BoxGeometry(0.07, 0.13, 0.014)],
  ['glowstick', () => { const g = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6); return g; }]
];
const UA = 0.29, FA = 0.27, TH = 0.44, SH = 0.45, TORSO = 0.5;
const BUILD_W = { slim: 0.88, average: 1, broad: 1.13, heavy: 1.3 };

function rimMaterial(opts) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05, ...opts });
  m.userData.rim = { uRimColor: { value: new THREE.Color('#5a7bff') }, uRimStrength: { value: 0.8 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.rim);
    sh.fragmentShader = 'uniform vec3 uRimColor;\nuniform float uRimStrength;\n' + sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n float rimF = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 2.2);\n totalEmissiveRadiance += uRimColor * rimF * uRimStrength;'
    );
  };
  return m;
}

// ---------------------------------------------------------------- crowd
export class Crowd {
  constructor(scene, maxCount = 2600) {
    this.scene = scene;
    this.max = maxCount;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mat = rimMaterial({});
    this.glowMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.meshes = {};
    for (const [name, mk] of PART_DEFS) this._mkMesh(name, mk(), this.mat);
    for (const [name, mk] of GLOW_DEFS) this._mkMesh(name, mk(), this.glowMat);
    this.people = [];
    this.st = [];
    this.count = 0;
    this.time = 0;
    this.rng = makeRng(99);
    this.mosh = { active: false, x: 0, z: 0, r: 0, target: 0, type: 'mosh', until: 0, dancer: -1 };
    this.ticker = [];
    this.onStory = null;
    this.frame = 0;
    this.clockStart = 22 * 60;
    this.pose = new Float32Array(NCH); this.pose2 = new Float32Array(NCH);
    this._m = { root: new THREE.Matrix4(), pelvis: new THREE.Matrix4(), torso: new THREE.Matrix4(), joint: new THREE.Matrix4(), joint2: new THREE.Matrix4(), tmp: new THREE.Matrix4(), part: new THREE.Matrix4(), zero: new THREE.Matrix4().makeScale(0, 0, 0) };
    this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._c = new THREE.Color();
    this.followId = -1;
    this.anthem = null;
  }

  _mkMesh(name, geo, mat) {
    const m = new THREE.InstancedMesh(geo, mat, this.max);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    for (let i = 0; i < this.max; i++) m.setColorAt(i, new THREE.Color(1, 1, 1));
    this.meshes[name] = m;
    this.group.add(m);
  }

  get clock() { return formatClock(this.clockStart + this.time / 60 * 1.5); }

  // ---------- setup ----------
  populate(people, area) {
    this.people = people;
    this.area = area;
    this.count = Math.min(people.length, this.max);
    const rng = makeRng(people.length * 7 + 3);
    this.st = [];
    // place groups
    const groupCenters = new Map();
    for (let i = 0; i < this.count; i++) {
      const p = people[i];
      let c = groupCenters.get(p.groupId);
      if (!c) { c = this._samplePoint(rng); groupCenters.set(p.groupId, c); }
      const ang = rng() * TAU, rad = 0.35 + rng() * 0.6;
      const pt = this._clampToArea(c.x + Math.cos(ang) * rad, c.z + Math.sin(ang) * rad);
      this.st.push(this._newState(p, pt.x, pt.z, rng));
    }
    this._relaxHomes(6);
    for (const s of this.st) { s.x = s.hx; s.z = s.hz; }
    this._applyColors();
    for (const k in this.meshes) this.meshes[k].count = this.count;
    // arrival stories
    for (let i = 0; i < this.count; i++) if (rng() < 0.3) this._log(i, 'arrive', {}, false, -rng() * 40);
  }

  _newState(p, x, z, rng) {
    return {
      x, z, hx: x, hz: z, ox: 0, oz: 0, yaw: 0, move: 'bounce', prev: 'sway', blend: 1, moveBeats: 0, holdUntil: 0,
      mode: 'dance', modeT: 0, nextThink: rng() * 0.5, reactAt: -1, reactMove: null, reactUntil: 0, lift: 0, partner: -1,
      intensity: 0.5, lookYaw: 0, phase: rng() * 100, walkTo: null, surfDir: 0, lastLog: -999, lod: 0, sx: 0, sy: 0, onScreen: false
    };
  }

  _samplePoint(rng) {
    const a = this.area;
    if (a.type === 'ring') {
      const ang = rng() * TAU, r = a.r0 + (a.r1 - a.r0) * Math.pow(rng(), 1.3);
      return { x: a.cx + Math.cos(ang) * r, z: a.cz + Math.sin(ang) * r };
    }
    const u = Math.pow(rng(), a.frontBias || 1.5);
    return { x: lerp(a.x0, a.x1, rng()), z: lerp(a.zFront, a.zBack, u) };
  }

  _clampToArea(x, z) {
    const a = this.area;
    if (a.type === 'ring') {
      const dx = x - a.cx, dz = z - a.cz, r = Math.hypot(dx, dz) || 1e-3;
      const rr = clamp(r, a.r0, a.r1);
      return { x: a.cx + dx / r * rr, z: a.cz + dz / r * rr };
    }
    const zmin = Math.min(a.zFront, a.zBack), zmax = Math.max(a.zFront, a.zBack);
    return { x: clamp(x, a.x0, a.x1), z: clamp(z, zmin, zmax) };
  }

  _relaxHomes(iter) {
    const minD = 0.58, cell = 0.6;
    for (let it = 0; it < iter; it++) {
      const grid = new Map();
      for (let i = 0; i < this.count; i++) {
        const s = this.st[i]; const k = `${Math.floor(s.hx / cell)},${Math.floor(s.hz / cell)}`;
        (grid.get(k) || grid.set(k, []).get(k)).push(i);
      }
      for (let i = 0; i < this.count; i++) {
        const s = this.st[i]; const cx = Math.floor(s.hx / cell), cz = Math.floor(s.hz / cell);
        for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) {
          const arr = grid.get(`${cx + gx},${cz + gz}`); if (!arr) continue;
          for (const j of arr) {
            if (j <= i) continue;
            const o = this.st[j]; let dx = o.hx - s.hx, dz = o.hz - s.hz; let d = Math.hypot(dx, dz);
            if (d < minD) { if (d < 1e-4) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d = Math.hypot(dx, dz); } const push = (minD - d) * 0.5; dx /= d; dz /= d; s.hx -= dx * push; s.hz -= dz * push; o.hx += dx * push; o.hz += dz * push; }
          }
        }
        const c = this._clampToArea(s.hx, s.hz); s.hx = c.x; s.hz = c.z;
      }
    }
  }

  _applyColors() {
    const c = this._c, M = this.meshes;
    for (let i = 0; i < this.count; i++) {
      const L = this.people[i].look;
      M.pelvis.setColorAt(i, c.set(L.pants));
      M.torso.setColorAt(i, c.set(L.top));
      M.head.setColorAt(i, c.set(L.skin));
      M.hair.setColorAt(i, c.set(L.hair));
      const arm = L.sleeves ? L.top : L.skin;
      M.uarmL.setColorAt(i, c.set(arm)); M.uarmR.setColorAt(i, c.set(arm));
      M.farmL.setColorAt(i, c.set(L.skin)); M.farmR.setColorAt(i, c.set(L.skin));
      M.thighL.setColorAt(i, c.set(L.pants)); M.thighR.setColorAt(i, c.set(L.pants));
      const shin = L.shorts ? L.skin : L.pants;
      M.shinL.setColorAt(i, c.set(shin)); M.shinR.setColorAt(i, c.set(shin));
      M.hat.setColorAt(i, c.set(L.hatColor));
      M.cup.setColorAt(i, c.set('#d8e4f0'));
      M.phone.setColorAt(i, c.setRGB(0.85, 0.92, 1.0));
      M.glowstick.setColorAt(i, c.set(L.glowColor).multiplyScalar(2.2));
    }
    for (const k in M) if (M[k].instanceColor) M[k].instanceColor.needsUpdate = true;
  }

  setRim(color, strength) { this.mat.userData.rim.uRimColor.value.copy(color); this.mat.userData.rim.uRimStrength.value = strength; }

  // ---------- events from the music ----------
  onDrop(A, intensity) {
    const rng = this.rng;
    const focus = this.area.focus;
    let riders = 0, surfers = 0;
    for (let i = 0; i < this.count; i++) {
      const p = this.people[i], s = this.st[i];
      if (s.mode !== 'dance') continue;
      const dist = Math.hypot(s.x - focus.x, s.z - focus.z);
      const eager = p.traits.hype;
      s.reactAt = this.time + (1 - eager) * 0.35 + dist * 0.012 + rng() * 0.15 + Math.abs(p.rhythmOffset);
      const like = p.taste[canonGenre(A.genre)] || 0.3;
      let mv = 'jump';
      if (A.genre === 'Dubstep') mv = rng() < 0.5 ? 'headbang' : 'halftime';
      else if (A.genre === 'Drum & Bass') mv = rng() < 0.6 ? 'skank' : 'jump';
      else if (A.genre === 'Hardstyle') mv = rng() < 0.5 ? 'stomp' : 'fistpump';
      else if (A.genre === 'Techno') mv = rng() < 0.6 ? 'housejack' : 'fistpump';
      else if (A.genre === 'Trance') mv = rng() < 0.5 ? 'handsup' : 'jump';
      if (like < 0.35 && rng() < 0.5) mv = 'bounce';
      if (p.traits.phone > 0.8 && rng() < 0.6) mv = 'phone';
      if (this.anthem && this.anthem.reaction === 'crouchjump') mv = 'jump';
      s.reactMove = mv; s.reactUntil = this.time + 8 + rng() * 10;
      p.mood = clamp(p.mood + 0.1 * like * intensity, 0, 1);
      p.energy = clamp(p.energy + 0.25 * intensity, 0, 1.2);
      // special moments
      if (p.friends.length && riders < Math.max(1, this.count / 90) && (p.goal.id === 'shoulders' || p.arch === 'squad' || p.arch === 'superfan' || p.arch === 'bachelorette') && rng() < 0.12 * intensity) {
        if (this._startRide(i)) riders++;
      } else if (surfers < 2 && (p.goal.id === 'surf' || p.traits.rowdy > 0.75) && rng() < 0.04 * intensity && this.area.type !== 'ring') {
        this._startSurf(i); surfers++;
      }
      if (rng() < 0.025 + (i === this.followId ? 1 : 0)) this._log(i, 'drop');
      if (p.goal.id === 'content' && s.move === 'phone' && !p.goal.done && rng() < 0.5) { p.goal.done = true; this._log(i, 'film', {}, true); }
    }
    if (this.mosh.active && this.mosh.type === 'mosh') this.mosh.go = true;
  }

  onBuildup(A) {
    // heavy genres: open a mosh pit during the build
    const heavy = ['Dubstep', 'Drum & Bass', 'Hardstyle'].includes(A.genre) || (this.anthem && this.anthem.reaction === 'mosh');
    if (heavy && !this.mosh.active && this.area.type !== 'ring' && this.rng() < 0.75) this._openCircle('mosh');
  }

  onSection(A) {
    if (A.section === 'GROOVE' && !this.mosh.active && this.rng() < 0.35) {
      const dancers = [];
      for (let i = 0; i < this.count; i++) if ((this.people[i].arch === 'battler' || this.people[i].arch === 'crewdancer' || this.people[i].arch === 'shuffler') && this.st[i].mode === 'dance') dancers.push(i);
      if (dancers.length) this._openCircle('circle', this.rng.pick(dancers));
    }
    if (A.section === 'BREAKDOWN') {
      for (let i = 0; i < this.count; i++) if (this.rng() < 0.015) this._log(i, 'breakdown');
    }
    if (A.section === 'BUILDUP') {
      for (let i = 0; i < this.count; i++) if (this.rng() < 0.01 || i === this.followId) this._log(i, 'buildup');
    }
  }

  _openCircle(type, dancer = -1) {
    const a = this.area;
    let x, z;
    if (dancer >= 0) { x = this.st[dancer].x; z = this.st[dancer].z; }
    else { x = lerp(a.x0, a.x1, 0.35 + this.rng() * 0.3); z = lerp(a.zFront, a.zBack, 0.35 + this.rng() * 0.2); }
    Object.assign(this.mosh, { active: true, type, x, z, r: 0, target: type === 'mosh' ? 3.2 : 1.6, until: this.time + (type === 'mosh' ? 40 : 28), dancer, go: type === 'circle' });
    if (dancer >= 0) { this._log(dancer, 'circle', {}, true); this.people[dancer].goal.id === 'circle' && (this.people[dancer].goal.done = true); }
    this.emitTicker(type === 'mosh' ? 'A mosh pit is opening up in the middle of the crowd!' : `A dance circle opened around ${this.people[dancer].name.split(' ')[0]}!`);
  }

  _startRide(i) {
    const p = this.people[i];
    const cands = p.friends.filter((f) => f < this.count && this.st[f].mode === 'dance' && this.people[f].look.height > p.look.height - 0.05);
    if (!cands.length) return false;
    const c = cands[0];
    const s = this.st[i], cs = this.st[c];
    s.mode = 'ride'; s.partner = c; s.modeT = this.time + 20 + this.rng() * 15;
    cs.mode = 'carry'; cs.partner = i; cs.modeT = s.modeT;
    this._log(i, 'shoulders', { friendId: c }, true);
    this._log(c, 'carry', { friendId: i }, false);
    if (p.goal.id === 'shoulders') p.goal.done = true;
    return true;
  }

  _startSurf(i) {
    const s = this.st[i];
    s.mode = 'surf'; s.modeT = this.time + 25;
    this._log(i, 'surf', {}, true);
    if (this.people[i].goal.id === 'surf') this.people[i].goal.done = true;
  }

  // anthem recognised: ripple of recognition from the front
  onAnthem(song) {
    this.anthem = song;
    if (!song) return;
    const focus = this.area.focus;
    for (let i = 0; i < this.count; i++) {
      const p = this.people[i], s = this.st[i];
      const dist = Math.hypot(s.x - focus.x, s.z - focus.z);
      const isTheirs = p.theirSongs.includes(song.key);
      const know = isTheirs ? 1 : clamp((p.taste[canonGenre(song.genre)] || 0.3) * 0.9 + 0.35 - (p.arch === 'tourist' || p.arch === 'kpopstan' ? 0.25 : 0) - (p.arch === 'purist' ? 0.3 : 0), 0, 1);
      if (this.rng() > know && !isTheirs) { if (this.rng() < 0.01) this._log(i, 'unknownanthem', { song: song.title }); continue; }
      s.reactAt = this.time + (isTheirs ? 0.1 : 0.5) + dist * 0.05 + this.rng() * 1.5;
      s.reactMove = isTheirs ? this.rng.pick(['handsup', 'jump', 'singalong', p.traits.phone > 0.5 ? 'phone' : 'hug']) : REACTION_MOVE[song.reaction] || 'handsup';
      s.reactUntil = s.reactAt + 20 + this.rng() * 25;
      p.mood = clamp(p.mood + (isTheirs ? 0.35 : 0.12), 0, 1);
      p.energy = clamp(p.energy + (isTheirs ? 0.4 : 0.15), 0, 1.2);
      if (isTheirs) {
        if (p.goal.id === 'song') p.goal.done = true;
        if (p.goal.id === 'propose' && p.partner != null && !p.goal.done) {
          p.goal.done = true;
          this._log(i, 'propose', { friendId: p.partner, song: song.title }, true);
          this.emitTicker(`💍 ${p.name.split(' ')[0]} just proposed to ${this.people[p.partner].name.split(' ')[0]} during "${song.title}"!`);
        } else this._log(i, 'theirsong', { song: song.title }, true);
      } else if (this.rng() < 0.02) this._log(i, 'anthem', { song: song.title });
    }
    if (song.reaction === 'mosh' && this.area.type !== 'ring') this._openCircle('mosh');
  }

  // ---------- simulation ----------
  update(dt, A, camera) {
    this.time += dt;
    this.frame++;
    const time = this.time;
    const genre = canonGenre(A.genre);
    const gfit = GENRE_FIT[genre] || {};
    const sfit = SECTION_FIT[A.section] || {};
    const focus = this.area.focus;

    // circle/mosh lifecycle
    const M = this.mosh;
    if (M.active) {
      if (time > M.until) M.target = 0;
      M.r = lerp(M.r, M.target, 1 - Math.exp(-dt * 1.2));
      if (M.target === 0 && M.r < 0.1) { M.active = false; M.go = false; }
    }

    // camera for LOD
    const camPos = camera.position;
    const bp = A.buildProgress;

    for (let i = 0; i < this.count; i++) {
      const p = this.people[i], s = this.st[i];

      // ---- think (staggered)
      if (time >= s.nextThink) {
        s.nextThink = time + 0.25 + Math.random() * 0.35;
        this._think(i, p, s, A, gfit, sfit, genre);
      }

      // ---- reaction timer
      if (s.reactAt > 0 && time >= s.reactAt) {
        s.reactAt = -1;
        if (s.mode === 'dance') this._setMove(s, s.reactMove, 16, 0.12);
      }

      // ---- movement target
      let tx = s.hx, tz = s.hz;
      if (A.section === 'BUILDUP' && this.area.type !== 'ring') tz += (this.area.zFront - this.area.zBack) * 0.025 * bp; // squeeze forward
      if (M.active && M.r > 0.05 && s.mode === 'dance') {
        const dx = s.hx - M.x, dz = s.hz - M.z, d = Math.hypot(dx, dz) || 1e-3;
        const inner = (M.type === 'mosh' && M.go && p.traits.rowdy > 0.6) || i === M.dancer;
        if (inner && d < M.r + 2) {
          // run around inside the pit / dance in the circle
          if (i === M.dancer) { tx = M.x; tz = M.z; }
          else { const ang = time * (0.9 + p.flair) + p.id; tx = M.x + Math.cos(ang) * M.r * 0.55; tz = M.z + Math.sin(ang) * M.r * 0.55; }
        } else if (d < M.r + 0.6) { tx = M.x + dx / d * (M.r + 0.6); tz = M.z + dz / d * (M.r + 0.6); }
      }
      if (s.mode === 'walk' && s.walkTo) { tx = s.walkTo.x; tz = s.walkTo.z; }
      if (s.mode === 'surf') {
        const fz = this.area.zFront;
        tz = s.z + Math.sign(fz - s.z) * 2; tx = s.x;
        if (Math.abs(s.z - fz) < 0.6) { s.mode = 'dance'; this._log(i, 'surf', {}, false); }
      }
      if (s.mode === 'ride' && s.partner >= 0) { const c = this.st[s.partner]; tx = c.x; tz = c.z; }
      const spd = s.mode === 'walk' ? 1.3 : s.mode === 'surf' ? 0.9 : s.mode === 'ride' ? 20 : (M.active && M.go ? 2.5 : 1.2);
      const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
      const moving = d > 0.05;
      if (moving) { const step = Math.min(d, spd * dt); s.x += dx / d * step; s.z += dz / d * step; }

      // ---- facing
      let targetYaw;
      if (s.mode === 'walk' && moving) targetYaw = Math.atan2(dx, dz);
      else if ((s.move === 'chat' || s.move === 'hug' || s.move === 'couple') && s.partner >= 0) { const f = this.st[s.partner]; targetYaw = Math.atan2(f.x - s.x, f.z - s.z); }
      else if (M.active && M.r > 0.3 && Math.hypot(s.x - M.x, s.z - M.z) < M.r + 1.6 && i !== M.dancer) targetYaw = Math.atan2(M.x - s.x, M.z - s.z);
      else targetYaw = Math.atan2(focus.x - s.x, focus.z - s.z) + s.lookYaw;
      let dy = targetYaw - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      s.yaw += dy * (1 - Math.exp(-dt * 3));

      // ---- live persona state
      const like = p.taste[genre] || 0.3;
      const want = clamp((A.energy / 10) * (0.5 + like * 0.8) * (0.6 + p.traits.hype * 0.6) * (0.5 + p.stamina * 0.6) * (A.silent ? 0.1 : 1), 0, 1.3);
      p.energy = lerp(p.energy, want, 1 - Math.exp(-dt * 0.6));
      const exert = (s.move === 'jump' || s.move === 'pogo' || s.move === 'skank' || s.move === 'shuffle' || s.move === 'stomp' || s.move === 'headbang') ? 1 : 0.35;
      p.stamina = clamp(p.stamina - dt * 0.0016 * exert * p.energy * (1.4 - p.traits.stamina) + (s.move === 'rest' || s.move === 'chat' || s.mode === 'walk' ? dt * 0.01 : 0), 0, 1);
      p.hydration = clamp(p.hydration - dt * 0.0012 * exert + (s.move === 'drink' ? dt * 0.03 : 0), 0, 1);
      p.mood = clamp(p.mood + dt * 0.01 * (like - 0.45) * (A.silent ? 0 : 1), 0, 1);
      s.intensity = lerp(s.intensity, clamp(p.energy * p.amp, 0.08, 1.4), 1 - Math.exp(-dt * 2));
      if (s.blend < 1) s.blend = Math.min(1, s.blend + dt * 2.2);

      // ---- LOD & pose
      const cdx = s.x - camPos.x, cdz = s.z - camPos.z;
      const cd2 = cdx * cdx + cdz * cdz;
      const lod = cd2 > 1600 ? 3 : cd2 > 625 ? 2 : 1;
      if (lod > 1 && ((this.frame + i) % lod) !== 0 && i !== this.followId) continue;
      this._pose(i, p, s, A, time);
      this._writeMatrices(i, p, s);
    }
    for (const k in this.meshes) this.meshes[k].instanceMatrix.needsUpdate = true;
  }

  _setMove(s, move, beats, blendRate = 0) {
    if (s.move === move) { s.holdUntil = Math.max(s.holdUntil, this.time + beats * 0.45); return; }
    s.prev = s.move; s.move = move; s.blend = blendRate ? 0.4 : 0; s.holdUntil = this.time + beats * 0.45;
  }

  _think(i, p, s, A, gfit, sfit, genre) {
    const rng = this.rng, time = this.time;
    // modes with timers
    if (s.mode === 'ride' || s.mode === 'carry') {
      if (time > s.modeT || (s.partner >= 0 && !['ride', 'carry'].includes(this.st[s.partner].mode))) { s.mode = 'dance'; s.partner = -1; s.lift = 0; }
      else { s.move = s.mode; s.blend = 1; return; }
    }
    if (s.mode === 'surf') { if (time > s.modeT) s.mode = 'dance'; else { s.move = 'surf'; s.blend = 1; return; } }
    if (s.mode === 'walk') {
      const w = s.walkTo; if (!w) { s.mode = 'dance'; return; }
      if (Math.hypot(w.x - s.x, w.z - s.z) < 0.4) {
        if (w.kind === 'bar') { s.walkTo = { x: s.hx, z: s.hz, kind: 'home' }; p.hydration = 1; p.stamina = Math.min(1, p.stamina + 0.3); this._log(i, 'bar'); if (p.stamina > 0.5 && rng() < 0.5) this._log(i, 'secondwind'); }
        else { s.mode = 'dance'; s.walkTo = null; }
      }
      s.move = 'walk'; s.blend = 1; return;
    }
    // tiredness / thirst -> bar or rest
    if ((p.hydration < 0.25 || p.stamina < 0.15) && this.area.bar && rng() < 0.15) {
      s.mode = 'walk'; s.walkTo = { x: this.area.bar.x + (rng() - 0.5) * 3, z: this.area.bar.z + (rng() - 0.5) * 2, kind: 'bar' };
      this._log(i, p.stamina < 0.15 ? 'tired' : 'bar');
      return;
    }
    // lost friend storyline
    if (p.goal.id === 'friend' && !p.goal.done && p.friends.length && rng() < 0.004) {
      p.goal.done = true; const f = p.friends[0];
      this._log(i, 'found', { friendId: f }, true);
      s.partner = f; this._setMove(s, 'hug', 6); return;
    }
    if (p.goal.id === 'newfriend' && !p.goal.done && rng() < 0.002) { p.goal.done = true; this._log(i, 'newfriend', {}, true); }
    if (p.goal.id === 'dj' && !p.goal.done && A.sinceDrop < 4 && rng() < 0.01) { p.goal.done = true; this._log(i, 'djeye', {}, true); }
    if (p.goal.id === 'barrier' && !p.goal.done && this.area.type !== 'ring' && rng() < 0.003) {
      p.goal.done = true; s.hz = lerp(s.hz, this.area.zFront, 0.8); this._log(i, 'drop', {}, true);
    }

    // still holding a reaction or a move?
    if (time < s.holdUntil && s.reactUntil < time) return;
    if (time < s.reactUntil && s.reactMove) { if (s.move !== s.reactMove) this._setMove(s, s.reactMove, 8); return; }

    // anticipation crouch late in the build-up
    if (A.section === 'BUILDUP' && A.buildProgress > 0.72 && (p.traits.hype > 0.45 || (this.anthem && this.anthem.reaction === 'crouchjump'))) { this._setMove(s, 'crouch', 4); return; }

    // choose a move by utility
    let best = 'bounce', total = 0;
    const like = p.taste[genre] || 0.3;
    const cands = this._cands || (this._cands = {});
    for (const m of DANCE_MOVES) {
      let w = (p.moveWeights[m] || 0.15) * (gfit[m] ?? 0.6) * (sfit[m] ?? 1);
      if (m === 'phone' && !p.props.phone) w *= A.section === 'BREAKDOWN' ? 0.6 : 0.05;
      if (m === 'glow' && !p.props.glowstick) w *= 0.1;
      if (m === 'drink' && !p.props.cup) w *= 0.15;
      if (m === 'couple' && p.partner == null) w *= 0.05;
      if (m === 'chat') w *= (1.4 - like) * (1.2 - p.energy) * (p.friends.length ? 1.5 : 0.2) * (0.5 + p.traits.extra);
      if (m === 'jump' || m === 'pogo' || m === 'skank') w *= 0.3 + p.energy * p.stamina * 1.2;
      if (m === 'sway') w *= 1.3 - p.energy * 0.7;
      if (m === 'singalong' && this.anthem) w *= 4;
      w *= 0.6 + Math.random() * 0.8;
      cands[m] = w; total += w;
    }
    if (p.stamina < 0.25 && rng() < 0.4) best = 'rest';
    else {
      let r = Math.random() * total;
      for (const m of DANCE_MOVES) { r -= cands[m]; if (r <= 0) { best = m; break; } }
    }
    if (best === 'chat' || best === 'couple' || best === 'hug') s.partner = p.partner != null && best === 'couple' ? p.partner : p.friends.length ? p.friends[Math.floor(rng() * p.friends.length)] : -1;
    if ((best === 'chat' || best === 'couple' || best === 'hug') && (s.partner < 0 || s.partner >= this.count)) best = 'bounce';
    s.lookYaw = (rng() - 0.5) * 0.5;
    this._setMove(s, best, 4 + Math.floor(rng() * 3) * 4);
    // taste-based story beats
    if (rng() < 0.0025) this._log(i, like > 0.7 ? 'genrelove' : like < 0.35 ? 'genremeh' : 'genrelove', { genre });
  }

  // ---------- story log ----------
  _log(i, type, ctx = {}, important = false, timeOffset = 0) {
    const p = this.people[i];
    const text = storyLine(type, p, this.people, ctx, Math.random);
    if (!text) return;
    p.log.push({ t: formatClock(this.clockStart + (this.time + timeOffset) / 60 * 1.5), text });
    if (p.log.length > 60) p.log.shift();
    if (important || i === this.followId) this.emitTicker(`${p.name.split(' ')[0]}: ${text}`, i);
  }
  emitTicker(text, id = -1) { if (this.onStory) this.onStory(text, id); }

  // ---------- pose ----------
  _pose(i, p, s, A, time) {
    const P = this.pose;
    const t = A.beats + (p.rhythmOffset + s.phase * 0.0) * A.bpm / 60;
    const e = s.intensity;
    computePose(P, s.move, t, e, p, s, A, time);
    if (s.blend < 1) {
      const Q = this.pose2;
      computePose(Q, s.prev, t, e, p, s, A, time);
      const b = s.blend * s.blend * (3 - 2 * s.blend);
      for (let k = 0; k < NCH; k++) P[k] = Q[k] + (P[k] - Q[k]) * b;
    }
    if (s.mode === 'ride' && s.partner >= 0) {
      const cp = this.people[s.partner];
      P[Y] += 1.38 * cp.look.height / 1.75 - 0.86 * p.look.height / 1.75; P[DX] = 0; P[DZ] = -0.05;
    }
  }

  _writeMatrices(i, p, s) {
    const P = this.pose, m = this._m, e = this._e, v = this._v, Ms = this.meshes;
    const sc = p.look.height / 1.75, w = BUILD_W[p.look.build] || 1;
    const set = (mesh, mat) => mesh.setMatrixAt(i, mat);
    const yaw = s.yaw + P[YAW];
    // root
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const lx = P[DX] * cy + P[DZ] * sy, lz = -P[DX] * sy + P[DZ] * cy;
    const crouch = P[CR];
    const kneeA = clamp(crouch, 0, 1.3);
    const hipH = (TH * Math.cos(kneeA) + SH * Math.cos(kneeA)) * sc + 0.05 * sc;
    const lie = P[LIE];
    m.root.makeRotationFromEuler(e.set(-lie * Math.PI / 2, yaw, 0, 'YXZ'));
    m.root.setPosition(s.x + lx, P[Y] + (lie > 0 ? 1.9 : hipH), s.z + lz);
    // pelvis
    m.tmp.makeRotationFromEuler(e.set(0, P[TW] * 0.3, P[LZ] * 0.3, 'YXZ'));
    m.pelvis.multiplyMatrices(m.root, m.tmp);
    m.part.copy(m.pelvis).scale(v.set(sc * w, sc, sc * w)); set(Ms.pelvis, m.part);
    // torso (lean forward with crouch for balance)
    m.tmp.makeRotationFromEuler(e.set(P[LX] + kneeA * 0.35, P[TW], P[LZ], 'YXZ'));
    m.tmp.setPosition(0, 0.06 * sc, 0);
    m.torso.multiplyMatrices(m.pelvis, m.tmp);
    m.part.copy(m.torso).scale(v.set(sc * w, sc, sc * w * 0.78)); set(Ms.torso, m.part);
    // head
    m.tmp.makeRotationFromEuler(e.set(P[HX], P[HY], P[HZ], 'YXZ'));
    m.tmp.setPosition(0, (TORSO + 0.13) * sc, 0.01 * sc);
    m.joint.multiplyMatrices(m.torso, m.tmp);
    m.part.copy(m.joint).scale(v.set(sc, sc * 1.08, sc)); set(Ms.head, m.part);
    // hair by style
    const hs = p.look.hairStyle;
    if (hs === 'bald') set(Ms.hair, m.zero);
    else {
      let hx = 1, hy = 1, hz = 1, oy = 0.02, oz = -0.01;
      if (hs === 'buzz') { hx = 0.97; hy = 0.95; hz = 0.97; oy = 0.012; }
      else if (hs === 'short' || hs === 'curly') { hx = 1.02; hy = 0.95; hz = 1.04; oy = 0.025; if (hs === 'curly') { hx = 1.15; hy = 1.05; hz = 1.15; } }
      else if (hs === 'long' || hs === 'braids') { hx = 1.06; hy = 1.55; hz = 1.05; oy = -0.04; oz = -0.03; }
      else if (hs === 'ponytail') { hx = 1.0; hy = 1.2; hz = 1.25; oy = -0.005; oz = -0.045; }
      else if (hs === 'afro') { hx = 1.55; hy = 1.4; hz = 1.5; oy = 0.05; }
      else if (hs === 'bun') { hx = 1.0; hy = 1.25; hz = 1.05; oy = 0.05; oz = -0.03; }
      else if (hs === 'mohawk') { hx = 0.28; hy = 1.25; hz = 1.1; oy = 0.05; }
      else if (hs === 'bob') { hx = 1.12; hy = 1.18; hz = 1.1; oy = -0.01; }
      m.tmp.makeTranslation(0, oy * sc, oz * sc);
      m.part.multiplyMatrices(m.joint, m.tmp).scale(v.set(sc * hx, sc * hy, sc * hz)); set(Ms.hair, m.part);
    }
    // hat
    if (p.props.hat) { m.tmp.makeTranslation(0, 0.085 * sc, 0); m.part.multiplyMatrices(m.joint, m.tmp).scale(v.set(sc * 1.05, sc, sc * 1.05)); set(Ms.hat, m.part); } else set(Ms.hat, m.zero);
    // arms
    const shY = (TORSO - 0.02) * sc, shX = 0.2 * sc * w;
    // left (+x)
    m.tmp.makeRotationFromEuler(e.set(P[ALP], 0, P[ALR], 'ZXY')); m.tmp.setPosition(shX, shY, 0);
    m.joint.multiplyMatrices(m.torso, m.tmp);
    m.part.copy(m.joint).scale(v.set(sc * w, sc, sc * w)); set(Ms.uarmL, m.part);
    m.tmp.makeRotationFromEuler(e.set(-P[ALE], 0, 0, 'XYZ')); m.tmp.setPosition(0, -UA * sc, 0);
    m.joint2.multiplyMatrices(m.joint, m.tmp);
    m.part.copy(m.joint2).scale(v.set(sc, sc, sc)); set(Ms.farmL, m.part);
    // cup in left hand
    if (p.props.cup && (s.move !== 'handsup' && s.move !== 'trance' && s.move !== 'jump')) { m.tmp.makeTranslation(0, -FA * sc, 0.03); m.part.multiplyMatrices(m.joint2, m.tmp); m.tmp.makeRotationX(Math.PI / 2 + P[ALE] - 0.3); m.part.multiply(m.tmp); set(Ms.cup, m.part); }
    else set(Ms.cup, m.zero);
    // right (-x)
    m.tmp.makeRotationFromEuler(e.set(P[ARP], 0, -P[ARR], 'ZXY')); m.tmp.setPosition(-shX, shY, 0);
    m.joint.multiplyMatrices(m.torso, m.tmp);
    m.part.copy(m.joint).scale(v.set(sc * w, sc, sc * w)); set(Ms.uarmR, m.part);
    m.tmp.makeRotationFromEuler(e.set(-P[ARE], 0, 0, 'XYZ')); m.tmp.setPosition(0, -UA * sc, 0);
    m.joint2.multiplyMatrices(m.joint, m.tmp);
    m.part.copy(m.joint2).scale(v.set(sc, sc, sc)); set(Ms.farmR, m.part);
    // props in right hand
    const showPhone = p.props.phone && (s.move === 'phone' || (s.move === 'singalong' && p.traits.phone > 0.6));
    if (showPhone) { m.tmp.makeTranslation(0, -FA * sc - 0.03, 0.02); m.part.multiplyMatrices(m.joint2, m.tmp); set(Ms.phone, m.part); } else set(Ms.phone, m.zero);
    if (p.props.glowstick && !showPhone) { m.tmp.makeTranslation(0, -FA * sc - 0.02, 0); m.part.multiplyMatrices(m.joint2, m.tmp); m.tmp.makeRotationX(Math.PI / 2); m.part.multiply(m.tmp); set(Ms.glowstick, m.part); } else set(Ms.glowstick, m.zero);
    // legs
    const hipX = 0.09 * sc * w;
    const legs = [[Ms.thighL, Ms.shinL, hipX, P[LLP] - kneeA, P[LLK] + 2 * kneeA, P[LLR]], [Ms.thighR, Ms.shinR, -hipX, P[LRP] - kneeA, P[LRK] + 2 * kneeA, -P[LRR]]];
    for (const [thM, shM, x, pitch, knee, roll] of legs) {
      m.tmp.makeRotationFromEuler(e.set(pitch, 0, roll, 'ZXY')); m.tmp.setPosition(x, 0, 0);
      m.joint.multiplyMatrices(m.pelvis, m.tmp);
      m.part.copy(m.joint).scale(v.set(sc * w, sc, sc * w)); set(thM, m.part);
      m.tmp.makeRotationFromEuler(e.set(knee, 0, 0, 'XYZ')); m.tmp.setPosition(0, -TH * sc, 0);
      m.joint2.multiplyMatrices(m.joint, m.tmp);
      m.part.copy(m.joint2).scale(v.set(sc, sc, sc)); set(shM, m.part);
    }
    // cache head position for picking/follow
    s.headY = m.root.elements[13] + (TORSO + 0.15) * sc;
  }

  // ---------- picking & follow ----------
  pick(ndcX, ndcY, camera, w, h) {
    const v = this._v;
    let best = -1, bestD = 28 * 28, bestZ = Infinity;
    const px = (ndcX * 0.5 + 0.5) * w, py = (-ndcY * 0.5 + 0.5) * h;
    for (let i = 0; i < this.count; i++) {
      const s = this.st[i];
      v.set(s.x, (s.headY || 1.4) - 0.25, s.z).project(camera);
      if (v.z > 1 || v.z < -1) continue;
      const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
      const d = (sx - px) ** 2 + (sy - py) ** 2;
      if (d < bestD * 1.0 && (d < bestD * 0.5 || v.z < bestZ)) { best = i; bestD = Math.max(d, 1); bestZ = v.z; }
    }
    return best;
  }

  getHead(i, out) { const s = this.st[i]; return out.set(s.x, s.headY || 1.6, s.z); }
  getYaw(i) { return this.st[i].yaw; }
  describe(i) { const s = this.st[i]; return { move: MOVE_LABELS[s.move] || s.move, mode: s.mode }; }
  randomInteresting() {
    const pool = [];
    for (let i = 0; i < this.count; i++) { const s = this.st[i]; if (s.mode !== 'dance' || ['jump', 'shuffle', 'handsup', 'singalong', 'phone', 'couple', 'hug', 'headbang', 'skank'].includes(s.move)) pool.push(i); }
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : Math.floor(Math.random() * this.count);
  }
}

// ======================================================================= poses
function computePose(P, move, t, e, p, s, A, time) {
  P.fill(0);
  const f = t - Math.floor(t);
  const w1 = 0.5 + 0.5 * Math.cos(TAU * t); // 1 on the beat
  const pulse = Math.exp(-f * 7);
  const half = Math.sin(Math.PI * t); // period 2 beats
  const flair = p.flair, sign = flair > 0.5 ? 1 : -1;
  // defaults: relaxed arms
  P[ALR] = 0.1; P[ARR] = 0.1; P[ALE] = 0.25; P[ARE] = 0.25;
  const bounce = (amt) => { P[CR] += amt * e * w1; P[HX] += amt * 0.9 * e * w1; };
  switch (move) {
    case 'bounce':
      bounce(0.16); P[CR] += 0.05;
      P[ALP] = -0.35 - 0.25 * e * w1; P[ARP] = -0.35 - 0.25 * e * (1 - w1); P[ALE] = P[ARE] = 1.1 + 0.3 * w1;
      P[LZ] = 0.05 * half * e; P[TW] = 0.12 * half * flair;
      break;
    case 'fistpump': {
      bounce(0.12);
      const up = Math.pow(Math.max(0, Math.cos(TAU * t)), 3);
      P[ARP] = -2.2 - 0.6 * up * e; P[ARR] = 0.2; P[ARE] = 0.9 * (1 - up);
      P[ALP] = -0.6; P[ALE] = 1.4; P[HX] -= 0.15; P[LX] = -0.05;
      if (flair > 0.7) { P[ALP] = -2.0 - 0.5 * up; P[ALE] = 0.6 * (1 - up); }
      break; }
    case 'handsup':
      bounce(0.08);
      P[ALP] = P[ARP] = -2.75; P[ALR] = P[ARR] = 0.25 + 0.25 * Math.sin(Math.PI * t * 0.5) * sign;
      P[ALE] = P[ARE] = 0.2 + 0.15 * w1; P[LZ] = 0.14 * Math.sin(Math.PI * t * 0.5) * e; P[HX] = -0.25;
      break;
    case 'jump': {
      const tt = e < 0.55 ? t * 0.5 : t;
      const ff = tt - Math.floor(tt);
      const air = ff < 0.62 ? Math.sin(Math.PI * ff / 0.62) : 0;
      P[Y] = air * (0.14 + 0.24 * e);
      P[CR] = air > 0 ? 0.04 : 0.38 * Math.sin(Math.PI * (ff - 0.62) / 0.38) * (0.5 + e * 0.5);
      P[LLK] = P[LRK] = 0.45 * air; P[LLP] = P[LRP] = -0.25 * air;
      P[ALP] = P[ARP] = -2.6 + 0.4 * (1 - air); P[ALR] = P[ARR] = 0.3; P[ALE] = P[ARE] = 0.25;
      P[HX] = -0.2 * air;
      break; }
    case 'pogo': {
      const air = f < 0.6 ? Math.sin(Math.PI * f / 0.6) : 0;
      P[Y] = air * (0.12 + 0.18 * e); P[CR] = air > 0 ? 0.02 : 0.25;
      P[ALP] = -0.2; P[ARP] = -0.2; P[ALR] = P[ARR] = -0.05; P[ALE] = P[ARE] = 0.5;
      P[LZ] = 0.1 * Math.sin(time * 9 + p.id) * e; P[HX] = 0.2 * air;
      P[TW] = 0.3 * Math.sin(time * 5 + p.id);
      break; }
    case 'headbang':
      P[HX] = 0.15 + 0.7 * Math.pow(pulse, 1.5) * e; P[LX] = 0.25 + 0.2 * pulse * e; P[CR] = 0.25 + 0.1 * w1;
      P[ARP] = -2.5; P[ARR] = 0.15; P[ARE] = 0.5 + 0.3 * pulse; P[ALP] = -0.7; P[ALE] = 1.2;
      if (flair > 0.6) { P[ALP] = -0.4; P[ALR] = 0.3; P[ARP] = -0.4; }
      break;
    case 'twostep':
      P[DX] = 0.12 * half * e; P[LZ] = -0.12 * half * e; P[TW] = 0.25 * half;
      P[LLP] = -0.35 * Math.max(0, half) * e; P[LLK] = 0.6 * Math.max(0, half) * e;
      P[LRP] = -0.35 * Math.max(0, -half) * e; P[LRK] = 0.6 * Math.max(0, -half) * e;
      P[ALP] = -0.5 + 0.4 * half; P[ARP] = -0.5 - 0.4 * half; P[ALE] = P[ARE] = 1.5; bounce(0.08);
      break;
    case 'housejack':
      P[LX] = 0.12 + 0.2 * Math.sin(TAU * t) * e; P[CR] = 0.15 + 0.1 * w1; P[HX] = 0.25 * w1 * e;
      P[ALP] = -0.6 - 0.3 * w1; P[ARP] = -0.6 - 0.3 * w1; P[ALE] = P[ARE] = 1.7; P[ALR] = P[ARR] = 0.25;
      P[LLK] = 0.15 * (1 - w1); P[TW] = 0.15 * Math.sin(Math.PI * t * 0.5) * flair;
      break;
    case 'shuffle': {
      const a = Math.sin(Math.PI * t * 2); // two steps per beat-pair
      P[LLP] = -0.9 * Math.max(0, a) * e; P[LLK] = 1.3 * Math.max(0, a) * e;
      P[LRP] = -0.9 * Math.max(0, -a) * e; P[LRK] = 1.3 * Math.max(0, -a) * e;
      P[LX] = -0.08; P[CR] = 0.12; P[TW] = 0.25 * Math.sin(Math.PI * t) * (flair > 0.5 ? 1 : 0);
      P[ALP] = -0.6 + 0.6 * a; P[ARP] = -0.6 - 0.6 * a; P[ALE] = P[ARE] = 1.5;
      P[DX] = 0.08 * Math.sin(Math.PI * t * 0.5) * e;
      break; }
    case 'stomp': {
      const a = Math.sin(Math.PI * t);
      P[LLP] = -0.7 * Math.max(0, a) * e; P[LLK] = 0.3 * Math.max(0, a);
      P[LRP] = -0.7 * Math.max(0, -a) * e; P[LRK] = 0.3 * Math.max(0, -a);
      P[CR] = 0.2 + 0.1 * pulse; P[ALP] = -1.2 + 0.5 * a; P[ARP] = -1.2 - 0.5 * a; P[ALE] = P[ARE] = 1.6; P[ALR] = P[ARR] = 0.4;
      P[HX] = 0.2 * pulse; P[TW] = -0.25 * a;
      break; }
    case 'skank': {
      const a = Math.sin(TAU * t);
      P[TW] = 0.45 * Math.sin(Math.PI * t) * e; P[CR] = 0.25;
      P[LLP] = -0.6 * Math.max(0, a) * e; P[LLK] = 0.9 * Math.max(0, a) * e;
      P[LRP] = -0.6 * Math.max(0, -a) * e; P[LRK] = 0.9 * Math.max(0, -a) * e;
      P[ALP] = -0.8 - 0.6 * a; P[ARP] = -0.8 + 0.6 * a; P[ALE] = P[ARE] = 1.7; P[LX] = 0.15; P[HX] = 0.2 * w1;
      break; }
    case 'halftime': {
      const t2 = t * 0.5; const f2 = t2 - Math.floor(t2);
      const nod = Math.exp(-f2 * 5);
      P[HX] = 0.1 + 0.6 * nod * e; P[LX] = 0.2 + 0.25 * nod; P[CR] = 0.25 + 0.2 * nod;
      P[ARP] = -1.5; P[ARE] = 0.4 + 0.5 * nod; P[ARR] = 0.1; P[ALP] = -0.5; P[ALE] = 1.6; P[HZ] = 0.15 * sign;
      P[LZ] = 0.08 * Math.sin(Math.PI * t2);
      break; }
    case 'trance': {
      const sw = Math.sin(Math.PI * t * 0.5);
      P[ALP] = P[ARP] = -2.5; P[ALR] = 0.6 + 0.3 * sw; P[ARR] = 0.6 - 0.3 * sw; P[ALE] = P[ARE] = 0.15 + 0.2 * w1;
      P[HX] = -0.35; P[LZ] = 0.12 * sw; bounce(0.05);
      break; }
    case 'hiphop':
      P[HX] = 0.35 * w1 * e; P[LZ] = 0.15 * Math.sin(Math.PI * t); P[CR] = 0.2 + 0.12 * w1; P[TW] = 0.2 * Math.sin(Math.PI * t * 0.5);
      P[ALP] = -0.3 - 0.5 * Math.max(0, Math.sin(Math.PI * t)); P[ARP] = -0.3 - 0.5 * Math.max(0, -Math.sin(Math.PI * t));
      P[ALE] = P[ARE] = 1.0; P[ALR] = P[ARR] = 0.25; P[LX] = 0.1;
      break;
    case 'disco': {
      const up = Math.floor(t) % 2 === 0;
      P[ARP] = up ? -2.5 : -0.5; P[ARR] = up ? 0.5 : -0.4; P[ARE] = 0.05;
      P[ALP] = -0.3; P[ALR] = 0.3; P[ALE] = 1.5; P[LZ] = (up ? 0.15 : -0.15) * e; P[HY] = up ? -0.3 : 0.2;
      P[DX] = 0.08 * half; bounce(0.06);
      break; }
    case 'sway': {
      const sw = Math.sin(Math.PI * t * 0.5);
      P[LZ] = 0.12 * sw * (0.5 + e); P[DX] = 0.06 * sw; P[HZ] = 0.15 * sw; P[HX] = 0.1;
      P[ALP] = -0.2; P[ARP] = -0.2; P[ALE] = P[ARE] = 0.6 + 0.2 * flair; P[CR] = 0.05 + 0.04 * w1;
      break; }
    case 'glow': {
      const a = TAU * t;
      P[ALP] = -1.3 + 0.5 * Math.sin(a); P[ARP] = -1.3 + 0.5 * Math.sin(a + Math.PI);
      P[ALR] = 0.4 + 0.4 * Math.cos(a); P[ARR] = 0.4 + 0.4 * Math.cos(a + Math.PI);
      P[ALE] = P[ARE] = 0.7 + 0.5 * Math.sin(a * 2); bounce(0.08); P[HX] = 0.1;
      break; }
    case 'clap': {
      const c2 = Math.floor(t) % 2 === 1 ? pulse : 0;
      P[ALP] = P[ARP] = -1.5; P[ALE] = P[ARE] = 0.9; P[ALR] = P[ARR] = -0.25 + 0.35 * (1 - c2) * (1 - pulse);
      bounce(0.1); P[HX] -= 0.1;
      if (A.section === 'BUILDUP' && A.buildProgress > 0.5) { P[ALP] = P[ARP] = -2.6; }
      break; }
    case 'phone':
      P[ARP] = -2.3; P[ARE] = 0.5; P[ARR] = 0.05; P[HX] = -0.25;
      P[ALP] = -0.4; P[ALE] = 1.2; bounce(0.06);
      break;
    case 'singalong':
      P[ARP] = -1.9 - 0.25 * pulse; P[ARE] = 0.1; P[ARR] = 0.05; P[HX] = -0.3 + 0.1 * w1;
      P[ALP] = -0.9; P[ALE] = 2.1; P[ALR] = -0.3; bounce(0.1); P[LZ] = 0.08 * Math.sin(Math.PI * t * 0.5);
      break;
    case 'crouch': {
      const d = 0.6 + 0.5 * clamp(A.buildProgress, 0, 1);
      P[CR] = d; P[LX] = 0.25; P[HX] = -0.5;
      P[ALP] = P[ARP] = -0.8; P[ALE] = P[ARE] = 0.4; P[ALR] = P[ARR] = 0.2;
      P[Y] = 0.01 * Math.sin(time * 30) * A.buildProgress; // trembling anticipation
      break; }
    case 'chat': {
      const talk = Math.sin(time * 2.2 + p.id) > 0.6;
      P[HX] = 0.05 + 0.08 * Math.sin(time * 3 + p.id); P[HY] = 0.15 * Math.sin(time * 0.7 + p.id);
      P[ARP] = talk ? -0.9 : -0.2; P[ARE] = talk ? 1.4 + 0.3 * Math.sin(time * 6) : 0.4; P[ALP] = -0.15; P[ALE] = 0.4;
      P[LZ] = 0.04 * Math.sin(Math.PI * t * 0.5); P[CR] = 0.04 * w1;
      break; }
    case 'rest':
      P[CR] = 0.25; P[LX] = 0.55; P[ALP] = P[ARP] = -0.7; P[ALE] = P[ARE] = 0.2; P[HX] = -0.3;
      P[Y] = 0.01 * Math.sin(time * 4);
      break;
    case 'couple': {
      const sw = Math.sin(Math.PI * t * 0.5);
      P[ALP] = P[ARP] = -1.25; P[ALR] = P[ARR] = -0.15; P[ALE] = P[ARE] = 0.8;
      P[LZ] = 0.12 * sw; P[DX] = 0.05 * sw; bounce(0.06); P[HZ] = 0.15;
      break; }
    case 'hug':
      P[ALP] = P[ARP] = -1.45; P[ALR] = P[ARR] = -0.55; P[ALE] = P[ARE] = 1.5; P[HZ] = 0.3; P[LX] = 0.1;
      P[LZ] = 0.06 * Math.sin(time * 2);
      break;
    case 'walk': {
      const a = Math.sin(time * 7 + p.id);
      P[LLP] = -0.45 * a; P[LRP] = 0.45 * a; P[LLK] = 0.5 * Math.max(0, -a); P[LRK] = 0.5 * Math.max(0, a);
      P[ALP] = 0.35 * a; P[ARP] = -0.35 * a; P[ALE] = P[ARE] = 0.3; P[Y] = 0.02 * Math.abs(a);
      break; }
    case 'surf':
      P[LIE] = 1; P[ALP] = P[ARP] = -1.6; P[ALR] = P[ARR] = 1.0 + 0.3 * Math.sin(time * 2); P[ALE] = P[ARE] = 0.2;
      P[LLR] = P[LRR] = 0.2; P[Y] = 0.08 * Math.sin(time * 3);
      break;
    case 'ride': {
      P[LLP] = P[LRP] = -1.4; P[LLR] = P[LRR] = 0.45; P[LLK] = P[LRK] = 1.5;
      P[ALP] = P[ARP] = -2.7; P[ALR] = P[ARR] = 0.35 + 0.25 * Math.sin(Math.PI * t); P[ALE] = P[ARE] = 0.2;
      P[LZ] = 0.08 * Math.sin(Math.PI * t); P[HX] = -0.2; P[Y] = 0.03 * w1;
      break; }
    case 'carry':
      P[ALP] = P[ARP] = -1.6; P[ALR] = P[ARR] = 0.45; P[ALE] = P[ARE] = 1.2; P[CR] = 0.08 + 0.05 * w1; P[HX] = -0.15;
      break;
    case 'drink': {
      const sip = Math.max(0, Math.sin(time * 0.9 + p.id)) > 0.8;
      P[ALP] = sip ? -1.6 : -0.6; P[ALE] = sip ? 2.3 : 1.4; P[HX] = sip ? -0.25 : 0.05;
      bounce(0.07); P[ARP] = -0.3; P[ARE] = 0.6;
      break; }
    default:
      bounce(0.1);
  }
  // individuality: amplitude & sloppiness
  const slop = (1 - p.traits.rhythm) * 0.08;
  P[HZ] += slop * Math.sin(time * 1.3 + p.id);
  P[LZ] += slop * 0.5 * Math.sin(time * 0.9 + p.id * 2);
}
