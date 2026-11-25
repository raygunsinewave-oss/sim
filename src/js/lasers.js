// Laser projectors: instanced additive beams with many show modes, plus a liquid-sky sheet.
import * as THREE from 'three';
import { clamp, TAU } from './util.js';

export const LASER_MODES = ['Fan Sweep', 'Tunnel', 'Liquid Sky', 'Crossfire', 'Scanner', 'Spiral', 'Wave', 'Chaos', 'Beat Chase'];
const BEAMS = 14;

const SHEET_FRAG = `varying vec2 vUv; uniform float uTime, uI; uniform vec3 uC;
void main(){ float y = vUv.y*24.0 + sin(vUv.x*8.0 + uTime*2.0)*1.5 + sin(vUv.x*3.0 - uTime)*2.0; float w = fwidth(y); float d = abs(fract(y)-0.5);
  float l = (1.0 - smoothstep(0.015, 0.015 + w * 1.5, 0.5 - d)) * clamp(1.0 - w * 4.0, 0.0, 1.0);
  float edge = smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x)*smoothstep(0.0,0.1,vUv.y)*smoothstep(1.0,0.8,vUv.y);
  gl_FragColor = vec4(uC * l * edge * uI, 1.0); }`;

export class LaserSystem {
  constructor(scene) {
    this.scene = scene;
    this.mode = 0;
    this.enabled = true;
    this.colorMode = 0; // 0 palette, 1 single (green), 2 RGB, 3 rainbow
    this.intensity = 1;
    const geo = new THREE.CylinderGeometry(0.018, 0.018, 1, 5, 1, true);
    geo.translate(0, 0.5, 0); geo.rotateX(Math.PI / 2); // along +Z from origin
    this.mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, 16 * BEAMS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < 16 * BEAMS; i++) this.mesh.setColorAt(i, new THREE.Color(0, 0, 0));
    scene.add(this.mesh);
    this.sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: SHEET_FRAG,
      uniforms: { uTime: { value: 0 }, uI: { value: 0 }, uC: { value: new THREE.Color('#00ff66') } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
    }));
    this.sheet.rotation.x = -Math.PI / 2;
    scene.add(this.sheet);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._d = new THREE.Vector3(); this._z = new THREE.Vector3(0, 0, 1); this._c = new THREE.Color();
    this.projectors = [];
  }

  build(env) {
    this.env = env;
    this.projectors = env.laserMounts.slice(0, 16).map((m, i) => ({ ...m, i }));
    const a = env.area;
    if (a.type === 'ring') { this.sheet.position.set(a.cx, 3.2, a.cz); this.sheet.scale.set(a.r1 * 2, a.r1 * 2, 1); }
    else { this.sheet.position.set((a.x0 + a.x1) / 2, 3.3, (a.zFront + a.zBack) / 2); this.sheet.scale.set(a.x1 - a.x0 + 6, Math.abs(a.zBack - a.zFront) + 6, 1); }
    this.mesh.count = this.projectors.length * BEAMS;
  }

  setMode(i) { this.mode = ((i % LASER_MODES.length) + LASER_MODES.length) % LASER_MODES.length; }

  _color(k, j, t, pal, beat) {
    const c = this._c;
    switch (this.colorMode) {
      case 1: return c.set('#00ff40');
      case 2: return c.setRGB(j % 3 === 0 ? 1 : 0, j % 3 === 1 ? 1 : 0, j % 3 === 2 ? 1 : 0);
      case 3: return c.setHSL((t * 0.1 + j / BEAMS + k * 0.1) % 1, 1, 0.5);
      default: return c.copy(pal[(k + Math.floor(beat / 8)) % 3]);
    }
  }

  update(t, dt, A, pal) {
    if (!this.env) return;
    const sec = A.section;
    let I = { INTRO: 0.15, GROOVE: 0.45, BREAKDOWN: 0.3, BUILDUP: 0.3 + 0.6 * A.buildProgress, DROP: 1, OUTRO: 0.2 }[sec] ?? 0.4;
    if (A.sinceDrop < 6) I = 1;
    I *= this.intensity * (this.enabled ? 1 : 0);
    const beat = A.beats, bar = A.bar + A.barPhase;
    const focus = this.env.area.focus;
    const a = this.env.area;
    const crowdCenter = this._p.set(a.type === 'ring' ? a.cx : (a.x0 + a.x1) / 2, 1.8, a.type === 'ring' ? a.cz : (a.zFront + a.zBack) / 2).clone();
    let idx = 0;
    const mode = this.mode;
    const liquid = mode === 2;
    this.sheet.visible = liquid && I > 0.01;
    this.sheet.material.uniforms.uTime.value = t;
    this.sheet.material.uniforms.uI.value = I * (0.4 + A.bass * 0.6) * 0.9;
    this.sheet.material.uniforms.uC.value.copy(this._color(0, 0, t, pal, beat)).multiplyScalar(2);
    for (const pr of this.projectors) {
      const k = pr.i, n = this.projectors.length, u = n > 1 ? k / (n - 1) : 0.5, side = u * 2 - 1;
      const origin = pr.pos;
      // base direction toward crowd
      const base = this._s.copy(crowdCenter).sub(origin).normalize();
      for (let j = 0; j < BEAMS; j++) {
        const v = j / (BEAMS - 1), s = v * 2 - 1;
        let yaw = 0, pitch = 0, len = 60, on = 1;
        switch (mode) {
          case 0: yaw = s * 0.9; pitch = 0.15 * Math.sin(bar * Math.PI * 0.5 + side) - 0.05; break; // fan
          case 1: { const ang = v * TAU + t * 1.2 * (k % 2 ? 1 : -1); const r = 0.12 + 0.05 * A.bass; yaw = Math.cos(ang) * r; pitch = Math.sin(ang) * r; break; }
          case 2: yaw = s * 0.8; pitch = -0.02; on = j % 2 ? 1 : 0; break;
          case 3: yaw = (k % 2 ? 1 : -1) * (0.4 + 0.3 * Math.sin(t + j * 0.2)) + s * 0.1; pitch = 0.05 * Math.sin(t * 2 + j); break;
          case 4: yaw = s * 0.5; pitch = 0.35 * Math.sin(bar * Math.PI + j * 0.15) - 0.05; break;
          case 5: { const ang = v * TAU * 1.5 + t * 2; const r = v * 0.6; yaw = Math.cos(ang) * r; pitch = Math.sin(ang) * r * 0.5; break; }
          case 6: yaw = s * 0.7; pitch = 0.2 * Math.sin(t * 3 - v * 6 + k); break;
          case 7: { const kk = Math.floor(beat * 2) + j * 7 + k * 31; yaw = Math.sin(kk * 12.9) * 0.9; pitch = Math.sin(kk * 78.2) * 0.35; break; }
          case 8: { const step = Math.floor(beat * 2) % BEAMS; on = j === step || j === BEAMS - 1 - step ? 1 : 0; yaw = s * 0.9; pitch = 0; break; }
        }
        if (liquid && j % 2 === 0) on = 0;
        if (pr.dir === 'up') pitch += 0.45 + 0.1 * Math.sin(t + k);
        const d = this._d.copy(base);
        // rotate base by yaw (around Y) and pitch (around local X)
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        let x = d.x * cy + d.z * sy, z = -d.x * sy + d.z * cy, y = d.y;
        const hl = Math.hypot(x, z);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const ny = y * cp + hl * sp, nh = hl * cp - y * sp;
        d.set(x / (hl || 1) * nh, ny, z / (hl || 1) * nh).normalize();
        this._q.setFromUnitVectors(this._z, d);
        const w = on * I > 0.001 ? 1 : 0;
        this._m.compose(origin, this._q, new THREE.Vector3(w * (1 + A.kick * 0.6), w * (1 + A.kick * 0.6), len * w));
        this.mesh.setMatrixAt(idx, this._m);
        const c = this._color(k, j, t, pal, beat);
        this.mesh.setColorAt(idx, this._c.copy(c).multiplyScalar(on * I * 2.2 * (0.8 + A.high * 0.5)));
        idx++;
      }
    }
    this.mesh.count = idx;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
