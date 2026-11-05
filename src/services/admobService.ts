import { Capacitor } from '@capacitor/core';

export type NativeRewardType = 'save_life' | 'life' | 'restart' | 'coins' | 'spin' | 'mystery';

interface AndroidAdBridge {
  watchSaveLife?: () => void;
  watchRewardedAd?: (rewardType: string) => void;
  preloadRewardedAd?: () => void;
  showInterstitial?: () => void;
  preloadInterstitial?: () => void;
  getBannerId?: () => string;
  isNativeAndroid?: () => boolean;
}

declare global {
  interface Window {
    Android?: AndroidAdBridge;
    giveLifeFromAd?: () => void;
    giveRewardFromAd?: (rewardType: string) => void;
    onNativeRewardedAdUnavailable?: (rewardType: string) => void;
    watchAdForLife?: () => void;
  }
}

/**
 * Final Live Google AdMob Ad Unit IDs:
 * - App ID: ca-app-pub-8318388001860392~8689085671
 * - Banner Ad ID: ca-app-pub-8318388001860392/7839164745 (native AdView at bottom in activity_main.xml)
 * - Interstitial Ad ID: ca-app-pub-8318388001860392/2642678386 (shown after every 3 completed games via Android.showInterstitial())
 * - Rewarded Ad ID (Watch Save Life): ca-app-pub-8318388001860392/4593766299 (Android.watchSaveLife() / Android.watchRewardedAd())
 * - App Open Ad ID: ca-app-pub-8318388001860392/5400703665 (loaded & shown in MainActivity.java)
 */
export const ADMOB_CONFIG = {
  APP_ID_ANDROID: 'ca-app-pub-8318388001860392~8689085671',
  BANNER_AD_ID: 'ca-app-pub-8318388001860392/7839164745',
  INTERSTITIAL_AD_ID: 'ca-app-pub-8318388001860392/2642678386',
  REWARDED_AD_ID: 'ca-app-pub-8318388001860392/4593766299',
  APP_OPEN_AD_ID: 'ca-app-pub-8318388001860392/5400703665',
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
      (typeof window.Android.watchSaveLife === 'function' ||
        typeof window.Android.showInterstitial === 'function')
    );
  }

  public hasNativeRewardedBridge(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.Android !== 'undefined' &&
      (typeof window.Android.watchRewardedAd === 'function' ||
        typeof window.Android.watchSaveLife === 'function')
    );
  }

  public isNative(): boolean {
    return this.hasAndroidBridge() || Capacitor.isNativePlatform();
  }

  public getGameOverCount(): number {
    return getGamesPlayed();
  }

  public async initializeAndShowBanner(): Promise<void> {
    if (this.hasAndroidBridge()) {
      window.Android?.preloadInterstitial?.();
      window.Android?.preloadRewardedAd?.();
    }
  }

  public async preloadInterstitial(): Promise<boolean> {
    if (this.hasAndroidBridge()) {
      try {
        window.Android?.preloadInterstitial?.();
        window.Android?.preloadRewardedAd?.();
      } catch {
        // Ignore bridge errors
      }
    }
    return true;
  }

  /**
   * Triggers native AdMob Rewarded Ad (ca-app-pub-8318388001860392/4593766299) via Android.watchSaveLife()
   * or Android.watchRewardedAd(rewardType) when inside the Android Studio APK.
   * Returns true if native bridge handled it; false if browser simulation modal should run.
   */
  public triggerRewardedAd(rewardType: NativeRewardType = 'save_life'): boolean {
    if (!this.hasNativeRewardedBridge()) {
      return false;
    }
    try {
      if (
        rewardType === 'save_life' &&
        typeof window.Android?.watchSaveLife === 'function'
      ) {
        window.Android.watchSaveLife();
        return true;
      }
      if (typeof window.Android?.watchRewardedAd === 'function') {
        window.Android.watchRewardedAd(rewardType);
        return true;
      }
      if (typeof window.Android?.watchSaveLife === 'function') {
        window.Android.watchSaveLife();
        return true;
      }
    } catch (err) {
      console.warn('Native Rewarded Ad call failed:', err);
    }
    return false;
  }

  public handleWebInterstitialDismissed(): void {
    void this.preloadInterstitial();
  }

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

  public async gameOver(skipAdsForVip: boolean = false): Promise<{
    triggeredInterstitial: boolean;
    showWebSimulation: boolean;
    gamesPlayed: number;
  }> {
    const currentGamesPlayed = incrementGamesPlayed();

    if (skipAdsForVip) {
      return {
        triggeredInterstitial: false,
        showWebSimulation: false,
        gamesPlayed: currentGamesPlayed,
      };
    }

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
