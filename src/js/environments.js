// Environments: 21 procedurally built venues sharing a kit of stages, LED walls, truss, skies and props.
import * as THREE from 'three';
import { makeRng, TAU } from './util.js';

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const TEX = {};
function tex(name) {
  if (TEX[name]) return TEX[name];
  const rng = makeRng(name.length * 31);
  let t;
  if (name === 'brick') t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2a1712'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
      const off = y % 2 ? 16 : 0; const v = 60 + rng() * 40;
      g.fillStyle = `rgb(${v + 40},${v * 0.45},${v * 0.35})`; g.fillRect(x * 32 + off + 1, y * 16 + 1, 30, 14);
    }
  }, [6, 2]);
  else if (name === 'concrete') t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3a3a3c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { const v = 40 + rng() * 40; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(rng() * w, rng() * h, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
  }, [4, 2]);
  else if (name === 'graffiti') t = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#2b2b30'; g.fillRect(0, 0, w, h);
    const cols = ['#ff2bd6', '#00f0ff', '#ffe600', '#7cff4f', '#ff5a1f', '#a46bff'];
    for (let i = 0; i < 26; i++) { g.strokeStyle = cols[i % cols.length]; g.lineWidth = 6 + rng() * 16; g.beginPath(); g.moveTo(rng() * w, rng() * h); for (let k = 0; k < 4; k++) g.quadraticCurveTo(rng() * w, rng() * h, rng() * w, rng() * h); g.stroke(); }
    g.font = '900 70px Arial'; g.fillStyle = '#ffffff'; g.fillText('DJSIM', 40, 160); g.fillStyle = '#ff2bd6'; g.fillText('RAYGUN', 260, 220);
  }, [3, 1]);
  else if (name === 'windows') t = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#05060a'; g.fillRect(0, 0, w, h);
    for (let y = 4; y < h; y += 10) for (let x = 4; x < w; x += 10) { if (rng() < 0.45) { const c = rng() < 0.7 ? '#ffd58a' : rng() < 0.5 ? '#9fd8ff' : '#ff9ae6'; g.fillStyle = c; g.globalAlpha = 0.4 + rng() * 0.6; g.fillRect(x, y, 6, 6); } }
    g.globalAlpha = 1;
  });
  else if (name === 'stained') t = canvasTex(128, 256, (g, w, h) => {
    const cols = ['#ff2b2b', '#2b6bff', '#ffd400', '#18c964', '#b02bff', '#ff8a00'];
    for (let i = 0; i < 60; i++) { g.fillStyle = cols[Math.floor(rng() * cols.length)]; g.beginPath(); const x = rng() * w, y = rng() * h; g.moveTo(x, y); g.lineTo(x + rng() * 50 - 25, y + rng() * 50); g.lineTo(x + rng() * 50 - 25, y - rng() * 30); g.fill(); }
    g.strokeStyle = '#111'; g.lineWidth = 3; for (let i = 0; i < 40; i++) { g.beginPath(); g.moveTo(rng() * w, rng() * h); g.lineTo(rng() * w, rng() * h); g.stroke(); }
  });
  else if (name === 'sand') t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9a26b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const v = rng(); g.fillStyle = `rgba(${150 + v * 80},${110 + v * 60},${70 + v * 40},0.5)`; g.fillRect(rng() * w, rng() * h, 2, 2); }
  }, [12, 12]);
  else if (name === 'grass') t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#16301a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { const v = rng(); g.fillStyle = `rgba(${20 + v * 40},${60 + v * 70},${20 + v * 30},0.6)`; g.fillRect(rng() * w, rng() * h, 1, 3); }
  }, [14, 14]);
  else if (name === 'stone') t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a4538'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const v = 55 + rng() * 40; g.fillStyle = `rgb(${v + 10},${v + 5},${v - 10})`; g.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28); }
  }, [4, 4]);
  else if (name === 'wood') t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5b3a22'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < 16; x++) { const v = 70 + rng() * 40; g.fillStyle = `rgb(${v + 30},${v * 0.6},${v * 0.35})`; g.fillRect(x * 16 + 1, 0, 14, h); }
  }, [8, 8]);
  else if (name === 'ice') t = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#9fe6ff'); gr.addColorStop(1, '#2a6fb5'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.45)'; for (let i = 0; i < 50; i++) { g.lineWidth = rng() * 2; g.beginPath(); g.moveTo(rng() * w, rng() * h); g.lineTo(rng() * w, rng() * h); g.stroke(); }
  }, [3, 3]);
  TEX[name] = t;
  return t;
}

// ---------------------------------------------------------------- shaders
const SKY_FRAG = `
varying vec3 vDir; uniform vec3 uTop, uMid, uBot, uSunCol; uniform vec3 uSunDir; uniform float uStars, uAurora, uTime, uSun, uClouds;
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5); float b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5); float c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5); float d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  vec3 col = y > 0.0 ? mix(uMid, uTop, pow(clamp(y,0.0,1.0), 0.6)) : mix(uMid, uBot, clamp(-y*4.0,0.0,1.0));
  if (uStars > 0.0 && y > 0.0){ vec3 q = floor(d*300.0); float s = step(0.9975, h(q)); col += vec3(s) * uStars * (0.5+0.5*sin(uTime*2.0+h(q)*20.0)) * smoothstep(0.0,0.3,y); }
  if (uAurora > 0.0 && y > 0.05){ float a = n2(vec2(d.x*3.0 + uTime*0.05, d.z*2.0)) ; float band = smoothstep(0.35,0.0,abs(y - 0.35 - 0.1*sin(d.x*4.0+uTime*0.2))) * a;
    col += mix(vec3(0.1,1.0,0.5), vec3(0.6,0.2,1.0), d.x*0.5+0.5) * band * uAurora; }
  if (uSun > 0.0){ float sd = max(dot(d, normalize(uSunDir)), 0.0); col += uSunCol * (pow(sd, 600.0)*3.0 + pow(sd, 12.0)*0.35) * uSun; }
  if (uClouds > 0.0 && y > 0.0){ float c = n2(d.xz/(y+0.15)*2.0 + uTime*0.01) * n2(d.xz/(y+0.15)*5.0); col = mix(col, uMid*1.4+0.1, c*uClouds*smoothstep(0.0,0.25,y)); }
  gl_FragColor = vec4(col, 1.0);
}`;
const SKY_VERT = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const WATER_VERT = `varying vec2 vUv; varying vec3 vW; uniform float uTime; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x*0.15+uTime)*0.25 + cos(p.y*0.2+uTime*0.8)*0.25; vW = (modelMatrix*vec4(p,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW,1.0); }`;
const WATER_FRAG = `varying vec2 vUv; varying vec3 vW; uniform float uTime, uKick; uniform vec3 uDeep, uShallow, uGlow;
void main(){ float w = sin(vW.x*0.8+uTime*1.5)*sin(vW.z*0.6-uTime) + sin(vW.x*2.3-uTime*2.0)*0.3; vec3 c = mix(uDeep, uShallow, 0.5+0.5*w);
  float spec = pow(max(0.0, w), 6.0); c += uGlow * spec * (0.5 + uKick); float fade = smoothstep(260.0, 20.0, length(vW.xz)); gl_FragColor = vec4(c*fade + uDeep*(1.0-fade)*0.5, 1.0); }`;

const LAVA_FRAG = `varying vec2 vUv; uniform float uTime, uKick; float hh(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5); }
float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y); }
void main(){ vec2 p = vUv*14.0; float v = n(p+uTime*0.15)*0.6 + n(p*2.3-uTime*0.1)*0.4; float cracks = smoothstep(0.55,0.5,v); vec3 c = mix(vec3(0.05,0.01,0.0), vec3(3.0,0.6,0.05)*(1.0+uKick*0.6), cracks); gl_FragColor = vec4(c,1.0); }`;
const SIMPLE_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

// ---------------------------------------------------------------- kit
class Kit {
  constructor(group, vis, rng) { this.g = group; this.vis = vis; this.rng = rng; this.animated = []; this.ledMeshes = []; this.lightMounts = []; this.laserMounts = []; this.blinders = []; this.strobes = []; this.pyroMounts = []; this.co2Mounts = []; this.emissives = []; }
  add(o) { this.g.add(o); return o; }
  mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...opts }); }
  box(w, h, d, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return this.add(m); }
  cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 12) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); return this.add(m); }

  sky(o) {
    const u = {
      uTop: { value: new THREE.Color(o.top || '#000005') }, uMid: { value: new THREE.Color(o.mid || '#05030f') }, uBot: { value: new THREE.Color(o.bot || '#000000') },
      uSunCol: { value: new THREE.Color(o.sunCol || '#ffb070') }, uSunDir: { value: new THREE.Vector3(...(o.sunDir || [0, 0.1, -1])) },
      uStars: { value: o.stars || 0 }, uAurora: { value: o.aurora || 0 }, uTime: { value: 0 }, uSun: { value: o.sun || 0 }, uClouds: { value: o.clouds || 0 }
    };
    const m = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false }));
    m.renderOrder = -10;
    this.animated.push((t) => { u.uTime.value = t; });
    return this.add(m);
  }

  floor(o = {}) {
    const size = o.size || 400;
    const mat = this.mat(o.color || '#0a0a0c', { roughness: o.rough ?? 0.35, metalness: o.metal ?? 0.5, map: o.tex ? tex(o.tex) : null });
    if (mat.map && o.repeat) mat.map.repeat.set(o.repeat, o.repeat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.rotation.x = -Math.PI / 2; m.receiveShadow = false;
    return this.add(m);
  }

  room(w, h, d, o = {}) {
    const mat = this.mat(o.color || '#151518', { map: o.tex ? tex(o.tex) : null, roughness: 0.9, side: THREE.BackSide });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(0, h / 2 - 0.01, o.z ?? 2);
    return this.add(m);
  }

  stage(o = {}) {
    const w = o.w || 16, d = o.d || 7, h = o.h || 1.3, z = o.z ?? -13;
    const mat = this.mat(o.color || '#101014', { roughness: 0.5, metalness: 0.4 });
    this.box(w, h, d, mat, 0, h / 2, z);
    // front LED strip
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.25), this.vis.createMaterial(w / 0.25 / 6, 0.9));
    strip.position.set(0, h - 0.18, z + d / 2 + 0.01); this.add(strip); this.ledMeshes.push(strip);
    // barrier
    if (o.barrier !== false) {
      const bm = this.mat('#9aa0a8', { metalness: 0.8, roughness: 0.35 });
      this.box(w + 4, 1.1, 0.12, bm, 0, 0.55, z + d / 2 + 1.6);
    }
    // DJ booth
    const booth = this.box(3.4, 1.05, 1.2, this.mat('#08080a', { metalness: 0.5, roughness: 0.4 }), 0, h + 0.52, z + 0.6);
    const bf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.0), this.vis.createMaterial(3.4, 0.8));
    bf.position.set(0, h + 0.52, z + 1.21); this.add(bf); this.ledMeshes.push(bf);
    this.djPos = new THREE.Vector3(0, h, z - 0.2);
    this.stageTop = h; this.stageZ = z; this.stageW = w;
    // speakers stacks
    if (o.speakers !== false) {
      const sm = this.mat('#0b0b0d', { roughness: 0.6 });
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 + 1.2);
        for (let i = 0; i < (o.stack || 3); i++) this.box(1.6, 1.1, 1.2, sm, x, 0.55 + i * 1.12, z + d / 2 - 0.5);
        // line array hanging
        for (let i = 0; i < 8; i++) { const b = this.box(1.2, 0.35, 0.8, sm, x, 9 - i * 0.37, z + d / 2 - 0.5); b.rotation.x = i * 0.03; }
      }
    }
    return this;
  }

  ledWall(o = {}) {
    const shape = o.shape || 'flat', w = o.w || 14, h = o.h || 7, y = o.y ?? 5.5, z = o.z ?? -16.2, bright = o.bright ?? 1;
    const addPanel = (pw, ph, x, py, pz, ry = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), this.vis.createMaterial(pw / ph, bright));
      m.position.set(x, py, pz); m.rotation.y = ry; this.add(m); this.ledMeshes.push(m); return m;
    };
    if (shape === 'flat') addPanel(w, h, 0, y, z);
    else if (shape === 'wings') { addPanel(w, h, 0, y, z); addPanel(w * 0.45, h * 0.8, -w * 0.78, y - h * 0.05, z + 2.2, 0.45); addPanel(w * 0.45, h * 0.8, w * 0.78, y - h * 0.05, z + 2.2, -0.45); }
    else if (shape === 'triple') { addPanel(w * 0.6, h, 0, y, z); addPanel(w * 0.3, h * 1.3, -w * 0.55, y + h * 0.15, z + 0.5); addPanel(w * 0.3, h * 1.3, w * 0.55, y + h * 0.15, z + 0.5); }
    else if (shape === 'circle') { const m = new THREE.Mesh(new THREE.CircleGeometry(h / 2, 64), this.vis.createMaterial(1, bright)); m.position.set(0, y, z); this.add(m); this.ledMeshes.push(m); }
    else if (shape === 'curved') {
      const geo = new THREE.CylinderGeometry(w, w, h, 48, 1, true, Math.PI - 0.6, 1.2);
      const m = new THREE.Mesh(geo, this.vis.createMaterial(w * 1.2 / h, bright)); m.material.side = THREE.BackSide; m.position.set(0, y, z + w); this.add(m); this.ledMeshes.push(m);
    } else if (shape === 'pipes') {
      const mat = this.vis.createMaterial(w / h, bright);
      const n = 23;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1); const ph = h * (0.55 + 0.45 * Math.sin(u * Math.PI));
        const g = new THREE.PlaneGeometry(w / n * 0.8, ph);
        const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) { uv.setX(k, u + (uv.getX(k) - 0.5) / n * 0.8); uv.setY(k, uv.getY(k) * ph / h); }
        const m = new THREE.Mesh(g, mat); m.position.set((u - 0.5) * w, y - h / 2 + ph / 2, z); this.add(m); this.ledMeshes.push(m);
      }
    } else if (shape === 'cube') {
      const mat = this.vis.createMaterial(1, bright);
      const m = new THREE.Mesh(new THREE.BoxGeometry(h, h, h), mat); m.position.set(0, y, z); this.add(m); this.ledMeshes.push(m);
      this.animated.push((t, A) => { m.rotation.y = t * 0.2; m.rotation.x = Math.sin(t * 0.13) * 0.3; m.scale.setScalar(1 + A.kick * 0.05); });
    } else if (shape === 'arch') {
      const geo = new THREE.TorusGeometry(w / 2, 0.6, 8, 48, Math.PI);
      const m = new THREE.Mesh(geo, this.vis.createMaterial(8, bright)); m.position.set(0, 1.3, z + 3); this.add(m); this.ledMeshes.push(m);
      addPanel(w * 0.7, h * 0.7, 0, y, z);
    } else if (shape === 'ring360') {
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; addPanel(w, h, Math.sin(a) * o.r, y, Math.cos(a) * o.r, a + Math.PI); }
    }
    return this;
  }

  truss(o = {}) {
    const w = o.w || 20, h = o.h || 11, z = o.z ?? -12, d = o.d || 10;
    const tm = this.mat('#8c929c', { metalness: 0.9, roughness: 0.3 });
    const beam = (len, x, y, zz, axis) => { const b = this.box(axis === 'x' ? len : 0.35, axis === 'y' ? len : 0.35, axis === 'z' ? len : 0.35, tm, x, y, zz); return b; };
    for (const sx of [-1, 1]) for (const sz of [0, 1]) beam(h, sx * w / 2, h / 2, z + sz * d * 0.6, 'y');
    for (const sz of [0, 1, 0.5]) beam(w, 0, h, z + sz * d * 0.6, 'x');
    for (const sx of [-1, 1]) beam(d * 0.6, sx * w / 2, h, z + d * 0.3, 'z');
    // mount points for moving heads along the beams
    const n = o.heads || 10;
    for (const row of [0, 0.5, 1]) {
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1) - 0.5) * (w - 1.5);
        this.lightMounts.push({ pos: new THREE.Vector3(x, h - 0.35, z + row * d * 0.6), row });
      }
    }
    // lasers on the front beam and stage floor
    const nl = o.lasers || 6;
    for (let i = 0; i < nl; i++) this.laserMounts.push({ pos: new THREE.Vector3((i / Math.max(1, nl - 1) - 0.5) * (w - 2), h - 0.4, z + d * 0.6), dir: 'down' });
    // blinders & strobes
    for (let i = 0; i < 6; i++) this.blinders.push(new THREE.Vector3((i / 5 - 0.5) * w * 0.9, h - 0.6, z + d * 0.6 + 0.2));
    for (let i = 0; i < 8; i++) this.strobes.push(new THREE.Vector3((i / 7 - 0.5) * w * 0.95, h + 0.3, z + d * 0.3));
    this.pyroMounts.push(new THREE.Vector3(-w / 2 + 1, (this.stageTop || 1.3), (this.stageZ ?? z) + 3), new THREE.Vector3(w / 2 - 1, (this.stageTop || 1.3), (this.stageZ ?? z) + 3), new THREE.Vector3(-w / 4, (this.stageTop || 1.3), (this.stageZ ?? z) + 3.3), new THREE.Vector3(w / 4, (this.stageTop || 1.3), (this.stageZ ?? z) + 3.3));
    this.co2Mounts.push(new THREE.Vector3(-w / 2 + 2, (this.stageTop || 1.3), (this.stageZ ?? z) + 2.5), new THREE.Vector3(w / 2 - 2, (this.stageTop || 1.3), (this.stageZ ?? z) + 2.5));
    return this;
  }

  floorLasers(n = 4, z = -9.5, y = 1.4) { for (let i = 0; i < n; i++) this.laserMounts.push({ pos: new THREE.Vector3((i / Math.max(1, n - 1) - 0.5) * 12, y, z), dir: 'up' }); return this; }

  // --- props
  palm(x, z, s = 1) {
    const trunk = this.mat('#5a3d22'); const leaf = this.mat('#1f5a2a', { roughness: 0.9 });
    const t = this.cyl(0.18 * s, 0.3 * s, 7 * s, trunk, x, 3.5 * s, z, 7); t.rotation.z = (this.rng() - 0.5) * 0.25;
    for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.5 * s, 3.4 * s, 4), leaf); l.position.set(x, 7 * s, z); l.rotation.set(Math.PI / 2 - 0.5, i / 7 * TAU, 0, 'YXZ'); l.translateY(1.4 * s); this.add(l); }
  }
  tree(x, z, s = 1, col = '#123a22') {
    const m = this.mat(col, { roughness: 0.95 });
    this.cyl(0.15 * s, 0.25 * s, 2 * s, this.mat('#2b1d12'), x, s, z, 6);
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry((2.2 - i * 0.55) * s, 2.6 * s, 7), m); c.position.set(x, (2.4 + i * 1.4) * s, z); this.add(c); }
  }
  building(x, z, w, h, d) {
    const t = tex('windows').clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 12)));
    const m = new THREE.MeshStandardMaterial({ color: '#0a0c12', emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.6, metalness: 0.4 });
    this.box(w, h, d, m, x, h / 2, z);
    if (this.rng() < 0.4) { const ant = this.box(0.3, 6, 0.3, this.mat('#222'), x, h + 3, z); const red = this.box(0.6, 0.6, 0.6, new THREE.MeshBasicMaterial({ color: '#ff2020' }), x, h + 6.2, z); this.animated.push((tt) => { red.visible = Math.sin(tt * 3 + x) > 0; }); }
  }
  neonSign(x, y, z, w, h, color, ry = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), toneMapped: false }));
    m.position.set(x, y, z); m.rotation.y = ry; this.add(m);
    const ph = this.rng() * 10; this.animated.push((t, A) => { m.visible = !(Math.sin(t * 13 + ph) > 0.97); m.material.color.set(color).multiplyScalar(2 + A.kick * 1.5); });
    return m;
  }
  water(o = {}) {
    const u = { uTime: { value: 0 }, uKick: { value: 0 }, uDeep: { value: new THREE.Color(o.deep || '#02101c') }, uShallow: { value: new THREE.Color(o.shallow || '#0b3a5a') }, uGlow: { value: new THREE.Color(o.glow || '#ffb070') } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 80, 80), new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, uniforms: u }));
    m.rotation.x = -Math.PI / 2; m.position.y = o.y ?? -0.6; m.position.z = o.z ?? -60; this.add(m);
    this.animated.push((t, A) => { u.uTime.value = t; u.uKick.value = A.kick; });
    return m;
  }
  lava(x, z, w, d) {
    const u = { uTime: { value: 0 }, uKick: { value: 0 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.ShaderMaterial({ vertexShader: SIMPLE_VERT, fragmentShader: LAVA_FRAG, uniforms: u, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); this.add(m);
    this.animated.push((t, A) => { u.uTime.value = t; u.uKick.value = A.kick; });
  }
  pillar(x, z, h, r = 0.6, mat) { return this.cyl(r, r * 1.1, h, mat || this.mat('#3a3630'), x, h / 2, z, 12); }
  uplight(x, z, color, h = 6) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(1.2, h, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(x, h / 2, z); m.rotation.x = Math.PI; this.add(m); this.emissives.push(m);
    return m;
  }
  stars3D(n = 1500, r = 300) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(r * (0.6 + Math.random() * 0.4)); pos.set([v.x, Math.abs(v.y), v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.2, sizeAttenuation: false, fog: false })));
  }
}

// ---------------------------------------------------------------- environment catalogue
const RECT = (x0, x1, zFront, zBack, extra = {}) => ({ type: 'rect', x0, x1, zFront, zBack, frontBias: 1.5, ...extra });

export const ENVIRONMENTS = [
  {
    id: 'warehouse', name: 'Warehouse Rave', desc: 'Brick, steel trusses and a low ceiling of haze.', palette: 'redalert', fog: ['#120707', 0.03], crowd: 700,
    area: RECT(-11, 11, -6.5, 14), bar: { x: 12, z: 12 }, particles: 'dust', fx: { pyro: false, co2: true, fireworks: false }, lights: 14, ambient: 0.25,
    build(k) {
      k.floor({ tex: 'concrete', color: '#666', rough: 0.6, metal: 0.2, repeat: 30 });
      k.room(30, 12, 40, { tex: 'brick', color: '#c9a08a', z: 0 });
      k.stage({ w: 14, h: 1.1, z: -13, stack: 2 }).ledWall({ shape: 'flat', w: 10, h: 4.5, y: 5, z: -16.4 }).truss({ w: 18, h: 9, z: -14, d: 12, heads: 8, lasers: 4 });
      const tm = k.mat('#55595f', { metalness: 0.9, roughness: 0.4 });
      for (let z = -15; z < 20; z += 5) k.box(30, 0.4, 0.4, tm, 0, 11.5, z);
      for (const x of [-14, 14]) for (let z = -10; z < 20; z += 8) k.pillar(x - Math.sign(x) * 0.5, z, 12, 0.35, tm);
    }
  },
  {
    id: 'mainstage', name: 'Mainstage Festival', desc: 'Massive LED wings, pyro, CO2 and fireworks for a sea of people.', palette: 'neon', fog: ['#05030c', 0.012], crowd: 1600,
    area: RECT(-22, 22, -4, 32, { frontBias: 1.8 }), bar: { x: 26, z: 30 }, particles: 'confettiAmbient', fx: { pyro: true, co2: true, fireworks: true }, lights: 22, ambient: 0.18, camDist: 1.6,
    build(k) {
      k.sky({ top: '#020210', mid: '#0b0820', bot: '#000', stars: 0.8 });
      k.floor({ tex: 'grass', color: '#5a6a5a', rough: 0.95, metal: 0, repeat: 60 });
      k.stage({ w: 30, h: 2.2, d: 10, z: -14, stack: 4 }).ledWall({ shape: 'wings', w: 22, h: 11, y: 9.5, z: -19 }).truss({ w: 34, h: 18, z: -18, d: 14, heads: 14, lasers: 8 });
      k.floorLasers(6, -9.5, 2.4);
      for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) k.box(3, 22, 3, k.mat('#111'), sx * (19 + i * 4), 11, -16);
      k.box(6, 3, 4, k.mat('#15151a'), 0, 1.5, 22); // FOH
    }
  },
  {
    id: 'bunker', name: 'Techno Bunker', desc: 'Raw concrete, white strobes, red lasers. No phones.', palette: 'mono', fog: ['#050505', 0.045], crowd: 600,
    area: RECT(-9, 9, -6, 13), bar: { x: 9, z: 13 }, particles: 'dust', fx: { pyro: false, co2: false, fireworks: false }, lights: 10, ambient: 0.12,
    build(k) {
      k.floor({ tex: 'concrete', color: '#555', rough: 0.4, metal: 0.4, repeat: 30 });
      k.room(24, 8, 36, { tex: 'concrete', color: '#777', z: 1 });
      k.stage({ w: 8, h: 0.8, d: 4, z: -12, speakers: true, stack: 3 }).ledWall({ shape: 'flat', w: 16, h: 1.2, y: 6.5, z: -15.8, bright: 0.9 }).truss({ w: 20, h: 7.4, z: -13, d: 22, heads: 6, lasers: 4 });
      for (let x = -9; x <= 9; x += 6) for (let z = -6; z <= 14; z += 7) k.box(0.9, 8, 0.9, k.mat('#4a4a4a', { map: tex('concrete') }), x, 4, z).visible = Math.abs(x) > 4;
    }
  },
  {
    id: 'ibiza', name: 'Ibiza Sunset Beach Club', desc: 'Golden hour over the sea, palms, pool deck and deep house.', palette: 'sunset', fog: ['#3a1e2a', 0.006], crowd: 650,
    area: RECT(-14, 14, -6, 12), bar: { x: 15, z: 4 }, particles: 'none', fx: { pyro: false, co2: true, fireworks: true }, lights: 12, ambient: 0.55, sunset: true,
    build(k) {
      k.sky({ top: '#1c2a6b', mid: '#ff7a59', bot: '#2a0f1e', sun: 1.3, sunDir: [0, 0.06, -1], sunCol: '#ffcf7a', clouds: 0.4 });
      k.floor({ tex: 'wood', color: '#c9a27a', rough: 0.7, metal: 0, repeat: 40 });
      k.water({ deep: '#1b1030', shallow: '#d0607a', glow: '#ffd08a', y: -0.5, z: -80 });
      k.stage({ w: 12, h: 0.9, d: 5, z: -11, speakers: true, stack: 2, barrier: false }).ledWall({ shape: 'circle', h: 7, y: 4.8, z: -13.8 }).truss({ w: 16, h: 7, z: -12, d: 8, heads: 8, lasers: 4 });
      for (let i = 0; i < 10; i++) { const s = i % 2 ? -1 : 1; k.palm(s * (17 + (i % 3) * 2), -10 + i * 3.5, 0.9 + (i % 3) * 0.15); }
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshStandardMaterial({ color: '#29d4ff', emissive: '#0a6aa0', roughness: 0.1, metalness: 0.2 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(-19, 0.02, 4); k.add(pool);
    }
  },
  {
    id: 'tokyo', name: 'Neo-Tokyo Rooftop', desc: 'Skyline, neon kanji-style signs and rain on a mirror-wet floor.', palette: 'cyberpunk', fog: ['#0a0614', 0.018], crowd: 550,
    area: RECT(-11, 11, -6, 10), bar: { x: 11, z: 9 }, particles: 'rain', fx: { pyro: false, co2: true, fireworks: false }, lights: 12, ambient: 0.2,
    build(k) {
      k.sky({ top: '#05020c', mid: '#2a0b3a', bot: '#000', clouds: 0.3 });
      k.floor({ color: '#08080c', rough: 0.08, metal: 0.9, size: 60 });
      k.stage({ w: 10, h: 0.9, d: 4.5, z: -11 }).ledWall({ shape: 'triple', w: 14, h: 5, y: 5, z: -14 }).truss({ w: 16, h: 8, z: -12, d: 8, heads: 8, lasers: 6 });
      const rail = k.mat('#2a2a33', { metalness: 0.8 });
      k.box(28, 1, 0.15, rail, 0, 0.5, 12); k.box(0.15, 1, 28, rail, -14, 0.5, -1); k.box(0.15, 1, 28, rail, 14, 0.5, -1);
      const rng = k.rng;
      for (let i = 0; i < 60; i++) { const a = rng() * TAU, r = 45 + rng() * 110; const x = Math.cos(a) * r, z = Math.sin(a) * r - 20; k.building(x, z, 6 + rng() * 10, 20 + rng() * 80, 6 + rng() * 10); }
      const cols = ['#ff2bd6', '#00f0ff', '#ffe600', '#ff3b3b', '#7cff4f'];
      for (let i = 0; i < 14; i++) k.neonSign(-30 + i * 4.6, 10 + rng() * 25, -45 - rng() * 20, 1.4, 4 + rng() * 4, cols[i % cols.length]);
    }
  },
  {
    id: 'boiler', name: 'Basement Boiler Room', desc: 'The DJ in the middle, the crowd all around, one camera on the decks.', palette: 'gold', fog: ['#0d0905', 0.05], crowd: 260,
    area: { type: 'ring', cx: 0, cz: 0, r0: 2.6, r1: 9 }, bar: { x: 10, z: 8 }, particles: 'dust', fx: { pyro: false, co2: false, fireworks: false }, lights: 8, ambient: 0.35, ring: true,
    build(k) {
      k.floor({ tex: 'wood', color: '#6a4a30', rough: 0.6, metal: 0.1, repeat: 20, size: 40 });
      k.room(24, 5, 24, { tex: 'brick', color: '#9a7060', z: 0 });
      const bm = k.mat('#08080a', { metalness: 0.5, roughness: 0.4 });
      k.box(3, 1.05, 1.2, bm, 0, 0.52, 0);
      const bf = new THREE.Mesh(new THREE.PlaneGeometry(3, 1), k.vis.createMaterial(3, 0.6)); bf.position.set(0, 0.52, 0.61); k.add(bf); k.ledMeshes.push(bf);
      k.djPos = new THREE.Vector3(0, 0, -0.8); k.stageTop = 0; k.stageZ = 0;
      k.ledWall({ shape: 'ring360', w: 6, h: 2.2, y: 3.3, r: 11.8, bright: 0.8 });
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; k.lightMounts.push({ pos: new THREE.Vector3(Math.cos(a) * 5, 4.7, Math.sin(a) * 5), row: i % 2 }); }
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; k.laserMounts.push({ pos: new THREE.Vector3(Math.cos(a) * 11, 4.5, Math.sin(a) * 11), dir: 'in' }); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.strobes.push(new THREE.Vector3(Math.cos(a) * 8, 4.8, Math.sin(a) * 8)); }
      // hanging bulbs
      for (let i = 0; i < 24; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb050').multiplyScalar(3), toneMapped: false })); b.position.set((k.rng() - 0.5) * 20, 4.2 - k.rng() * 0.6, (k.rng() - 0.5) * 20); k.add(b); }
    }
  },
  {
    id: 'playa', name: 'Desert Playa Sunrise', desc: 'Dust, art cars and giant sculptures as dawn breaks.', palette: 'sunset', fog: ['#b07a5a', 0.01], crowd: 900,
    area: RECT(-18, 18, -5, 22), bar: { x: 20, z: 18 }, particles: 'sand', fx: { pyro: true, co2: false, fireworks: false }, lights: 14, ambient: 0.6,
    build(k) {
      k.sky({ top: '#2b3f7a', mid: '#ffb48a', bot: '#c08060', sun: 1.1, sunDir: [0.6, 0.04, -0.8], sunCol: '#ffe0a0' });
      k.floor({ tex: 'sand', color: '#d8b080', rough: 1, metal: 0, repeat: 40 });
      k.stage({ w: 16, h: 1.4, z: -13, stack: 3 }).ledWall({ shape: 'cube', h: 6, y: 8, z: -15 }).truss({ w: 20, h: 12, z: -14, d: 10, heads: 10, lasers: 6 });
      const rng = k.rng;
      // art cars
      for (let i = 0; i < 4; i++) {
        const x = (i % 2 ? 1 : -1) * (26 + rng() * 6), z = -5 + i * 9;
        k.box(6, 2.2, 3, k.mat('#222'), x, 1.6, z);
        const top = k.box(4, 0.4, 2.4, new THREE.MeshBasicMaterial({ color: '#ff2bd6', toneMapped: false }), x, 3, z);
        k.animated.push((t, A) => top.material.color.setHSL((t * 0.1 + i * 0.25) % 1, 1, 0.3 + A.kick * 0.4));
      }
      // sculptures
      const tor = new THREE.Mesh(new THREE.TorusKnotGeometry(4, 0.6, 120, 12), k.mat('#c0c4cc', { metalness: 1, roughness: 0.2 })); tor.position.set(-34, 8, 10); k.add(tor);
      k.animated.push((t) => { tor.rotation.y = t * 0.1; });
      const man = k.box(1.5, 14, 1.5, k.mat('#8a6a4a'), 38, 7, 20);
      for (let i = 0; i < 30; i++) k.box(0.4 + rng(), 0.4 + rng() * 2, 0.4 + rng(), k.mat('#a08060'), (rng() - 0.5) * 160, 0.4, -30 - rng() * 80);
    }
  },
  {
    id: 'cyber', name: 'Cyber Neon Club', desc: 'Chrome, grid floors and cyan/magenta everything.', palette: 'cyberpunk', fog: ['#06030f', 0.028], crowd: 650,
    area: RECT(-11, 11, -6.5, 12), bar: { x: 12, z: 11 }, particles: 'none', fx: { pyro: false, co2: true, fireworks: false }, lights: 14, ambient: 0.18, gridFloor: true,
    build(k) {
      const gridMat = new THREE.ShaderMaterial({ vertexShader: SIMPLE_VERT, uniforms: { uTime: { value: 0 }, uKick: { value: 0 }, uC: { value: new THREE.Color('#00f0ff') }, uC2: { value: new THREE.Color('#ff2bd6') } },
        fragmentShader: `varying vec2 vUv; uniform float uTime,uKick; uniform vec3 uC,uC2; void main(){ vec2 g = vUv*80.0; vec2 f = abs(fract(g)-0.5); float l = smoothstep(0.47,0.5,max(f.x,f.y)); float pulse = smoothstep(0.02,0.0,abs(fract(length(vUv-vec2(0.5,0.45))*6.0 - uTime*0.5)-0.5)-0.45); gl_FragColor = vec4(mix(uC,uC2,vUv.y)*(l*(0.6+uKick)+pulse*0.6) + vec3(0.01,0.0,0.02), 1.0); }`, toneMapped: false });
      const gf = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), gridMat); gf.rotation.x = -Math.PI / 2; k.add(gf);
      k.animated.push((t, A, pal) => { gridMat.uniforms.uTime.value = t; gridMat.uniforms.uKick.value = A.kick; gridMat.uniforms.uC.value.copy(pal[0]); gridMat.uniforms.uC2.value.copy(pal[1]); });
      k.room(28, 10, 34, { color: '#0b0b14', z: 1 });
      k.stage({ w: 12, h: 1, z: -12.5 }).ledWall({ shape: 'curved', w: 16, h: 6, y: 5, z: -16 }).truss({ w: 18, h: 8.5, z: -13, d: 10, heads: 10, lasers: 8 });
      for (let i = -3; i <= 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 10, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? '#00f0ff' : '#ff2bd6').multiplyScalar(3), toneMapped: false })); b.position.set(i * 4, 5, 17.8); k.add(b); }
      for (const sx of [-1, 1]) for (let z = -8; z < 16; z += 4) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 10, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#7a5cff').multiplyScalar(3), toneMapped: false })); b.position.set(sx * 13.8, 5, z); k.add(b); }
    }
  },
  {
    id: 'icecave', name: 'Ice Cave', desc: 'Blue crystalline walls, frozen stalactites and snowfall.', palette: 'ice', fog: ['#0a1a2e', 0.025], crowd: 500,
    area: RECT(-10, 10, -6, 11), bar: { x: 10, z: 10 }, particles: 'snow', fx: { pyro: false, co2: true, fireworks: false }, lights: 10, ambient: 0.4,
    build(k) {
      k.floor({ tex: 'ice', color: '#a8d8ff', rough: 0.15, metal: 0.3, repeat: 20 });
      const cave = new THREE.Mesh(new THREE.SphereGeometry(26, 24, 16, 0, TAU, 0, Math.PI / 2), k.mat('#6fb6e8', { map: tex('ice'), side: THREE.BackSide, roughness: 0.3, emissive: '#0a2a4a' }));
      cave.scale.set(1, 0.45, 1); k.add(cave);
      k.stage({ w: 11, h: 1, z: -12, color: '#9fd0f0' }).ledWall({ shape: 'flat', w: 11, h: 5, y: 5, z: -15.5 }).truss({ w: 15, h: 8.5, z: -13, d: 8, heads: 8, lasers: 4 });
      const cm = k.mat('#bfe8ff', { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, emissive: '#2a6aa0' });
      const rng = k.rng;
      for (let i = 0; i < 70; i++) { const a = rng() * TAU, r = 6 + rng() * 17; const c = new THREE.Mesh(new THREE.ConeGeometry(0.2 + rng() * 0.5, 1 + rng() * 3, 5), cm); c.position.set(Math.cos(a) * r, 10.5 - rng() * 1.5, Math.sin(a) * r); c.rotation.x = Math.PI; k.add(c); }
      for (let i = 0; i < 26; i++) { const a = rng() * TAU, r = 18 + rng() * 6; const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.6 + rng() * 1.6), cm); c.position.set(Math.cos(a) * r, 0.8, Math.sin(a) * r); c.scale.y = 2.4; k.add(c); }
    }
  },
  {
    id: 'jungle', name: 'Jungle Temple', desc: 'A stone ziggurat stage, vines, torches and fireflies.', palette: 'forest', fog: ['#06120a', 0.03], crowd: 700,
    area: RECT(-13, 13, -4, 14), bar: { x: 14, z: 12 }, particles: 'fireflies', fx: { pyro: true, co2: false, fireworks: false }, lights: 12, ambient: 0.3,
    build(k) {
      k.sky({ top: '#01030a', mid: '#0a1a14', bot: '#000', stars: 0.5 });
      k.floor({ tex: 'grass', color: '#4a5a3a', rough: 1, metal: 0, repeat: 40 });
      const sm = k.mat('#7a7058', { map: tex('stone') });
      for (let i = 0; i < 5; i++) k.box(26 - i * 4.5, 1.5, 14 - i * 2, sm, 0, 0.75 + i * 1.5, -17);
      k.stage({ w: 14, h: 1.3, z: -9.5, color: '#5a5442', speakers: true }).ledWall({ shape: 'flat', w: 9, h: 4, y: 9.5, z: -14.8 }).truss({ w: 18, h: 10, z: -11, d: 7, heads: 8, lasers: 6 });
      const rng = k.rng;
      for (let i = 0; i < 30; i++) { const a = rng() * TAU, r = 22 + rng() * 25; k.tree(Math.cos(a) * r, Math.sin(a) * r, 1.4 + rng(), '#0f3a1c'); }
      // torches
      for (let i = 0; i < 8; i++) {
        const x = (i % 2 ? 1 : -1) * 15, z = -8 + Math.floor(i / 2) * 6;
        k.cyl(0.1, 0.12, 2.4, k.mat('#3a2a1a'), x, 1.2, z, 6);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a20').multiplyScalar(3), toneMapped: false })); fl.position.set(x, 2.7, z); k.add(fl);
        k.animated.push((t) => { fl.scale.set(1, 0.8 + 0.4 * Math.sin(t * 17 + i) * Math.sin(t * 7 + i * 2), 1); });
      }
    }
  },
  {
    id: 'space', name: 'Orbital Space Station', desc: 'Earth through the window, zero-g confetti and infinite stars.', palette: 'ultraviolet', fog: ['#02020a', 0.008], crowd: 450,
    area: RECT(-10, 10, -6, 9), bar: { x: 10, z: 8 }, particles: 'stars', fx: { pyro: false, co2: true, fireworks: false }, lights: 10, ambient: 0.25,
    build(k) {
      k.sky({ top: '#000', mid: '#02010a', bot: '#000', stars: 1.4 }); k.stars3D(2500, 380);
      k.floor({ color: '#1a1c24', rough: 0.25, metal: 0.8, size: 40 });
      const hull = k.mat('#c8ccd6', { metalness: 0.7, roughness: 0.35 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(15, 0.5, 8, 48), hull); ring.rotation.x = Math.PI / 2; ring.position.y = 9; k.add(ring);
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const r = k.box(0.6, 9, 0.6, hull, Math.cos(a) * 15, 4.5, Math.sin(a) * 15); }
      const earth = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 32), new THREE.MeshStandardMaterial({ color: '#2a6ad0', emissive: '#0a2a6a', roughness: 0.8 }));
      earth.position.set(-60, -70, -180); k.add(earth);
      const atmo = new THREE.Mesh(new THREE.SphereGeometry(93, 48, 32), new THREE.MeshBasicMaterial({ color: '#6ab8ff', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.BackSide })); atmo.position.copy(earth.position); k.add(atmo);
      const land = new THREE.Mesh(new THREE.IcosahedronGeometry(90.4, 3), new THREE.MeshStandardMaterial({ color: '#3a8a3a', flatShading: true, transparent: true, opacity: 0.5 })); land.position.copy(earth.position); k.add(land);
      k.animated.push((t) => { earth.rotation.y = t * 0.01; land.rotation.y = t * 0.01; });
      const moon = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), k.mat('#aaa', { emissive: '#333' })); moon.position.set(120, 60, -200); k.add(moon);
      k.stage({ w: 11, h: 1, z: -11.5, color: '#2a2d38' }).ledWall({ shape: 'circle', h: 7, y: 6, z: -14.5 }).truss({ w: 16, h: 8.8, z: -12, d: 8, heads: 8, lasers: 6 });
    }
  },
  {
    id: 'stadium', name: 'Stadium Night', desc: 'Tiered stands, colossal line arrays and fireworks overhead.', palette: 'rainbow', fog: ['#04040a', 0.008], crowd: 2000,
    area: RECT(-24, 24, -4, 34, { frontBias: 1.6 }), bar: { x: 26, z: 30 }, particles: 'none', fx: { pyro: true, co2: true, fireworks: true }, lights: 24, ambient: 0.2, camDist: 1.8,
    build(k) {
      k.sky({ top: '#01010a', mid: '#0a0a1c', bot: '#000', stars: 0.4 });
      k.floor({ tex: 'grass', color: '#3a5a3a', rough: 1, metal: 0, repeat: 70 });
      const sm = k.mat('#25262c');
      for (let i = 0; i < 10; i++) {
        const r = 55 + i * 3.2, h = 1.5 + i * 2.2;
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.9, 64, 1, true, Math.PI * 0.35, Math.PI * 1.3), sm); seg.material.side = THREE.DoubleSide; seg.position.set(0, h, 0); k.add(seg);
        const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.9, 0.4), new THREE.MeshBasicMaterial({ color: '#fff', toneMapped: false }), 160);
        const m4 = new THREE.Matrix4(), c = new THREE.Color();
        for (let j = 0; j < 160; j++) { const a = Math.PI * 0.35 + (j / 160) * Math.PI * 1.3 - Math.PI / 2; m4.makeTranslation(Math.cos(a) * (r - 0.5), h + 0.9, -Math.sin(a) * (r - 0.5) ); pm.setMatrixAt(j, m4); pm.setColorAt(j, c.setHSL(k.rng(), 0.6, 0.15 + k.rng() * 0.2)); }
        k.add(pm);
        k.animated.push((t, A) => { pm.material.color.setScalar(0.6 + A.bass * 0.8 + (A.section === 'BREAKDOWN' ? 1.5 : 0)); });
      }
      k.stage({ w: 34, h: 2.6, d: 11, z: -16, stack: 4 }).ledWall({ shape: 'wings', w: 26, h: 13, y: 11, z: -21 }).truss({ w: 40, h: 21, z: -20, d: 15, heads: 16, lasers: 10 });
      k.floorLasers(8, -10.5, 2.8);
    }
  },
  {
    id: 'cathedral', name: 'Gothic Cathedral Rave', desc: 'Stained-glass light, stone pillars and an organ-pipe LED wall.', palette: 'gold', fog: ['#0a0806', 0.03], crowd: 600,
    area: RECT(-8, 8, -6, 16), bar: { x: 9, z: 16 }, particles: 'dust', fx: { pyro: false, co2: false, fireworks: false }, lights: 12, ambient: 0.3,
    build(k) {
      k.floor({ tex: 'stone', color: '#8a8070', rough: 0.5, metal: 0.2, repeat: 12 });
      k.room(22, 24, 44, { tex: 'stone', color: '#7a7060', z: 2 });
      k.stage({ w: 12, h: 1.2, z: -13, color: '#2a241c', speakers: true, stack: 2 }).ledWall({ shape: 'pipes', w: 14, h: 12, y: 8.5, z: -18.5 }).truss({ w: 16, h: 12, z: -14, d: 10, heads: 8, lasers: 4 });
      const pm = k.mat('#6a6050', { map: tex('stone') });
      for (const sx of [-1, 1]) for (let z = -10; z <= 20; z += 6) {
        k.pillar(sx * 8.8, z, 22, 0.75, pm);
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 8), new THREE.MeshBasicMaterial({ map: tex('stained'), toneMapped: false, color: '#bbbbbb' })); win.position.set(sx * 10.95, 11, z + 3); win.rotation.y = -sx * Math.PI / 2; k.add(win);
        k.animated.push((t, A) => win.material.color.setScalar(0.8 + A.mid * 1.2));
      }
      const rose = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshBasicMaterial({ map: tex('stained'), toneMapped: false })); rose.position.set(0, 18, 23.9); rose.rotation.y = Math.PI; k.add(rose);
    }
  },
  {
    id: 'forest', name: 'Forest Clearing', desc: 'Uplit pines, a full moon and mist rolling through.', palette: 'forest', fog: ['#081410', 0.028], crowd: 550,
    area: RECT(-12, 12, -5, 12), bar: { x: 13, z: 11 }, particles: 'fireflies', fx: { pyro: false, co2: true, fireworks: false }, lights: 10, ambient: 0.35,
    build(k) {
      k.sky({ top: '#020814', mid: '#0a1a24', bot: '#000', stars: 1, sun: 0.7, sunDir: [-0.3, 0.45, -1], sunCol: '#dfe8ff' });
      k.floor({ tex: 'grass', color: '#3a4a3a', rough: 1, metal: 0, repeat: 40 });
      k.stage({ w: 10, h: 0.9, z: -11, color: '#3a2a1a', speakers: true, stack: 2 }).ledWall({ shape: 'flat', w: 9, h: 4, y: 4.6, z: -14 }).truss({ w: 14, h: 7.5, z: -12, d: 7, heads: 8, lasers: 6 });
      const rng = k.rng; const cols = ['#00ffa0', '#7a5cff', '#ff2bd6', '#00c8ff'];
      for (let i = 0; i < 60; i++) {
        const a = rng() * TAU, r = 18 + rng() * 30; const x = Math.cos(a) * r, z = Math.sin(a) * r;
        k.tree(x, z, 1.4 + rng() * 1.2, '#0c2a18');
        if (r < 26 && rng() < 0.5) k.uplight(x, z, cols[i % cols.length], 9);
      }
    }
  },
  {
    id: 'yacht', name: 'Superyacht Party', desc: 'A polished deck at sea with city lights on the horizon.', palette: 'ocean', fog: ['#030812', 0.012], crowd: 280,
    area: RECT(-6.5, 6.5, -5.5, 8), bar: { x: 5, z: 8 }, particles: 'none', fx: { pyro: false, co2: true, fireworks: true }, lights: 8, ambient: 0.35,
    build(k) {
      k.sky({ top: '#01030c', mid: '#0a1430', bot: '#000', stars: 0.8 });
      k.water({ deep: '#010610', shallow: '#0a2a4a', glow: '#7ab8ff', y: -1.2, z: 0 });
      const deck = k.box(16, 0.4, 34, k.mat('#a07a50', { map: tex('wood'), roughness: 0.4 }), 0, -0.2, 0);
      const hull = k.mat('#f0f2f6', { roughness: 0.3, metalness: 0.3 });
      k.box(17, 3, 36, hull, 0, -1.9, 0);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(8.5, 12, 4), hull); bow.rotation.set(-Math.PI / 2, Math.PI / 4, 0); bow.scale.set(1, 1, 0.35); bow.position.set(0, -1.6, 23.5); k.add(bow);
      k.box(10, 3.5, 8, hull, 0, 1.75, 14);
      k.box(16, 1, 0.1, k.mat('#cfd6e0', { metalness: 0.9 }), 0, 0.5, -16.9);
      for (const sx of [-1, 1]) k.box(0.1, 1, 34, k.mat('#cfd6e0', { metalness: 0.9 }), sx * 8, 0.5, 0);
      k.stage({ w: 8, h: 0.6, d: 3.5, z: -11.5, speakers: false, barrier: false }).ledWall({ shape: 'flat', w: 8, h: 3.4, y: 3.4, z: -13.4 }).truss({ w: 11, h: 5.5, z: -12.5, d: 5, heads: 6, lasers: 4 });
      for (let i = 0; i < 70; i++) { const x = -150 + i * 4.3 + k.rng() * 2; k.building(x, -200 - k.rng() * 30, 3 + k.rng() * 4, 6 + k.rng() * 40, 4); }
    }
  },
  {
    id: 'synthwave', name: 'Retro 80s Synthwave', desc: 'A sun-grid horizon, palm silhouettes and chrome.', palette: 'synth', fog: ['#1a0624', 0.012], crowd: 650,
    area: RECT(-13, 13, -6, 13), bar: { x: 14, z: 12 }, particles: 'none', fx: { pyro: false, co2: true, fireworks: false }, lights: 12, ambient: 0.3, gridFloor: true,
    build(k) {
      k.sky({ top: '#0a0220', mid: '#ff3a8a', bot: '#1a0420', sun: 1.6, sunDir: [0, 0.12, -1], sunCol: '#ffc040', stars: 0.6 });
      const gridMat = new THREE.ShaderMaterial({ vertexShader: SIMPLE_VERT, uniforms: { uTime: { value: 0 }, uKick: { value: 0 } }, toneMapped: false,
        fragmentShader: `varying vec2 vUv; uniform float uTime,uKick; void main(){ vec2 g = vUv*vec2(60.0,60.0); g.y += uTime*2.0; vec2 f = abs(fract(g)-0.5); float l = smoothstep(0.44,0.5,max(f.x,f.y)); gl_FragColor = vec4(vec3(1.0,0.15,0.8)*l*(1.2+uKick) + vec3(0.04,0.0,0.06), 1.0); }` });
      const gf = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), gridMat); gf.rotation.x = -Math.PI / 2; k.add(gf);
      k.animated.push((t, A) => { gridMat.uniforms.uTime.value = t; gridMat.uniforms.uKick.value = A.kick; });
      k.stage({ w: 12, h: 1, z: -12, color: '#1a1030' }).ledWall({ shape: 'flat', w: 14, h: 6, y: 5.5, z: -15.5 }).truss({ w: 17, h: 9.5, z: -13, d: 8, heads: 10, lasers: 8 });
      const sil = new THREE.MeshBasicMaterial({ color: '#050008' });
      for (let i = 0; i < 12; i++) { const sx = i % 2 ? 1 : -1; const x = sx * (20 + (i % 4) * 7), z = -20 - i * 6; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 12, 6), sil); t.position.set(x, 6, z); k.add(t); for (let j = 0; j < 6; j++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.6, 5, 3), sil); l.position.set(x, 12, z); l.rotation.set(Math.PI / 2 - 0.6, j / 6 * TAU, 0, 'YXZ'); l.translateY(2); k.add(l); } }
      for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(30 + k.rng() * 30, 25 + k.rng() * 30, 4), new THREE.MeshBasicMaterial({ color: '#12021e', wireframe: false })); m.position.set(-180 + i * 45, 10, -230); k.add(m); const w = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: '#ff2bd6', wireframe: true, transparent: true, opacity: 0.35 })); w.position.copy(m.position); k.add(w); }
    }
  },
  {
    id: 'underwater', name: 'Underwater Dome', desc: 'Caustics, fish schools and bioluminescent glow beneath the sea.', palette: 'ocean', fog: ['#021a2a', 0.03], crowd: 500,
    area: RECT(-10, 10, -6, 10), bar: { x: 10, z: 9 }, particles: 'bubbles', fx: { pyro: false, co2: true, fireworks: false }, lights: 10, ambient: 0.45,
    build(k) {
      k.sky({ top: '#0a5a8a', mid: '#032a40', bot: '#010a14' });
      k.floor({ tex: 'sand', color: '#7aa0a0', rough: 1, metal: 0, repeat: 30 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(22, 32, 16, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8ad8ff', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }));
      k.add(dome);
      const frame = new THREE.Mesh(new THREE.SphereGeometry(22.05, 16, 8, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#6ae0ff', wireframe: true, transparent: true, opacity: 0.25 })); k.add(frame);
      k.stage({ w: 10, h: 1, z: -11, color: '#0a2a3a' }).ledWall({ shape: 'circle', h: 6.5, y: 5, z: -14 }).truss({ w: 14, h: 8, z: -12, d: 7, heads: 8, lasers: 4 });
      // fish school
      const fish = new THREE.InstancedMesh(new THREE.ConeGeometry(0.15, 0.6, 4), new THREE.MeshBasicMaterial({ color: '#ffb040', toneMapped: false }), 240);
      k.add(fish); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
      const seeds = Array.from({ length: 240 }, () => [Math.random() * TAU, 24 + Math.random() * 18, 3 + Math.random() * 18, Math.random() * 0.3 + 0.1]);
      k.animated.push((t, A) => { for (let i = 0; i < 240; i++) { const [a0, r, y, sp] = seeds[i]; const a = a0 + t * sp; p.set(Math.cos(a) * r, y + Math.sin(t + i) * 0.5, Math.sin(a) * r); q.setFromEuler(e.set(0, -a, Math.PI / 2)); m4.compose(p, q, s); fish.setMatrixAt(i, m4); } fish.instanceMatrix.needsUpdate = true; fish.material.color.setHSL(0.08 + A.bass * 0.05, 1, 0.5); });
      for (let i = 0; i < 40; i++) { const c = k.cyl(0.05, 0.12, 1 + k.rng() * 3, new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.5 + k.rng() * 0.4, 1, 0.5).multiplyScalar(2), toneMapped: false }), (k.rng() - 0.5) * 70, 0.8, -25 - k.rng() * 30, 5); }
    }
  },
  {
    id: 'volcano', name: 'Volcano Crater', desc: 'Lava glow, ash in the air and a red-hot rig.', palette: 'lava', fog: ['#1a0602', 0.02], crowd: 800,
    area: RECT(-14, 14, -5, 14), bar: { x: 14, z: 13 }, particles: 'ash', fx: { pyro: true, co2: false, fireworks: true }, lights: 14, ambient: 0.3,
    build(k) {
      k.sky({ top: '#0a0202', mid: '#3a0a04', bot: '#000', clouds: 0.6 });
      k.floor({ color: '#1a1412', rough: 0.9, metal: 0.1 });
      k.lava(0, -40, 120, 40); k.lava(-40, 0, 30, 80); k.lava(40, 0, 30, 80);
      const rock = k.mat('#2a1a14', { roughness: 1, flatShading: true });
      for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, r = 60 + k.rng() * 12; const m = new THREE.Mesh(new THREE.ConeGeometry(14 + k.rng() * 8, 30 + k.rng() * 25, 6), rock); m.position.set(Math.cos(a) * r, 12, Math.sin(a) * r); k.add(m); }
      k.stage({ w: 14, h: 1.3, z: -12, color: '#1a0a06' }).ledWall({ shape: 'triple', w: 16, h: 6, y: 6, z: -15.5 }).truss({ w: 20, h: 11, z: -13, d: 9, heads: 10, lasers: 6 });
    }
  },
  {
    id: 'tundra', name: 'Northern Lights Tundra', desc: 'An aurora sky, snowfall and an ice-block stage.', palette: 'aurora', fog: ['#06101a', 0.015], crowd: 650,
    area: RECT(-13, 13, -5, 14), bar: { x: 14, z: 12 }, particles: 'snow', fx: { pyro: true, co2: false, fireworks: true }, lights: 12, ambient: 0.35,
    build(k) {
      k.sky({ top: '#01040c', mid: '#0a1a2a', bot: '#000', stars: 1.2, aurora: 1.3 });
      k.floor({ color: '#d8e6f0', rough: 0.9, metal: 0 });
      k.stage({ w: 12, h: 1.2, z: -12, color: '#a8d0e8' }).ledWall({ shape: 'flat', w: 10, h: 4.5, y: 5, z: -15.5 }).truss({ w: 16, h: 8.5, z: -13, d: 8, heads: 8, lasers: 6 });
      const snow = k.mat('#f0f6fa', { roughness: 0.9 });
      for (const [x, z] of [[-24, -6], [26, 2], [-28, 14]]) { const ig = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8, 0, TAU, 0, Math.PI / 2), snow); ig.position.set(x, 0, z); k.add(ig); }
      for (let i = 0; i < 20; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(25 + k.rng() * 20, 30 + k.rng() * 30, 5), snow); m.position.set(-200 + i * 22, 8, -220 - k.rng() * 40); k.add(m); }
      for (let i = 0; i < 24; i++) k.tree((k.rng() - 0.5) * 120, -30 - k.rng() * 50, 1 + k.rng(), '#1a3a2a');
    }
  },
  {
    id: 'underpass', name: 'Rainy Underpass', desc: 'Puddles, graffiti, sodium lights and a guerilla sound system.', palette: 'toxic', fog: ['#0a0a06', 0.035], crowd: 400,
    area: RECT(-8, 8, -6, 12), bar: { x: 8, z: 12 }, particles: 'rain', fx: { pyro: false, co2: false, fireworks: false }, lights: 8, ambient: 0.3,
    build(k) {
      k.floor({ color: '#111214', rough: 0.05, metal: 0.85, size: 120 });
      const wall = k.mat('#888', { map: tex('graffiti') });
      for (const sx of [-1, 1]) { const w = k.box(0.6, 8, 60, wall, sx * 10, 4, 0); }
      const roof = k.box(21, 1.5, 34, k.mat('#2a2a2c', { map: tex('concrete') }), 0, 8.5, 0);
      for (let z = -14; z <= 14; z += 7) { const lamp = k.box(1.4, 0.15, 0.5, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a30').multiplyScalar(2.5), toneMapped: false }), 0, 7.6, z); }
      k.stage({ w: 8, h: 0.5, d: 3, z: -11, speakers: true, stack: 4, barrier: false }).ledWall({ shape: 'flat', w: 6, h: 2.5, y: 3.2, z: -12.6, bright: 0.85 }).truss({ w: 12, h: 7.2, z: -12, d: 6, heads: 6, lasers: 4 });
      for (let i = 0; i < 4; i++) k.box(1.2, 1.4, 1, k.mat('#333'), -7 + i * 0.3, 0.7, 6 + i * 2);
    }
  },
  {
    id: 'skyarena', name: 'Sky Arena', desc: 'Floating platforms above the clouds at sunset.', palette: 'pastel', fog: ['#c08aa0', 0.006], crowd: 900,
    area: RECT(-16, 16, -5, 16), bar: { x: 17, z: 14 }, particles: 'none', fx: { pyro: false, co2: true, fireworks: true }, lights: 14, ambient: 0.7, sunset: true,
    build(k) {
      k.sky({ top: '#3a5ab8', mid: '#ffb0c8', bot: '#ffe0e8', sun: 1.2, sunDir: [-0.5, 0.08, -1], sunCol: '#fff0c0', clouds: 0.8 });
      const plat = k.cyl(26, 22, 3, k.mat('#e8e0f0', { metalness: 0.3, roughness: 0.4 }), 0, -1.5, 2, 48);
      const edge = new THREE.Mesh(new THREE.TorusGeometry(26, 0.2, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color('#00f0ff').multiplyScalar(2), toneMapped: false })); edge.rotation.x = Math.PI / 2; edge.position.set(0, 0.02, 2); k.add(edge);
      k.stage({ w: 14, h: 1, z: -13, color: '#f0eaf6' }).ledWall({ shape: 'arch', w: 16, h: 8, y: 6, z: -16 }).truss({ w: 18, h: 10, z: -14, d: 9, heads: 10, lasers: 6 });
      const cm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.85 });
      for (let i = 0; i < 70; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(6 + k.rng() * 10, 10, 8), cm); c.position.set((k.rng() - 0.5) * 300, -18 - k.rng() * 10, (k.rng() - 0.5) * 300); c.scale.y = 0.4; k.add(c); }
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; const p = k.cyl(5, 3, 2, k.mat('#e8e0f0'), Math.cos(a) * 55, 6 + i * 3, Math.sin(a) * 55 - 20, 24); k.animated.push((t) => { p.position.y = 6 + i * 3 + Math.sin(t * 0.4 + i) * 1.5; }); }
    }
  }
];

export function buildEnvironment(def, scene, vis) {
  const group = new THREE.Group();
  group.name = def.id;
  const k = new Kit(group, vis, makeRng(def.id.length * 977));
  def.build(k);
  scene.add(group);
  const area = { ...def.area };
  area.focus = k.djPos ? k.djPos.clone().add(new THREE.Vector3(0, 1.6, 0)) : new THREE.Vector3(0, 2.5, -12);
  if (def.bar) area.bar = def.bar;
  return {
    def, group, area, kit: k,
    djPos: k.djPos || new THREE.Vector3(0, 1, -12),
    ledMeshes: k.ledMeshes, lightMounts: k.lightMounts, laserMounts: k.laserMounts, blinders: k.blinders, strobes: k.strobes,
    pyroMounts: k.pyroMounts, co2Mounts: k.co2Mounts, emissives: k.emissives,
    update(t, A, pal) { for (const f of k.animated) f(t, A, pal); for (const e of k.emissives) e.material.opacity = 0.06 + A.bass * 0.18; },
    dispose() {
      scene.remove(group);
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map && !Object.values(TEX).includes(m.map)) m.map.dispose?.(); m.dispose(); } } });
    }
  };
}
