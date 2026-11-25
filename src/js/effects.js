// Special effects: pyro, CO2 jets, confetti, fireworks, sparks and ambient weather.
import * as THREE from 'three';
import { TAU } from './util.js';

const P_VERT = `
attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
varying vec3 vColor; varying float vAlpha;
void main(){ vColor = aColor; vAlpha = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`;
const P_FRAG = `
varying vec3 vColor; varying float vAlpha;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vColor * a * vAlpha, 1.0); }`;

class ParticlePool {
  constructor(scene, max) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.baseCol = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.grow = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: P_VERT, fragmentShader: P_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
  }
  spawn(x, y, z, vx, vy, vz, r, g, b, size, life, grav = -9.8, drag = 0.5, grow = 0) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.baseCol[i * 3] = r; this.baseCol[i * 3 + 1] = g; this.baseCol[i * 3 + 2] = b;
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3, dr = Math.exp(-this.drag[i] * dt);
      this.vel[k] *= dr; this.vel[k + 1] = this.vel[k + 1] * dr + this.grav[i] * dt; this.vel[k + 2] *= dr;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = Math.min(1, f * 1.5);
      this.col[k] = this.baseCol[k]; this.col[k + 1] = this.baseCol[k + 1]; this.col[k + 2] = this.baseCol[k + 2];
    }
    for (const n of ['position', 'aColor', 'aSize', 'aAlpha']) this.geo.attributes[n].needsUpdate = true;
  }
  clear() { this.life.fill(0); this.alpha.fill(0); }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pool = new ParticlePool(scene, 9000);
    // confetti: instanced quads with flutter
    this.confMax = 1600;
    this.conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), this.confMax);
    this.conf.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.conf.frustumCulled = false;
    this.confState = new Float32Array(this.confMax * 8); // x y z vx vy vz life rot
    for (let i = 0; i < this.confMax; i++) this.conf.setColorAt(i, new THREE.Color().setHSL(Math.random(), 1, 0.6));
    this.conf.count = this.confMax;
    scene.add(this.conf);
    this.confCursor = 0;
    // ambient weather particles
    this.ambient = null;
    this.level = 1; // FX intensity
    this.auto = true;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this.co2Fog = 0;
    this.pending = [];
  }

  build(env) {
    this.env = env;
    this.pool.clear();
    for (let i = 0; i < this.confMax; i++) this.confState[i * 8 + 6] = 0;
    if (this.ambient) { this.scene.remove(this.ambient.points); this.ambient.points.geometry.dispose(); }
    this.ambient = makeAmbient(env.def.particles, env.area);
    if (this.ambient) this.scene.add(this.ambient.points);
  }

  pyro(scale = 1) {
    if (!this.env || !this.env.def.fx.pyro) return false;
    for (const m of this.env.pyroMounts) for (let i = 0; i < 70 * scale; i++) {
      const sp = 0.6;
      this.pool.spawn(m.x + (Math.random() - 0.5) * sp, m.y, m.z + (Math.random() - 0.5) * sp, (Math.random() - 0.5) * 1.5, 9 + Math.random() * 7, (Math.random() - 0.5) * 1.5,
        3, 1.1 + Math.random() * 0.6, 0.2, 2.2 + Math.random() * 2, 0.7 + Math.random() * 0.5, -6, 1.2, 1.5);
    }
    return true;
  }

  co2() {
    if (!this.env || !this.env.def.fx.co2) return false;
    for (const m of this.env.co2Mounts) for (let i = 0; i < 120; i++) {
      const ang = (Math.random() - 0.5) * 0.25;
      this.pool.spawn(m.x, m.y, m.z, Math.sin(ang) * 3 + (Math.random() - 0.5), 14 + Math.random() * 6, (Math.random() - 0.5) * 2,
        0.5, 0.55, 0.6, 1.5 + Math.random() * 2, 1.2 + Math.random() * 0.6, -2, 2.2, 4);
    }
    this.co2Fog = 1;
    return true;
  }

  confetti(pal) {
    if (!this.env) return;
    const a = this.env.area;
    const c = new THREE.Color();
    for (let i = 0; i < 700; i++) {
      const k = this.confCursor; this.confCursor = (this.confCursor + 1) % this.confMax;
      const s = this.confState;
      const sx = (Math.random() < 0.5 ? -1 : 1) * (a.type === 'ring' ? 2 : 6 + Math.random() * 3);
      s[k * 8] = sx; s[k * 8 + 1] = (this.env.kit.stageTop || 1) + 1; s[k * 8 + 2] = a.type === 'ring' ? 0 : (this.env.djPos.z + 3);
      s[k * 8 + 3] = -sx * 0.3 + (Math.random() - 0.5) * 6; s[k * 8 + 4] = 12 + Math.random() * 8; s[k * 8 + 5] = (a.type === 'ring' ? (Math.random() - 0.5) * 8 : 4 + Math.random() * 8);
      s[k * 8 + 6] = 8 + Math.random() * 5; s[k * 8 + 7] = Math.random() * TAU;
      this.conf.setColorAt(k, Math.random() < 0.6 ? c.copy(pal[Math.floor(Math.random() * 3)]).multiplyScalar(1.4) : c.setHSL(Math.random(), 1, 0.6));
    }
    this.conf.instanceColor.needsUpdate = true;
  }

  fireworks(pal) {
    if (!this.env || !this.env.def.fx.fireworks) return false;
    for (let f = 0; f < 5; f++) {
      const delay = f * 0.35;
      this.pending.push({ t: delay, fn: () => {
        const x = (Math.random() - 0.5) * 60, y = 30 + Math.random() * 25, z = -40 - Math.random() * 40;
        const col = pal[Math.floor(Math.random() * 3)];
        const n = 220;
        for (let i = 0; i < n; i++) {
          const v = new THREE.Vector3().randomDirection().multiplyScalar(10 + Math.random() * 4);
          this.pool.spawn(x, y, z, v.x, v.y, v.z, col.r * 3, col.g * 3, col.b * 3, 2.5, 1.6 + Math.random() * 0.8, -4, 1.1, -0.8);
        }
      } });
    }
    return true;
  }

  sparks(intensity = 1) {
    if (!this.env) return;
    const z = this.env.area.type === 'ring' ? 0 : this.env.djPos.z + 2.5;
    for (let i = 0; i < 300 * intensity; i++) {
      const x = (Math.random() - 0.5) * (this.env.kit.stageW || 12);
      this.pool.spawn(x, 12, z, (Math.random() - 0.5) * 0.5, -1 - Math.random() * 3, (Math.random() - 0.5) * 0.5, 3, 2.4, 1.2, 0.35, 1.5 + Math.random(), -6, 0.3, 0);
    }
  }

  update(t, dt, A, pal) {
    // delayed spawns
    for (let i = this.pending.length - 1; i >= 0; i--) { const p = this.pending[i]; p.t -= dt; if (p.t <= 0) { p.fn(); this.pending.splice(i, 1); } }
    this.pool.update(dt);
    this.co2Fog *= Math.exp(-dt * 0.6);
    // confetti physics
    const s = this.confState, m = this._m;
    for (let i = 0; i < this.confMax; i++) {
      const k = i * 8;
      if (s[k + 6] <= 0) { m.makeScale(0, 0, 0); this.conf.setMatrixAt(i, m); continue; }
      s[k + 6] -= dt;
      s[k + 3] *= Math.exp(-dt * 1.6); s[k + 5] *= Math.exp(-dt * 1.6);
      s[k + 4] = s[k + 4] * Math.exp(-dt * 2.2) - 9.8 * dt * 0.35;
      if (s[k + 4] < -1.2) s[k + 4] = -1.2;
      s[k] += (s[k + 3] + Math.sin(t * 3 + i) * 0.6) * dt; s[k + 1] += s[k + 4] * dt; s[k + 2] += s[k + 5] * dt;
      if (s[k + 1] < 0.02) { s[k + 1] = 0.02; s[k + 3] = s[k + 4] = s[k + 5] = 0; }
      s[k + 7] += dt * 6;
      this._q.setFromEuler(this._e.set(s[k + 7], s[k + 7] * 0.7, i));
      this._p.set(s[k], s[k + 1], s[k + 2]);
      const sc = Math.min(1, s[k + 6]);
      this._s.setScalar(sc);
      m.compose(this._p, this._q, this._s);
      this.conf.setMatrixAt(i, m);
    }
    this.conf.instanceMatrix.needsUpdate = true;
    if (this.ambient) this.ambient.update(t, dt, A, pal);
  }
}

// ---------------------------------------------------------------- ambient particles
function makeAmbient(type, area) {
  if (!type || type === 'none') return null;
  const n = { snow: 3000, rain: 4000, sand: 2500, fireflies: 300, ash: 1500, bubbles: 600, stars: 800, dust: 1200, confettiAmbient: 500 }[type] || 1000;
  const cx = area.type === 'ring' ? area.cx : (area.x0 + area.x1) / 2, cz = area.type === 'ring' ? area.cz : (area.zFront + area.zBack) / 2;
  const R = area.type === 'ring' ? area.r1 + 6 : Math.max(area.x1 - area.x0, Math.abs(area.zBack - area.zFront)) * 0.75 + 6;
  const H = 14;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = cx + (Math.random() - 0.5) * R * 2; pos[i * 3 + 1] = Math.random() * H; pos[i * 3 + 2] = cz + (Math.random() - 0.5) * R * 2;
    seed[i] = Math.random();
    let c = [1, 1, 1], s = 0.25, a = 0.6;
    if (type === 'snow') { s = 0.35; a = 0.8; }
    if (type === 'rain') { c = [0.6, 0.7, 0.9]; s = 0.18; a = 0.5; }
    if (type === 'sand') { c = [0.9, 0.7, 0.45]; s = 0.2; a = 0.35; }
    if (type === 'fireflies') { c = [1.4, 1.6, 0.4]; s = 0.4; a = 1; }
    if (type === 'ash') { c = Math.random() < 0.3 ? [3, 0.9, 0.2] : [0.4, 0.38, 0.35]; s = 0.25; a = 0.7; }
    if (type === 'bubbles') { c = [0.6, 0.9, 1.2]; s = 0.5; a = 0.5; }
    if (type === 'stars') { c = [1, 1, 1.4]; s = 0.25; a = 0.7; }
    if (type === 'dust') { c = [0.8, 0.75, 0.7]; s = 0.15; a = 0.25; }
    if (type === 'confettiAmbient') { const h = new THREE.Color().setHSL(Math.random(), 1, 0.6); c = [h.r, h.g, h.b]; s = 0.25; a = 0.8; }
    col.set(c, i * 3); size[i] = s * (0.6 + Math.random() * 0.8); alpha[i] = a;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: P_VERT, fragmentShader: P_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  points.frustumCulled = false;
  const baseAlpha = alpha.slice();
  return {
    points,
    update(t, dt, A) {
      for (let i = 0; i < n; i++) {
        const k = i * 3, sd = seed[i];
        let vx = 0, vy = 0, vz = 0;
        switch (type) {
          case 'snow': vy = -0.8 - sd * 0.6; vx = Math.sin(t * 0.7 + sd * 20) * 0.4; break;
          case 'rain': vy = -14 - sd * 6; vx = 0.6; break;
          case 'sand': vx = 3 + sd * 3 + A.bass * 3; vy = Math.sin(t + sd * 10) * 0.3; break;
          case 'fireflies': vx = Math.sin(t * 0.6 + sd * 30) * 0.4; vy = Math.cos(t * 0.5 + sd * 17) * 0.2; vz = Math.cos(t * 0.4 + sd * 11) * 0.4; alpha[i] = baseAlpha[i] * Math.max(0, Math.sin(t * (1 + sd * 2) + sd * 40)) * (0.6 + A.bass); break;
          case 'ash': vy = -0.5 - sd * 0.5; vx = Math.sin(t * 0.3 + sd * 9) * 0.5; break;
          case 'bubbles': vy = 0.8 + sd * 0.8 + A.bass * 0.8; vx = Math.sin(t * 2 + sd * 30) * 0.2; break;
          case 'stars': vy = 0.05; vx = Math.sin(t * 0.2 + sd * 9) * 0.1; alpha[i] = baseAlpha[i] * (0.4 + 0.6 * Math.sin(t * 3 + sd * 50)); break;
          case 'dust': vx = Math.sin(t * 0.1 + sd * 9) * 0.1; vy = Math.sin(t * 0.13 + sd * 5) * 0.05; alpha[i] = baseAlpha[i] * (0.6 + A.bass * 0.8); break;
          case 'confettiAmbient': vy = -0.4 - sd * 0.3; vx = Math.sin(t * 2 + sd * 30) * 0.5; break;
        }
        pos[k] += vx * dt; pos[k + 1] += vy * dt; pos[k + 2] += vz * dt;
        if (pos[k + 1] < 0) pos[k + 1] += H; if (pos[k + 1] > H) pos[k + 1] -= H;
        if (pos[k] > cx + R) pos[k] -= R * 2; if (pos[k] < cx - R) pos[k] += R * 2;
      }
      g.attributes.position.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true;
    }
  };
}
