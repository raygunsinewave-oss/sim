// Demo DJ: a procedural Web Audio DJ set that moves through genres with intros, breakdowns, build-ups and drops.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export const DEMO_TRACKS = [
  { title: 'Neon Pulse', genre: 'House', bpm: 124, root: 45, style: 'house', prog: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']] },
  { title: 'Concrete Cathedral', genre: 'Techno', bpm: 132, root: 43, style: 'techno', prog: [[0, 'm'], [0, 'm'], [-2, 'M'], [0, 'm']] },
  { title: 'Starlight Overdrive', genre: 'Trance', bpm: 138, root: 46, style: 'trance', prog: [[0, 'm'], [-4, 'M'], [-7, 'M'], [-2, 'M']] },
  { title: 'Gravity Well', genre: 'Dubstep', bpm: 140, root: 41, style: 'dubstep', prog: [[0, 'm'], [1, 'M'], [-2, 'M'], [0, 'm']] },
  { title: 'Amen Velocity', genre: 'Drum & Bass', bpm: 174, root: 42, style: 'dnb', prog: [[0, 'm'], [-4, 'M'], [-5, 'm'], [-2, 'M']] },
  { title: 'Mirrorball Fever', genre: 'Disco/Funk', bpm: 118, root: 48, style: 'disco', prog: [[0, 'm7'], [5, 'M'], [3, 'M'], [-2, 'M']] },
  { title: 'Hard Reset', genre: 'Hardstyle', bpm: 150, root: 44, style: 'hardstyle', prog: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']] },
  { title: 'Late Night Bounce', genre: 'Hip-Hop/Trap', bpm: 92, root: 41, style: 'hiphop', prog: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-5, 'm']] },
  { title: 'Sunset Groove', genre: 'Tech House', bpm: 126, root: 45, style: 'techhouse', prog: [[0, 'm'], [0, 'm'], [-4, 'M'], [-2, 'M']] }
];

// bars per section
const LAYOUT = [['INTRO', 8], ['GROOVE', 16], ['BREAKDOWN', 8], ['BUILDUP', 8], ['DROP', 16], ['GROOVE', 8], ['OUTRO', 8]];
const TOTAL_BARS = LAYOUT.reduce((a, b) => a + b[1], 0);

function sectionAt(bar) {
  let acc = 0;
  for (const [name, len] of LAYOUT) {
    if (bar < acc + len) return { name, start: acc, len, pos: bar - acc };
    acc += len;
  }
  return { name: 'OUTRO', start: TOTAL_BARS - 8, len: 8, pos: 7 };
}

function chordNotes(root, [off, q]) {
  const r = root + 12 + off;
  if (q === 'm') return [r, r + 3, r + 7];
  if (q === 'm7') return [r, r + 3, r + 7, r + 10];
  return [r, r + 4, r + 7];
}

export class DemoDJ {
  constructor(ctx, output) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.attack.value = 0.003; this.comp.release.value = 0.15;
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 20000; this.filter.Q.value = 0.8;
    this.drums = ctx.createGain(); this.music = ctx.createGain(); this.music.gain.value = 0.7;
    this.drums.connect(this.comp); this.music.connect(this.filter); this.filter.connect(this.comp);
    this.comp.connect(this.out); this.out.connect(output);
    // noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // distortion curve for hardstyle kick
    this.distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; this.distCurve[i] = Math.tanh(x * 6); }
    this.running = false;
    this.trackIndex = 0;
    this.timer = null;
    this.onTrackChange = null;
  }

  get track() { return DEMO_TRACKS[this.trackIndex % DEMO_TRACKS.length]; }

  start(index = this.trackIndex) {
    this.stop();
    this.running = true;
    this.trackIndex = index;
    this._beginTrack(this.ctx.currentTime + 0.1);
    this.timer = setInterval(() => this._schedule(), 25);
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  next() { this.start((this.trackIndex + 1) % DEMO_TRACKS.length); }

  _beginTrack(t) {
    this.trackStart = t;
    this.step = 0;
    this.nextTime = t;
    this.stepDur = 60 / this.track.bpm / 4;
    if (this.onTrackChange) this.onTrackChange({ title: this.track.title, artist: 'Raygun Demo DJ', genre: this.track.genre, bpm: this.track.bpm });
  }

  // Ground-truth timing info used as an analysis hint
  info() {
    const t = this.ctx.currentTime - (this.ctx.outputLatency || 0) - (this.ctx.baseLatency || 0);
    const beats = Math.max(0, (t - this.trackStart) * this.track.bpm / 60);
    const bar = Math.floor(beats / 4);
    const sec = sectionAt(bar);
    return { bpm: this.track.bpm, beats, bar, section: sec.name, sectionPos: (sec.pos + (beats / 4 - bar)) / sec.len, genre: this.track.genre, title: this.track.title };
  }

  _schedule() {
    if (!this.running) return;
    const ahead = this.ctx.currentTime + 0.12;
    while (this.nextTime < ahead) {
      const bar = Math.floor(this.step / 16);
      if (bar >= TOTAL_BARS) {
        this.trackIndex = (this.trackIndex + 1) % DEMO_TRACKS.length;
        this._beginTrack(this.nextTime);
        continue;
      }
      try { this._playStep(this.step, this.nextTime); } catch (e) { console.warn('demo step', e); }
      this.step++;
      this.nextTime += this.stepDur;
    }
  }

  _playStep(step, t) {
    const T = this.track, st = T.style;
    const bar = Math.floor(step / 16), s = step % 16;
    const sec = sectionAt(bar);
    const S = sec.name;
    const chord = T.prog[Math.floor(bar / 2) % T.prog.length];
    const beatDur = 60 / T.bpm;
    const lastBarOfBuild = S === 'BUILDUP' && sec.pos === sec.len - 1;
    const introFade = S === 'INTRO' ? sec.pos / sec.len : 1;

    // master filter automation per bar
    if (s === 0) {
      const f = this.filter.frequency;
      if (S === 'INTRO') f.setTargetAtTime(600 + 19000 * Math.pow(sec.pos / sec.len, 2), t, 0.5);
      else if (S === 'BUILDUP') f.setTargetAtTime(800 + 19000 * Math.pow((sec.pos + 1) / sec.len, 2), t, 0.4);
      else if (S === 'BREAKDOWN') f.setTargetAtTime(2500, t, 0.5);
      else if (S === 'OUTRO') f.setTargetAtTime(20000 - 18500 * (sec.pos / sec.len), t, 0.5);
      else f.setTargetAtTime(20000, t, 0.1);
      if (S === 'DROP' && sec.pos === 0) { this.impact(t); this.crash(t); }
      if (S === 'BUILDUP' && sec.pos === 0) this.riser(t, sec.len * 4 * beatDur);
      if (S === 'GROOVE' && sec.pos === 0 && bar > 0) this.crash(t);
    }

    const drumsOn = S !== 'BREAKDOWN' && !(lastBarOfBuild && s >= 12);
    const kickOn = drumsOn && !(S === 'BUILDUP' && sec.pos >= 6) && !(S === 'INTRO' && sec.pos < 1);
    const bassOn = S === 'GROOVE' || S === 'DROP' || (S === 'OUTRO' && sec.pos < 4) || (S === 'INTRO' && sec.pos >= 6);
    const leadOn = S === 'DROP' || S === 'BREAKDOWN';
    const big = S === 'DROP' ? 1 : 0.75;

    // ---- drums by style
    const four = s % 4 === 0;
    if (st === 'house' || st === 'techhouse' || st === 'disco') {
      if (kickOn && four) this.kick(t, 1 * big);
      if (drumsOn && (s === 4 || s === 12) && S !== 'INTRO') this.clap(t, 0.8);
      if (drumsOn && s % 4 === 2) this.hat(t, true, 0.35 * introFade);
      if (drumsOn && st === 'techhouse' && s % 2 === 1) this.hat(t, false, 0.18);
      if (drumsOn && st === 'disco' && s % 2 === 1) this.hat(t, false, 0.15);
    } else if (st === 'techno') {
      if (kickOn && four) this.kick(t, 1.05);
      if (drumsOn) this.hat(t, false, s % 4 === 2 ? 0.3 : 0.12);
      if (drumsOn && S !== 'INTRO' && (s === 4 || s === 12) && bar % 2 === 1) this.clap(t, 0.5);
      if (bassOn && !four) this.bass(t, mtof(T.root - 12), this.stepDur * 0.9, 'rumble', 0.35);
    } else if (st === 'trance') {
      if (kickOn && four) this.kick(t, 1);
      if (drumsOn && s % 4 === 2) this.hat(t, true, 0.3);
      if (drumsOn && (s === 4 || s === 12) && S !== 'INTRO') this.clap(t, 0.6);
      if (bassOn && !four) this.bass(t, mtof(chordNotes(T.root - 12, chord)[0]), this.stepDur * 0.8, 'saw', 0.4);
    } else if (st === 'dubstep') {
      if (kickOn && (s === 0 || (s === 10 && bar % 2 === 1))) this.kick(t, 1.1);
      if (drumsOn && s === 8) this.snare(t, 1);
      if (drumsOn && s % 2 === 0) this.hat(t, false, 0.15);
    } else if (st === 'dnb') {
      if (kickOn && (s === 0 || s === 10)) this.kick(t, 1);
      if (drumsOn && (s === 4 || s === 12)) this.snare(t, 0.9);
      if (drumsOn && s % 2 === 0) this.hat(t, false, 0.2);
      if (drumsOn && (s === 7 || s === 15) && bar % 2) this.snare(t, 0.25);
    } else if (st === 'hardstyle') {
      if (kickOn && four) this.kick(t, 1.2, true);
      if (drumsOn && s % 4 === 2) this.hat(t, true, 0.3);
      if (drumsOn && (s === 4 || s === 12) && S !== 'INTRO') this.clap(t, 0.6);
    } else if (st === 'hiphop') {
      if (kickOn && (s === 0 || s === 7 || s === 10)) { this.kick(t, 1); if (bassOn) this.bass(t, mtof(chordNotes(T.root - 12, chord)[0]), beatDur * 1.5, '808', 0.6); }
      if (drumsOn && (s === 4 || s === 12)) this.snare(t, 0.9);
      if (drumsOn && (s % 2 === 0 || (bar % 4 === 3 && s > 11))) this.hat(t, false, 0.2);
    }

    // ---- build-up snare roll
    if (S === 'BUILDUP') {
      const p = sec.pos;
      const div = p < 2 ? 4 : p < 4 ? 2 : p < 6 ? 1 : 1;
      if (!(lastBarOfBuild && s >= 12) && s % div === 0) this.snare(t, 0.25 + 0.6 * (p / sec.len));
      if (p >= 6 && !(lastBarOfBuild && s >= 12)) this.snare(t + this.stepDur / 2, 0.5);
    }

    // ---- bass lines
    const notes = chordNotes(T.root, chord);
    if (bassOn) {
      if (st === 'house' || st === 'techhouse') { if (s % 4 === 2) this.bass(t, mtof(notes[0] - 24), this.stepDur * 1.6, 'saw', 0.5); if (st === 'techhouse' && s === 15) this.bass(t, mtof(notes[0] - 12), this.stepDur, 'saw', 0.4); }
      if (st === 'disco' && s % 2 === 0) this.bass(t, mtof(notes[0] - 24 + (s % 4 === 2 ? 12 : 0)), this.stepDur * 1.5, 'saw', 0.45);
      if (st === 'dubstep' && S === 'DROP') { if (s % 4 === 0) this.wobble(t, mtof(notes[0] - 24), beatDur, bar % 2 ? 3 : 1.5, 0.55); }
      else if (st === 'dubstep' && s === 0) this.bass(t, mtof(notes[0] - 24), beatDur * 3, 'sub', 0.6);
      if (st === 'dnb' && (s === 0 || s === 10)) this.reese(t, mtof(notes[0] - 24), beatDur * (s === 0 ? 2.4 : 1.4), 0.5);
      if (st === 'hardstyle' && S === 'DROP' && s % 4 === 2) this.lead(t, notes.map((n) => mtof(n + 12)), this.stepDur * 1.8, 0.28, 'screech');
    }

    // ---- chords / leads
    if (S === 'BREAKDOWN' && s === 0 && sec.pos % 2 === 0) this.pad(t, notes.map((n) => mtof(n)), beatDur * 8, 0.25);
    if (S === 'BUILDUP' && s === 0 && sec.pos % 2 === 0) this.pad(t, notes.map((n) => mtof(n)), beatDur * 8, 0.18);
    if (leadOn) {
      if (st === 'trance' && s % 2 === 0) {
        const arp = [notes[0], notes[1], notes[2], notes[1] + 12][(s / 2) % 4];
        this.lead(t, [mtof(arp + 12)], this.stepDur * 1.8, S === 'DROP' ? 0.22 : 0.12, 'supersaw');
      } else if ((st === 'house' || st === 'techhouse') && (s === 3 || s === 10) ) {
        this.lead(t, notes.map((n) => mtof(n + 12)), this.stepDur * 1.5, 0.22, 'stab');
      } else if (st === 'disco' && (s === 2 || s === 6 || s === 10 || s === 14)) {
        this.lead(t, notes.map((n) => mtof(n + 12)), this.stepDur * 1.2, 0.18, 'stab');
      } else if (st === 'techno' && s === 6 && bar % 2 === 0) {
        this.lead(t, [mtof(notes[0] + 12), mtof(notes[0] + 19)], this.stepDur * 2, 0.2, 'stab');
      } else if (st === 'dnb' && S === 'DROP' && s % 8 === 0) {
        this.lead(t, notes.map((n) => mtof(n + 12)), this.stepDur * 3, 0.15, 'supersaw');
      } else if (st === 'hiphop' && s % 8 === 0) {
        this.lead(t, notes.map((n) => mtof(n + 12)), beatDur * 1.5, 0.12, 'keys');
      } else if (st === 'hardstyle' && S === 'BREAKDOWN' && s % 4 === 0) {
        this.lead(t, [mtof(notes[(s / 4) % 3] + 12)], beatDur * 0.9, 0.16, 'supersaw');
      } else if (st === 'dubstep' && S === 'BREAKDOWN' && s % 8 === 0) {
        this.lead(t, [mtof(notes[(s / 8) % 3] + 24)], beatDur * 1.5, 0.1, 'keys');
      }
    }
  }

  // ---------------- instruments ----------------
  _env(g, t, a, peak, d) {
    peak = Math.max(peak, 0.0002);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  kick(t, vol = 1, hard = false) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(hard ? 220 : 150, t);
    o.frequency.exponentialRampToValueAtTime(hard ? 52 : 44, t + (hard ? 0.16 : 0.1));
    this._env(g, t, 0.002, vol, hard ? 0.45 : 0.32);
    if (hard) {
      const ws = c.createWaveShaper(); ws.curve = this.distCurve;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
      o.connect(ws); ws.connect(lp); lp.connect(g);
    } else o.connect(g);
    g.connect(this.drums);
    o.start(t); o.stop(t + 0.6);
  }

  _noise(t, dur, type, freq, q, vol, a = 0.001) {
    const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    this._env(g, t, a, vol, dur);
    src.connect(f); f.connect(g); g.connect(this.drums);
    src.start(t, Math.random() * 1.5); src.stop(t + a + dur + 0.05);
  }

  clap(t, vol) { for (let i = 0; i < 3; i++) this._noise(t + i * 0.011, i === 2 ? 0.18 : 0.02, 'bandpass', 1400, 1.2, vol * 0.9); }
  snare(t, vol) {
    this._noise(t, 0.16, 'bandpass', 1900, 0.8, vol * 0.8);
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    this._env(g, t, 0.001, vol * 0.4, 0.1); o.connect(g); g.connect(this.drums); o.start(t); o.stop(t + 0.2);
  }
  hat(t, open, vol) { this._noise(t, open ? 0.16 : 0.035, 'highpass', open ? 7000 : 8500, 0.7, vol); }
  crash(t) { this._noise(t, 1.8, 'highpass', 5000, 0.5, 0.35, 0.005); }
  impact(t) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    this._env(g, t, 0.005, 0.9, 1.4); o.connect(g); g.connect(this.drums); o.start(t); o.stop(t + 1.6);
    this._noise(t, 0.9, 'lowpass', 1200, 0.5, 0.5, 0.003);
  }
  riser(t, dur) {
    const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; src.loop = true; f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.97); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.music); src.start(t); src.stop(t + dur + 0.05);
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + dur);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.07, t + dur * 0.97); og.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(og); og.connect(this.music); o.start(t); o.stop(t + dur + 0.05);
  }

  bass(t, freq, dur, type, vol) {
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    if (type === '808' || type === 'sub') {
      o.type = 'sine'; o.frequency.setValueAtTime(freq * (type === '808' ? 1.5 : 1), t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
      f.type = 'lowpass'; f.frequency.value = 400;
    } else {
      o.type = 'sawtooth'; o.frequency.value = freq;
      f.type = 'lowpass'; f.Q.value = type === 'rumble' ? 2 : 6;
      f.frequency.setValueAtTime(type === 'rumble' ? 260 : 1400, t); f.frequency.exponentialRampToValueAtTime(type === 'rumble' ? 90 : 180, t + dur);
    }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.15);
    o.connect(f); f.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.3);
  }

  wobble(t, freq, dur, rate, vol) {
    const c = this.ctx, o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    const lfo = c.createOscillator(), lg = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = freq; o2.frequency.value = freq * 1.005;
    f.type = 'lowpass'; f.Q.value = 8; f.frequency.value = 600;
    lfo.frequency.value = rate * this.track.bpm / 60; lg.gain.value = 550;
    lfo.connect(lg); lg.connect(f.frequency);
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.95); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.music);
    [o1, o2, lfo].forEach((o) => { o.start(t); o.stop(t + dur + 0.02); });
  }

  reese(t, freq, dur, vol) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(250, t + dur); f.Q.value = 3;
    g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(0.0001, t + dur * 0.8, dur * 0.1);
    for (const det of [-12, 12]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.3); }
    f.connect(g); g.connect(this.music);
  }

  pad(t, freqs, dur, vol) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    for (const fr of freqs) for (const det of [-8, 8]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.05); }
    f.connect(g); g.connect(this.music);
  }

  lead(t, freqs, dur, vol, kind) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(kind === 'stab' ? 3500 : kind === 'screech' ? 6000 : kind === 'keys' ? 2200 : 5000, t);
    f.frequency.exponentialRampToValueAtTime(kind === 'stab' ? 600 : 1500, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.2);
    const dets = kind === 'supersaw' ? [-18, -7, 0, 7, 18] : kind === 'screech' ? [-25, 25] : kind === 'keys' ? [0] : [-6, 6];
    for (const fr of freqs) for (const det of dets) {
      const o = c.createOscillator(); o.type = kind === 'keys' ? 'triangle' : kind === 'screech' ? 'square' : 'sawtooth';
      o.frequency.value = fr; o.detune.value = det;
      if (kind === 'screech') { o.frequency.setValueAtTime(fr * 1.06, t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.06); }
      o.connect(f); o.start(t); o.stop(t + dur + 0.4);
    }
    f.connect(g); g.connect(this.music);
  }
}
