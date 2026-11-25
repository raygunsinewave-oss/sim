// DOM interface for DJSIM
import * as THREE from 'three';
import { ENVIRONMENTS } from './environments.js';
import { PALETTES, PRESETS } from './presets.js';
import { VISUALS } from './visualizers.js';
import { LASER_MODES } from './lasers.js';
import { LIGHT_PATTERNS } from './lights.js';
import { CAMERA_MODES } from './camera.js';
import { MOVE_LABELS } from './crowd.js';
import { GENRES } from './personas.js';
import { searchAnthems, ANTHEMS } from './songs.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UI {
  constructor(app) {
    this.app = app;
    this._v = new THREE.Vector3();
    this.tickT = 0;
    this.statT = 0;
    this.storyT = 0;
    this.moments = [];
    this.buildStatic();
    this.bind();
  }

  // ---------------------------------------------------------------- build
  buildStatic() {
    const app = this.app;
    // worlds
    $('worldGrid').innerHTML = ENVIRONMENTS.map((e, i) => {
      const c = PALETTES[e.palette].colors;
      return `<div class="world" data-i="${i}" style="background:linear-gradient(135deg, ${c[0]}55, ${c[1]}33 55%, #0008), ${e.fog[0]}"><div class="wn">${esc(e.name)}</div><div class="wd">${esc(e.desc)}</div></div>`;
    }).join('');
    $('presetList').innerHTML = PRESETS.map((p, i) => `<div class="item" data-i="${i}"><span>${esc(p.name)}</span><span class="k">${i < 9 ? i + 1 : ''}</span></div>`).join('');
    $('paletteGrid').innerHTML = Object.entries(PALETTES).map(([k, p]) => `<div class="pal" data-k="${k}"><div class="sw">${p.colors.map((c) => `<div style="background:${c}"></div>`).join('')}</div>${esc(p.name)}</div>`).join('');
    const chips = (el, arr, attr) => { $(el).innerHTML = arr.map((n, i) => `<button class="chip" data-${attr}="${i}">${esc(n)}</button>`).join(''); };
    chips('visGrid', VISUALS, 'v'); chips('laserGrid', LASER_MODES, 'l'); chips('lightGrid', LIGHT_PATTERNS, 'p'); chips('camGrid', CAMERA_MODES, 'c');
    this.renderCustomPresets();
    this.syncControls();
  }

  renderCustomPresets() {
    const list = this.app._load('djsim.presets') || [];
    $('customPresets').innerHTML = list.length ? list.map((p, i) => `<div class="item" data-ci="${i}"><span>${esc(p.name)}</span><span class="x" data-del="${i}">✕</span></div>`).join('') : '<div class="hint" style="font-size:11px">No saved looks yet.</div>';
  }

  // ---------------------------------------------------------------- bind
  bind() {
    const app = this.app;
    $('startBtn').onclick = () => { $('splash').classList.add('gone'); app.start(); setTimeout(() => this.onboarding(), 1200); };
    // tabs
    document.querySelectorAll('.drawer').forEach((d) => {
      d.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => {
        d.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
        d.querySelectorAll('.tab-body').forEach((x) => x.classList.toggle('hidden', x.dataset.body !== b.dataset.tab));
      });
    });
    $('btnLeft').onclick = () => $('left').classList.toggle('open');
    $('btnRight').onclick = () => $('right').classList.toggle('open');
    $('btnHelp').onclick = () => $('help').classList.toggle('hidden');
    $('helpClose').onclick = () => $('help').classList.add('hidden');
    $('btnFull').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); };
    $('worldGrid').onclick = (e) => { const w = e.target.closest('.world'); if (w) { app.loadEnvironment(+w.dataset.i); this.banner(ENVIRONMENTS[+w.dataset.i].name, 'world'); } };
    $('presetList').onclick = (e) => { const it = e.target.closest('.item'); if (it) app.applyPreset(PRESETS[+it.dataset.i]); };
    $('customPresets').onclick = (e) => {
      const list = app._load('djsim.presets') || [];
      if (e.target.dataset.del != null) { list.splice(+e.target.dataset.del, 1); app._save('djsim.presets', list); this.renderCustomPresets(); return; }
      const it = e.target.closest('.item'); if (it) app.applyPreset(list[+it.dataset.ci]);
    };
    $('savePreset').onclick = () => { const list = app._load('djsim.presets') || []; const look = app.currentLook(); list.unshift(look); app._save('djsim.presets', list.slice(0, 40)); this.renderCustomPresets(); this.toast(`Saved "${look.name}"`); };
    $('exportPresets').onclick = () => {
      const blob = new Blob([JSON.stringify(app._load('djsim.presets') || [], null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'djsim-presets.json'; a.click();
    };
    $('importPresets').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const arr = JSON.parse(await f.text()); if (!Array.isArray(arr)) throw new Error('not a list'); const list = app._load('djsim.presets') || []; app._save('djsim.presets', [...arr.filter((p) => p && p.env), ...list].slice(0, 80)); this.renderCustomPresets(); this.toast(`Imported ${arr.length} looks`); }
      catch (err) { this.toast('That file is not a DJSIM preset export.'); }
    };
    $('paletteGrid').onclick = (e) => { const p = e.target.closest('.pal'); if (p) app.setPalette(p.dataset.k); };
    $('visGrid').onclick = (e) => { const c = e.target.closest('.chip'); if (c) { app.vis.setMode(+c.dataset.v); this.syncControls(); } };
    $('laserGrid').onclick = (e) => { const c = e.target.closest('.chip'); if (c) { app.lasers.setMode(+c.dataset.l); this.syncControls(); } };
    $('lightGrid').onclick = (e) => { const c = e.target.closest('.chip'); if (c) { app.lights.setPattern(+c.dataset.p); this.syncControls(); } };
    $('camGrid').onclick = (e) => { const c = e.target.closest('.chip'); if (c) { const m = +c.dataset.c; if (m === 7 && app.selected < 0) app.selectPerson(app.crowd.randomInteresting()); if (m === 7) app.director.follow(app.selected); else app.director.setMode(m); this.syncControls(); } };
    $('laserColor').onchange = (e) => { app.lasers.colorMode = +e.target.value; };
    $('lightColor').onchange = (e) => { app.lights.colorMode = +e.target.value; };
    document.querySelectorAll('.fx').forEach((b) => {
      b.onmousedown = () => { this.fire(b.dataset.fx, true); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); };
      b.onmouseup = b.onmouseleave = () => { if (b.dataset.fx === 'strobe') app.lights.strobeHold = false; };
    });
    const chk = (id, key, fn) => { $(id).onchange = (e) => { app.settings[key] = e.target.checked; fn && fn(e.target.checked); app.saveSettings(); }; };
    chk('autoVJ', 'autoVJ'); chk('autoFX', 'autoFX'); chk('autoQuality', 'autoQuality'); chk('glitch', 'glitch');
    $('lasersOn').onchange = (e) => { app.lasers.enabled = e.target.checked; };
    $('lightsOn').onchange = (e) => { app.lights.enabled = e.target.checked; };
    const rng = (id, key, after) => { $(id).oninput = (e) => { app.settings[key] = +e.target.value; app.applySettings(); after && after(+e.target.value); }; };
    rng('bloom', 'bloom'); rng('trails', 'trails'); rng('grain', 'grain'); rng('fog', 'fog'); rng('fxLevel', 'fxLevel'); rng('sens', 'sens'); rng('gain', 'gain'); rng('volume', 'volume');
    rng('latency', 'latency', (v) => { $('latVal').textContent = `${v} ms`; });
    $('quality').onchange = (e) => { app.settings.quality = +e.target.value; app.applyQuality(); app.saveSettings(); if (app.crowd.count > [400, 900, 1800, 2500][app.settings.quality]) app.populateCrowd(); };
    $('crowdSize').onchange = (e) => { app.settings.crowdSize = +e.target.value; app.saveSettings(); app.populateCrowd(); app.selectPerson(-1); };
    $('crowdSize').oninput = (e) => { $('crowdSizeVal').textContent = `${e.target.value} people`; };
    $('mcSend').onclick = () => this.sendMC();
    $('mcText').onkeydown = (e) => { if (e.key === 'Enter') this.sendMC(); e.stopPropagation(); };
    $('tagSearch').oninput = (e) => this.renderTagResults(e.target.value);
    $('tagSearch').onkeydown = (e) => e.stopPropagation();
    $('tagResults').onclick = (e) => { const it = e.target.closest('.item'); if (!it) return; const s = ANTHEMS[+it.dataset.a]; app.engine.tagTrack(s.title, s.artist); this.toast(`Told the crowd: "${s.title}" is playing`); };
    this.renderTagResults('');
    $('randomStory').onclick = () => this.randomStory();
    $('followBtn').onclick = () => { if (app.selected < 0) app.selectPerson(app.crowd.randomInteresting()); app.director.follow(app.selected); this.syncControls(); };
    $('momentLog').onclick = (e) => { const d = e.target.closest('[data-id]'); if (d && +d.dataset.id >= 0) app.selectPerson(+d.dataset.id); };
    $('ticker').onclick = (e) => { const d = e.target.closest('[data-id]'); if (d && +d.dataset.id >= 0) app.selectPerson(+d.dataset.id); };
    // story card
    $('storyClose').onclick = () => app.selectPerson(-1);
    $('stFollow').onclick = () => { app.director.follow(app.selected); this.syncControls(); };
    $('stPov').onclick = () => { app.director.crowdPovId = app.selected; app.director.setMode(4); this.syncControls(); };
    $('stFriends').onclick = (e) => { const a = e.target.closest('a'); if (a) app.selectPerson(+a.dataset.id); };
    // sources
    $('sources').onclick = async (e) => {
      const b = e.target.closest('.seg'); if (!b) return;
      if (!app.started) { $('splash').classList.add('gone'); app.started = true; await app.engine.resume(); }
      try {
        if (b.dataset.src === 'demo') await app.engine.startDemo();
        if (b.dataset.src === 'files') { if (app.engine.playlist.length) await app.engine.playIndexAt(Math.max(0, app.engine.playIndex)); else this.openFiles(); }
        if (b.dataset.src === 'live') { await app.engine.startLive($('deviceSelect').value || undefined); this.refreshDevices(); this.toast('Listening to live input. Point your mixer\'s booth/record out at your audio interface.'); }
        if (b.dataset.src === 'system') { await app.engine.startSystem(); this.toast('Capturing system audio.'); }
      } catch (err) { this.toast(err.message || String(err)); }
      this.refreshSource();
    };
    $('deviceSelect').onchange = async (e) => { if (app.engine.mode === 'live') { try { await app.engine.startLive(e.target.value || undefined); } catch (err) { this.toast(err.message); } } };
    // deck
    $('tPlay').onclick = () => app.engine.togglePause();
    $('tNext').onclick = () => app.engine.next();
    $('tPrev').onclick = () => { if (app.engine.mode === 'files') app.engine.seek(0); else if (app.engine.mode === 'demo') app.engine.startDemo((app.engine.demo.trackIndex + 8) % 9); };
    $('autoMix').onchange = (e) => { app.engine.autoMix = e.target.checked; };
    $('playlistSel').onchange = (e) => { const v = e.target.value; if (v.startsWith('d')) app.engine.startDemo(+v.slice(1)); else app.engine.playIndexAt(+v); };
    $('openFiles').onclick = () => this.openFiles();
    $('fileInput').onchange = async (e) => { const n = await app.engine.addFiles(e.target.files); if (!app.started) { $('splash').classList.add('gone'); app.started = true; } this.toast(n ? `Added ${n} track${n > 1 ? 's' : ''} to the set` : 'No playable audio files found.'); e.target.value = ''; };
    $('progress').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); app.engine.seek((e.clientX - r.left) / r.width); };
    // drag & drop
    let dragN = 0;
    addEventListener('dragenter', (e) => { e.preventDefault(); dragN++; $('dropzone').classList.remove('hidden'); });
    addEventListener('dragleave', () => { dragN = Math.max(0, dragN - 1); if (!dragN) $('dropzone').classList.add('hidden'); });
    addEventListener('dragover', (e) => e.preventDefault());
    addEventListener('drop', async (e) => {
      e.preventDefault(); dragN = 0; $('dropzone').classList.add('hidden');
      const n = await app.engine.addFiles(e.dataTransfer.files);
      if (!app.started) { $('splash').classList.add('gone'); app.started = true; }
      this.toast(n ? `Added ${n} track${n > 1 ? 's' : ''} to the set` : 'No playable audio files found.');
    });
    // canvas interactions
    const cv = app.renderer.domElement;
    let down = null;
    cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    cv.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return;
      this.canvasClick(e);
    });
    cv.addEventListener('dblclick', (e) => { if (this._hitStage(e)) { app.triggerDrop(true); this.banner('DROP!', ''); } });
    // keyboard
    addEventListener('keydown', (e) => this.key(e, true));
    addEventListener('keyup', (e) => this.key(e, false));
    this.refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', () => this.refreshDevices());
    this.refreshPlaylist();
  }

  _ndc(e) { const r = this.app.renderer.domElement.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1, w: r.width, h: r.height }; }

  _hitStage(e) {
    const app = this.app, n = this._ndc(e);
    const rc = new THREE.Raycaster(); rc.setFromCamera(n, app.camera);
    const hits = rc.intersectObjects(app.env.group.children, false);
    if (!hits.length) return false;
    const p = hits[0].point;
    return Math.abs(p.z - app.env.djPos.z) < 5 && Math.abs(p.x - app.env.djPos.x) < 10 && p.y < 4;
  }

  canvasClick(e) {
    const app = this.app, n = this._ndc(e);
    // lasers: projector positions on screen
    for (const pr of app.lasers.projectors) {
      this._v.copy(pr.pos).project(app.camera);
      const sx = (this._v.x * 0.5 + 0.5) * n.w, sy = (-this._v.y * 0.5 + 0.5) * n.h;
      if (this._v.z < 1 && Math.hypot(sx - (e.clientX), sy - (e.clientY)) < 18) { app.lasers.setMode(app.lasers.mode + 1); this.toast(`Lasers: ${LASER_MODES[app.lasers.mode]}`); this.syncControls(); return; }
    }
    // crowd
    const id = app.crowd.pick(n.x, n.y, app.camera, n.w, n.h);
    // LED wall
    const rc = new THREE.Raycaster(); rc.setFromCamera(n, app.camera);
    const led = rc.intersectObjects(app.env.ledMeshes, false);
    if (id >= 0) {
      const s = app.crowd.st[id];
      const pd = app.camera.position.distanceTo(this._v.set(s.x, s.headY || 1.5, s.z));
      if (!led.length || led[0].distance > pd) { app.selectPerson(id); return; }
    }
    if (led.length) { app.vis.setMode(app.vis.mode + 1); this.toast(`LED wall: ${VISUALS[app.vis.mode]}`); this.syncControls(); return; }
    if (id < 0 && app.selected >= 0) app.selectPerson(-1);
  }

  fire(fx, down) {
    const app = this.app;
    switch (fx) {
      case 'drop': app.triggerDrop(true); this.banner('DROP!', ''); break;
      case 'strobe': app.lights.strobeHold = down; break;
      case 'blinder': app.lights.blinder(); break;
      case 'pyro': if (!app.fx.pyro(1)) this.toast('No pyro in this world. Try Mainstage, Stadium, Playa, Jungle, Volcano or Tundra.'); break;
      case 'co2': if (!app.fx.co2()) this.toast('No CO2 cannons here.'); break;
      case 'confetti': app.fx.confetti(app.palette); break;
      case 'fireworks': if (!app.fx.fireworks(app.palette)) this.toast('Fireworks need an open sky: Mainstage, Stadium, Ibiza, Yacht, Volcano, Tundra or Sky Arena.'); break;
      case 'sparks': app.fx.sparks(1); break;
    }
  }

  key(e, down) {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
    const app = this.app, k = e.key.toLowerCase();
    if (!down) { if (k === 's') app.lights.strobeHold = false; return; }
    if (e.repeat && k !== 's') return;
    if (e.metaKey || e.ctrlKey) return;
    const map = {
      ' ': () => this.fire('drop'), s: () => this.fire('strobe', true), b: () => this.fire('blinder'), p: () => this.fire('pyro'), x: () => this.fire('co2'),
      w: () => this.fire('fireworks'), z: () => this.fire('sparks'),
      c: () => { if (e.shiftKey) { app.director.setMode(0); this.syncControls(); } else this.fire('confetti'); },
      v: () => { app.vis.setMode(app.vis.mode + 1); this.toast(`LED wall: ${VISUALS[app.vis.mode]}`); this.syncControls(); },
      k: () => { app.lasers.setMode(app.lasers.mode + 1); this.toast(`Lasers: ${LASER_MODES[app.lasers.mode]}`); this.syncControls(); },
      m: () => { app.lights.setPattern(app.lights.pattern + 1); this.toast(`Lights: ${LIGHT_PATTERNS[app.lights.pattern]}`); this.syncControls(); },
      l: () => { app.lasers.enabled = !app.lasers.enabled; $('lasersOn').checked = app.lasers.enabled; },
      e: () => { app.loadEnvironment(app.envIndex + 1); this.banner(ENVIRONMENTS[app.envIndex].name, 'world'); },
      f: () => { app.settings.fog = Math.min(2.5, app.settings.fog + 0.4); if (app.settings.fog >= 2.5) app.settings.fog = 0.4; app.applySettings(); $('fog').value = app.settings.fog; this.toast(`Haze ${Math.round(app.settings.fog * 100)}%`); },
      n: () => { const keys = Object.keys(PALETTES); app.setPalette(keys[(keys.indexOf(app.paletteKey) + 1) % keys.length]); this.toast(`Palette: ${PALETTES[app.paletteKey].name}`); },
      r: () => this.randomStory(),
      g: () => { if (app.selected < 0) app.selectPerson(app.crowd.randomInteresting()); app.director.follow(app.selected); this.syncControls(); },
      0: () => { app.director.setMode(1); this.syncControls(); this.toast('Cinematic auto-camera'); },
      tab: () => this.toggleUI(),
      h: () => $('help').classList.toggle('hidden'),
      j: () => { app.settings.autoVJ = !app.settings.autoVJ; this.syncControls(); this.toast(`Auto-VJ ${app.settings.autoVJ ? 'on' : 'off'}`); },
      t: () => app.engine.next(),
      escape: () => { $('help').classList.add('hidden'); app.selectPerson(-1); }
    };
    if (/^[1-9]$/.test(k)) { app.applyPreset(PRESETS[+k - 1]); e.preventDefault(); return; }
    if (map[k]) { map[k](); e.preventDefault(); }
  }

  toggleUI() { document.body.classList.toggle('ui-hidden'); }
  openFiles() { $('fileInput').click(); }

  sendMC() {
    const t = $('mcText').value.trim(); if (!t) return;
    const app = this.app;
    app.vis.setText(t.toUpperCase(), 'DJSIM'); app._prevVis = app.vis.mode; app.vis.setMode(8); app._vjFlashText = app.time + 12;
    this.syncControls(); this.ticker(`🎤 MC: "${t}"`);
    $('mcText').value = '';
  }

  renderTagResults(q) {
    const res = searchAnthems(q, 8);
    $('tagResults').innerHTML = res.map((s) => `<div class="item" data-a="${ANTHEMS.indexOf(s)}"><span>${esc(s.title)}</span><span class="k">${esc(s.artist)}</span></div>`).join('');
  }

  randomStory() { const app = this.app; const id = app.crowd.randomInteresting(); app.selectPerson(id); app.director.follow(id); this.syncControls(); }

  async refreshDevices() {
    const devs = await this.app.engine.listInputs();
    const sel = $('deviceSelect'); const cur = sel.value;
    sel.innerHTML = '<option value="">Default input</option>' + devs.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || `Input ${i + 1}`)}</option>`).join('');
    sel.value = cur;
  }

  // ---------------------------------------------------------------- sync
  syncControls() {
    const app = this.app, s = app.settings;
    const mark = (el, attr, val) => $(el).querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', +c.dataset[attr] === val));
    mark('visGrid', 'v', app.vis.mode); mark('laserGrid', 'l', app.lasers.mode); mark('lightGrid', 'p', app.lights.pattern); mark('camGrid', 'c', app.director.mode);
    $('autoVJ').checked = s.autoVJ; $('autoFX').checked = s.autoFX; $('autoQuality').checked = s.autoQuality; $('glitch').checked = s.glitch;
    for (const k of ['bloom', 'trails', 'grain', 'fog', 'fxLevel', 'sens', 'gain', 'volume', 'latency']) $(k).value = s[k];
    $('latVal').textContent = `${s.latency} ms`;
    $('quality').value = s.quality;
    $('laserColor').value = app.lasers.colorMode; $('lightColor').value = app.lights.colorMode;
    $('presetList').querySelectorAll('.item').forEach((it) => it.classList.toggle('active', PRESETS[+it.dataset.i].name === app.currentPreset));
  }
  refreshWorld() { document.querySelectorAll('.world').forEach((w) => w.classList.toggle('active', +w.dataset.i === this.app.envIndex)); }
  refreshPalette() { document.querySelectorAll('.pal').forEach((p) => p.classList.toggle('active', p.dataset.k === this.app.paletteKey)); }
  refreshCrowdSize(n) { $('crowdSize').value = n; $('crowdSizeVal').textContent = `${n} people`; }
  setVersion(v) { $('ver').textContent = `v${v}`; }

  refreshSource() {
    const m = this.app.engine.mode;
    document.querySelectorAll('.seg').forEach((b) => b.classList.toggle('active', b.dataset.src === m));
    $('deckMode').textContent = { demo: 'Demo DJ', files: 'Your set', live: 'Live input', system: 'System audio' }[m] || '';
    this.refreshPlaylist();
  }

  refreshPlaylist() {
    const e = this.app.engine;
    const sel = $('playlistSel');
    if (e.mode === 'files' && e.playlist.length) sel.innerHTML = e.playlist.map((it, i) => `<option value="${i}" ${i === e.playIndex ? 'selected' : ''}>${i + 1}. ${esc(it.artist ? it.artist + ' – ' : '')}${esc(it.title)}</option>`).join('');
    else sel.innerHTML = ['Neon Pulse · House', 'Concrete Cathedral · Techno', 'Starlight Overdrive · Trance', 'Gravity Well · Dubstep', 'Amen Velocity · DnB', 'Mirrorball Fever · Disco', 'Hard Reset · Hardstyle', 'Late Night Bounce · Hip-Hop', 'Sunset Groove · Tech House'].map((n, i) => `<option value="d${i}" ${i === e.demo.trackIndex ? 'selected' : ''}>${n}</option>`).join('');
  }

  setTrack(tr, song) {
    $('npTitle').innerHTML = esc(tr.title) + (song ? '<span class="anthem">ANTHEM</span>' : '');
    $('npArtist').textContent = [tr.artist, tr.genre].filter(Boolean).join(' · ');
    this.refreshPlaylist();
  }

  // ---------------------------------------------------------------- feedback
  banner(title, sub) {
    const b = $('banner');
    b.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  toast(msg) {
    const d = document.createElement('div'); d.textContent = msg; $('toast').appendChild(d);
    setTimeout(() => d.remove(), 3500);
  }
  ticker(text, id = -1) {
    const el = $('ticker');
    const d = document.createElement('div'); d.className = 'tick'; d.textContent = text; d.dataset.id = id;
    el.prepend(d);
    while (el.children.length > 5) el.lastChild.remove();
    setTimeout(() => d.classList.add('old'), 7000); setTimeout(() => d.remove(), 8200);
    const m = $('momentLog');
    const row = document.createElement('div'); row.textContent = `${this.app.crowd.clock} · ${text}`; row.dataset.id = id;
    m.prepend(row); while (m.children.length > 60) m.lastChild.remove();
  }
  flashSection() { const b = $('roSection'); b.classList.remove('DROP'); void b.offsetWidth; b.classList.add('DROP'); }

  onboarding() {
    if (this.app._load('djsim.onboarded')) return;
    const steps = [
      ['sources', '<b>1. Pick a source.</b> The Demo DJ is playing now. Drop in your own tracks, or plug in your mixer with Live Input.'],
      ['btnLeft', '<b>2. Pick a world.</b> 21 venues and 44 presets live in this drawer. Number keys 1–9 jump between presets.'],
      ['stage', '<b>3. Click anyone in the crowd.</b> Everyone has a name, a backstory, a goal for the night and a live story log.']
    ];
    let i = 0;
    const tip = $('tip');
    const show = () => {
      if (i >= steps.length) { tip.classList.add('hidden'); this.app._save('djsim.onboarded', true); return; }
      const [anchor, html] = steps[i];
      const r = $(anchor).getBoundingClientRect();
      tip.innerHTML = `${html}<div class="row"><button class="btn" id="tipNext">${i < steps.length - 1 ? 'Next' : 'Let\'s go'}</button></div>`;
      tip.classList.remove('hidden');
      if (anchor === 'stage') { tip.style.left = `${innerWidth / 2 - 135}px`; tip.style.top = `${innerHeight / 2 - 40}px`; }
      else { tip.style.left = `${Math.min(innerWidth - 290, r.left)}px`; tip.style.top = `${r.bottom + 12}px`; }
      $('tipNext').onclick = () => { i++; show(); };
    };
    show();
  }

  // ---------------------------------------------------------------- story card
  showStory(id) {
    const card = $('story');
    if (id < 0) { card.classList.add('hidden'); $('pin').classList.add('hidden'); return; }
    card.classList.remove('hidden');
    this.storyT = 0;
    this.renderStory();
  }

  renderStory() {
    const app = this.app, id = app.selected; if (id < 0) return;
    const p = app.crowd.people[id]; if (!p) return;
    const d = app.crowd.describe(id);
    $('stName').textContent = p.name;
    $('stMeta').textContent = `${p.age} · from ${p.hometown}`;
    $('stArch').textContent = p.archLabel;
    $('stBack').textContent = p.backstory;
    const g = $('stGoal'); g.textContent = `${p.goal.done ? '✓ ' : '🎯 '}${p.goal.text}`; g.classList.toggle('done', p.goal.done);
    const meters = [['Mood', p.mood], ['Energy', Math.min(1, p.energy)], ['Stamina', p.stamina], ['Hydration', p.hydration]];
    $('stMeters').innerHTML = meters.map(([l, v]) => `<div class="mt">${l}<div class="bar"><div style="width:${Math.round(v * 100)}%"></div></div></div>`).join('');
    $('stNow').textContent = d.move;
    $('stTaste').textContent = GENRES.slice().sort((a, b) => p.taste[b] - p.taste[a]).slice(0, 3).join(', ');
    const songs = p.theirSongs.map((k) => ANTHEMS.find((s) => s.key === k)).filter(Boolean);
    $('stSong').textContent = songs.map((s) => `"${s.title}"`).join(', ');
    $('stFriends').innerHTML = p.friends.filter((f) => f < app.crowd.count).map((f) => `<a data-id="${f}">${esc(app.crowd.people[f].name)}</a>`).join('') || '<span class="hint">Came alone</span>';
    $('stLog').innerHTML = p.log.slice().reverse().map((e) => `<div><span class="t">${e.t}</span>${esc(e.text)}</div>`).join('') || '<div class="hint">The night is young…</div>';
  }

  // ---------------------------------------------------------------- per frame
  update(dt, A) {
    const app = this.app;
    this.tickT += dt;
    if (this.tickT > 0.1) {
      this.tickT = 0;
      $('roBpm').textContent = A.silent && app.engine.mode !== 'demo' ? '---' : A.bpm.toFixed(0);
      $('roGenre').textContent = A.genre;
      const sec = $('roSection'); if (sec.textContent !== A.section) { sec.textContent = A.section; sec.className = `val badge ${A.section}`; }
      $('roEnergy').style.width = `${Math.round(A.energy * 10)}%`;
      $('roClock').textContent = app.crowd.clock;
      const pos = app.engine.getPosition();
      if (pos && pos.duration) { $('progressFill').style.width = `${(pos.current / pos.duration) * 100}%`; $('deckTime').textContent = `${fmt(pos.current)} / ${fmt(pos.duration)}`; }
      else if (app.engine.mode === 'demo') { const info = app.engine.demo.info(); $('progressFill').style.width = `${Math.min(100, info.bar / 72 * 100)}%`; $('deckTime').textContent = `bar ${info.bar + 1} · ${info.section}`; }
      else { $('progressFill').style.width = '0%'; $('deckTime').textContent = 'live'; }
    }
    // pin over selected person
    if (app.selected >= 0) {
      const v = app.crowd.getHead(app.selected, this._v); v.y += 0.35; v.project(app.camera);
      const pin = $('pin');
      if (v.z < 1 && app.director.mode !== 4) {
        pin.classList.remove('hidden');
        pin.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; pin.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
        pin.querySelector('.pin-name').textContent = app.crowd.people[app.selected].name;
        pin.querySelector('.pin-act').textContent = app.crowd.describe(app.selected).move;
      } else pin.classList.add('hidden');
      this.storyT += dt;
      if (this.storyT > 0.6) { this.storyT = 0; this.renderStory(); }
    }
    // crowd stats
    this.statT += dt;
    if (this.statT > 1 && !$('right').querySelector('[data-body="crowd"]').classList.contains('hidden')) {
      this.statT = 0;
      const c = app.crowd; let mood = 0, energy = 0, dancing = 0; const moves = {};
      for (let i = 0; i < c.count; i++) { const p = c.people[i], s = c.st[i]; mood += p.mood; energy += p.energy; if (!['chat', 'rest', 'walk', 'drink'].includes(s.move)) dancing++; moves[s.move] = (moves[s.move] || 0) + 1; }
      const top = Object.entries(moves).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m]) => MOVE_LABELS[m] || m).join(', ');
      const n = Math.max(1, c.count);
      $('crowdStats').innerHTML = [
        [c.count, 'People'], [`${Math.round(dancing / n * 100)}%`, 'Dancing'], [`${Math.round(mood / n * 100)}%`, 'Avg mood'], [`${Math.round(Math.min(1, energy / n) * 100)}%`, 'Avg energy'],
        [`<span style="font-size:11px">${esc(top)}</span>`, 'Most popular moves'], [`${Math.round(app.fps)}`, 'FPS']
      ].map(([v, l]) => `<div class="stat"><div class="n">${v}</div><div class="l">${l}</div></div>`).join('');
    }
  }
}

function fmt(s) { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
