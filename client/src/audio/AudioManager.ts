// ============================================================
// AudioManager — Procedural sound effects via Web Audio API
// Extended with era-aware ambience and zone-based environmental audio
// ============================================================

import type { EraId, EraAudio } from '@monopoly/shared';
import { getEra } from '@monopoly/shared';
import { AudioZone } from './ZoneDetector';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = true;
  private initialized = false;

  // Ambient nodes
  private rainNoise: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private cityAmbienceSource: AudioBufferSourceNode | null = null;
  private cityAmbienceGain: GainNode | null = null;
  private citySoundTimeout: ReturnType<typeof setTimeout> | null = null;

  // Track ambient state
  private currentWeather = 'clear';
  private nightFactor = 0;

  // ── Era & Zone ambient system ──
  private currentEra: EraId = '2025';
  private eraDroneSource: AudioBufferSourceNode | null = null;
  private eraDroneGain: GainNode | null = null;
  private eraDroneTargetVol = 0;
  private eraEventTimeouts: ReturnType<typeof setTimeout>[] = [];

  private zoneLayers: Map<AudioZone, {
    source: AudioBufferSourceNode;
    gain: GainNode;
    currentVol: number;
  }> = new Map();
  private zoneTargetGains: Map<AudioZone, number> = new Map();
  private zoneEventTimeouts: ReturnType<typeof setTimeout>[] = [];

  private init(): void {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.65;
      this.masterGain.connect(this.ctx.destination);

      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = 0;
      this.ambienceGain.connect(this.masterGain);

      // Resume on user interaction (browsers suspend AudioContext until click)
      const resume = () => {
        this.ctx?.resume();
        document.removeEventListener('click', resume);
        document.removeEventListener('keydown', resume);
      };
      document.addEventListener('click', resume);
      document.addEventListener('keydown', resume);

      this.initialized = true;
    } catch {
      this.enabled = false;
    }
  }

  private ensureContext(): AudioContext | null {
    this.init();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
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
  // ---- City & Environmental Sounds ----

  /** Car horn: two-tone honk */
  playCarHorn(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Two quick horn tones
    const tones = [380, 460];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.08, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.15);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.18);
    });
  }

  /** Bicycle bell: high-pitched ding-ding */
  playBicycleBell(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Two quick high-pitched rings
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now + i * 0.18);
      osc.frequency.setValueAtTime(2200, now + i * 0.18 + 0.03);
      osc.frequency.exponentialRampToValueAtTime(1200, now + i * 0.18 + 0.1);
      gain.gain.setValueAtTime(0.06, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.12);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.15);
    }
  }

  /** Footstep: short thud sound */
  playFootstep(surface?: string): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const baseFreq = 150;
    const vol = 0.18;

    // Short thud: low frequency burst
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.06);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.09);

    // Click component for texture
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(400, now);
    clickOsc.frequency.exponentialRampToValueAtTime(100, now + 0.03);
    clickGain.gain.setValueAtTime(vol * 0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    clickGain.connect(this.masterGain!);
    clickOsc.connect(clickGain);
    clickOsc.start(now);
    clickOsc.stop(now + 0.05);
  }

  /** Walking on grass/dirt (softer) */
  playFootstepGrass(): void {
    this.playFootstep('dirt');
  }

  // ---- City Ambience ----

  /** Start background city ambience (distant traffic, hum) */
  startCityAmbience(): void {
    if (!this.enabled || this.cityAmbienceSource) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.ambienceGain) return;

    const sampleRate = ctx.sampleRate;
    const duration = 8;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Layered filtered noise: low rumble + mid texture
    let b0 = 0, b1 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      // Very low frequency rumble (like distant engines)
      b0 = 0.008 * white + 0.99 * b0;
      // Mid-frequency texture (like distant voices, activity)
      b1 = 0.015 * white + 0.97 * b1;
      data[i] = b0 * 0.12 + b1 * 0.04;
    }

    this.cityAmbienceSource = ctx.createBufferSource();
    this.cityAmbienceSource.buffer = buffer;
    this.cityAmbienceSource.loop = true;

    this.cityAmbienceGain = ctx.createGain();
    this.cityAmbienceGain.gain.value = 0.25;
    this.cityAmbienceGain.connect(this.ambienceGain!);

    this.cityAmbienceSource.connect(this.cityAmbienceGain);
    this.cityAmbienceSource.start();
  }

  stopCityAmbience(): void {
    if (this.cityAmbienceSource) {
      try { this.cityAmbienceSource.stop(); } catch { /* already stopped */ }
      this.cityAmbienceSource = null;
    }
    this.cityAmbienceGain = null;
  }

  // ---- Scheduled Random City Sounds ----

  /** Start scheduling random city sounds (horns, bells, etc.) */
  startCitySounds(): void {
    this.scheduleCitySound();
  }

  stopCitySounds(): void {
    if (this.citySoundTimeout) {
      clearTimeout(this.citySoundTimeout);
      this.citySoundTimeout = null;
    }
  }

  private scheduleCitySound(): void {
    if (this.citySoundTimeout) clearTimeout(this.citySoundTimeout);
    const delay = 3000 + Math.random() * 8000;
    this.citySoundTimeout = setTimeout(() => {
      if (!this.enabled) return;
      const r = Math.random();
      if (r < 0.4) {
        this.playCarHorn();
      } else if (r < 0.65) {
        this.playBicycleBell();
      }
      // else: silence (just ambient hum)
      this.scheduleCitySound();
    }, delay);
  }

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
    // Note: city ambience and city sounds are persistent, not stopped by weather changes
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

  // ──────────────────────────────────────────────────────────
  // Era ambient drone — continuous era-characteristic background
  // ──────────────────────────────────────────────────────────

  setEra(eraId: EraId): void {
    if (this.currentEra === eraId && this.eraDroneSource) return;
    this.currentEra = eraId;
    this.stopEraDrone();
    this.stopEraEvents();
    if (!this.enabled) return;

    const eraDef = getEra(eraId);
    const audio = eraDef.audio;

    this.eraDroneTargetVol = audio.droneVolume;
    this.startEraDrone(audio);
    this.startEraEvents(audio);

    // Cross-fade old city ambience out in favor of era drone
    if (this.cityAmbienceGain) {
      this.cityAmbienceGain.gain.setTargetAtTime(0.02, this.ensureContext()?.currentTime || 0, 2);
    }
  }

  private startEraDrone(audio: EraAudio): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.ambienceGain) return;

    const sampleRate = ctx.sampleRate;
    const duration = 6;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    const baseFreq = audio.droneBaseFreq;
    const harmonics = audio.droneHarmonics;

    // Build a rich drone from filtered noise + harmonic partials
    let lpState = 0;
    const lpCoeff = 0.03;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const white = Math.random() * 2 - 1;

      // Low-passed noise as foundation
      lpState = lpCoeff * white + (1 - lpCoeff) * lpState;

      // Harmonic sine partials layered on top
      let harmonicSum = 0;
      for (const mult of harmonics) {
        harmonicSum += Math.sin(2 * Math.PI * baseFreq * mult * t + Math.sin(t * 0.3) * 0.5);
      }
      harmonicSum *= 0.15 / harmonics.length;

      // Wave-shape character varies by oscillator type
      const waveChar = audio.droneType === 'sawtooth' ? 0.6 : audio.droneType === 'square' ? 0.4 : 0.3;

      data[i] = lpState * 0.15 + harmonicSum * waveChar;
    }

    this.eraDroneSource = ctx.createBufferSource();
    this.eraDroneSource.buffer = buffer;
    this.eraDroneSource.loop = true;

    this.eraDroneGain = ctx.createGain();
    this.eraDroneGain.gain.value = 0;
    this.eraDroneGain.connect(this.ambienceGain!);

    this.eraDroneSource.connect(this.eraDroneGain);
    this.eraDroneSource.start();

    // Fade in
    this.eraDroneGain.gain.setTargetAtTime(audio.droneVolume, ctx.currentTime, 1.5);
  }

  private stopEraDrone(): void {
    if (this.eraDroneSource) {
      try { this.eraDroneSource.stop(); } catch { /* already stopped */ }
      this.eraDroneSource = null;
    }
    this.eraDroneGain = null;
  }

  // ── Era-specific random events ──

  private startEraEvents(audio: EraAudio): void {
    for (const event of audio.events) {
      this.scheduleEraEvent(event, audio);
    }
  }

  private scheduleEraEvent(event: EraAudio['events'][0], audio: EraAudio): void {
    const delay = (event.minInterval + Math.random() * (event.maxInterval - event.minInterval)) * 1000;
    const timeout = setTimeout(() => {
      if (this.currentEra !== this.currentEra || !this.enabled) return; // era changed
      this.playEraEventSound(event.name);
      this.scheduleEraEvent(event, audio);
    }, delay);
    this.eraEventTimeouts.push(timeout);
  }

  private playEraEventSound(name: string): void {
    switch (name) {
      // ── 1945 ──
      case 'typewriter': this.playTypewriter(); break;
      case 'steam_whistle': this.playSteamWhistle(); break;
      case 'vinyl_crackle': this.playVinylCrackle(); break;
      case 'old_car_engine': this.playOldCarEngine(); break;
      case 'radio_jingle': this.playRadioJingle(); break;
      // ── 1985 ──
      case 'arcade_blip': this.playArcadeBlip(); break;
      case 'synth_stab': this.playSynthStab(); break;
      case 'cassette_click': this.playCassetteClick(); break;
      case 'neon_hum': this.playNeonHum(); break;
      case 'dial_up': this.playDialUp(); break;
      // ── 2025 ──
      case 'notification_ping': this.playNotificationPing(); break;
      case 'ev_motor': this.playEVMotor(); break;
      case 'coffee_shop': this.playCoffeeShop(); break;
      case 'keyboard_typing': this.playKeyboardTyping(); break;
      case 'electric_scooter': this.playElectricScooter(); break;
      // ── 2055 ──
      case 'hover_whoosh': this.playHoverWhoosh(); break;
      case 'holo_chime': this.playHoloChime(); break;
      case 'biolume_crackle': this.playBiolumeCrackle(); break;
      case 'ai_voice_tone': this.playAIVoiceTone(); break;
      case 'quantum_pulse': this.playQuantumPulse(); break;
    }
  }

  private stopEraEvents(): void {
    for (const t of this.eraEventTimeouts) clearTimeout(t);
    this.eraEventTimeouts = [];
  }

  // ──────────────────────────────────────────────────────────
  // Zone ambient layers — location-based environmental audio
  // ──────────────────────────────────────────────────────────

  setZoneWeights(weights: Map<AudioZone, number>): void {
    // Store target gains; update() cross-fades smoothly
    this.zoneTargetGains = new Map(weights);
  }

  update(_dt: number): void {
    if (!this.enabled || !this.initialized) return;

    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const activeZones = new Set(this.zoneTargetGains.keys());

    // Create layers for new zones with non-zero weight
    for (const [zone, targetGain] of this.zoneTargetGains) {
      if (targetGain < 0.03) continue; // skip negligible weights

      let layer = this.zoneLayers.get(zone);
      if (!layer) {
        const newLayer = this.createZoneLayer(zone);
        if (!newLayer) continue;
        this.zoneLayers.set(zone, newLayer);
        layer = newLayer;
        // Start zone events when first activating
        this.startZoneEvents(zone);
      }

      // Smooth cross-fade
      const vol = targetGain * 0.25; // scale to reasonable ambient level
      layer.gain.gain.setTargetAtTime(Math.max(0.01, vol), now, 1.5);
      layer.currentVol = vol;
    }

    // Fade out inactive zones
    for (const [zone, layer] of this.zoneLayers) {
      if (!activeZones.has(zone) || (this.zoneTargetGains.get(zone) || 0) < 0.03) {
        layer.gain.gain.setTargetAtTime(0, now, 2.0);
        layer.currentVol = 0;
        this.stopZoneEvents(zone);
      }
    }

    // Garbage collect fully silent layers
    for (const [zone, layer] of this.zoneLayers) {
      if (layer.currentVol === 0 && layer.gain.gain.value < 0.001) {
        try { layer.source.stop(); } catch { /* ok */ }
        this.zoneLayers.delete(zone);
      }
    }
  }

  private createZoneLayer(zone: AudioZone): { source: AudioBufferSourceNode; gain: GainNode; currentVol: number } | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.ambienceGain) return null;

    const buffer = this.buildZoneAmbientBuffer(zone, ctx.sampleRate);
    if (!buffer) return null;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.ambienceGain!);
    source.connect(gain);
    source.start();

    return { source, gain, currentVol: 0 };
  }

  private buildZoneAmbientBuffer(zone: AudioZone, sampleRate: number): AudioBuffer | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;

    const duration = 5;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Each zone has a distinctive noise profile
    let lpState = 0;
    let lp2State = 0;

    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;

      switch (zone) {
        case AudioZone.ResidentialLow:
          // Quiet, gentle: very low filtered noise + distant birds
          lpState = 0.004 * white + 0.994 * lpState;
          data[i] = lpState * 0.12;
          break;

        case AudioZone.CommercialMid:
          // Busy mid-range: chatter-like noise texture
          lpState = 0.015 * white + 0.975 * lpState;
          lp2State = 0.03 * white + 0.95 * lp2State;
          data[i] = lpState * 0.08 + lp2State * 0.05;
          break;

        case AudioZone.Upscale:
          // Elegant: gentle water-like texture + occasional tonal
          lpState = 0.006 * white + 0.99 * lpState;
          const t = i / sampleRate;
          data[i] = lpState * 0.08 + Math.sin(t * 1.7) * 0.012;
          break;

        case AudioZone.Premium:
          // Corporate: subdued, minimal, clean
          lpState = 0.005 * white + 0.992 * lpState;
          data[i] = lpState * 0.06;
          break;

        case AudioZone.Railway:
          // Distant train rumble: very low frequency emphasis
          lpState = 0.02 * white + 0.98 * lpState;
          data[i] = lpState * 0.18;
          break;

        case AudioZone.Industrial:
          // Machinery: sharper noise + electrical buzz
          lpState = 0.025 * white + 0.96 * lpState;
          lp2State = 0.06 * white + 0.88 * lp2State;
          data[i] = lpState * 0.1 + lp2State * 0.06;
          break;

        case AudioZone.Civic:
          // Open hall: slight reverb feel, crowd murmur
          lpState = 0.01 * white + 0.985 * lpState;
          lp2State = 0.02 * white + 0.97 * lp2State;
          data[i] = lpState * 0.06 + lp2State * 0.05;
          break;

        case AudioZone.InnerCafe:
          // Warm, cozy: mid-high filtered noise (steam, chatter)
          lpState = 0.018 * white + 0.97 * lpState;
          lp2State = 0.04 * white + 0.93 * lp2State;
          data[i] = lpState * 0.06 + lp2State * 0.04;
          break;

        case AudioZone.InnerRest:
          // Peaceful: very quiet with gentle tones
          lpState = 0.003 * white + 0.995 * lpState;
          const t2 = i / sampleRate;
          data[i] = lpState * 0.05 + Math.sin(t2 * 0.8) * 0.008;
          break;

        case AudioZone.InnerMarket:
          // Lively: richer noise, market bustle
          lpState = 0.02 * white + 0.975 * lpState;
          lp2State = 0.035 * white + 0.94 * lp2State;
          data[i] = lpState * 0.09 + lp2State * 0.05;
          break;
      }
    }

    return buffer;
  }

  // ── Zone-specific random sounds ──

  private zoneEventStates: Map<AudioZone, ReturnType<typeof setTimeout>> = new Map();

  private startZoneEvents(zone: AudioZone): void {
    if (this.zoneEventStates.has(zone)) return;
    this.scheduleZoneEvent(zone);
  }

  private scheduleZoneEvent(zone: AudioZone): void {
    const config = ZONE_EVENT_CONFIG[zone];
    if (!config) return;

    const delay = (config.minInterval + Math.random() * (config.maxInterval - config.minInterval)) * 1000;
    const timeout = setTimeout(() => {
      if (!this.enabled || !this.zoneLayers.has(zone)) return;
      const layer = this.zoneLayers.get(zone);
      if (layer && layer.currentVol > 0.02) {
        const r = Math.random();
        let cumulative = 0;
        for (const ev of config.events) {
          cumulative += ev.weight / config.totalWeight;
          if (r < cumulative) {
            this.playZoneEventSound(ev.name);
            break;
          }
        }
      }
      this.scheduleZoneEvent(zone);
    }, delay);
    this.zoneEventStates.set(zone, timeout);
    this.zoneEventTimeouts.push(timeout);
  }

  private stopZoneEvents(zone: AudioZone): void {
    const t = this.zoneEventStates.get(zone);
    if (t) {
      clearTimeout(t);
      this.zoneEventStates.delete(zone);
    }
  }

  private playZoneEventSound(name: string): void {
    switch (name) {
      // Residential
      case 'bird_song': this.playBirdChirp(); break;
      case 'dog_bark': this.playDogBark(); break;
      case 'children_play': this.playChildrenPlay(); break;
      case 'garden_sprinkler': this.playSprinkler(); break;
      // Commercial
      case 'cash_register': this.playCashRegister(); break;
      case 'street_music': this.playStreetMusic(); break;
      case 'door_chime': this.playDoorChime(); break;
      // Upscale
      case 'fountain': this.playFountain(); break;
      case 'piano_note': this.playPianoNote(); break;
      // Premium
      case 'elevator_ding': this.playElevatorDing(); break;
      case 'office_murmur': this.playOfficeMurmur(); break;
      // Railway
      case 'train_rumble': this.playTrainRumble(); break;
      case 'platform_bell': this.playPlatformBell(); break;
      // Industrial
      case 'machine_hum': this.playMachineHum(); break;
      case 'electric_spark': this.playElectricSpark(); break;
      // Civic
      case 'crowd_murmur': this.playCrowdMurmur(); break;
      case 'bell_tower': this.playBellTower(); break;
      // Inner Cafe
      case 'coffee_machine': this.playCoffeeMachine(); break;
      case 'cup_clink': this.playCupClink(); break;
      // Inner Rest
      case 'leaves_rustle': this.playLeavesRustle(); break;
      case 'water_trickle': this.playWaterTrickle(); break;
      // Inner Market
      case 'vendor_call': this.playVendorCall(); break;
      case 'market_chatter': this.playMarketChatter(); break;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Era Event Sound Generators
  // ──────────────────────────────────────────────────────────

  // ── 1945 ──

  private playTypewriter(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Series of quick ticks
    const count = 5 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const t = now + i * 0.12 + Math.random() * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800 + Math.random() * 400, t);
      gain.gain.setValueAtTime(0.02, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.04);
    }
    // Carriage return "ding"
    const ding = ctx.createOscillator();
    const dGain = ctx.createGain();
    ding.type = 'sine';
    ding.frequency.setValueAtTime(1200, now + count * 0.12 + 0.1);
    dGain.gain.setValueAtTime(0.04, now + count * 0.12 + 0.1);
    dGain.gain.exponentialRampToValueAtTime(0.001, now + count * 0.12 + 0.3);
    dGain.connect(this.masterGain!);
    ding.connect(dGain);
    ding.start(now + count * 0.12 + 0.1);
    ding.stop(now + count * 0.12 + 0.35);
  }

  private playSteamWhistle(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.3);
    osc.frequency.setValueAtTime(800, now + 0.8);
    osc.frequency.exponentialRampToValueAtTime(400, now + 1.5);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.2);
    gain.gain.setValueAtTime(0.07, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 1.6);
  }

  private playVinylCrackle(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const sampleRate = ctx.sampleRate;
    const duration = 0.8 + Math.random() * 1.2;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    // Sparse impulse noise (crackle)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() < 0.08 ? (Math.random() * 2 - 1) * 0.06 : 0;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(this.masterGain!);
    source.connect(gain);
    source.start(now);
    source.stop(now + duration);
  }

  private playOldCarEngine(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Rumbling engine start + idle
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(30, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.4);
    osc.frequency.setValueAtTime(50, now + 1.2);
    osc.frequency.setValueAtTime(55, now + 1.5);
    osc.frequency.setValueAtTime(35, now + 2.5);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.3);
    gain.gain.setValueAtTime(0.06, now + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 2.9);
  }

  private playRadioJingle(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Short melodic jingle with AM radio effect (filtered)
    const notes = [440, 554, 659, 554, 440];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const t = now + i * 0.1;
      gain.gain.setValueAtTime(0.025, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  // ── 1985 ──

  private playArcadeBlip(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const count = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const freq = 400 + Math.random() * 1200;
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.03, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.06);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.08);
    }
  }

  private playSynthStab(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Dramatic synth chord stab
    const freqs = [220, 277, 330, 440];
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.55);
    });
  }

  private playCassetteClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Mechanical click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.06);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.1);
    // Followed by tape hiss
    setTimeout(() => {
      this.playNoiseBurst(0.2, 2000, 6000, 0.02);
    }, 100);
  }

  private playNeonHum(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // High-pitched electrical buzz
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now); // 120Hz base with 60Hz feel
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.025, now + 0.2);
    gain.gain.setValueAtTime(0.025, now + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 2.1);
  }

  private playDialUp(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Classic modem handshake tones
    const sweep = ctx.createOscillator();
    const gain = ctx.createGain();
    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(1000, now);
    sweep.frequency.exponentialRampToValueAtTime(2000, now + 0.5);
    sweep.frequency.setValueAtTime(2000, now + 0.8);
    sweep.frequency.exponentialRampToValueAtTime(800, now + 1.2);
    sweep.frequency.setValueAtTime(1800, now + 1.5);
    sweep.frequency.exponentialRampToValueAtTime(1000, now + 2.0);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.setValueAtTime(0.03, now + 1.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
    gain.connect(this.masterGain!);
    sweep.connect(gain);
    sweep.start(now);
    sweep.stop(now + 2.3);
  }

  // ── 2025 ──

  private playNotificationPing(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.setValueAtTime(1500, now + 0.03);
    osc.frequency.setValueAtTime(1800, now + 0.06);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  private playEVMotor(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Smooth electric motor whir
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(400, now + 0.8);
    osc.frequency.setValueAtTime(400, now + 1.5);
    osc.frequency.linearRampToValueAtTime(100, now + 2.5);
    gain.gain.setValueAtTime(0.015, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.4);
    gain.gain.setValueAtTime(0.03, now + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 2.9);
  }

  private playCoffeeShop(): void {
    // Combine espresso steam + cup sounds
    this.playCoffeeMachine();
    setTimeout(() => this.playCupClink(), 400);
  }

  private playKeyboardTyping(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const count = 8 + Math.floor(Math.random() * 12);
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(600 + Math.random() * 600, now + i * 0.06 + Math.random() * 0.03);
      gain.gain.setValueAtTime(0.012, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.02);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.03);
    }
  }

  private playElectricScooter(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.5);
    osc.frequency.exponentialRampToValueAtTime(80, now + 1.2);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 1.4);
  }

  // ── 2055 ──

  private playHoverWhoosh(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Filtered noise sweep simulating hover vehicle pass
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 1.0);
    osc.frequency.exponentialRampToValueAtTime(60, now + 2.0);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.5);
    gain.gain.linearRampToValueAtTime(0.05, now + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 2.3);
  }

  private playHoloChime(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Sparkling chime with harmonics
    const baseFreq = 800 + Math.random() * 600;
    [1, 1.5, 2, 2.5, 3].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = baseFreq * mult;
      const t = now + i * 0.04;
      gain.gain.setValueAtTime(0.025 / (i + 1), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  private playBiolumeCrackle(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const sampleRate = ctx.sampleRate;
    const duration = 0.6 + Math.random() * 1.0;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    // Organic crackle with high-frequency sparkle
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() < 0.05 ? (Math.random() * 2 - 1) * 0.05 : Math.sin(i / sampleRate * 8000) * 0.005;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(this.masterGain!);
    source.connect(gain);
    source.start(now);
    source.stop(now + duration);
  }

  private playAIVoiceTone(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Two-tone AI assistant chime
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.setValueAtTime(1200, now + 0.08);
    osc.frequency.setValueAtTime(1600, now + 0.16);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  private playQuantumPulse(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Deep resonant pulse
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(30, now + i * 0.3);
      gain.gain.setValueAtTime(0.06, now + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.3 + 0.2);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + i * 0.3);
      osc.stop(now + i * 0.3 + 0.25);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Zone Event Sound Generators
  // ──────────────────────────────────────────────────────────

  // ── Residential ──

  private playDogBark(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(250, now + i * 0.18);
      osc.frequency.exponentialRampToValueAtTime(180, now + i * 0.18 + 0.1);
      gain.gain.setValueAtTime(0.04, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.13);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.15);
    }
  }

  private playChildrenPlay(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Distant laughter-like high pitched bursts
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600 + Math.random() * 400, now + i * 0.25);
      osc.frequency.linearRampToValueAtTime(800 + Math.random() * 300, now + i * 0.25 + 0.15);
      gain.gain.setValueAtTime(0.015, now + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 0.2);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + i * 0.25);
      osc.stop(now + i * 0.25 + 0.22);
    }
  }

  private playSprinkler(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Rhythmic ticking
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.015, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.02);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.03);
    }
  }

  // ── Commercial ──

  private playCashRegister(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(1200, now + 0.05);
    osc.frequency.setValueAtTime(600, now + 0.1);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  private playStreetMusic(): void {
    // Reuse fanfare pattern but quieter
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const notes = [523, 587, 659, 523, 440, 523];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const t = now + i * 0.13;
      gain.gain.setValueAtTime(0.02, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  private playDoorChime(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.setValueAtTime(2000, now + 0.06);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // ── Upscale ──

  private playFountain(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Gentle water splashing noise
    const sampleRate = ctx.sampleRate;
    const duration = 1.5;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      lp = 0.06 * white + 0.92 * lp; // high-frequency filtered noise
      data[i] = lp * 0.06;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(this.masterGain!);
    source.connect(gain);
    source.start(now);
    source.stop(now + duration);
  }

  private playPianoNote(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const notes = [523, 659, 784, 659, 523];
    const note = notes[Math.floor(Math.random() * notes.length)];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = note;
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  // ── Premium ──

  private playElevatorDing(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.setValueAtTime(1400, now + 0.06);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  private playOfficeMurmur(): void {
    // Reuse crowd murmur pattern
    this.playCrowdMurmur();
  }

  // ── Railway ──

  private playTrainRumble(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Deep, distant rumble
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(25, now);
    osc.frequency.linearRampToValueAtTime(35, now + 0.8);
    osc.frequency.setValueAtTime(35, now + 2.0);
    osc.frequency.linearRampToValueAtTime(20, now + 3.5);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.5);
    gain.gain.setValueAtTime(0.05, now + 2.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3.8);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 4.0);
  }

  private playPlatformBell(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.03, now + i * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.5 + 0.15);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + i * 0.5);
      osc.stop(now + i * 0.5 + 0.18);
    }
  }

  // ── Industrial ──

  private playMachineHum(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.setValueAtTime(120, now + 0.3);
    osc.frequency.setValueAtTime(60, now + 0.5);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.setValueAtTime(0.025, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 1.1);
  }

  private playElectricSpark(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Sharp high-frequency crack
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(3000, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // ── Civic ──

  private playCrowdMurmur(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const sampleRate = ctx.sampleRate;
    const duration = 2.0;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      lp = 0.025 * white + 0.965 * lp;
      data[i] = lp * 0.08;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(this.masterGain!);
    source.connect(gain);
    source.start(now);
    source.stop(now + duration);
  }

  private playBellTower(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.04, now + i * 1.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 1.5 + 0.5);
      gain.connect(this.masterGain!);
      osc.connect(gain);
      osc.start(now + i * 1.5);
      osc.stop(now + i * 1.5 + 0.6);
    }
  }

  // ── Inner Cafe ──

  private playCoffeeMachine(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // Steam hiss + pump noise
    const sampleRate = ctx.sampleRate;
    const duration = 1.2;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      lp = 0.04 * white + 0.94 * lp;
      data[i] = lp * 0.06;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(this.masterGain!);
    source.connect(gain);
    source.start(now);
    source.stop(now + duration);
  }

  private playCupClink(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3000, now);
    osc.frequency.exponentialRampToValueAtTime(1500, now + 0.08);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    gain.connect(this.masterGain!);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // ── Inner Rest ──

  private playLeavesRustle(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const sampleRate = ctx.sampleRate;
    const duration = 1.5;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      lp = 0.08 * white + 0.88 * lp;
      data[i] = lp * 0.04;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(this.masterGain!);
    source.connect(gain);
    source.start(now);
    source.stop(now + duration);
  }

  private playWaterTrickle(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // High-frequency water trickle
    const sampleRate = ctx.sampleRate;
    const duration = 1.0;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      lp = 0.1 * white + 0.85 * lp;
      data[i] = lp * 0.04;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(this.masterGain!);
    source.connect(gain);
    source.start(now);
    source.stop(now + duration);
  }

  // ── Inner Market ──

  private playMarketChatter(): void {
    // Similar to crowd murmur but slightly different character
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const sampleRate = ctx.sampleRate;
    const duration = 2.5;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    let lp1 = 0, lp2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      lp1 = 0.035 * white + 0.95 * lp1;
      lp2 = 0.05 * white + 0.93 * lp2;
      data[i] = lp1 * 0.05 + lp2 * 0.04;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(this.masterGain!);
    source.connect(gain);
    source.start(now);
    source.stop(now + duration);
  }

  // ──────────────────────────────────────────────────────────
  // Zone event configuration
  // ──────────────────────────────────────────────────────────

  dispose(): void {
    this.stopAmbience();
    this.stopCityAmbience();
    this.stopCitySounds();
    this.stopEraDrone();
    this.stopEraEvents();
    // Clean up zone layers
    for (const [, layer] of this.zoneLayers) {
      try { layer.source.stop(); } catch { /* ok */ }
    }
    this.zoneLayers.clear();
    for (const t of this.zoneEventTimeouts) clearTimeout(t);
    this.zoneEventTimeouts = [];
    this.zoneEventStates.clear();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}

// ──────────────────────────────────────────────────────────
// Zone event configuration
// ──────────────────────────────────────────────────────────

interface ZoneEventConfig {
  minInterval: number;
  maxInterval: number;
  totalWeight: number;
  events: { name: string; weight: number }[];
}

const ZONE_EVENT_CONFIG: Partial<Record<AudioZone, ZoneEventConfig>> = {
  [AudioZone.ResidentialLow]: {
    minInterval: 10, maxInterval: 25,
    totalWeight: 10,
    events: [
      { name: 'bird_song', weight: 5 },
      { name: 'dog_bark', weight: 2 },
      { name: 'children_play', weight: 2 },
      { name: 'garden_sprinkler', weight: 1 },
    ],
  },
  [AudioZone.CommercialMid]: {
    minInterval: 6, maxInterval: 18,
    totalWeight: 10,
    events: [
      { name: 'cash_register', weight: 3 },
      { name: 'street_music', weight: 2 },
      { name: 'door_chime', weight: 3 },
      { name: 'vendor_call', weight: 2 },
    ],
  },
  [AudioZone.Upscale]: {
    minInterval: 8, maxInterval: 22,
    totalWeight: 6,
    events: [
      { name: 'fountain', weight: 3 },
      { name: 'piano_note', weight: 3 },
    ],
  },
  [AudioZone.Premium]: {
    minInterval: 10, maxInterval: 28,
    totalWeight: 4,
    events: [
      { name: 'elevator_ding', weight: 3 },
      { name: 'office_murmur', weight: 1 },
    ],
  },
  [AudioZone.Railway]: {
    minInterval: 8, maxInterval: 20,
    totalWeight: 6,
    events: [
      { name: 'train_rumble', weight: 4 },
      { name: 'platform_bell', weight: 2 },
    ],
  },
  [AudioZone.Industrial]: {
    minInterval: 6, maxInterval: 16,
    totalWeight: 6,
    events: [
      { name: 'machine_hum', weight: 3 },
      { name: 'electric_spark', weight: 3 },
    ],
  },
  [AudioZone.Civic]: {
    minInterval: 10, maxInterval: 25,
    totalWeight: 6,
    events: [
      { name: 'crowd_murmur', weight: 2 },
      { name: 'bell_tower', weight: 2 },
      { name: 'door_chime', weight: 2 },
    ],
  },
  [AudioZone.InnerCafe]: {
    minInterval: 6, maxInterval: 15,
    totalWeight: 6,
    events: [
      { name: 'coffee_machine', weight: 3 },
      { name: 'cup_clink', weight: 3 },
    ],
  },
  [AudioZone.InnerRest]: {
    minInterval: 8, maxInterval: 22,
    totalWeight: 6,
    events: [
      { name: 'bird_song', weight: 2 },
      { name: 'leaves_rustle', weight: 2 },
      { name: 'water_trickle', weight: 2 },
    ],
  },
  [AudioZone.InnerMarket]: {
    minInterval: 5, maxInterval: 14,
    totalWeight: 6,
    events: [
      { name: 'vendor_call', weight: 2 },
      { name: 'cash_register', weight: 2 },
      { name: 'market_chatter', weight: 2 },
    ],
  },
};

// Singleton
export const audioManager = new AudioManager();

// Make available globally for socket.ts placeholder
if (typeof window !== 'undefined') {
  (window as any).__monopolyAudio = audioManager;
}
