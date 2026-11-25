// The DJ: an animated performer behind CDJs and a mixer.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';

export class DJ {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    const skin = new THREE.MeshStandardMaterial({ color: '#8d5b3e', roughness: 0.7 });
    const shirt = new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({ color: '#1a1a22', roughness: 0.8 });
    const hp = new THREE.MeshStandardMaterial({ color: '#0a0a0a', metalness: 0.6, roughness: 0.3 });
    const cap = new THREE.MeshStandardMaterial({ color: '#ff2bd6', roughness: 0.6, emissive: '#3a0030' });
    const mk = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    const cap1 = (r, l) => { const g = new THREE.CapsuleGeometry(r, l, 3, 8); g.translate(0, -(l / 2 + r), 0); return g; };
    this.body = new THREE.Group(); this.root.add(this.body);
    this.hips = new THREE.Group(); this.hips.position.y = 0.95; this.body.add(this.hips);
    for (const sx of [-1, 1]) mk(cap1(0.08, 0.72), pants, this.hips, sx * 0.1, 0, 0);
    this.torso = new THREE.Group(); this.hips.add(this.torso);
    const tg = new THREE.CapsuleGeometry(0.17, 0.3, 3, 10); tg.translate(0, 0.33, 0); mk(tg, shirt, this.torso).scale.z = 0.75;
    this.head = new THREE.Group(); this.head.position.y = 0.72; this.torso.add(this.head);
    mk(new THREE.SphereGeometry(0.11, 14, 10), skin, this.head, 0, 0.02, 0);
    const capM = mk(new THREE.SphereGeometry(0.118, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap, this.head, 0, 0.04, 0);
    const brim = mk(new THREE.CylinderGeometry(0.11, 0.11, 0.015, 12), cap, this.head, 0, 0.05, 0.1); brim.scale.z = 0.8;
    // headphones
    const band = mk(new THREE.TorusGeometry(0.125, 0.015, 6, 16, Math.PI), hp, this.head, 0, 0.03, 0); band.rotation.z = 0;
    for (const sx of [-1, 1]) mk(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12), hp, this.head, sx * 0.125, 0.0, 0).rotation.z = Math.PI / 2;
    this.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.22, 0.6, 0); this.torso.add(sh);
      mk(cap1(0.055, 0.22), shirt, sh);
      const el = new THREE.Group(); el.position.y = -0.31; sh.add(el);
      mk(cap1(0.045, 0.2), skin, el);
      this.arms.push({ sh, el, side: sx });
    }
    // decks
    this.decks = new THREE.Group(); this.root.add(this.decks);
    const dm = new THREE.MeshStandardMaterial({ color: '#1b1c22', metalness: 0.6, roughness: 0.35 });
    this.jogs = [];
    for (const sx of [-1, 1]) {
      mk(new THREE.BoxGeometry(0.55, 0.1, 0.65), dm, this.decks, sx * 0.62, 1.1, 0.55);
      const jog = mk(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 32), new THREE.MeshStandardMaterial({ color: '#2a2c33', metalness: 0.8, roughness: 0.25 }), this.decks, sx * 0.62, 1.17, 0.5);
      const ring = mk(new THREE.TorusGeometry(0.18, 0.012, 6, 32), new THREE.MeshBasicMaterial({ color: '#00f0ff', toneMapped: false }), this.decks, sx * 0.62, 1.18, 0.5); ring.rotation.x = Math.PI / 2;
      const screen = mk(new THREE.PlaneGeometry(0.3, 0.12), new THREE.MeshBasicMaterial({ color: '#1a4aff', toneMapped: false }), this.decks, sx * 0.62, 1.16, 0.78); screen.rotation.x = -Math.PI / 2;
      this.jogs.push({ jog, ring, screen });
    }
    mk(new THREE.BoxGeometry(0.42, 0.11, 0.6), dm, this.decks, 0, 1.11, 0.55);
    this.meters = [];
    for (let i = 0; i < 4; i++) { const m = mk(new THREE.BoxGeometry(0.03, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: '#00ff66', toneMapped: false }), this.decks, -0.1 + i * 0.065, 1.2, 0.35); this.meters.push(m); }
    this.root.traverse((o) => { o.frustumCulled = true; });
    this.focusSide = 1; this.nextSwitch = 0; this.point = 0;
  }

  place(pos) { this.root.position.copy(pos); this.root.rotation.y = 0; }
  faceCrowd(yaw) { this.root.rotation.y = yaw; }

  update(t, dt, A, pal) {
    const beat = A.beats, f = beat - Math.floor(beat), pulse = Math.exp(-f * 6);
    const sec = A.section;
    // body bounce & head nod
    this.hips.position.y = 0.95 - 0.04 * pulse * (0.5 + A.energy / 10);
    this.torso.rotation.x = 0.15 + 0.08 * pulse;
    this.head.rotation.x = 0.15 + 0.25 * pulse * (sec === 'BREAKDOWN' ? 0.3 : 1);
    this.head.rotation.y = Math.sin(t * 0.5) * 0.2;
    if (t > this.nextSwitch) { this.focusSide = Math.random() < 0.5 ? -1 : 1; this.nextSwitch = t + 2 + Math.random() * 4; }
    if (A.drop) this.point = 6;
    this.point = Math.max(0, this.point - dt);
    for (const a of this.arms) {
      let shX, shZ, elX;
      const working = a.side === this.focusSide;
      if (this.point > 0 && a.side === 1) { shX = -2.8 + 0.2 * pulse; shZ = -0.2; elX = -0.1; } // fist in the air on drops
      else if (sec === 'BUILDUP' && a.side === -1 && A.buildProgress > 0.5) { shX = -1.2 - 1.6 * A.buildProgress; shZ = 0.3; elX = -0.3; } // raising the crowd
      else if (sec === 'BREAKDOWN' && a.side === 1) { shX = -1.9; shZ = -0.9; elX = -2.2; } // hand on headphones
      else if (working) { shX = -0.9 + 0.08 * Math.sin(t * 7); shZ = a.side * 0.15 + 0.05 * Math.sin(t * 3); elX = -1.0 + 0.15 * Math.sin(t * 5); }
      else { shX = -0.7; shZ = a.side * 0.1; elX = -1.2 + 0.1 * pulse; }
      a.sh.rotation.x = lerp(a.sh.rotation.x, shX, 1 - Math.exp(-dt * 8));
      a.sh.rotation.z = lerp(a.sh.rotation.z, shZ * (a.side < 0 ? -1 : 1) * -1, 1 - Math.exp(-dt * 8));
      a.el.rotation.x = lerp(a.el.rotation.x, elX, 1 - Math.exp(-dt * 8));
    }
    for (let i = 0; i < this.jogs.length; i++) {
      const j = this.jogs[i];
      j.jog.rotation.y -= dt * (A.bpm / 60) * Math.PI * (i ? 1 : 0.98);
      j.ring.material.color.copy(pal[i]).multiplyScalar(1.5 + A.kick * 2);
      j.screen.material.color.copy(pal[2]).multiplyScalar(0.5 + A.level);
    }
    const lv = [A.bands[0], A.bands[1], A.bands[3], A.bands[5]];
    for (let i = 0; i < 4; i++) { this.meters[i].scale.y = 0.2 + lv[i] * 1.2; this.meters[i].material.color.setHSL(0.33 - lv[i] * 0.33, 1, 0.5).multiplyScalar(2); }
  }
}
