import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdOptions,
  BannerAdPosition,
  BannerAdSize,
  AdOptions,
} from '@capacitor-community/admob';

/**
 * Official Google AdMob Test Ad Unit IDs specified in project requirements:
 * - Banner Ad ID: ca-app-pub-3940256099942544/6300978111 (shown at bottom always)
 * - Interstitial Ad ID: ca-app-pub-3940256099942544/1033173712 (shown after every 3 game overs)
 */
export const ADMOB_CONFIG = {
  APP_ID_ANDROID: 'ca-app-pub-3940256099942544~3347511713',
  BANNER_AD_ID: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL_AD_ID: 'ca-app-pub-3940256099942544/1033173712',
  INTERSTITIAL_FREQUENCY: 3, // Show after every 3 game overs
} as const;

class AdMobManager {
  private initialized = false;
  private interstitialReady = false;
  private gameOverCount = 0;

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public getGameOverCount(): number {
    return this.gameOverCount;
  }

  public async initializeAndShowBanner(): Promise<void> {
    if (!this.isNative()) {
      // On web preview, the persistent bottom AdMob Test Banner UI renders directly in React
      this.initialized = true;
      return;
    }

    if (this.initialized) return;

    try {
      await AdMob.initialize({
        initializeForTesting: true,
      });
      this.initialized = true;

      const bannerOptions: BannerAdOptions = {
        adId: ADMOB_CONFIG.BANNER_AD_ID,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: true,
      };

      await AdMob.showBanner(bannerOptions);
      await this.preloadInterstitial();
    } catch (err) {
      console.warn('AdMob initialization skipped or failed:', err);
    }
  }

  public async preloadInterstitial(): Promise<void> {
    if (!this.isNative()) return;

    try {
      const options: AdOptions = {
        adId: ADMOB_CONFIG.INTERSTITIAL_AD_ID,
        isTesting: true,
      };
      await AdMob.prepareInterstitial(options);
      this.interstitialReady = true;
    } catch (err) {
      this.interstitialReady = false;
      console.warn('AdMob interstitial preload failed:', err);
    }
  }

  /**
   * Increments Game Over counter and triggers Interstitial Ad every 3rd game over.
   * Returns true if a Web Test Interstitial overlay should be displayed in browser preview.
   */
  public async recordGameOverAndMaybeShowInterstitial(): Promise<{
    triggeredInterstitial: boolean;
    showWebSimulation: boolean;
    gameOverCount: number;
  }> {
    this.gameOverCount += 1;
    const shouldShow = this.gameOverCount % ADMOB_CONFIG.INTERSTITIAL_FREQUENCY === 0;

    if (!shouldShow) {
      return {
        triggeredInterstitial: false,
        showWebSimulation: false,
        gameOverCount: this.gameOverCount,
      };
    }

    if (this.isNative()) {
      try {
        if (!this.interstitialReady) {
          await this.preloadInterstitial();
        }
        await AdMob.showInterstitial();
        this.interstitialReady = false;
        // Preload next interstitial for the next 3rd game over cycle
        this.preloadInterstitial().catch(() => {});
        return {
          triggeredInterstitial: true,
          showWebSimulation: false,
          gameOverCount: this.gameOverCount,
        };
      } catch (err) {
        console.warn('AdMob showInterstitial error:', err);
        return {
          triggeredInterstitial: false,
          showWebSimulation: false,
          gameOverCount: this.gameOverCount,
        };
      }
    }

    // In browser preview, trigger the interactive AdMob Test Interstitial simulation
    return {
      triggeredInterstitial: true,
      showWebSimulation: true,
      gameOverCount: this.gameOverCount,
    };
  }
}

export const admobService = new AdMobManager();
