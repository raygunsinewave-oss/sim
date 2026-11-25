// Lighting rig: volumetric moving heads, washes, strobes and blinders.
import * as THREE from 'three';
import { clamp, lerp, TAU } from './util.js';

export const LIGHT_PATTERNS = ['Sweep', 'Fan', 'Ballyhoo', 'Circle', 'Figure 8', 'Crowd Scan', 'Center Hit', 'Chaos', 'Tilt Wave', 'Sky Pillars'];

const BEAM_VERT = `
varying float vAlong; varying vec3 vN; varying vec3 vV; varying float vDepth;
void main(){ vDepth = -(modelViewMatrix * vec4(position,1.0)).z; vAlong = -position.y / 40.0; vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`;
const BEAM_FRAG = `
uniform vec3 uColor; uniform float uIntensity, uHaze;
varying float vAlong; varying vec3 vN; varying vec3 vV; varying float vDepth;
void main(){
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float core = pow(facing, 3.0);
  float fall = pow(clamp(1.0 - vAlong, 0.0, 1.0), 2.0);
  float a = core * fall * uIntensity * uHaze * smoothstep(1.5, 7.0, vDepth);
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

export class LightRig {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.heads = [];
    this.pattern = 0;
    this.colorMode = 0; // 0 palette spread, 1 unison, 2 chase
    this.intensity = 1;
    this.haze = 1;
    this.strobeHold = false;
    this.strobe = 0; // 0..1 flash amount this frame
    this.blind = 0;
    this.manualCenter = 0;
    this.enabled = true;
    // scene lighting
    this.hemi = new THREE.HemisphereLight('#8090ff', '#100810', 0.4);
    this.key = new THREE.DirectionalLight('#ffffff', 0.6);
    this.key.position.set(0, 10, -15);
    this.washes = [];
    for (let i = 0; i < 4; i++) { const p = new THREE.PointLight('#ff00ff', 0, 40, 1.6); this.washes.push(p); this.group.add(p); }
    this.blinderLight = new THREE.PointLight('#ffd9a0', 0, 60, 1.2);
    this.group.add(this.hemi, this.key, this.key.target, this.blinderLight);
    this.strobeMeshes = []; this.blinderMeshes = [];
    this._q = new THREE.Quaternion(); this._down = new THREE.Vector3(0, -1, 0); this._v = new THREE.Vector3();
    this.beamGeo = new THREE.CylinderGeometry(0.05, 0.75, 40, 20, 1, true);
    this.beamGeo.translate(0, -20, 0);
    this._strobeT = 0;
  }

  build(env) {
    // clear
    for (const h of this.heads) { this.group.remove(h.obj); h.mat.dispose(); }
    for (const m of [...this.strobeMeshes, ...this.blinderMeshes]) this.group.remove(m);
    this.heads = []; this.strobeMeshes = []; this.blinderMeshes = [];
    this.env = env;
    const mounts = env.lightMounts;
    const want = env.def.lights || 12;
    const step = Math.max(1, Math.floor(mounts.length / want));
    const headGeo = new THREE.BoxGeometry(0.35, 0.45, 0.35);
    const headMat = new THREE.MeshStandardMaterial({ color: '#16161a', metalness: 0.6, roughness: 0.4 });
    const lensGeo = new THREE.CircleGeometry(0.13, 16);
    let idx = 0;
    for (let i = 0; i < mounts.length && this.heads.length < want; i += step) {
      const m = mounts[i];
      const obj = new THREE.Group();
      obj.position.copy(m.pos);
      const body = new THREE.Mesh(headGeo, headMat); body.position.y = 0.1; obj.add(body);
      const pivot = new THREE.Group(); obj.add(pivot);
      const mat = new THREE.ShaderMaterial({ vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
        uniforms: { uColor: { value: new THREE.Color() }, uIntensity: { value: 0 }, uHaze: { value: 1 } } });
      const beam = new THREE.Mesh(this.beamGeo, mat); beam.frustumCulled = false; pivot.add(beam);
      const lens = new THREE.Mesh(lensGeo, new THREE.MeshBasicMaterial({ color: '#fff', toneMapped: false })); lens.rotation.x = Math.PI / 2; lens.position.y = -0.14; pivot.add(lens);
      this.group.add(obj);
      this.heads.push({ obj, pivot, beam, mat, lens, i: idx++, row: m.row || 0, aim: new THREE.Vector3(0, -1, 0.3).normalize(), base: m.pos.clone() });
    }
    for (const p of env.strobes) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: '#222', toneMapped: false }));
      s.position.copy(p); this.group.add(s); this.strobeMeshes.push(s);
    }
    for (const p of env.blinders) {
      const g = new THREE.Group(); g.position.copy(p);
      for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), new THREE.MeshBasicMaterial({ color: '#331a00', toneMapped: false })); d.position.set((k % 2 - 0.5) * 0.4, (Math.floor(k / 2) - 0.5) * 0.4, 0.05); g.add(d); }
      this.group.add(g); this.blinderMeshes.push(g);
    }
    // wash positions
    const a = env.area;
    const cx = a.type === 'ring' ? a.cx : (a.x0 + a.x1) / 2, cz = a.type === 'ring' ? a.cz : (a.zFront + a.zBack) / 2;
    const spanX = a.type === 'ring' ? a.r1 : (a.x1 - a.x0) / 2;
    this.washes[0].position.set(cx - spanX * 0.6, 7, cz); this.washes[1].position.set(cx + spanX * 0.6, 7, cz);
    this.washes[2].position.set(0, (env.kit.stageTop || 1) + 4, (env.djPos.z || -12) + 1); this.washes[3].position.set(cx, 6, a.type === 'ring' ? cz : a.zFront + 2);
    this.blinderLight.position.set(0, 8, a.type === 'ring' ? 0 : a.zFront + 3);
    this.key.position.set(0, 12, env.djPos.z - 2); this.key.target.position.set(cx, 0, cz + 5);
    this.hemi.intensity = env.def.ambient ?? 0.3;
    this.baseAmbient = env.def.ambient ?? 0.3;
  }

  setPattern(i) { this.pattern = ((i % LIGHT_PATTERNS.length) + LIGHT_PATTERNS.length) % LIGHT_PATTERNS.length; }

  update(t, dt, A, pal, fxLevel = 1) {
    const env = this.env; if (!env) return;
    const focus = env.area.focus;
    const sec = A.section;
    const secI = { INTRO: 0.35, GROOVE: 0.7, BREAKDOWN: 0.45, BUILDUP: 0.6 + 0.4 * A.buildProgress, DROP: 1, OUTRO: 0.4 }[sec] ?? 0.6;
    const bar = A.bar + A.barPhase, beat = A.beats;
    const n = this.heads.length;
    const pattern = this.manualCenter > 0 || (sec === 'BUILDUP' && A.buildProgress > 0.85) ? 6 : this.pattern;
    const a = env.area;
    const cx = a.type === 'ring' ? a.cx : (a.x0 + a.x1) / 2, czF = a.type === 'ring' ? a.cz : a.zFront, czB = a.type === 'ring' ? a.cz : a.zBack;
    for (const h of this.heads) {
      const u = n > 1 ? h.i / (n - 1) : 0.5, s = u * 2 - 1;
      const tgt = this._v;
      const ring = a.type === 'ring';
      switch (pattern) {
        case 0: { const sw = Math.sin(bar * Math.PI * 0.5 + (h.row * 0.5)); tgt.set(h.base.x + sw * 14 + s * 3, 0, lerp(czF, czB, 0.4)); break; }
        case 1: { const sp = 0.5 + 0.5 * Math.sin(bar * Math.PI * 0.5); tgt.set(h.base.x + s * 25 * sp, 0, lerp(czF, czB, 0.3 + 0.3 * sp)); break; }
        case 2: { const ph = beat * 0.4 + h.i * 1.7; tgt.set(cx + Math.sin(ph) * 10 + Math.cos(ph * 1.3) * 5, 0, lerp(czF, czB, 0.5) + Math.cos(ph * 0.9) * 8); break; }
        case 3: { const ph = beat * Math.PI * 0.25 + u * TAU; tgt.set(cx + Math.cos(ph) * 8, 0, lerp(czF, czB, 0.45) + Math.sin(ph) * 6); break; }
        case 4: { const ph = beat * Math.PI * 0.25 + u * 0.8; tgt.set(cx + Math.sin(ph) * 12, 0, lerp(czF, czB, 0.45) + Math.sin(ph * 2) * 6); break; }
        case 5: { const scan = 0.5 + 0.5 * Math.sin(bar * Math.PI * 0.5); tgt.set(cx + s * 12, 0, lerp(czF, czB, scan)); break; }
        case 6: tgt.set(focus.x, focus.y + 6, ring ? focus.z : focus.z + 6); break;
        case 7: { const k = Math.floor(beat) + h.i * 13; tgt.set(cx + Math.sin(k * 12.9898) * 14, 0, lerp(czF, czB, 0.5 + 0.4 * Math.sin(k * 78.233))); break; }
        case 8: { const wv = Math.sin(beat * Math.PI * 0.5 - u * Math.PI * 2); tgt.set(h.base.x + s * 4, 0, lerp(czF, czB, 0.45 + 0.4 * wv)); break; }
        case 9: tgt.set(h.base.x + s * 6 + Math.sin(bar + u * 4) * 3, 60, h.base.z - 10 + Math.cos(bar * 0.7 + u * 3) * 6); break;
      }
      if (ring && pattern !== 6) { tgt.x = cx + (tgt.x - cx) * 0.6; tgt.z = a.cz + (tgt.z - (czF + czB) / 2) * 0.6; }
      const dir = tgt.sub(h.obj.position).normalize();
      h.aim.lerp(dir, 1 - Math.exp(-dt * (pattern === 7 ? 14 : 5))).normalize();
      this._q.setFromUnitVectors(this._down, h.aim);
      h.pivot.quaternion.copy(this._q);
      // color
      let col;
      if (this.colorMode === 1) col = pal[Math.floor(bar / 4) % 3];
      else if (this.colorMode === 2) col = pal[(Math.floor(beat) + h.i) % 3];
      else col = pal[(h.i + Math.floor(bar / 8)) % 3];
      h.mat.uniforms.uColor.value.copy(col);
      // intensity: chase on beats in grooves, flash on kicks in drops
      let I = secI * (0.55 + 0.45 * A.bass);
      if (sec === 'GROOVE' && pattern !== 6) I *= 0.6 + 0.4 * (Math.floor(beat) % 2 === h.i % 2 ? 1 : 0.3);
      if (sec === 'DROP') I *= 0.8 + A.kick * 0.6;
      if (sec === 'BREAKDOWN') I *= 0.6 + 0.4 * Math.sin(t * 0.8 + h.i);
      h.mat.uniforms.uIntensity.value = this.enabled ? I * this.intensity * 0.32 : 0;
      h.mat.uniforms.uHaze.value = this.haze;
      h.lens.material.color.copy(col).multiplyScalar(this.enabled ? 1 + I * 3 : 0.1);
      h.beam.visible = this.enabled;
    }
    // washes
    for (let i = 0; i < this.washes.length; i++) {
      const w = this.washes[i];
      w.color.copy(pal[(i + Math.floor(bar / 4)) % 3]);
      w.intensity = (5 + 30 * A.bass * secI + (i === 2 ? 14 : 0)) * this.intensity;
    }
    this.hemi.color.copy(pal[2]).lerp(new THREE.Color('#ffffff'), 0.4);
    this.hemi.intensity = this.baseAmbient * (0.7 + A.level * 0.6);
    this.key.color.copy(pal[0]);
    this.key.intensity = 0.4 + A.kick * 0.8 * secI;

    // strobes
    let strobe = 0;
    if (this.strobeHold) strobe = (Math.floor(t * 14) % 2) ? 1 : 0;
    else if (sec === 'BUILDUP' && A.buildProgress > 0.6 && fxLevel > 0) { const rate = 4 + 12 * A.buildProgress; strobe = (Math.floor(t * rate) % 2) && A.buildProgress > 0.7 ? 0.5 : 0; }
    else if (A.sinceDrop < 0.6) strobe = (Math.floor(t * 18) % 2) ? 1 : 0;
    this.strobe = strobe * fxLevel;
    for (const s of this.strobeMeshes) s.material.color.setScalar(0.12 + strobe * 6);
    // blinders
    if (A.drop) this.blind = 1;
    this.blind *= Math.exp(-dt * 3.5);
    const bl = Math.max(this.blind, this._manualBlind || 0);
    this._manualBlind = (this._manualBlind || 0) * Math.exp(-dt * 3);
    for (const g of this.blinderMeshes) for (const d of g.children) d.material.color.setRGB(0.2 + bl * 8, 0.1 + bl * 5.5, 0.02 + bl * 2.5);
    this.blinderLight.intensity = bl * 110 * fxLevel;
  }

  blinder() { this._manualBlind = 1; }
}
