/**
 * Tactile Haptic Feedback Engine using the Web Vibration API (`navigator.vibrate`).
 * Provides distinct rhythmic vibration patterns for block placement, escalating
 * perfect combos, 3D coin pickups, and Game Over impact, with graceful no-op
 * fallback on unsupported browsers/desktops and persistent user toggle state.
 */

const HAPTICS_STORAGE_KEY = 'color_stack_haptics_muted_v1';

class HapticEngine {
  private muted: boolean = false;

  constructor() {
    try {
      const saved = localStorage.getItem(HAPTICS_STORAGE_KEY);
      this.muted = saved === 'true';
    } catch {
      this.muted = false;
    }
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stop();
    }
    try {
      localStorage.setItem(HAPTICS_STORAGE_KEY, String(muted));
    } catch {
      // Ignore storage restrictions
    }
  }

  public toggleMute(): boolean {
    const nextMuted = !this.muted;
    this.setMuted(nextMuted);
    if (!nextMuted) {
      this.trigger([16, 22, 18]);
    }
    return nextMuted;
  }

  private trigger(pattern: number | number[]): void {
    if (this.muted || !this.isSupported()) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore blocked vibration before first user gesture
    }
  }

  public stop(): void {
    if (!this.isSupported()) return;
    try {
      navigator.vibrate(0);
    } catch {
      // Ignore
    }
  }

  /** Subtle micro-tick for UI button interactions */
  public vibrateTap(): void {
    this.trigger(8);
  }

  /** Crisp solid thud when a standard/sliced block lands on the tower */
  public vibrateBlockPlaced(): void {
    this.trigger(18);
  }

  /** Escalating rhythmic multi-pulse pattern for Perfect Combos & 5-streak Size-Up */
  public vibratePerfectCombo(combo: number, expanded: boolean): void {
    if (expanded) {
      // Celebratory 3-stage crescendo on 5-streak Size-Up
      this.trigger([24, 24, 28, 24, 48]);
      return;
    }
    if (combo >= 6) {
      this.trigger([18, 20, 24, 20, 36]);
      return;
    }
    if (combo >= 2) {
      const accent = Math.min(34, 22 + combo * 2);
      this.trigger([16, 22, accent]);
      return;
    }
    this.trigger([16, 20, 22]);
  }

  /** Light metallic double-pulse when collecting a 3D Gold Coin */
  public vibrateCoinPickup(): void {
    this.trigger([12, 18, 22]);
  }

  /** Heavy crash + decay rumble when missing the tower (Game Over) */
  public vibrateGameOver(): void {
    this.trigger([60, 45, 95, 40, 55]);
  }
}

export const hapticEngine = new HapticEngine();
