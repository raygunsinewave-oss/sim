// Real-time music analysis: bands, onsets, tempo, beat phase, song sections, drops, genre and energy.
import { clamp, smooth } from './util.js';
import { GENRES } from './personas.js';

const BAND_EDGES = [20, 60, 250, 500, 2000, 4000, 6500, 18000];
export const BAND_NAMES = ['sub', 'bass', 'lowmid', 'mid', 'highmid', 'presence', 'air'];

export class Analyzer {
  constructor(engine) {
    this.engine = engine;
    this.an = engine.analyser;
    const n = this.an.frequencyBinCount;
    this.fft = new Uint8Array(n);
    this.prev = new Float32Array(n);
    this.wave = new Uint8Array(this.an.fftSize);
    this.fftSmall = new Uint8Array(256); // for shaders
    this.waveSmall = new Uint8Array(256);
    const binHz = engine.ctx.sampleRate / this.an.fftSize;
    this.bandBins = [];
    for (let i = 0; i < 7; i++) this.bandBins.push([Math.max(1, Math.floor(BAND_EDGES[i] / binHz)), Math.max(2, Math.ceil(BAND_EDGES[i + 1] / binHz))]);
    this.lowBins = Math.ceil(150 / binHz);
    this.midA = Math.floor(1000 / binHz); this.midB = Math.ceil(5000 / binHz);
    this.binHz = binHz;
    this.bandRaw = new Float32Array(7);
    this.bandLin = new Float32Array(7);
    this._minDb = this.an.minDecibels; this._rangeDb = this.an.maxDecibels - this.an.minDecibels;
    this.bandMax = new Float32Array(7).fill(0.05);
    this.bands = new Float32Array(7);
    this.bandsSlow = new Float32Array(7);
    // outputs
    this.bass = 0; this.mid = 0; this.high = 0; this.level = 0; this.rms = 0;
    this.kick = 0; this.snare = 0; this.hat = 0; this.onset = false;
    this.bpm = 124; this.bpmConf = 0;
    this.beats = 0; this.beatPhase = 0; this.bar = 0; this.barPhase = 0; this.phrase = 0; this.beat = false; this.downbeat = false;
    this.section = 'INTRO'; this.sectionTime = 0; this.buildProgress = 0;
    this.drop = false; this.dropIntensity = 0; this.dropTime = -100; this.sinceDrop = 100;
    this.genre = 'House'; this.genreConf = 0; this.genreScores = Object.fromEntries(GENRES.map((g) => [g, 0]));
    this.energy = 3; this.hype = 0.3; this.centroid = 0; this.flatness = 0; this.silent = true;
    this.time = 0;
    this.latency = 0;
    this.sensitivity = 1;
    // internals
    this._env = new Float32Array(800); this._envIdx = 0; this._envAcc = 0; this._envT = 0;
    this._fluxHist = []; this._lowFluxHist = []; this._midFluxHist = []; this._hiFluxHist = [];
    this._lastOnset = 0; this._lastKick = 0; this._lastSnare = 0; this._lastHat = 0;
    this._bpmHist = []; this._tempoT = 0;
    this._bassFast = 0; this._bassSlow = 0; this._bassRef = 0.05; this._hiFast = 0; this._hiSlow = 0; this._levelSlow = 0; this._levelMax = 0.05;
    this._gapT = 0; this._buildT = 0; this._onsetRate = 0; this._kickRate = 0; this._hatRate = 0;
    this._prevBeatInt = 0;
    this._hintSection = null;
    this.events = [];
    // audio-thread envelope (preferred)
    this._wEnv = new Float32Array(2048); this._wIdx = 0; this._wCount = 0; this._wRate = 172; this._wLastT = 0;
    engine.onsetListeners.push((d) => {
      this._wRate = d.rate;
      for (let i = 0; i < d.v.length; i++) { this._wEnv[this._wIdx] = d.v[i]; this._wIdx = (this._wIdx + 1) % this._wEnv.length; this._wCount++; }
      this._wLastT = d.t;
    });
  }

  reset() { this.section = 'INTRO'; this.sectionTime = 0; this._gapT = 0; this._buildT = 0; this._bpmHist = []; this._bassRef = 0.05; this.genreScores = Object.fromEntries(GENRES.map((g) => [g, 0])); }

  update(dt, hint) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.events.length = 0;
    const an = this.an;
    an.getByteFrequencyData(this.fft);
    an.getByteTimeDomainData(this.wave);
    const fft = this.fft, n = fft.length;

    // downsample for shaders (log-ish mapping)
    for (let i = 0; i < 256; i++) {
      const a = Math.floor(Math.pow(i / 256, 1.7) * (n * 0.7)) + 1;
      const b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / 256, 1.7) * (n * 0.7)) + 1);
      let m = 0; for (let k = a; k < b; k++) if (fft[k] > m) m = fft[k];
      this.fftSmall[i] = m;
      this.waveSmall[i] = this.wave[i * 4];
    }

    // RMS
    let sum = 0;
    for (let i = 0; i < this.wave.length; i++) { const v = (this.wave[i] - 128) / 128; sum += v * v; }
    this.rms = Math.sqrt(sum / this.wave.length);
    this._levelMax = Math.max(this.rms, this._levelMax * Math.exp(-dt / 30), 0.02);
    const levelNorm = clamp(this.rms / this._levelMax, 0, 1.2);
    this.level = smooth(this.level, levelNorm, 12, dt);
    this.silent = this.rms < 0.0015;

    // bands
    for (let b = 0; b < 7; b++) {
      const [a, c] = this.bandBins[b];
      let s = 0, lin = 0; for (let k = a; k < c && k < n; k++) { const v = fft[k] / 255; s += v * v; lin += Math.pow(10, (this._minDb + v * this._rangeDb) / 10); }
      const v = s / Math.max(1, c - a);
      this.bandRaw[b] = v;
      this.bandLin[b] = lin / Math.max(1, c - a);
      this.bandMax[b] = Math.max(v, this.bandMax[b] * Math.exp(-dt / 20), 0.01);
      const norm = clamp(v / this.bandMax[b], 0, 1);
      this.bands[b] = norm > this.bands[b] ? norm : smooth(this.bands[b], norm, 10, dt);
      this.bandsSlow[b] = smooth(this.bandsSlow[b], norm, 1.5, dt);
    }
    this.bass = Math.max(this.bands[0] * 0.8, this.bands[1]);
    this.mid = (this.bands[2] + this.bands[3]) * 0.5;
    this.high = (this.bands[4] + this.bands[5] + this.bands[6]) / 3;

    // spectral centroid / flatness
    let wsum = 0, msum = 0, lsum = 0, cnt = 0;
    for (let k = 2; k < n * 0.8; k++) { const m = fft[k] / 255 + 1e-4; wsum += k * m; msum += m; lsum += Math.log(m); cnt++; }
    this.centroid = smooth(this.centroid, (wsum / msum) * this.binHz, 3, dt);
    this.flatness = smooth(this.flatness, Math.exp(lsum / cnt) / (msum / cnt), 3, dt);

    // spectral flux (overall, low, mid, high)
    let flux = 0, low = 0, mid = 0, hi = 0;
    const hiA = Math.floor(7000 / this.binHz);
    for (let k = 1; k < n; k++) {
      const v = fft[k] / 255;
      const d = v - this.prev[k];
      if (d > 0) {
        flux += d;
        if (k <= this.lowBins) low += d * 2;
        else if (k >= this.midA && k <= this.midB) mid += d;
        else if (k >= hiA) hi += d;
      }
      this.prev[k] = v;
    }
    const sens = this.sensitivity;
    const isOn = (hist, v, k, minGap, last) => {
      hist.push(v); if (hist.length > 45) hist.shift();
      let m = 0; for (const x of hist) m += x; m /= hist.length;
      let sd = 0; for (const x of hist) sd += (x - m) * (x - m); sd = Math.sqrt(sd / hist.length);
      return v > m + k * sd / sens && v > m * 1.15 && this.time - last > minGap && !this.silent;
    };
    this.onset = isOn(this._fluxHist, flux, 1.5, 0.09, this._lastOnset);
    if (this.onset) this._lastOnset = this.time;
    const kickHit = isOn(this._lowFluxHist, low, 1.3, 0.18, this._lastKick);
    if (kickHit) { this._lastKick = this.time; this.kick = 1; }
    const snareHit = isOn(this._midFluxHist, mid, 1.6, 0.12, this._lastSnare);
    if (snareHit) { this._lastSnare = this.time; this.snare = 1; }
    const hatHit = isOn(this._hiFluxHist, hi, 1.4, 0.06, this._lastHat);
    if (hatHit) { this._lastHat = this.time; this.hat = 1; }
    this.kick *= Math.exp(-dt * 9); this.snare *= Math.exp(-dt * 8); this.hat *= Math.exp(-dt * 14);
    this._onsetRate = smooth(this._onsetRate, this.onset ? 1 / dt : 0, 0.5, dt);
    this._kickRate = smooth(this._kickRate, kickHit ? 1 / dt : 0, 0.3, dt);
    this._hatRate = smooth(this._hatRate, hatHit ? 1 / dt : 0, 0.3, dt);
    this._snareRate = smooth(this._snareRate || 0, snareHit ? 1 / dt : 0, 0.6, dt);

    // ---------- tempo ----------
    if (hint) {
      this.bpm = hint.bpm; this.bpmConf = 1;
      const prevBeats = this.beats;
      this.beats = hint.beats;
      if (this.beats < prevBeats - 1) this._prevBeatInt = Math.floor(this.beats) - 1; // new track
    } else {
      const useW = this.engine.workletReady && this._wCount > 400;
      if (!useW) {
        // fallback: onset envelope at 100 Hz from frames
        const envV = flux + low * 0.5;
        this._envAcc += dt;
        while (this._envAcc >= 0.01) { this._env[this._envIdx] = envV; this._envIdx = (this._envIdx + 1) % this._env.length; this._envAcc -= 0.01; }
      }
      this._tempoT += dt;
      if (this._tempoT > 0.5) { this._tempoT = 0; if (useW) this._estimateTempoW(); else this._estimateTempo(); }
      // beat clock
      this.beats += dt * this.bpm / 60;
      if (useW && this._phaseRef != null) {
        // lock phase to the comb-filter estimate measured on the audio thread
        const now = this.engine.ctx.currentTime;
        const ph = (((now - this._phaseRef) * this.bpm / 60) % 1 + 1) % 1;
        let err = ph - (this.beats - Math.floor(this.beats));
        if (err > 0.5) err -= 1; if (err < -0.5) err += 1;
        this.beats += err * Math.min(1, dt * 4);
      } else if (kickHit || (this.onset && this.time - this._lastKick > 1.5)) {
        const frac = this.beats - Math.round(this.beats);
        if (Math.abs(frac) < 0.3) this.beats -= frac * (kickHit ? 0.25 : 0.1);
      }
    }
    const latBeats = this.latency * this.bpm / 60;
    const b = this.beats - latBeats;
    const bi = Math.floor(b);
    this.beat = bi > this._prevBeatInt;
    this._prevBeatInt = bi;
    this.beatPhase = b - bi;
    this.bar = Math.floor(b / 4);
    this.barPhase = (b / 4) - this.bar;
    this.downbeat = this.beat && bi % 4 === 0;
    this.phrase = ((b / 32) % 1 + 1) % 1;
    if (this.beat) this.events.push('beat');
    if (this.downbeat) this.events.push('bar');
    if (this.beat && bi % 32 === 0) this.events.push('phrase');

    // ---------- sections ----------
    const bassLin = Math.sqrt(this.bandLin[0] + this.bandLin[1]) * 1000, hiLin = Math.sqrt(this.bandLin[4] + this.bandLin[5] + this.bandLin[6]) * 1000;
    this._bassFast = smooth(this._bassFast, bassLin, 4, dt);
    this._bassSlow = smooth(this._bassSlow, bassLin, 0.12, dt);
    this._hiFast = smooth(this._hiFast, hiLin, 1.2, dt);
    this._hiSlow = smooth(this._hiSlow, hiLin, 0.15, dt);
    this._levelSlow = smooth(this._levelSlow, this.rms, 0.2, dt);
    const prevSection = this.section;
    this.sectionTime += dt;
    this.sinceDrop = this.time - this.dropTime;

    if (hint) {
      if (hint.section !== this._hintSection) {
        const was = this._hintSection;
        this._hintSection = hint.section;
        this.section = hint.section; this.sectionTime = 0;
        if (hint.section === 'DROP' && was !== '__forced') this._fireDrop(was === 'BUILDUP' ? 1 : 0.7);
      }
      this.buildProgress = hint.section === 'BUILDUP' ? clamp(hint.sectionPos, 0, 1) : 0;
    } else {
      if (this.section !== 'BREAKDOWN' && this.section !== 'BUILDUP') this._bassRef = Math.max(this._bassRef * Math.exp(-dt / 40), this._bassFast * 0.95, 0.05);
      const bassRatio = this._bassFast / Math.max(this._bassRef, 1e-3);
      if (bassRatio < 0.38 && !this.silent) this._gapT += dt; else if (bassRatio > 0.6) this._gapT = Math.max(0, this._gapT - dt * 3);
      switch (this.section) {
        case 'INTRO':
          if (bassRatio > 0.55 && this.sectionTime > 4 && this.level > 0.3) this._setSection('GROOVE');
          break;
        case 'GROOVE':
        case 'DROP':
          if (this.section === 'DROP' && this.sectionTime > 32 * 60 / this.bpm) this._setSection('GROOVE');
          if (this._gapT > 1.2) this._setSection('BREAKDOWN');
          break;
        case 'BREAKDOWN':
          if (this._hiFast > this._hiSlow * 1.2 && (this._snareRate > 2 || this._onsetRate > 3) && this.sectionTime > 2) this._setSection('BUILDUP');
          if (bassRatio > 0.75 && this._gapT < 0.4) this._fireDrop(clamp(this.sectionTime / 12, 0.4, 0.8));
          break;
        case 'BUILDUP':
          this._buildT += dt;
          if (bassRatio > 0.72) this._fireDrop(clamp(0.6 + this._buildT / 20, 0.6, 1));
          if (this.sectionTime > 40) this._setSection('GROOVE');
          break;
      }
      this.buildProgress = this.section === 'BUILDUP' ? clamp(this.sectionTime / 16, 0, 1) : 0;
      if (this.silent && this._levelSlow < 0.003 && this.section !== 'INTRO' && this.sectionTime > 3) this._setSection('INTRO');
    }
    if (this.section !== prevSection) this.events.push('section');
    this.drop = this.events.includes('drop');

    // ---------- genre ----------
    if (hint && hint.genre) {
      this.genre = hint.genre; this.genreConf = 1;
    } else this._classify(dt);

    // ---------- energy / hype ----------
    const secBoost = { INTRO: -1.5, GROOVE: 0, BREAKDOWN: -2.5, BUILDUP: 0.5, DROP: 2.5, OUTRO: -1.5 }[this.section] || 0;
    const e = clamp(2 + this.level * 4 + this.bandsSlow[1] * 2 + Math.min(this._onsetRate, 6) * 0.25 + secBoost + (this.sinceDrop < 8 ? 2 : 0), 0, 10);
    this.energy = smooth(this.energy, this.silent ? 0 : e, 1.5, dt);
    this.hype = smooth(this.hype, this.energy / 10, this.energy / 10 > this.hype ? 0.5 : 0.08, dt);
    return this;
  }

  _setSection(s) { if (this.section !== s) { this.section = s; this.sectionTime = 0; if (s === 'BUILDUP') this._buildT = 0; } }

  _fireDrop(intensity) {
    this.section = 'DROP'; this.sectionTime = 0; this._gapT = 0;
    this.dropTime = this.time; this.dropIntensity = intensity;
    this.events.push('drop');
    // align bars: drops land on a downbeat
    if (!this._hintSection) this.beats = Math.round(this.beats / 4) * 4;
  }

  // manual drop (keyboard)
  forceDrop() { this._fireDrop(1); this.drop = true; if (this._hintSection) this._hintSection = '__forced'; }

  _estimateTempoW() {
    const rate = this._wRate, L = this._wEnv.length;
    const N = Math.min(this._wCount, Math.floor(rate * 8), L);
    const x = new Float32Array(N);
    let mean = 0;
    for (let i = 0; i < N; i++) { x[i] = this._wEnv[(this._wIdx - N + i + L * 2) % L]; mean += x[i]; }
    mean /= N;
    let energy = 0;
    for (let i = 0; i < N; i++) { x[i] = Math.max(0, x[i] - mean); energy += x[i] * x[i]; }
    if (energy < 1e-6) return;
    const minLag = Math.floor(rate * 60 / 180), maxLag = Math.ceil(rate * 60 / 70);
    const ac = new Float32Array(maxLag * 2 + 3);
    const accum = (lag) => { let s = 0; for (let i = lag; i < N; i++) s += x[i] * x[i - lag]; return s / energy; };
    for (let lag = minLag - 1; lag <= Math.min(maxLag * 2 + 1, N - 2); lag++) ac[lag] = accum(lag);
    let best = -1, bestV = -1e9;
    for (let lag = minLag; lag <= maxLag; lag++) {
      const bpm = rate * 60 / lag;
      const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 125) / 0.6, 2));
      const v = (ac[lag] + 0.5 * (ac[lag * 2] || 0)) * (0.55 + w);
      if (v > bestV && ac[lag] >= ac[lag - 1] && ac[lag] >= ac[lag + 1]) { bestV = v; best = lag; }
    }
    if (best < 0) return;
    const y0 = ac[best - 1], y1 = ac[best], y2 = ac[best + 1];
    const den = (y0 - 2 * y1 + y2);
    const off = den !== 0 ? clamp((y0 - y2) / (2 * den), -0.5, 0.5) : 0;
    const period = best + off;
    const bpm = rate * 60 / period;
    this.bpmConf = clamp(ac[best] * 1.5, 0, 1);
    this._bpmHist.push(bpm); if (this._bpmHist.length > 7) this._bpmHist.shift();
    const sorted = [...this._bpmHist].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    if (this.bpmConf > 0.05) this.bpm = Math.abs(med - this.bpm) > 4 ? med : smooth(this.bpm, med, 3, 0.5);
    // comb filter for beat phase: find offset of the most recent beat
    const P = rate * 60 / this.bpm;
    let bestO = 0, bestS = -1;
    for (let o = 0; o < Math.floor(P); o++) {
      let sc = 0;
      for (let k = 0; k < 12; k++) { const idx = N - 1 - Math.round(o + k * P); if (idx < 1) break; sc += x[idx] + 0.5 * (x[idx - 1] + x[idx + 1 < N ? idx + 1 : idx]); }
      if (sc > bestS) { bestS = sc; bestO = o; }
    }
    const tLast = this._wLastT;
    this._phaseRef = tLast - bestO / rate;
  }

  _estimateTempo() {
    const N = 600, env = this._env, L = env.length;
    const x = new Float32Array(N);
    let mean = 0;
    for (let i = 0; i < N; i++) { x[i] = env[(this._envIdx - N + i + L * 2) % L]; mean += x[i]; }
    mean /= N;
    let energy = 0;
    for (let i = 0; i < N; i++) { x[i] -= mean; energy += x[i] * x[i]; }
    if (energy < 1e-3) return;
    const minLag = Math.floor(6000 / 180), maxLag = Math.ceil(6000 / 70);
    const ac = new Float32Array(maxLag + 2);
    for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
      let s = 0; for (let i = lag; i < N; i++) s += x[i] * x[i - lag];
      ac[lag] = s / energy;
    }
    let best = -1, bestV = -1e9;
    for (let lag = minLag; lag <= maxLag; lag++) {
      const bpm = 6000 / lag;
      const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 126) / 0.55, 2)); // prefer dance tempos
      const v = ac[lag] * (0.5 + w) + 0.3 * (ac[lag * 2] || 0);
      if (v > bestV && ac[lag] >= ac[lag - 1] && ac[lag] >= ac[lag + 1]) { bestV = v; best = lag; }
    }
    if (best < 0) return;
    const y0 = ac[best - 1], y1 = ac[best], y2 = ac[best + 1];
    const off = (y0 - y2) / (2 * (y0 - 2 * y1 + y2) || 1);
    let bpm = 6000 / (best + clamp(off, -0.5, 0.5));
    this.bpmConf = clamp(ac[best] * 2, 0, 1);
    this._bpmHist.push(bpm); if (this._bpmHist.length > 9) this._bpmHist.shift();
    const sorted = [...this._bpmHist].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    if (this.bpmConf > 0.1) this.bpm = smooth(this.bpm, med, 2, 0.5);
  }

  _classify(dt) {
    const bpm = this.bpm, s = {};
    for (const g of GENRES) s[g] = 0;
    const kickPerBeat = this._kickRate / (bpm / 60);
    const bassy = this.bandsSlow[0] + this.bandsSlow[1];
    const bright = this.centroid / 4000;
    const near = (c, w) => Math.exp(-0.5 * Math.pow((bpm - c) / w, 2));
    s['Drum & Bass'] = near(174, 6) + near(87, 3) * (this._hatRate > 4 ? 0.8 : 0.2);
    s.Hardstyle = near(150, 5) * (0.5 + this.flatness);
    s.Dubstep = near(140, 4) * (kickPerBeat < 0.7 ? 1.2 : 0.4) + near(70, 3) * 0.6;
    s.Trance = near(138, 4) * (0.5 + bright);
    s.Techno = near(132, 5) * (1.2 - bright * 0.5) + near(140, 6) * 0.3;
    s['Tech House'] = near(126, 3) * (0.6 + bassy * 0.4);
    s.House = near(123, 4) * (0.6 + bright * 0.5);
    s['Pop/EDM'] = near(128, 4) * 0.6 + near(100, 8) * 0.4;
    s['Disco/Funk'] = near(115, 6) * (0.6 + bright * 0.3);
    s['Hip-Hop/Trap'] = near(90, 10) + near(75, 6) * 0.7;
    s.Ambient = this.energy < 3 && this._kickRate < 0.3 ? 1 : 0;
    let best = this.genre, bv = 0, tot = 0;
    for (const g of GENRES) {
      this.genreScores[g] = smooth(this.genreScores[g], s[g], 0.15, dt);
      tot += this.genreScores[g];
      if (this.genreScores[g] > bv) { bv = this.genreScores[g]; best = g; }
    }
    this.genre = best;
    this.genreConf = tot > 0 ? bv / tot : 0;
  }
}
