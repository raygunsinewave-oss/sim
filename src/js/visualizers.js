// LED wall visualizer shaders: one material, many audio-reactive modes.
import * as THREE from 'three';

export const VISUALS = [
  'Spectrum Bars', 'Circular Spectrum', 'Oscilloscope', 'Hyper Tunnel', 'Kaleidoscope', 'Plasma', 'Starfield Warp',
  'EQ Matrix', 'Glitch Type', 'Voronoi Cells', 'Ripple Rings', 'Retro Sun Grid', 'Fractal Feedback', 'Strobe Blocks', 'Liquid Chrome'
];

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uTime, uBass, uMid, uHigh, uEnergy, uBeat, uBar, uKick, uDrop, uBright, uAspect, uMode;
uniform vec3 uC1, uC2, uC3;
uniform sampler2D uFFT, uWave, uText;
#define PI 3.14159265
float fft(float x){ return texture2D(uFFT, vec2(clamp(x,0.0,1.0), 0.5)).r; }
float wav(float x){ return texture2D(uWave, vec2(clamp(x,0.0,1.0), 0.5)).r; }
vec3 pal(float t){ t = fract(t); return t < 0.333 ? mix(uC1,uC2,t*3.0) : t < 0.666 ? mix(uC2,uC3,(t-0.333)*3.0) : mix(uC3,uC1,(t-0.666)*3.0); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

vec3 modeBars(vec2 uv){
  float n = 48.0; float x = floor(uv.x*n)/n; float h = fft(x*0.85+0.02);
  h = pow(h, 1.4) * (0.8 + uEnergy*0.04);
  float cell = fract(uv.x*n); float gap = step(0.12, cell) * step(cell, 0.88);
  float segs = fract(uv.y*32.0); float sg = step(0.18, segs);
  float on = step(uv.y, h) * gap * sg;
  vec3 c = pal(x*0.8 + uv.y*0.3 + uTime*0.05);
  float peak = smoothstep(0.015,0.0,abs(uv.y - h - 0.02)) * gap;
  return c * on * (1.2 + uKick) + vec3(1.0)*peak*0.8 + c*0.05;
}
vec3 modeCircle(vec2 uv){
  vec2 p = (uv-0.5)*vec2(uAspect,1.0); float r = length(p); float a = atan(p.y,p.x)/(2.0*PI)+0.5;
  float sym = abs(a*2.0-1.0); float h = fft(sym*0.7+0.02);
  float base = 0.18 + uBass*0.08;
  float ring = smoothstep(0.008,0.0,abs(r-base));
  float bar = step(base, r) * step(r, base + h*0.32) * step(0.25, fract(a*96.0));
  vec3 c = pal(a + uTime*0.1);
  float core = smoothstep(base, 0.0, r) * (0.3 + uKick*0.7);
  return c*bar*1.4 + vec3(1.0)*ring + pal(uTime*0.2)*core;
}
vec3 modeScope(vec2 uv){
  vec3 col = vec3(0.0);
  for (int k=0;k<3;k++){
    float fk = float(k);
    float w = (wav(uv.x) - 0.5) * (1.6 + uEnergy*0.15) * (1.0 - fk*0.25);
    float y = 0.5 + w + (fk-1.0)*0.12*uBass;
    float d = abs(uv.y - y);
    col += pal(fk*0.33 + uTime*0.05) * (0.004/(d+0.002)) * 0.25;
  }
  float grid = step(0.98, fract(uv.x*16.0)) + step(0.98, fract(uv.y*8.0));
  return col + grid*0.06*uC2;
}
vec3 modeTunnel(vec2 uv){
  vec2 p = (uv-0.5)*vec2(uAspect,1.0); float r = length(p)+1e-3; float a = atan(p.y,p.x);
  float z = 0.35/r + uTime*(0.6+uEnergy*0.12);
  float rings = smoothstep(0.1,0.0,abs(fract(z*2.0)-0.5)-0.38);
  float spokes = smoothstep(0.08,0.0,abs(fract(a/PI*8.0 + uTime*0.1)-0.5)-0.42);
  vec3 c = pal(z*0.2 + a/(2.0*PI));
  return c*(rings*1.2+spokes*0.6)*smoothstep(0.0,0.4,r)*(0.6+uBass) + pal(uTime*0.3)*uKick*smoothstep(0.3,0.0,r);
}
vec3 modeKaleido(vec2 uv){
  vec2 p = (uv-0.5)*vec2(uAspect,1.0); float r = length(p); float a = atan(p.y,p.x);
  float seg = PI/6.0; a = mod(a, 2.0*seg); a = abs(a-seg);
  p = vec2(cos(a),sin(a))*r;
  p *= rot(uTime*0.2); p += uTime*0.05;
  float n = noise(p*6.0 + uBass*2.0) + 0.5*noise(p*12.0 - uTime);
  float lines = smoothstep(0.05,0.0,abs(fract(n*3.0)-0.5)-0.4);
  return pal(n + r + uTime*0.05) * (0.25 + lines*(0.8+uMid)) * (1.0+uKick*0.5);
}
vec3 modePlasma(vec2 uv){
  vec2 p = uv*vec2(uAspect,1.0)*3.0; float t = uTime*0.6;
  float v = sin(p.x+t) + sin(p.y*1.3+t*1.1) + sin((p.x+p.y)*0.7+t*0.7) + sin(length(p-1.5)*2.0 - t*1.5 - uBass*3.0);
  return pal(v*0.15 + uTime*0.05) * (0.5 + 0.5*sin(v*2.0+uMid*3.0)) * (0.7 + uEnergy*0.06);
}
vec3 modeStars(vec2 uv){
  vec2 p = (uv-0.5)*vec2(uAspect,1.0); vec3 col = vec3(0.0);
  for (int l=0;l<4;l++){
    float fl = float(l);
    float z = fract(uTime*(0.12+uEnergy*0.03) + fl*0.25);
    vec2 q = p * (2.0 - z*1.9) * 6.0; vec2 id = floor(q); vec2 f = fract(q)-0.5;
    vec2 h = hash2(id+fl*10.0)-0.5; float d = length(f-h*0.7);
    float star = smoothstep(0.08*z,0.0,d) * z;
    col += star * mix(vec3(1.0), pal(hash(id)), 0.6) * 1.5;
  }
  return col + pal(uTime*0.1)*uKick*0.15;
}
vec3 modeMatrix(vec2 uv){
  vec2 g = vec2(40.0, 22.0); vec2 id = floor(uv*g); vec2 f = fract(uv*g);
  float h = fft(id.x/g.x*0.8+0.02); float lvl = step(id.y/g.y, h*1.1);
  float dot = smoothstep(0.45,0.3,length(f-0.5));
  vec3 c = id.y/g.y > 0.75 ? uC3 : id.y/g.y > 0.45 ? uC2 : uC1;
  return c*dot*(lvl*1.3 + 0.05);
}
vec3 modeGlitch(vec2 uv){
  float band = floor(uv.y*24.0); float g = step(0.85 - uKick*0.3, hash(vec2(band, floor(uTime*12.0))));
  vec2 tuv = uv; tuv.x += g*(hash(vec2(band,uTime))-0.5)*0.2;
  float r = texture2D(uText, tuv + vec2(0.006*(1.0+uBass*3.0),0.0)).r;
  float gg = texture2D(uText, tuv).r;
  float b = texture2D(uText, tuv - vec2(0.006*(1.0+uBass*3.0),0.0)).r;
  vec3 txt = vec3(r*uC1.r+gg*0.2, gg*uC2.g + r*0.1, b*uC3.b + gg*0.3) * 1.6;
  float scan = 0.85 + 0.15*sin(uv.y*400.0);
  return (txt + pal(uv.x+uTime*0.1)*0.06*noise(uv*40.0+uTime*5.0)) * scan;
}
vec3 modeVoronoi(vec2 uv){
  vec2 p = uv*vec2(uAspect,1.0)*5.0; vec2 i = floor(p), f = fract(p); float md = 8.0, md2 = 8.0; vec2 mid;
  for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){ vec2 b = vec2(x,y); vec2 o = hash2(i+b); o = 0.5+0.5*sin(uTime*0.8+6.2831*o);
    float d = length(b+o-f); if (d<md){ md2=md; md=d; mid=i+b; } else if (d<md2) md2=d; }
  float edge = smoothstep(0.08,0.0,md2-md);
  float lvl = fft(hash(mid)*0.6+0.05);
  return pal(hash(mid)+uTime*0.05)*lvl*1.2 + edge*vec3(1.0)*(0.3+uKick);
}
vec3 modeRipples(vec2 uv){
  vec2 p = (uv-0.5)*vec2(uAspect,1.0); float r = length(p);
  float w = sin(r*40.0 - uTime*6.0 - uBass*8.0)*0.5+0.5;
  w = pow(w, 6.0 - uEnergy*0.3);
  return pal(r + uTime*0.1) * w * smoothstep(0.9,0.0,r) * (0.8+uKick);
}
vec3 modeRetro(vec2 uv){
  vec3 sky = mix(uC3*0.3, uC1*0.8, uv.y);
  vec2 sp = (uv - vec2(0.5,0.58))*vec2(uAspect,1.0); float sun = smoothstep(0.22,0.215,length(sp));
  float stripes = step(0.5, fract((uv.y-0.4)*28.0 - uTime*0.5)) + step(0.62, uv.y);
  vec3 col = sky + mix(uC2, vec3(1.0,0.9,0.3), uv.y)*sun*min(1.0,stripes)*(1.0+uKick*0.5);
  if (uv.y < 0.45){
    float y = 0.45-uv.y; float z = 0.1/y; float x = (uv.x-0.5)*z*4.0;
    float gx = smoothstep(0.06,0.0,abs(fract(x)-0.5)-0.44); float gz = smoothstep(0.06,0.0,abs(fract(z*2.0 - uTime*(1.0+uEnergy*0.2))-0.5)-0.44);
    col = mix(vec3(0.02,0.0,0.05), uC1*(1.0+uBass), max(gx,gz)*smoothstep(0.0,0.2,y)*1.0);
  }
  return col;
}
vec3 modeFractal(vec2 uv){
  vec2 p = (uv-0.5)*vec2(uAspect,1.0)*2.2;
  vec2 c = vec2(-0.75 + 0.1*sin(uTime*0.13), 0.12 + 0.12*cos(uTime*0.17 + uBass));
  float it = 0.0; vec2 z = p;
  for (int i=0;i<48;i++){ z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c; if (dot(z,z)>8.0) break; it += 1.0; }
  float t = it/48.0;
  return pal(t*2.0 + uTime*0.05) * pow(t, 0.6) * (0.8 + uEnergy*0.05 + uKick*0.5);
}
vec3 modeBlocks(vec2 uv){
  vec2 g = vec2(8.0, 4.0); vec2 id = floor(uv*g);
  float on = step(0.6 - uEnergy*0.03, hash(id + floor(uTime*2.0)));
  float f = smoothstep(0.48,0.44,max(abs(fract(uv.x*g.x)-0.5),abs(fract(uv.y*g.y)-0.5)));
  return pal(hash(id)) * on * f * (0.7 + uKick*1.2);
}
vec3 modeChrome(vec2 uv){
  vec2 p = uv*vec2(uAspect,1.0)*2.0;
  float n = noise(p*2.0 + vec2(uTime*0.3, -uTime*0.2)) + 0.5*noise(p*4.0 - uTime*0.4 + uBass);
  float h = sin(n*8.0 + uTime) * 0.5 + 0.5;
  vec3 c = mix(vec3(0.05), vec3(0.95), pow(h, 3.0));
  return c*mix(vec3(1.0), pal(n + uTime*0.1), 0.5) * (0.7 + uMid*0.6);
}

void main(){
  vec2 uv = vUv; vec3 c;
  int m = int(uMode + 0.5);
  if (m==0) c = modeBars(uv); else if (m==1) c = modeCircle(uv); else if (m==2) c = modeScope(uv);
  else if (m==3) c = modeTunnel(uv); else if (m==4) c = modeKaleido(uv); else if (m==5) c = modePlasma(uv);
  else if (m==6) c = modeStars(uv); else if (m==7) c = modeMatrix(uv); else if (m==8) c = modeGlitch(uv);
  else if (m==9) c = modeVoronoi(uv); else if (m==10) c = modeRipples(uv); else if (m==11) c = modeRetro(uv);
  else if (m==12) c = modeFractal(uv); else if (m==13) c = modeBlocks(uv); else c = modeChrome(uv);
  // drop flash and LED pixel grid
  c += pal(uTime) * uDrop * 0.6;
  vec2 px = fract(vUv * vec2(240.0*uAspect, 240.0));
  float led = smoothstep(0.5, 0.35, length(px-0.5)) * 0.35 + 0.65;
  gl_FragColor = vec4(c * led * uBright, 1.0);
}`;

export class VisualizerSystem {
  constructor() {
    this.fftTex = new THREE.DataTexture(new Uint8Array(256 * 4), 256, 1, THREE.RGBAFormat);
    this.waveTex = new THREE.DataTexture(new Uint8Array(256 * 4), 256, 1, THREE.RGBAFormat);
    for (const t of [this.fftTex, this.waveTex]) { t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1024; this.textCanvas.height = 512;
    this.textTex = new THREE.CanvasTexture(this.textCanvas);
    this.materials = [];
    this.mode = 0;
    this.text = 'DJSIM';
    this.subText = 'by Raygun';
    this.drawText();
    this.dropPulse = 0;
  }

  createMaterial(aspect = 2, brightness = 1) {
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, toneMapped: false,
      uniforms: {
        uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 }, uEnergy: { value: 0 }, uBeat: { value: 0 },
        uBar: { value: 0 }, uKick: { value: 0 }, uDrop: { value: 0 }, uBright: { value: brightness }, uAspect: { value: aspect }, uMode: { value: this.mode },
        uC1: { value: new THREE.Color('#00f0ff') }, uC2: { value: new THREE.Color('#ff2bd6') }, uC3: { value: new THREE.Color('#7a5cff') },
        uFFT: { value: this.fftTex }, uWave: { value: this.waveTex }, uText: { value: this.textTex }
      }
    });
    m.userData.baseBright = brightness;
    this.materials.push(m);
    return m;
  }

  clearMaterials() { for (const m of this.materials) m.dispose(); this.materials = []; }

  setMode(i) { this.mode = ((i % VISUALS.length) + VISUALS.length) % VISUALS.length; }

  setText(main, sub = '') {
    this.text = main; this.subText = sub; this.drawText();
  }

  drawText() {
    const c = this.textCanvas, g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 220;
    g.font = `900 ${size}px "Helvetica Neue", Arial, sans-serif`;
    while (g.measureText(this.text).width > c.width * 0.92 && size > 40) { size -= 8; g.font = `900 ${size}px "Helvetica Neue", Arial, sans-serif`; }
    g.fillText(this.text, c.width / 2, c.height * (this.subText ? 0.42 : 0.5));
    if (this.subText) { g.font = `700 64px "Helvetica Neue", Arial, sans-serif`; g.fillText(this.subText.toUpperCase(), c.width / 2, c.height * 0.78); }
    this.textTex.needsUpdate = true;
  }

  update(time, A, palette, dt) {
    const f = this.fftTex.image.data, w = this.waveTex.image.data;
    for (let i = 0; i < 256; i++) { f[i * 4] = A.fftSmall[i]; w[i * 4] = A.waveSmall[i]; }
    this.fftTex.needsUpdate = true; this.waveTex.needsUpdate = true;
    if (A.drop) this.dropPulse = 1;
    this.dropPulse *= Math.exp(-dt * 2.5);
    for (const m of this.materials) {
      const u = m.uniforms;
      u.uTime.value = time; u.uBass.value = A.bass; u.uMid.value = A.mid; u.uHigh.value = A.high; u.uEnergy.value = A.energy;
      u.uBeat.value = A.beatPhase; u.uBar.value = A.barPhase; u.uKick.value = A.kick; u.uDrop.value = this.dropPulse; u.uMode.value = this.mode;
      u.uC1.value.copy(palette[0]); u.uC2.value.copy(palette[1]); u.uC3.value.copy(palette[2]);
    }
  }
}
