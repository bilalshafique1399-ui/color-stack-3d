/**
 * Procedural Web Audio synthesizer for Color Stack 3D.
 * Zero external audio files required — generates crisp marimba/kalimba tones,
 * ascending pentatonic combo chimes, overhang slice swooshes, and game-over chords.
 */

import { hapticEngine } from './hapticEngine';

// Major Pentatonic scale in semitones per full 12-semitone octave (strictly monotonic ascent!)
const PENTATONIC_SEMITONES = [0, 2, 4, 7, 9];

function streakToFrequency(streak: number): number {
  const step = Math.max(0, streak - 1);
  // Climb 3.5 full octaves smoothly from C4 (261.63 Hz) up to A7, with gentle brilliance above streak 18
  const cappedStep = Math.min(step, 17);
  const extraShimmerSemitones = step > 17 ? Math.min(5, (step - 17) * 0.5) : 0;
  const octave = Math.floor(cappedStep / PENTATONIC_SEMITONES.length);
  const noteIdx = cappedStep % PENTATONIC_SEMITONES.length;
  const semitones = octave * 12 + PENTATONIC_SEMITONES[noteIdx] + extraShimmerSemitones;
  return 261.63 * Math.pow(2, semitones / 12);
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    try {
      const saved = localStorage.getItem('color_stack_muted');
      this.muted = saved === 'true';
    } catch {
      this.muted = false;
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem('color_stack_muted', String(muted));
    } catch {
      // Ignore storage restrictions
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.playClick();
    }
    return this.muted;
  }

  public playClick(): void {
    hapticEngine.vibrateTap();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.045);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  private scheduleHarmonicVoice(
    ctx: AudioContext,
    type: OscillatorType,
    freq: number,
    startTime: number,
    peakGain: number,
    duration: number,
    detuneCents: number = 0,
  ): void {
    // Keep upper harmonics below Nyquist / comfortable brilliance ceiling
    if (freq > 7500) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.detune.setValueAtTime(detuneCents, startTime);
    // Subtle energetic upward pitch snap on attack
    osc.frequency.setValueAtTime(freq * 0.988, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.014);

    gain.gain.setValueAtTime(0.0008, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.009);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.015);
  }

  /**
   * Dynamically pitch-shifts the success tone strictly higher with every Perfect drop
   * and layers progressively richer harmonic intervals as the streak builds.
   */
  public playPerfectDrop(streak: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const baseFreq = streakToFrequency(streak);
    const energyBoost = Math.min(1.25, 1 + (streak - 1) * 0.03);

    // 1. Fundamental glassy tone (always present)
    this.scheduleHarmonicVoice(ctx, 'triangle', baseFreq, now, 0.24 * energyBoost, 0.36);

    // 2. Octave shimmer overtone (2x)
    this.scheduleHarmonicVoice(ctx, 'sine', baseFreq * 2, now + 0.006, 0.12 * energyBoost, 0.44);

    // 3. Streak 3+: Add warm Perfect Fifth (3:2 = 1.4983x) harmonic interval
    if (streak >= 3) {
      this.scheduleHarmonicVoice(
        ctx,
        'sine',
        baseFreq * 1.4983,
        now + 0.018,
        0.11 * energyBoost,
        0.42,
      );
    }

    // 4. Streak 6+: Add bright Major Third (5:4 = 1.2599x) + detuned chorus width
    if (streak >= 6) {
      this.scheduleHarmonicVoice(
        ctx,
        'triangle',
        baseFreq * 1.2599,
        now + 0.012,
        0.095 * energyBoost,
        0.46,
        5,
      );
      this.scheduleHarmonicVoice(
        ctx,
        'sine',
        baseFreq * 3.0,
        now + 0.028,
        0.065 * energyBoost,
        0.38,
        -5,
      );
    }

    // 5. Streak 10+: Radiant Major 9th sparkle arpeggio tail
    if (streak >= 10) {
      this.scheduleHarmonicVoice(
        ctx,
        'sine',
        baseFreq * 2.2449, // Major 9th above root
        now + 0.042,
        0.08 * energyBoost,
        0.5,
      );
    }
  }

  /**
   * Celebratory ascending chord when 5 consecutive perfect drops expand block size,
   * dynamically transposed upward to match the player's current streak pitch!
   */
  public playPowerExpand(streak: number = 5): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const rootFreq = streakToFrequency(streak);
    const intervals = [1.0, 1.2599, 1.4983, 2.0]; // Root, Major 3rd, Perfect 5th, Octave
    intervals.forEach((ratio, i) => {
      this.scheduleHarmonicVoice(
        ctx,
        i === 3 ? 'sine' : 'triangle',
        rootFreq * ratio,
        now + i * 0.036,
        0.17,
        0.48,
      );
    });
  }

  /**
   * Plays a crisp marimba tap + subtle slice effect when trimming overhang.
   */
  public playSliceDrop(layerIndex: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Subtle pitch shift based on stack height
    const pitchMod = 1 + ((layerIndex % 12) * 0.025);
    const freq = 196 * pitchMod;

    // Woody block thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.35, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + 0.11);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // Slice transient
    const sliceOsc = ctx.createOscillator();
    const sliceGain = ctx.createGain();
    sliceOsc.type = 'sawtooth';
    sliceOsc.frequency.setValueAtTime(920, now);
    sliceOsc.frequency.exponentialRampToValueAtTime(280, now + 0.065);

    sliceGain.gain.setValueAtTime(0.06, now);
    sliceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    sliceOsc.connect(sliceGain);
    sliceGain.connect(ctx.destination);
    sliceOsc.start(now);
    sliceOsc.stop(now + 0.075);
  }

  /**
   * Plays a warm descending resonant chord on Game Over.
   */
  public playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [329.63, 261.63, 196.0];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.88, start + 0.35);

      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  }

  /**
   * Bright metallic dual-bell harmonic ping when picking up a 3D Gold Coin.
   */
  public playCoinCollect(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    this.scheduleHarmonicVoice(ctx, 'sine', 987.77, now, 0.16, 0.18); // B5
    this.scheduleHarmonicVoice(ctx, 'triangle', 1318.51, now + 0.048, 0.19, 0.34); // E6
    this.scheduleHarmonicVoice(ctx, 'sine', 2637.02, now + 0.052, 0.08, 0.28); // E7 sparkle
  }

  /**
   * Short mechanical peg tick as the Lucky Spin Wheel passes a prize segment.
   */
  public playWheelTick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.022);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.026);
  }

  /**
   * Celebratory ascending arpeggio when winning Spin Wheel, Daily Login Bonus, or Mission rewards.
   */
  public playRewardFanfare(): void {
    hapticEngine.vibrateCoinPickup();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6
    chord.forEach((freq, idx) => {
      this.scheduleHarmonicVoice(ctx, 'triangle', freq, now + idx * 0.055, 0.16, 0.42);
    });
  }
}

export const soundEngine = new SoundEngine();
