// Audio engine: demo DJ, file playlist with auto-mixing decks, live input and system audio.
import { Emitter } from './util.js';
import { DemoDJ } from './demo.js';

export class AudioEngine extends Emitter {
  constructor() {
    super();
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.55;
    this.analyser.minDecibels = -95; this.analyser.maxDecibels = -20;
    this.mixBus = this.ctx.createGain();
    this.inputGain = this.ctx.createGain();
    this.monitor = this.ctx.createGain();
    this.volume = this.ctx.createGain();
    this.mixBus.connect(this.inputGain);
    this.inputGain.connect(this.analyser);
    this.mixBus.connect(this.monitor);
    this.monitor.connect(this.volume);
    this.volume.connect(this.ctx.destination);
    this.mode = 'none';
    this.demo = new DemoDJ(this.ctx, this.mixBus);
    this.demo.onTrackChange = (meta) => { if (this.mode === 'demo') this._setTrack(meta); };
    // file decks
    this.decks = [this._makeDeck(), this._makeDeck()];
    this.activeDeck = 0;
    this.playlist = [];
    this.playIndex = -1;
    this.autoMix = true;
    this.mixSeconds = 14;
    this.mixing = false;
    this.liveStream = null;
    this.liveSource = null;
    this.track = { title: '—', artist: '', genre: null };
    this._mixTimer = setInterval(() => this._checkAutoMix(), 250);
    this.onsetListeners = [];
    this._initWorklet();
  }

  async _initWorklet() {
    try {
      await this.ctx.audioWorklet.addModule(new URL('./onset-worklet.js', import.meta.url));
      this.onsetNode = new AudioWorkletNode(this.ctx, 'djsim-onset', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      const sink = this.ctx.createGain(); sink.gain.value = 0;
      this.inputGain.connect(this.onsetNode); this.onsetNode.connect(sink); sink.connect(this.ctx.destination);
      this.onsetNode.port.onmessage = (e) => { for (const f of this.onsetListeners) f(e.data); };
      this.workletReady = true;
    } catch (e) { console.warn('Onset worklet unavailable, using frame-based analysis', e); this.workletReady = false; }
  }

  _makeDeck() {
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    const src = this.ctx.createMediaElementSource(el);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain); gain.connect(this.mixBus);
    const deck = { el, gain, item: null };
    el.addEventListener('ended', () => { if (this.mode === 'files' && deck === this.decks[this.activeDeck] && !this.mixing) this.next(); });
    return deck;
  }

  async resume() { if (this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch (e) { /* ignore */ } } }

  _setTrack(meta) {
    this.track = { title: meta.title || 'Unknown', artist: meta.artist || '', genre: meta.genre || null, bpm: meta.bpm || null, source: this.mode };
    this.emit('track', this.track);
  }

  _stopAll() {
    this.demo.stop();
    for (const d of this.decks) { d.el.pause(); d.gain.gain.cancelScheduledValues(0); d.gain.gain.value = 0; }
    this.mixing = false;
    if (this.liveSource) { try { this.liveSource.disconnect(); } catch (e) { /* */ } this.liveSource = null; }
    if (this.liveStream) { this.liveStream.getTracks().forEach((t) => t.stop()); this.liveStream = null; }
  }

  async startDemo(index) {
    await this.resume();
    this._stopAll();
    this.mode = 'demo';
    this.monitor.gain.value = 1;
    this.demo.start(index ?? this.demo.trackIndex);
    this.emit('mode', this.mode);
  }

  demoNext() { if (this.mode === 'demo') this.demo.next(); }

  // ---------------- files ----------------
  async addFiles(fileList) {
    const items = [];
    for (const f of fileList) {
      if (!/^audio\//.test(f.type) && !/\.(mp3|wav|flac|m4a|aac|ogg|aiff?|opus)$/i.test(f.name)) continue;
      const meta = await readTags(f);
      items.push({ file: f, url: URL.createObjectURL(f), title: meta.title, artist: meta.artist });
    }
    if (!items.length) return 0;
    const wasEmpty = this.playlist.length === 0 || this.mode !== 'files';
    this.playlist.push(...items);
    this.emit('playlist', this.playlist);
    if (wasEmpty) await this.playIndexAt(this.playlist.length - items.length);
    return items.length;
  }

  async playIndexAt(i) {
    if (i < 0 || i >= this.playlist.length) return;
    await this.resume();
    if (this.mode !== 'files') { this._stopAll(); this.mode = 'files'; this.emit('mode', this.mode); }
    this.monitor.gain.value = 1;
    const deck = this.decks[this.activeDeck];
    const other = this.decks[1 - this.activeDeck];
    other.el.pause(); other.gain.gain.value = 0;
    deck.item = this.playlist[i];
    deck.el.src = deck.item.url;
    deck.gain.gain.cancelScheduledValues(0);
    deck.gain.gain.value = 1;
    this.playIndex = i;
    try { await deck.el.play(); } catch (e) { console.warn(e); }
    this._setTrack({ title: deck.item.title, artist: deck.item.artist });
    this.emit('playlist', this.playlist);
  }

  togglePause() {
    if (this.mode === 'files') {
      const d = this.decks[this.activeDeck];
      if (d.el.paused) d.el.play(); else d.el.pause();
      return !d.el.paused;
    }
    if (this.mode === 'demo') {
      if (this.ctx.state === 'running') { this.ctx.suspend(); return false; }
      this.ctx.resume(); return true;
    }
    return true;
  }

  next() {
    if (this.mode === 'demo') return this.demoNext();
    if (this.mode !== 'files' || !this.playlist.length) return;
    if (this.autoMix && !this.mixing) this._startMix();
    else this.playIndexAt((this.playIndex + 1) % this.playlist.length);
  }

  _checkAutoMix() {
    if (this.mode !== 'files' || !this.autoMix || this.mixing || this.playlist.length < 2) return;
    const d = this.decks[this.activeDeck];
    if (!d.el.duration || d.el.paused) return;
    if (d.el.duration - d.el.currentTime <= this.mixSeconds) this._startMix();
  }

  async _startMix() {
    const from = this.decks[this.activeDeck];
    const toIdx = 1 - this.activeDeck;
    const to = this.decks[toIdx];
    const nextI = (this.playIndex + 1) % this.playlist.length;
    this.mixing = true;
    to.item = this.playlist[nextI];
    to.el.src = to.item.url;
    to.gain.gain.value = 0;
    try { await to.el.play(); } catch (e) { console.warn(e); }
    const t = this.ctx.currentTime, dur = this.mixSeconds;
    // equal-power crossfade
    const steps = 32, curveIn = new Float32Array(steps), curveOut = new Float32Array(steps);
    for (let i = 0; i < steps; i++) { const x = i / (steps - 1); curveIn[i] = Math.sin(x * Math.PI / 2); curveOut[i] = Math.cos(x * Math.PI / 2); }
    to.gain.gain.setValueCurveAtTime(curveIn, t, dur);
    from.gain.gain.setValueCurveAtTime(curveOut, t, dur);
    this.emit('mix', { from: from.item, to: to.item, seconds: dur });
    // the crowd hears the new track when it becomes dominant (halfway)
    setTimeout(() => {
      this.activeDeck = toIdx; this.playIndex = nextI;
      this._setTrack({ title: to.item.title, artist: to.item.artist });
      this.emit('playlist', this.playlist);
    }, dur * 500);
    setTimeout(() => { from.el.pause(); this.mixing = false; }, dur * 1000 + 100);
  }

  getPosition() {
    if (this.mode !== 'files') return null;
    const d = this.decks[this.activeDeck];
    return { current: d.el.currentTime || 0, duration: d.el.duration || 0, paused: d.el.paused };
  }

  seek(frac) {
    if (this.mode !== 'files') return;
    const d = this.decks[this.activeDeck];
    if (d.el.duration) d.el.currentTime = frac * d.el.duration;
  }

  // ---------------- live ----------------
  async listInputs() {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      return devs.filter((d) => d.kind === 'audioinput');
    } catch (e) { return []; }
  }

  async startLive(deviceId) {
    await this.resume();
    if (window.djsimNative && window.djsimNative.requestMic) {
      const ok = await window.djsimNative.requestMic();
      if (!ok) throw new Error('Microphone permission denied. Enable DJSIM in System Settings → Privacy & Security → Microphone.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 }
    });
    this._stopAll();
    this.mode = 'live';
    this.liveStream = stream;
    this.liveSource = this.ctx.createMediaStreamSource(stream);
    this.liveSource.connect(this.mixBus);
    this.monitor.gain.value = 0; // never feed the room mic back to the speakers
    this._setTrack({ title: 'Live Input', artist: stream.getAudioTracks()[0]?.label || '' });
    this.emit('mode', this.mode);
  }

  async startSystem() {
    await this.resume();
    const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
    const audioTracks = stream.getAudioTracks();
    stream.getVideoTracks().forEach((t) => t.stop());
    if (!audioTracks.length) throw new Error('No system audio was shared. On macOS, install a loopback driver such as BlackHole and choose it under Live Input.');
    this._stopAll();
    this.mode = 'system';
    this.liveStream = new MediaStream(audioTracks);
    this.liveSource = this.ctx.createMediaStreamSource(this.liveStream);
    this.liveSource.connect(this.mixBus);
    this.monitor.gain.value = 0;
    this._setTrack({ title: 'System Audio', artist: '' });
    this.emit('mode', this.mode);
  }

  // DJ can tag what is playing (for live input where no metadata exists)
  tagTrack(title, artist) { this._setTrack({ title, artist }); }

  setGain(v) { this.inputGain.gain.value = v; }
  setVolume(v) { this.volume.gain.value = v; }
}

// ---------- metadata ----------
async function readTags(file) {
  let title = null, artist = null;
  try {
    const buf = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
      const ver = buf[3];
      const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
      let p = 10;
      if (buf[5] & 0x40) { // extended header
        const ext = ver === 4 ? (((buf[10] & 0x7f) << 21) | ((buf[11] & 0x7f) << 14) | ((buf[12] & 0x7f) << 7) | (buf[13] & 0x7f)) : ((buf[10] << 24) | (buf[11] << 16) | (buf[12] << 8) | buf[13]) + 4;
        p += ext;
      }
      const end = Math.min(buf.length, 10 + size);
      while (p + 10 < end) {
        const id = String.fromCharCode(buf[p], buf[p + 1], buf[p + 2], buf[p + 3]);
        if (!/^[A-Z0-9]{4}$/.test(id)) break;
        const fsz = ver === 4 ? (((buf[p + 4] & 0x7f) << 21) | ((buf[p + 5] & 0x7f) << 14) | ((buf[p + 6] & 0x7f) << 7) | (buf[p + 7] & 0x7f)) : ((buf[p + 4] << 24) | (buf[p + 5] << 16) | (buf[p + 6] << 8) | buf[p + 7]);
        if (fsz <= 0 || p + 10 + fsz > buf.length) break;
        if (id === 'TIT2' || id === 'TPE1') {
          const val = decodeText(buf.subarray(p + 10, p + 10 + fsz));
          if (id === 'TIT2') title = val; else artist = val;
        }
        p += 10 + fsz;
      }
    }
  } catch (e) { /* ignore */ }
  if (!title) {
    const base = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/^\d+\s*[-.]\s*/, '');
    const m = base.split(' - ');
    if (m.length >= 2) { artist = artist || m[0].trim(); title = m.slice(1).join(' - ').trim(); } else title = base;
  }
  return { title, artist: artist || '' };
}

function decodeText(b) {
  const enc = b[0];
  const data = b.subarray(1);
  let s;
  try {
    if (enc === 1) s = new TextDecoder('utf-16').decode(data);
    else if (enc === 2) s = new TextDecoder('utf-16be').decode(data);
    else if (enc === 3) s = new TextDecoder('utf-8').decode(data);
    else s = new TextDecoder('latin1').decode(data);
  } catch (e) { s = ''; }
  return s.replace(/\u0000/g, '').trim();
}
