package com.example.colorstack;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private RewardedAd rewardedAd;
    private InterstitialAd interstitialAd;
    private int gameCount = 0;

    private final String REWARDED_ID = "ca-app-pub-8318388001860392/4593766299";
    private final String BANNER_ID = "ca-app-pub-8318388001860392/7839164745";
    private final String INTERSTITIAL_ID = "ca-app-pub-8318388001860392/2642678386";
    private final String APP_OPEN_ID = "ca-app-pub-8318388001860392/5400703665";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        MobileAds.initialize(this, status -> {});
        loadRewarded();
        loadInterstitial();

        webView = findViewById(R.id.webView);
        if (webView == null) {
            webView = findViewById(R.id.gameWebView);
        }
        if (webView != null) {
            webView.getSettings().setJavaScriptEnabled(true);
            webView.getSettings().setDomStorageEnabled(true);
            webView.addJavascriptInterface(new AdBridge(), "AndroidAdMob");
            webView.addJavascriptInterface(new AdBridge(), "Android");
            webView.loadUrl("file:///android_asset/index.html");
        }

        // Real Banner - Neeche wala
        AdView banner = findViewById(R.id.adView);
        if (banner == null) {
            banner = findViewById(R.id.bannerAd);
        }
        if (banner != null) {
            AdRequest adRequest = new AdRequest.Builder().build();
            banner.loadAd(adRequest);
        }
    }

    private void loadRewarded() {
        RewardedAd.load(this, REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError e) {
                rewardedAd = null;
            }

            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                rewardedAd = ad;
            }
        });
    }

    private void loadInterstitial() {
        InterstitialAd.load(this, INTERSTITIAL_ID, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError e) {
                interstitialAd = null;
            }

            @Override
            public void onAdLoaded(@NonNull InterstitialAd ad) {
                interstitialAd = ad;
            }
        });
    }

    public class AdBridge {
        @JavascriptInterface
        public void showRewarded() {
            runOnUiThread(() -> {
                if (rewardedAd != null) {
                    rewardedAd.show(MainActivity.this, rewardItem -> {
                        if (webView != null) {
                            webView.evaluateJavascript("window.onRewardEarned && window.onRewardEarned()", null);
                        }
                        loadRewarded();
                    });
                } else {
                    Toast.makeText(MainActivity.this, "Ad load ho raha hai, dobara try karo", Toast.LENGTH_SHORT).show();
                    loadRewarded();
                }
            });
        }

        @JavascriptInterface
        public void showInterstitial() {
            runOnUiThread(() -> {
                gameCount++;
                if (gameCount % 3 == 0 && interstitialAd != null) {
                    interstitialAd.show(MainActivity.this);
                    loadInterstitial();
                }
            });
        }

        @JavascriptInterface
        public void watchSaveLife() {
            showRewarded();
        }

        @JavascriptInterface
        public void watchRewardedAd(String rewardType) {
            showRewarded();
        }
    }
}
