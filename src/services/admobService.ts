import { Capacitor } from '@capacitor/core';

export type NativeRewardType = 'save_life' | 'life' | 'restart' | 'coins' | 'spin' | 'mystery';

// REAL AdMob - Koi Preview / Fake Ad Nahi Hoga
export const ADMOB_CONFIG = {
  APP_ID: 'ca-app-pub-8318388001860392~8689085671',
  APP_ID_ANDROID: 'ca-app-pub-8318388001860392~8689085671',
  REWARDED_AD_ID: 'ca-app-pub-8318388001860392/4593766299',
  BANNER_AD_ID: 'ca-app-pub-8318388001860392/7839164745',
  INTERSTITIAL_AD_ID: 'ca-app-pub-8318388001860392/2642678386',
  APP_OPEN_AD_ID: 'ca-app-pub-8318388001860392/5400703665',
  INTERSTITIAL_FREQUENCY: 3, // Show after every 3 completed games
} as const;

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
    AndroidAdMob?: {
      showRewarded: () => void;
      showInterstitial: () => void;
      showAppOpen?: () => void;
    };
    Android?: AndroidAdBridge;
    onRewardEarned?: () => void;
    giveLifeFromAd?: () => void;
    giveRewardFromAd?: (rewardType: string) => void;
    onNativeRewardedAdUnavailable?: (rewardType: string) => void;
    watchAdForLife?: () => void;
  }
}

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

class AdMobService {
  // Banner hamesha Native se aayega, Web me fake banner nahi banayenge
  public init(): void {
    console.log('Real AdMob Init:', ADMOB_CONFIG.APP_ID);
  }

  public hasAndroidBridge(): boolean {
    return (
      typeof window !== 'undefined' &&
      (typeof window.AndroidAdMob !== 'undefined' ||
        (typeof window.Android !== 'undefined' &&
          (typeof window.Android.watchSaveLife === 'function' ||
            typeof window.Android.showInterstitial === 'function')))
    );
  }

  public hasNativeRewardedBridge(): boolean {
    return (
      typeof window !== 'undefined' &&
      (typeof window.AndroidAdMob?.showRewarded === 'function' ||
        (typeof window.Android !== 'undefined' &&
          (typeof window.Android.watchRewardedAd === 'function' ||
            typeof window.Android.watchSaveLife === 'function')))
    );
  }

  public isNative(): boolean {
    return this.hasAndroidBridge() || Capacitor.isNativePlatform();
  }

  public getGameOverCount(): number {
    return getGamesPlayed();
  }

  // Rewarded Ad - Sirf Asli Ad
  public showRewardedAd(onReward: () => void): Promise<boolean> {
    return new Promise((resolve) => {
      // Agar Android Native hai to usko bolo
      if (typeof window !== 'undefined' && (window.AndroidAdMob?.showRewarded || window.Android?.watchSaveLife)) {
        window.onRewardEarned = () => {
          onReward();
          resolve(true);
        };
        if (typeof window.AndroidAdMob?.showRewarded === 'function') {
          window.AndroidAdMob.showRewarded();
        } else if (typeof window.Android?.watchSaveLife === 'function') {
          window.Android.watchSaveLife();
        }
        // 30 sec me ad na aaye to fail, fake preview kabhi nahi dikhayenge
        setTimeout(() => resolve(false), 30000);
        return;
      }
      // Web / Preview me hai to seedha bol do ad nahi hai, fake mat dikhao
      console.log('Native AdMob not found - Real device me chalao');
      resolve(false);
    });
  }

  public showInterstitial(): void {
    if (typeof window === 'undefined') return;
    if (typeof window.AndroidAdMob?.showInterstitial === 'function') {
      window.AndroidAdMob.showInterstitial();
    } else if (typeof window.Android?.showInterstitial === 'function') {
      window.Android.showInterstitial();
    }
  }

  public async initializeAndShowBanner(): Promise<void> {
    this.init();
    if (typeof window !== 'undefined') {
      window.Android?.preloadInterstitial?.();
      window.Android?.preloadRewardedAd?.();
    }
  }

  public async preloadInterstitial(): Promise<boolean> {
    if (typeof window !== 'undefined') {
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
   * Triggers native AdMob Rewarded Ad (ca-app-pub-8318388001860392/4593766299)
   * via AndroidAdMob.showRewarded() or Android.watchSaveLife().
   * Returns true if native bridge handled it; false if native bridge is not available.
   */
  public triggerRewardedAd(rewardType: NativeRewardType = 'save_life'): boolean {
    if (!this.hasNativeRewardedBridge()) {
      return false;
    }
    try {
      if (typeof window !== 'undefined') {
        if (typeof window.AndroidAdMob?.showRewarded === 'function') {
          window.AndroidAdMob.showRewarded();
          return true;
        }
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
        this.showInterstitial();
        return {
          triggeredInterstitial: true,
          showWebSimulation: false,
        };
      } catch (err) {
        console.warn('showInterstitial() failed:', err);
        return {
          triggeredInterstitial: false,
          showWebSimulation: false,
        };
      }
    }

    // REAL AdMob: Web preview me fake simulation ad nahi dikhayenge
    return {
      triggeredInterstitial: false,
      showWebSimulation: false,
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

export const admobService = new AdMobService();
