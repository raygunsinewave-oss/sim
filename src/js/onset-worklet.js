// Runs on the audio thread: computes a multi-band onset-strength envelope at a fixed hop size,
// so tempo and beat tracking stay accurate even when the renderer drops frames.
class OnsetProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.hop = 256;
    this.n = 0;
    this.lp1 = 0; this.lp2 = 0;
    const a = (fc) => 1 - Math.exp(-2 * Math.PI * fc / sampleRate);
    this.a1 = a(150); this.a2 = a(2000);
    this.acc = [0, 0, 0];
    this.prev = [0, 0, 0];
    this.buf = []; this.kbuf = [];
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input.length) return true;
    const L = input[0], R = input[1] || input[0];
    for (let i = 0; i < L.length; i++) {
      const x = (L[i] + R[i]) * 0.5;
      this.lp1 += this.a1 * (x - this.lp1);
      this.lp2 += this.a2 * (x - this.lp2);
      const low = this.lp1, mid = this.lp2 - this.lp1, high = x - this.lp2;
      this.acc[0] += low * low; this.acc[1] += mid * mid; this.acc[2] += high * high;
      if (++this.n >= this.hop) {
        let flux = 0, kick = 0;
        const w = [1.6, 1.0, 0.6];
        for (let b = 0; b < 3; b++) {
          const e = Math.log(1e-10 + this.acc[b] / this.hop);
          const d = e - this.prev[b];
          if (d > 0) { flux += d * w[b]; if (b === 0) kick = d; }
          this.prev[b] = e; this.acc[b] = 0;
        }
        this.buf.push(flux); this.kbuf.push(kick);
        this.n = 0;
        if (this.buf.length >= 8) {
          this.port.postMessage({ t: currentTime, rate: sampleRate / this.hop, v: this.buf, k: this.kbuf });
          this.buf = []; this.kbuf = [];
        }
      }
    }
    return true;
  }
}
registerProcessor('djsim-onset', OnsetProcessor);
