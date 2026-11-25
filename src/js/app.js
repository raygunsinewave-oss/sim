// DJSIM by Raygun — main application
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';

import { AudioEngine } from './audio.js';
import { Analyzer } from './analysis.js';
import { VisualizerSystem, VISUALS } from './visualizers.js';
import { ENVIRONMENTS, buildEnvironment } from './environments.js';
import { Crowd } from './crowd.js';
import { generatePersonas } from './personas.js';
import { LightRig, LIGHT_PATTERNS } from './lights.js';
import { LaserSystem, LASER_MODES } from './lasers.js';
import { Effects } from './effects.js';
import { DJ } from './dj.js';
import { CameraDirector, CAMERA_MODES } from './camera.js';
import { PALETTES, PRESETS } from './presets.js';
import { matchAnthem, REACTION_LABELS } from './songs.js';
import { UI } from './ui.js';
import { clamp, lerp } from './util.js';

const FINAL_SHADER = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.05 }, uStrobe: { value: 0 }, uChroma: { value: 0 }, uPunch: { value: 0 }, uVignette: { value: 1 }, uFlashCol: { value: new THREE.Color(1, 1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uGrain, uStrobe, uChroma, uPunch, uVignette; uniform vec3 uFlashCol; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*7.0) * 43758.5453); }
    void main(){
      vec2 d = (vUv - 0.5) * uChroma * 0.02;
      vec3 c = vec3(texture2D(tDiffuse, vUv + d).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d).b);
      c *= 1.0 + uPunch;
      c = mix(c, uFlashCol * 1.6, uStrobe * 0.85);
      float v = smoothstep(1.0, 0.3, length(vUv - 0.5) * 1.25);
      c *= mix(1.0, v, 0.55 * uVignette);
      c += (rnd(vUv * 900.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`
};

const QUALITY = [
  { name: 'Low', pr: 0.6, bloomScale: 0.35, maxCrowd: 400 },
  { name: 'Medium', pr: 0.85, bloomScale: 0.5, maxCrowd: 900 },
  { name: 'High', pr: 1.0, bloomScale: 0.5, maxCrowd: 1800 },
  { name: 'Ultra', pr: 2.0, bloomScale: 0.75, maxCrowd: 2500 }
];

class App {
  constructor() {
    this.container = document.getElementById('stage');
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000');
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1200);
    this.camera.position.set(0, 7, 24);

    // post
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.afterimage = new AfterimagePass(0.35); this.composer.addPass(this.afterimage);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.0, 0.55, 0.32); this.composer.addPass(this.bloom);
    this.glitch = new GlitchPass(); this.glitch.enabled = false; this.composer.addPass(this.glitch);
    this.final = new ShaderPass(FINAL_SHADER); this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());

    // systems
    this.engine = new AudioEngine();
    this.A = new Analyzer(this.engine);
    this.vis = new VisualizerSystem();
    this.lights = new LightRig(this.scene);
    this.lasers = new LaserSystem(this.scene);
    this.fx = new Effects(this.scene);
    this.crowd = new Crowd(this.scene, 2600);
    this.dj = new DJ(this.scene);
    this.director = new CameraDirector(this.camera, this.renderer.domElement);
    this.personas = generatePersonas(2600, 20251125);

    this.settings = Object.assign({
      quality: 2, autoQuality: true, bloom: 1, trails: 0.35, grain: 0.05, fog: 1, fxLevel: 1, glitch: true, sens: 1, gain: 1, latency: 0, volume: 0.85,
      autoVJ: true, autoFX: true, crowdSize: 0, paletteKey: null
    }, this._load('djsim.settings') || {});
    this.palette = [new THREE.Color('#00f0ff'), new THREE.Color('#ff2bd6'), new THREE.Color('#7a5cff')];
    this.paletteTarget = this.palette.map((c) => c.clone());
    this.paletteKey = 'neon';
    this.envIndex = 0;
    this.env = null;
    this.selected = -1;
    this.time = 0;
    this.clock = new THREE.Clock();
    this.fpsAcc = 0; this.fpsFrames = 0; this.fps = 60; this.lowFpsT = 0;
    this.started = false;
    this.anthem = null;
    this.ui = new UI(this);

    this.engine.on('track', (tr) => this.onTrack(tr));
    this.engine.on('mode', () => this.ui.refreshSource());
    this.engine.on('playlist', () => this.ui.refreshPlaylist());
    this.engine.on('mix', (m) => this.ui.toast(`Mixing into "${m.to.title}" over ${m.seconds}s`));
    this.crowd.onStory = (text, id) => this.ui.ticker(text, id);

    addEventListener('resize', () => this.resize());
    this.applyQuality();
    this.applySettings();
    this.loadEnvironment(0);
    this.applyPreset(PRESETS[1], false);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
    if (window.djsimNative) { window.djsimNative.onMenu((a) => this.onMenu(a)); window.djsimNative.version().then((v) => this.ui.setVersion(v)); }
  }

  _load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  _save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  saveSettings() { this._save('djsim.settings', this.settings); }

  async start() {
    if (this.started) return;
    this.started = true;
    await this.engine.resume();
    await this.engine.startDemo(0);
    this.engine.setVolume(this.settings.volume);
  }

  onMenu(a) {
    if (a === 'open-files') this.ui.openFiles();
    if (a === 'next-preset') this.nextPreset(1);
    if (a === 'prev-preset') this.nextPreset(-1);
    if (a === 'toggle-ui') this.ui.toggleUI();
    if (a === 'auto-vj') { this.settings.autoVJ = !this.settings.autoVJ; this.ui.syncControls(); }
  }

  // ---------------------------------------------------------------- worlds
  loadEnvironment(i) {
    this.envIndex = ((i % ENVIRONMENTS.length) + ENVIRONMENTS.length) % ENVIRONMENTS.length;
    const def = ENVIRONMENTS[this.envIndex];
    if (this.env) this.env.dispose();
    this.vis.clearMaterials();
    this.env = buildEnvironment(def, this.scene, this.vis);
    const fog = def.fog;
    this.fogBase = fog[1];
    this.scene.fog = new THREE.FogExp2(fog[0], fog[1] * this.settings.fog);
    this.scene.background = new THREE.Color(fog[0]).multiplyScalar(0.5);
    this.populateCrowd();
    this.lights.build(this.env);
    this.lasers.build(this.env);
    this.fx.build(this.env);
    this.dj.place(this.env.djPos);
    this.dj.root.rotation.y = def.ring ? 0 : 0;
    this.director.setEnv(this.env);
    this.setPalette(def.palette, false);
    this.selectPerson(-1);
    this.ui.refreshWorld();
  }

  populateCrowd() {
    const def = this.env.def;
    const q = QUALITY[this.settings.quality];
    const n = clamp(this.settings.crowdSize || def.crowd, 50, q.maxCrowd);
    for (const p of this.personas) { p.log.length = 0; }
    if (this.selected >= n) this.selectPerson(-1);
    this.crowd.populate(this.personas.slice(0, n), this.env.area);
    this.ui.refreshCrowdSize(n);
  }

  setPalette(key, save = true) {
    const p = PALETTES[key]; if (!p) return;
    this.paletteKey = key;
    p.colors.forEach((c, i) => this.paletteTarget[i].set(c));
    if (save) this.settings.paletteKey = key;
    this.ui.refreshPalette();
  }

  applyPreset(p, announce = true) {
    if (!p) return;
    const envI = ENVIRONMENTS.findIndex((e) => e.id === p.env);
    if (envI >= 0 && envI !== this.envIndex) this.loadEnvironment(envI);
    this.vis.setMode(p.vis); this.lasers.setMode(p.laser); this.lights.setPattern(p.light); this.setPalette(p.palette, false);
    if (p.cam != null) this.director.setMode(p.cam);
    if (p.fx != null) this.settings.fxLevel = p.fx;
    if (p.bloom != null) this.settings.bloom = p.bloom;
    if (p.trails != null) this.settings.trails = p.trails;
    this.currentPreset = p.name;
    this.applySettings();
    this.ui.syncControls();
    if (announce) this.ui.banner(p.name, ENVIRONMENTS[this.envIndex].name);
  }

  nextPreset(d) {
    const i = PRESETS.findIndex((p) => p.name === this.currentPreset);
    this.applyPreset(PRESETS[((i + d) % PRESETS.length + PRESETS.length) % PRESETS.length]);
  }

  currentLook() {
    return { name: `My look ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, env: ENVIRONMENTS[this.envIndex].id, vis: this.vis.mode, laser: this.lasers.mode, light: this.lights.pattern, palette: this.paletteKey, cam: this.director.mode, fx: this.settings.fxLevel, bloom: this.settings.bloom, trails: this.settings.trails };
  }

  // ---------------------------------------------------------------- settings
  applyQuality() {
    const q = QUALITY[this.settings.quality];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr * (devicePixelRatio > 1 ? devicePixelRatio : 1), 2));
    this.resize();
  }

  applySettings() {
    const s = this.settings;
    this.A.sensitivity = s.sens; this.A.latency = s.latency / 1000;
    this.engine.setGain(s.gain); this.engine.setVolume(s.volume);
    if (this.scene.fog && this.fogBase != null) this.scene.fog.density = this.fogBase * s.fog;
    this.lights.haze = 0.4 + s.fog * 0.6;
    this.fx.level = s.fxLevel;
    this.final.uniforms.uGrain.value = s.grain;
    this.saveSettings();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    const q = QUALITY[this.settings.quality];
    this.bloom.setSize(w * q.bloomScale, h * q.bloomScale);
  }

  // ---------------------------------------------------------------- music events
  onTrack(tr) {
    this.A.reset();
    const song = matchAnthem(tr.title, tr.artist);
    this.anthem = song;
    this.crowd.onAnthem(song);
    this.ui.setTrack(tr, song);
    if (song) {
      this.vis.setText(song.title.toUpperCase(), song.artist);
      this.ui.banner(song.title, `${song.artist} · crowd: ${REACTION_LABELS[song.reaction]}`);
      this.ui.ticker(`🎵 The crowd recognises "${song.title}"! A wave of ${REACTION_LABELS[song.reaction].toLowerCase()} sweeps from the front.`);
      if (this.settings.autoVJ) { this._vjFlashText = this.time + 10; this._prevVis = this.vis.mode; this.vis.setMode(8); }
    } else {
      this.vis.setText((tr.title || 'DJSIM').toUpperCase().slice(0, 28), tr.artist || 'by Raygun');
    }
  }

  triggerDrop(manual = true) {
    if (manual) this.A.forceDrop();
    this.handleDrop(1);
  }

  handleDrop(intensity) {
    this.crowd.onDrop(this.A, intensity);
    const lvl = this.settings.fxLevel;
    if (this.settings.autoFX && lvl > 0) {
      this.fx.co2();
      if (intensity > 0.6) this.fx.pyro(lvl);
      if (Math.random() < 0.5 * intensity) this.fx.confetti(this.palette);
      if (Math.random() < 0.4) this.fx.fireworks(this.palette);
      this.fx.sparks(0.6);
    }
    if (this.settings.glitch) { this.glitch.enabled = true; this._glitchUntil = this.time + 0.45; }
    if (this.settings.autoVJ) this.autoVJ('drop');
    this.ui.flashSection();
  }

  autoVJ(kind) {
    const r = Math.random;
    if (kind === 'drop') {
      this.lasers.setMode([0, 1, 7, 3, 5][Math.floor(r() * 5)]);
      this.lights.setPattern([6, 7, 1, 2][Math.floor(r() * 4)]);
      if (r() < 0.5) this.vis.setMode([0, 1, 3, 6, 13, 12][Math.floor(r() * 6)]);
    } else if (kind === 'phrase') {
      if (r() < 0.7) this.vis.setMode(Math.floor(r() * VISUALS.length));
      if (r() < 0.6) this.lasers.setMode(Math.floor(r() * LASER_MODES.length));
      if (r() < 0.7) this.lights.setPattern(Math.floor(r() * LIGHT_PATTERNS.length));
      if (r() < 0.25) { const keys = Object.keys(PALETTES); this.setPalette(keys[Math.floor(r() * keys.length)], false); }
      if (r() < 0.2) this.lasers.colorMode = Math.floor(r() * 4);
    } else if (kind === 'breakdown') {
      this.lasers.setMode(2); this.lights.setPattern(9); this.vis.setMode([5, 10, 6, 14][Math.floor(r() * 4)]);
    }
    this.ui.syncControls();
  }

  // ---------------------------------------------------------------- selection
  selectPerson(i) {
    this.selected = i;
    this.crowd.followId = i;
    this.ui.showStory(i);
  }

  // ---------------------------------------------------------------- main loop
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    const t = this.time;
    // fps / auto quality
    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc > 1) {
      this.fps = this.fpsFrames / this.fpsAcc; this.fpsAcc = 0; this.fpsFrames = 0;
      if (this.settings.autoQuality && this.started) {
        if (this.fps < 40) this.lowFpsT++; else this.lowFpsT = 0;
        if (this.lowFpsT >= 3 && this.settings.quality > 0) {
          this.settings.quality--; this.lowFpsT = 0; this.applyQuality(); this.saveSettings();
          if (this.crowd.count > QUALITY[this.settings.quality].maxCrowd) this.populateCrowd();
          this.ui.toast(`Performance: switched to ${QUALITY[this.settings.quality].name} quality`); this.ui.syncControls();
        }
      }
    }

    const hint = this.engine.mode === 'demo' && this.started ? this.engine.demo.info() : null;
    const A = this.A.update(dt, hint);
    if (!this.started) { A.energy = 4; A.section = 'GROOVE'; A.beats = t * 2; A.beatPhase = A.beats % 1; }

    // music events
    if (A.drop) this.handleDrop(A.dropIntensity);
    if (A.events.includes('section')) {
      this.crowd.onSection(A);
      if (A.section === 'BUILDUP') this.crowd.onBuildup(A);
      if (A.section === 'BREAKDOWN' && this.settings.autoVJ) this.autoVJ('breakdown');
    }
    if (A.events.includes('phrase') && this.settings.autoVJ && A.section !== 'BREAKDOWN') this.autoVJ('phrase');
    if (this._vjFlashText && t > this._vjFlashText) { this._vjFlashText = 0; if (this.vis.mode === 8) this.vis.setMode(this._prevVis ?? 0); this.ui.syncControls(); }
    if (this._glitchUntil && t > this._glitchUntil) { this.glitch.enabled = false; this._glitchUntil = 0; }

    // palette smoothing
    for (let i = 0; i < 3; i++) this.palette[i].lerp(this.paletteTarget[i], 1 - Math.exp(-dt * 2));

    // systems
    const pal = this.palette;
    this.env.update(t, A, pal);
    this.vis.update(t, A, pal, dt);
    this.lights.update(t, dt, A, pal, this.settings.fxLevel);
    this.lasers.update(t, dt, A, pal);
    this.fx.update(t, dt, A, pal);
    this.dj.update(t, dt, A, pal);
    this.crowd.setRim(this.palette[(Math.floor(A.bar / 4)) % 3], 0.25 + A.bass * 0.6 + this.lights.blind * 0.8, 0.16 + (this.env.def.ambient || 0.3) * 0.25 + this.lights.blind * 0.25 + this.lights.strobe * 0.3);
    this.director.update(t, dt, A, this.crowd);
    this.crowd.update(dt, A, this.camera);

    // fog breathing with CO2
    if (this.scene.fog) this.scene.fog.density = this.fogBase * this.settings.fog * (1 + this.fx.co2Fog * 0.8);

    // post
    const drop = A.sinceDrop < 3 ? 1 - A.sinceDrop / 3 : 0;
    this.bloom.strength = this.settings.bloom * (0.75 + A.energy * 0.04 + A.kick * 0.25 + drop * 0.5);
    const trail = clamp(this.settings.trails + drop * 0.2 + (A.section === 'BREAKDOWN' ? 0.12 : 0), 0, 0.93);
    this.afterimage.uniforms.damp.value = Math.pow(trail, dt * 60); // frame-rate independent trails
    this.afterimage.enabled = this.afterimage.uniforms.damp.value > 0.02;
    const F = this.final.uniforms;
    F.uTime.value = t; F.uStrobe.value = this.lights.strobe; F.uPunch.value = A.kick * 0.18 * this.settings.fxLevel;
    F.uChroma.value = (A.kick * 0.6 + drop * 2.5) * this.settings.fxLevel;
    F.uFlashCol.value.copy(this.lights.strobe > 0 ? new THREE.Color(1, 1, 1) : pal[0]);
    this.composer.render(dt);
    this.ui.update(dt, A);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.djsim = new App();
  } catch (e) {
    console.error(e);
    document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font:16px sans-serif;background:#000;z-index:999">DJSIM could not start WebGL: ${e.message}</div>`);
  }
});

export { ENVIRONMENTS, PRESETS, PALETTES, VISUALS, LASER_MODES, LIGHT_PATTERNS, CAMERA_MODES };
