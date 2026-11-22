import { PlayerSettings } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private lastBounceTime = 0;
  private settings: PlayerSettings = {
    sfxEnabled: true,
    sfxVolume: 0.7,
    musicEnabled: false,
    musicVolume: 0.35,
    reducedEffects: false,
    showTrajectory: true,
  };

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.settings.sfxEnabled ? this.settings.sfxVolume : 0;
      this.sfxGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.settings.musicEnabled ? this.settings.musicVolume * 0.4 : 0;
      this.musicGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && this.settings.musicEnabled && this.musicTimer === null) {
      this.startMusicLoop();
    }
  }

  public updateSettings(next: PlayerSettings): void {
    this.settings = { ...next };
    if (this.ctx && this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(
        next.sfxEnabled ? next.sfxVolume : 0,
        this.ctx.currentTime,
        0.04
      );
    }
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(
        next.musicEnabled ? next.musicVolume * 0.4 : 0,
        this.ctx.currentTime,
        0.08
      );
    }

    if (next.musicEnabled) {
      if (this.ctx && this.musicTimer === null) {
        this.startMusicLoop();
      }
    } else {
      this.stopMusicLoop();
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.25,
    delay = 0,
    slideToFreq?: number,
    target: 'sfx' | 'music' = 'sfx'
  ): void {
    if (target === 'sfx' && (!this.settings.sfxEnabled || this.settings.sfxVolume <= 0)) return;
    if (target === 'music' && (!this.settings.musicEnabled || this.settings.musicVolume <= 0)) return;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const bus = target === 'sfx' ? this.sfxGain : this.musicGain;
    if (!bus) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideToFreq), start + duration);
    }

    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(volume, start + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env);
    env.connect(bus);

    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  public playDrop(): void {
    this.playTone(460, 0.11, 'sine', 0.2, 0, 260);
  }

  public playBounce(intensity: number): void {
    const now = performance.now();
    if (now - this.lastBounceTime < 65) return;
    this.lastBounceTime = now;
    const clamped = Math.min(1, Math.max(0.15, intensity));
    const freq = 180 + Math.random() * 60 + clamped * 90;
    this.playTone(freq, 0.06, 'triangle', 0.08 * clamped, 0, freq * 0.8);
  }

  public playMerge(level: number, combo: number): void {
    const pentatonic = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const baseFreq = pentatonic[Math.min(pentatonic.length - 1, Math.max(0, level - 1))];
    const comboBoost = 1 + Math.min(combo - 1, 5) * 0.06;
    const f = baseFreq * comboBoost;

    this.playTone(f, 0.16, 'sine', 0.24, 0, f * 1.18);
    this.playTone(f * 1.5, 0.18, 'triangle', 0.14, 0.04);

    if (combo >= 2) {
      this.playTone(f * 2, 0.22, 'sine', 0.14, 0.08);
    }
  }

  public playSupernova(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.35, 'triangle', 0.2, idx * 0.06);
    });
  }

  public playNewDiscovery(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this.playTone(n, 0.22, 'sine', 0.18, i * 0.07);
    });
  }

  public playNewRecord(): void {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, i) => {
      this.playTone(n, 0.26, 'triangle', 0.2, i * 0.085);
    });
  }

  public playGameOver(): void {
    const notes = [392, 349.23, 329.63, 261.63];
    notes.forEach((n, i) => {
      this.playTone(n, 0.28, 'sine', 0.18, i * 0.13);
    });
  }

  public playCoin(): void {
    this.playTone(987.77, 0.09, 'sine', 0.16, 0);
    this.playTone(1318.51, 0.16, 'sine', 0.16, 0.06);
  }

  public playClick(): void {
    this.playTone(540, 0.045, 'sine', 0.1, 0, 480);
  }

  private startMusicLoop(): void {
    if (this.musicTimer !== null) return;
    // Gentle C-major / A-minor kalimba pattern
    const pattern = [
      261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 392.0,
      220.0, 261.63, 329.63, 440.0, 329.63, 261.63, 246.94, 329.63,
      174.61, 220.0, 261.63, 349.23, 261.63, 220.0, 196.0, 293.66,
      261.63, 329.63, 392.0, 523.25, 493.88, 392.0, 329.63, 293.66,
    ];
    const bass = [130.81, 110.0, 87.31, 98.0];

    const tick = () => {
      if (!this.settings.musicEnabled) {
        this.stopMusicLoop();
        return;
      }
      const note = pattern[this.musicStep % pattern.length];
      this.playTone(note, 0.42, 'sine', 0.18, 0, undefined, 'music');

      if (this.musicStep % 8 === 0) {
        const bassNote = bass[Math.floor(this.musicStep / 8) % bass.length];
        this.playTone(bassNote, 0.85, 'triangle', 0.14, 0, undefined, 'music');
      }
      this.musicStep++;
    };

    tick();
    this.musicTimer = window.setInterval(tick, 440);
  }

  private stopMusicLoop(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const soundEngine = new SoundEngine();
