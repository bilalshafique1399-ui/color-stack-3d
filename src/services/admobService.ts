import { Capacitor } from '@capacitor/core';

interface AndroidAdBridge {
  showInterstitial?: () => void;
  preloadInterstitial?: () => void;
  isNativeAndroid?: () => boolean;
}

declare global {
  interface Window {
    Android?: AndroidAdBridge;
  }
}

/**
 * Final Live Google AdMob Ad Unit IDs:
 * - App ID: ca-app-pub-8318388001860392~8689085671
 * - Banner Ad ID: ca-app-pub-8318388001860392/4000077808 (native AdView at bottom in activity_main.xml)
 * - Interstitial Ad ID: ca-app-pub-8318388001860392/3808506117 (shown after every 3 completed games via Android.showInterstitial())
 * - App Open Ad ID: ca-app-pub-8318388001860392/6741791216 (loaded & shown in MainActivity.java)
 */
export const ADMOB_CONFIG = {
  APP_ID_ANDROID: 'ca-app-pub-8318388001860392~8689085671',
  BANNER_AD_ID: 'ca-app-pub-8318388001860392/4000077808',
  INTERSTITIAL_AD_ID: 'ca-app-pub-8318388001860392/3808506117',
  APP_OPEN_AD_ID: 'ca-app-pub-8318388001860392/6741791216',
  INTERSTITIAL_FREQUENCY: 3, // Show after every 3 completed games
} as const;

const GAMES_PLAYED_STORAGE_KEY = 'gamesPlayed';

function loadGamesPlayedFromStorage(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(GAMES_PLAYED_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveGamesPlayedToStorage(count: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GAMES_PLAYED_STORAGE_KEY, String(count));
  } catch {
    // Ignore private-mode storage errors
  }
}

let gamesPlayed: number = loadGamesPlayedFromStorage();

export function getGamesPlayed(): number {
  gamesPlayed = loadGamesPlayedFromStorage() || gamesPlayed;
  return gamesPlayed;
}

export function incrementGamesPlayed(): number {
  const persisted = loadGamesPlayedFromStorage();
  if (persisted > gamesPlayed) {
    gamesPlayed = persisted;
  }
  gamesPlayed += 1;
  saveGamesPlayedToStorage(gamesPlayed);
  return gamesPlayed;
}

class AdMobManager {
  public hasAndroidBridge(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.Android !== 'undefined' &&
      typeof window.Android.showInterstitial === 'function'
    );
  }

  public isNative(): boolean {
    return this.hasAndroidBridge() || Capacitor.isNativePlatform();
  }

  public getGameOverCount(): number {
    return getGamesPlayed();
  }

  public async initializeAndShowBanner(): Promise<void> {
    // On Android APK, Banner + AppOpen + Interstitial preload run natively in MainActivity.java
    if (this.hasAndroidBridge()) {
      window.Android?.preloadInterstitial?.();
    }
  }

  public async preloadInterstitial(): Promise<boolean> {
    if (this.hasAndroidBridge()) {
      try {
        window.Android?.preloadInterstitial?.();
      } catch {
        // Ignore bridge errors
      }
    }
    return true;
  }

  public handleWebInterstitialDismissed(): void {
    void this.preloadInterstitial();
  }

  /**
   * Calls native Android.showInterstitial() when running inside the Android APK,
   * or triggers the web simulation modal when previewing in browser.
   */
  public async showInterstitialAd(): Promise<{
    triggeredInterstitial: boolean;
    showWebSimulation: boolean;
  }> {
    if (this.hasAndroidBridge()) {
      try {
        window.Android?.showInterstitial?.();
        return {
          triggeredInterstitial: true,
          showWebSimulation: false,
        };
      } catch (err) {
        console.warn('Android.showInterstitial() failed:', err);
        return {
          triggeredInterstitial: false,
          showWebSimulation: false,
        };
      }
    }

    if (Capacitor.isNativePlatform()) {
      return {
        triggeredInterstitial: false,
        showWebSimulation: false,
      };
    }

    return {
      triggeredInterstitial: true,
      showWebSimulation: true,
    };
  }

  /**
   * Increments persistent gamesPlayed counter (saved in localStorage) and triggers
   * Interstitial Ad strictly after every 3 completed games (gamesPlayed % 3 === 0).
   */
  public async gameOver(): Promise<{
    triggeredInterstitial: boolean;
    showWebSimulation: boolean;
    gamesPlayed: number;
  }> {
    const currentGamesPlayed = incrementGamesPlayed();

    if (currentGamesPlayed % ADMOB_CONFIG.INTERSTITIAL_FREQUENCY === 0) {
      const adResult = await this.showInterstitialAd();
      return {
        ...adResult,
        gamesPlayed: currentGamesPlayed,
      };
    }

    void this.preloadInterstitial();

    return {
      triggeredInterstitial: false,
      showWebSimulation: false,
      gamesPlayed: currentGamesPlayed,
    };
  }

  public async recordGameOverAndMaybeShowInterstitial(): Promise<{
    triggeredInterstitial: boolean;
    showWebSimulation: boolean;
    gameOverCount: number;
  }> {
    const res = await this.gameOver();
    return {
      triggeredInterstitial: res.triggeredInterstitial,
      showWebSimulation: res.showWebSimulation,
      gameOverCount: res.gamesPlayed,
    };
  }
}

export const admobService = new AdMobManager();
