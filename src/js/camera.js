// Camera director: free orbit, POVs, drone, follow cam and a cinematic auto-director.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, lerp } from './util.js';

export const CAMERA_MODES = ['Free Orbit', 'Cinematic Auto', 'DJ POV', 'Front Row', 'In the Crowd', 'Drone Fly-over', 'Balcony Wide', 'Follow Person'];

export class CameraDirector {
  constructor(camera, dom) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495; this.controls.minDistance = 2; this.controls.maxDistance = 120;
    this.mode = 1;
    this.pos = new THREE.Vector3(); this.tgt = new THREE.Vector3();
    this.curPos = camera.position.clone(); this.curTgt = new THREE.Vector3();
    this.shot = 0; this.shotStart = 0; this.nextCut = 0;
    this.followId = -1;
    this.crowdPovId = -1;
    this.shake = 0;
    this._v = new THREE.Vector3();
    this.fovBase = 55;
  }

  setEnv(env) {
    this.env = env;
    const a = env.area, s = env.def.camDist || 1;
    const back = a.type === 'ring' ? 14 : a.zBack;
    this.home = { pos: new THREE.Vector3(0, 7 * s, (a.type === 'ring' ? 16 : back + 8) * (a.type === 'ring' ? 1 : 1)), tgt: new THREE.Vector3(0, 3, env.djPos.z + 2) };
    if (a.type === 'ring') this.home = { pos: new THREE.Vector3(11, 5.5, 11), tgt: new THREE.Vector3(0, 1.2, 0) };
    this.camera.position.copy(this.home.pos); this.controls.target.copy(this.home.tgt);
    this.curPos.copy(this.home.pos); this.curTgt.copy(this.home.tgt);
    this.controls.update();
  }

  setMode(m) {
    this.mode = ((m % CAMERA_MODES.length) + CAMERA_MODES.length) % CAMERA_MODES.length;
    this.controls.enabled = this.mode === 0;
    if (this.mode === 0) { this.controls.target.copy(this.curTgt); }
    this.nextCut = 0;
  }

  follow(id) { this.followId = id; this.setMode(7); }

  _shotPose(shot, t, A, crowd) {
    const env = this.env, a = env.area, dj = env.djPos, P = this.pos, T = this.tgt;
    const ring = a.type === 'ring';
    const midZ = ring ? 0 : (a.zFront + a.zBack) / 2;
    const el = t - this.shotStart;
    switch (shot) {
      case 0: // wide from the back, slow push in
        if (ring) { P.set(Math.cos(t * 0.05) * 13, 6, Math.sin(t * 0.05) * 13); T.set(0, 1.2, 0); }
        else { P.set(Math.sin(t * 0.07) * 6, 8 + Math.sin(t * 0.1), a.zBack + 9 - el * 0.4); T.set(0, 3, dj.z + 2); }
        break;
      case 1: // DJ close up from the side
        P.set(dj.x + 3.2, dj.y + 2.3, dj.z + (ring ? 2.6 : 2.2)); T.set(dj.x, dj.y + 1.5, dj.z + 0.3); break;
      case 2: // over the DJ shoulder to the crowd
        P.set(dj.x - 0.8 + Math.sin(t * 0.3) * 0.4, dj.y + 2.6, dj.z - 1.6); T.set(0, 1.5, ring ? 6 : midZ); break;
      case 3: // low crowd angle looking up at the stage
        P.set(Math.sin(t * 0.2) * 3, 1.0, ring ? 6 : a.zFront + 3.5); T.set(0, 5, dj.z); break;
      case 4: // drone orbit
        P.set(Math.cos(t * 0.12) * 24, 16 + Math.sin(t * 0.2) * 3, midZ + Math.sin(t * 0.12) * 24); T.set(0, 1, midZ - 3); break;
      case 5: // side truss
        P.set((ring ? 9 : (a.x1 + 3)), 9, ring ? -3 : a.zFront + 4); T.set(0, 1.5, ring ? 2 : midZ); break;
      case 6: // crane rise from crowd
        P.set(-4 + el * 0.5, 2 + el * 1.5, ring ? 8 : midZ + 4); T.set(0, 3, dj.z + 2); break;
      case 7: // front of stage looking at crowd
        P.set(Math.sin(t * 0.15) * 5, 3.2, ring ? 3 : a.zFront - 1.2); T.set(0, 1.6, ring ? 10 : midZ + 4); break;
    }
  }

  update(t, dt, A, crowd) {
    if (!this.env) return;
    const P = this.pos, T = this.tgt;
    if (this.mode === 0) {
      this.controls.update();
      this.curPos.copy(this.camera.position); this.curTgt.copy(this.controls.target);
      this._applyShake(dt, A);
      return;
    }
    let rate = 2.2;
    if (this.mode === 1) {
      // cuts on bar boundaries; big shot on the drop
      if (A.drop) { this.shot = Math.random() < 0.5 ? 6 : 4; this.shotStart = t; this.nextCut = t + 8; rate = 50; this._cut = true; }
      else if (t > this.nextCut && A.events.includes('bar')) {
        const pool = A.section === 'BUILDUP' ? [3, 1, 7] : A.section === 'BREAKDOWN' ? [0, 2, 5] : [0, 1, 2, 3, 4, 5, 7];
        let s; do { s = pool[Math.floor(Math.random() * pool.length)]; } while (s === this.shot && pool.length > 1);
        this.shot = s; this.shotStart = t; this.nextCut = t + (A.section === 'BUILDUP' ? 4 : 7 + Math.random() * 6); this._cut = true;
      }
      this._shotPose(this.shot, t, A, crowd);
      if (A.section === 'BUILDUP') { this._v.subVectors(T, P).multiplyScalar(0.25 * A.buildProgress); P.add(this._v); }
      if (this._cut) { this.curPos.copy(P); this.curTgt.copy(T); this._cut = false; }
      rate = 1.6;
    } else if (this.mode === 2) { this._shotPose(2, t, A, crowd); }
    else if (this.mode === 3) { this._shotPose(3, t, A, crowd); }
    else if (this.mode === 4) {
      if (this.crowdPovId < 0 || this.crowdPovId >= crowd.count) this.crowdPovId = Math.floor(crowd.count * 0.4);
      crowd.getHead(this.crowdPovId, P); P.y += 0.05; P.y += 0.05 * Math.sin(A.beats * Math.PI * 2);
      const f = this.env.area.focus; T.set(f.x, f.y + 1.5, f.z);
      rate = 12;
    } else if (this.mode === 5) { this._shotPose(4, t, A, crowd); }
    else if (this.mode === 6) {
      const a = this.env.area; const ring = a.type === 'ring';
      P.set(ring ? 0 : 0, ring ? 14 : 13, ring ? 16 : a.zBack + 14); T.set(0, 2, ring ? 0 : (a.zFront + this.env.djPos.z) / 2);
    } else if (this.mode === 7) {
      const id = this.followId;
      if (id >= 0 && id < crowd.count) {
        const yaw = crowd.getYaw(id);
        crowd.getHead(id, T);
        P.set(T.x - Math.sin(yaw) * 2.6 + Math.cos(yaw) * 0.6, T.y + 0.9, T.z - Math.cos(yaw) * 2.6 - Math.sin(yaw) * 0.6);
        T.y -= 0.2;
        rate = 4;
      } else this.setMode(1);
    }
    this.curPos.lerp(P, 1 - Math.exp(-dt * rate));
    this.curTgt.lerp(T, 1 - Math.exp(-dt * rate * 1.3));
    this.camera.position.copy(this.curPos);
    this.camera.lookAt(this.curTgt);
    this._applyShake(dt, A);
  }

  _applyShake(dt, A) {
    if (A.drop) this.shake = 1;
    this.shake *= Math.exp(-dt * 3);
    const s = this.shake * 0.12 + A.kick * 0.015;
    this.camera.position.x += (Math.random() - 0.5) * s;
    this.camera.position.y += (Math.random() - 0.5) * s;
    const fov = this.fovBase - A.kick * 1.2 + (A.section === 'BUILDUP' ? -4 * A.buildProgress : 0);
    this.camera.fov = lerp(this.camera.fov, fov, 1 - Math.exp(-dt * 8));
    this.camera.updateProjectionMatrix();
  }
}
