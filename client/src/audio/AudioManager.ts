// ============================================================
// AudioManager — Procedural sound effects via Web Audio API
// ============================================================

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = true;
  private initialized = false;

  // Ambient nodes
  private rainNoise: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;

  // Track ambient state
  private currentWeather = 'clear';
  private nightFactor = 0;

  private init(): void {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);

      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = 0;
      this.ambienceGain.connect(this.masterGain);
      this.initialized = true;
    } catch {
      // Audio not available
      this.enabled = false;
    }
  }

  private ensureContext(): AudioContext | null {
    this.init();
    return this.ctx;
  }

  // ---- Master Controls ----

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stopAmbience();
  }

  setMasterVolume(v: number): void {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  // ---- Event Sounds ----

  onLogEvent(type: string): void {
    if (!this.enabled) return;
    switch (type) {
      case 'rent': this.playRent(); break;
      case 'buy': this.playBuy(); break;
      case 'sell': this.playSell(); break;
      case 'card': this.playCard(); break;
      case 'dividend': this.playDividend(); break;
      case 'bankrupt': this.playBankrupt(); break;
      case 'victory': this.playVictory(); break;
      case 'jail': this.playJail(); break;
    }
  }

  playDice(): void { this.playNoiseBurst(0.1, 800, 200, 0.3); }
  playClick(): void { this.playTone(800, 0.03, 'square'); }
  playBuy(): void { this.playMelody([523, 659, 784], 0.08); }
  playSell(): void { this.playMelody([784, 659, 523], 0.08); }
  playBuild(): void { this.playNoiseBurst(0.15, 400, 600, 0.4); }
  playRent(): void { this.playMelody([440, 350, 300], 0.1); }
  playCard(): void { this.playSweep(600, 1200, 0.2); }
  playJail(): void { this.playNoiseBurst(0.3, 100, 300, 0.5); }
  playPassGO(): void { this.playMelody([523, 659, 784, 1047], 0.07); }
  playBankrupt(): void { this.playDescendingSweep(800, 100, 0.6); }
  playVictory(): void { this.playFanfare(); }
  playDividend(): void { this.playTone(1000, 0.15, 'sine'); }
  playWheelSpin(): void { this.playNoiseBurst(0.4, 300, 900, 0.35); }
  playQuizCorrect(): void { this.playMelody([523, 784, 1047], 0.1); }
  playQuizWrong(): void { this.playNoiseBurst(0.2, 150, 300, 0.4); }

  // ---- Ambient Soundscapes ----

  setWeatherSound(weather: string): void {
    this.currentWeather = weather;
    if (!this.enabled || !this.initialized) return;
    this.updateAmbience();
  }

  setNightFactor(factor: number): void {
    this.nightFactor = factor;
    if (!this.enabled || !this.initialized) return;
    this.updateAmbience();
  }

  private updateAmbience(): void {
    this.stopAmbience();

    switch (this.currentWeather) {
      case 'rain':
      case 'storm':
        this.startRainNoise(this.currentWeather === 'storm' ? 0.22 : 0.12);
        break;
      case 'snow':
        this.startWindNoise(0.06);
        break;
      case 'fog':
        this.startWindNoise(0.04);
        break;
    }

    // Thunder for storms
    if (this.currentWeather === 'storm') {
      this.scheduleThunder();
    }

    // Birds during daytime, clear weather
    if (this.currentWeather === 'clear' && this.nightFactor < 0.5) {
      this.scheduleBirds();
    }

    // Street vendors during daytime, non-storm
    if (this.currentWeather !== 'storm' && this.currentWeather !== 'snow' && this.nightFactor < 0.5) {
      this.scheduleVendor();
    }
  }

  private stopAmbience(): void {
    if (this.rainNoise) {
      try { this.rainNoise.stop(); } catch { /* already stopped */ }
      this.rainNoise = null;
    }
  }

  private startRainNoise(intensity: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.ambienceGain) return;

    const sampleRate = ctx.sampleRate;
    const duration = 4; // seconds, will loop
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Filtered white noise
    let b0 = 0, b1 = 0, b2 = 0; // simple lowpass filter state
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      // Lowpass filter at ~800Hz
      b0 = 0.05 * white + 0.9 * b0;
      data[i] = b0 * intensity;
    }

    this.rainNoise = ctx.createBufferSource();
    this.rainNoise.buffer = buffer;
    this.rainNoise.loop = true;

    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = intensity;
    this.rainGain.connect(this.ambienceGain!);

    this.rainNoise.connect(this.rainGain);
    this.rainNoise.start();
  }

  private startWindNoise(intensity: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.ambienceGain) return;

    const sampleRate = ctx.sampleRate;
    const duration = 5;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.02 * white + 0.96 * b0; // very low frequency noise
      data[i] = b0 * intensity;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = intensity;
    gain.connect(this.ambienceGain!);
    source.connect(gain);
    source.start();
  }

  private thunderTimeout: ReturnType<typeof setTimeout> | null = null;
  private scheduleThunder(): void {
    if (this.thunderTimeout) clearTimeout(this.thunderTimeout);
    const delay = 8000 + Math.random() * 20000;
    this.thunderTimeout = setTimeout(() => {
      if (this.currentWeather === 'storm' && this.enabled) {
        this.playThunderClap();
        this.scheduleThunder();
      }
    }, delay);
  }

  private playThunderClap(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    // Two bursts of low-frequency noise
    for (let b = 0; b < 2; b++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(50, now + b * 0.15);
      osc.frequency.exponentialRampToValueAtTime(20, now + b * 0.15 + 1.2);
      gain.gain.setValueAtTime(0.15, now + b * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + b * 0.15 + 1.5);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + b * 0.15);
      osc.stop(now + b * 0.15 + 1.5);
    }
  }

  private birdTimeout: ReturnType<typeof setTimeout> | null = null;
  private scheduleBirds(): void {
    if (this.birdTimeout) clearTimeout(this.birdTimeout);
    const delay = 12000 + Math.random() * 16000;
    this.birdTimeout = setTimeout(() => {
      if (this.currentWeather === 'clear' && this.nightFactor < 0.5 && this.enabled) {
        this.playBirdChirp();
        this.scheduleBirds();
      }
    }, delay);
  }

  private playBirdChirp(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const freq = 2000 + Math.random() * 3000;
      osc.frequency.setValueAtTime(freq, now + i * 0.15);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + i * 0.15 + 0.08);
      gain.gain.setValueAtTime(0.02, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.12);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.15);
    }
  }

  private vendorTimeout: ReturnType<typeof setTimeout> | null = null;
  private scheduleVendor(): void {
    if (this.vendorTimeout) clearTimeout(this.vendorTimeout);
    const delay = 28000 + Math.random() * 25000;
    this.vendorTimeout = setTimeout(() => {
      if (this.currentWeather !== 'storm' && this.currentWeather !== 'snow' && this.nightFactor < 0.5 && this.enabled) {
        this.playVendorCall();
        this.scheduleVendor();
      }
    }, delay);
  }

  private playVendorCall(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    // Rising then falling pitch
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.4);
    osc.frequency.linearRampToValueAtTime(350, now + 0.8);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 1);
  }

  // ---- Primitive Sound Generators ----

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + duration);
  }

  private playMelody(freqs: number[], noteLen: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.12, now + i * noteLen);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * noteLen + noteLen * 1.2);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + i * noteLen);
      osc.stop(now + i * noteLen + noteLen * 1.5);
    });
  }

  private playNoiseBurst(duration: number, freqLow: number, freqHigh: number, vol: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.1 * white + 0.85 * b0;
      data[i] = b0;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(this.masterGain!);
    source.connect(gain);
    source.start(now);
    source.stop(now + duration);
  }

  private playSweep(freqStart: number, freqEnd: number, duration: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + duration);
  }

  private playDescendingSweep(freqStart: number, freqEnd: number, duration: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + duration);
  }

  private playFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const t = now + i * 0.12;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  dispose(): void {
    this.stopAmbience();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}

// Singleton
export const audioManager = new AudioManager();

// Make available globally for socket.ts placeholder
if (typeof window !== 'undefined') {
  (window as any).__monopolyAudio = audioManager;
}
