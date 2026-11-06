package com.colorstack3d.game;

import android.annotation.SuppressLint;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.appopen.AppOpenAd;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import java.io.InputStream;
import java.net.URLConnection;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {
    private InterstitialAd mInterstitialAd;
    private boolean isInterstitialLoading = false;

    private RewardedAd mRewardedAd;
    private boolean isRewardedLoading = false;

    private AppOpenAd mAppOpenAd;
    private boolean isAppOpenLoading = false;
    private boolean hasShownInitialAppOpen = false;
    private long lastBackgroundTimestampMs = 0L;

    private boolean isShowingFullScreenAd = false;
    private boolean adsInitialized = false;

    private AdView adView;
    private WebView wv;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // Live Google AdMob Unit IDs (App ID in AndroidManifest.xml: ca-app-pub-8318388001860392~8689085671)
    private static final String BANNER_ID = "ca-app-pub-8318388001860392/7839164745";
    private static final String INTERSTITIAL_ID = "ca-app-pub-8318388001860392/2642678386";
    private static final String REWARDED_ID = "ca-app-pub-8318388001860392/4593766299";
    private static final String APP_OPEN_ID = "ca-app-pub-8318388001860392/5400703665";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        adView = findViewById(R.id.bannerAd);
        wv = findViewById(R.id.gameWebView);

        setupWebView();

        // Initialize Google Mobile Ads SDK first, then load all 4 ad formats once ready
        MobileAds.initialize(this, initializationStatus ->
            runOnUiThread(this::initAllAdsAfterSdkReady)
        );
        // Fallback safety trigger in case MobileAds callback is delayed on custom ROMs
        mainHandler.postDelayed(this::initAllAdsAfterSdkReady, 2500);
    }

    private void initAllAdsAfterSdkReady() {
        if (adsInitialized || isFinishing() || isDestroyed()) {
            return;
        }
        adsInitialized = true;

        // 1. Banner Ad (Bottom Always: ca-app-pub-8318388001860392/7839164745)
        if (adView != null) {
            adView.setAdListener(new AdListener() {
                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                    mainHandler.postDelayed(() -> {
                        if (adView != null && !isFinishing() && !isDestroyed()) {
                            adView.loadAd(new AdRequest.Builder().build());
                        }
                    }, 10000);
                }
            });
            adView.loadAd(new AdRequest.Builder().build());
        }

        // 2. Interstitial Ad Preload (ca-app-pub-8318388001860392/2642678386)
        loadInterstitial();

        // 3. Rewarded Ad Preload - Watch Save Life (ca-app-pub-8318388001860392/4593766299)
        loadRewardedAd();

        // 4. App Open Ad Preload & Cold-Start Show (ca-app-pub-8318388001860392/5400703665)
        loadAppOpenAd(true);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        if (wv == null) return;

        WebSettings settings = wv.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (url != null && "appassets.androidplatform.net".equals(url.getHost())) {
                    String path = url.getPath();
                    if (path == null || path.isEmpty() || "/".equals(path)) {
                        path = "/index.html";
                    }
                    String assetPath = path.startsWith("/") ? path.substring(1) : path;
                    try {
                        InputStream stream = getAssets().open(assetPath);
                        String mimeType = getMimeType(assetPath);
                        Map<String, String> headers = new HashMap<>();
                        headers.put("Access-Control-Allow-Origin", "*");
                        return new WebResourceResponse(mimeType, "UTF-8", 200, "OK", headers, stream);
                    } catch (Exception ignored) {
                        if (!assetPath.contains(".")) {
                            try {
                                InputStream indexStream = getAssets().open("index.html");
                                return new WebResourceResponse("text/html", "UTF-8", indexStream);
                            } catch (Exception ignoredToo) {
                                return null;
                            }
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
        });

        wv.addJavascriptInterface(new WebAppAdBridge(), "Android");
        wv.addJavascriptInterface(new WebAppAdBridge(), "AndroidAdMob");
        wv.loadUrl("https://appassets.androidplatform.net/index.html");
    }

    private String getMimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
        String guessed = URLConnection.guessContentTypeFromName(path);
        return guessed != null ? guessed : "application/octet-stream";
    }

    public void loadAppOpenAd(final boolean showImmediatelyWhenLoaded) {
        if (mAppOpenAd != null || isAppOpenLoading || isFinishing() || isDestroyed()) {
            return;
        }
        isAppOpenLoading = true;
        AppOpenAd.load(
            this,
            APP_OPEN_ID,
            new AdRequest.Builder().build(),
            new AppOpenAd.AppOpenAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull AppOpenAd ad) {
                    isAppOpenLoading = false;
                    mAppOpenAd = ad;
                    mAppOpenAd.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override
                        public void onAdShowedFullScreenContent() {
                            isShowingFullScreenAd = true;
                        }

                        @Override
                        public void onAdDismissedFullScreenContent() {
                            isShowingFullScreenAd = false;
                            mAppOpenAd = null;
                            loadAppOpenAd(false);
                        }

                        @Override
                        public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                            isShowingFullScreenAd = false;
                            mAppOpenAd = null;
                            loadAppOpenAd(false);
                        }
                    });

                    if (showImmediatelyWhenLoaded && !hasShownInitialAppOpen && !isShowingFullScreenAd) {
                        hasShownInitialAppOpen = true;
                        showAppOpenAdIfAvailable();
                    }
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                    isAppOpenLoading = false;
                    mAppOpenAd = null;
                    mainHandler.postDelayed(() -> loadAppOpenAd(false), 12000);
                }
            }
        );
    }

    public void showAppOpenAdIfAvailable() {
        if (mAppOpenAd != null && !isShowingFullScreenAd && !isFinishing() && !isDestroyed()) {
            mAppOpenAd.show(MainActivity.this);
        } else if (mAppOpenAd == null) {
            loadAppOpenAd(false);
        }
    }

    public void loadInterstitial() {
        if (mInterstitialAd != null || isInterstitialLoading || isFinishing() || isDestroyed()) {
            return;
        }
        isInterstitialLoading = true;
        InterstitialAd.load(
            this,
            INTERSTITIAL_ID,
            new AdRequest.Builder().build(),
            new InterstitialAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull InterstitialAd ad) {
                    isInterstitialLoading = false;
                    mInterstitialAd = ad;
                    mInterstitialAd.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override
                        public void onAdShowedFullScreenContent() {
                            isShowingFullScreenAd = true;
                        }

                        @Override
                        public void onAdDismissedFullScreenContent() {
                            isShowingFullScreenAd = false;
                            mInterstitialAd = null;
                            loadInterstitial();
                        }

                        @Override
                        public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                            isShowingFullScreenAd = false;
                            mInterstitialAd = null;
                            loadInterstitial();
                        }
                    });
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                    isInterstitialLoading = false;
                    mInterstitialAd = null;
                    mainHandler.postDelayed(MainActivity.this::loadInterstitial, 8000);
                }
            }
        );
    }

    public void showInterstitial() {
        runOnUiThread(() -> {
            if (mInterstitialAd != null && !isShowingFullScreenAd && !isFinishing() && !isDestroyed()) {
                mInterstitialAd.show(MainActivity.this);
            } else {
                loadInterstitial();
            }
        });
    }

    public void loadRewardedAd() {
        if (mRewardedAd != null || isRewardedLoading || isFinishing() || isDestroyed()) {
            return;
        }
        isRewardedLoading = true;
        RewardedAd.load(
            this,
            REWARDED_ID,
            new AdRequest.Builder().build(),
            new RewardedAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull RewardedAd ad) {
                    isRewardedLoading = false;
                    mRewardedAd = ad;
                    mRewardedAd.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override
                        public void onAdShowedFullScreenContent() {
                            isShowingFullScreenAd = true;
                        }

                        @Override
                        public void onAdDismissedFullScreenContent() {
                            isShowingFullScreenAd = false;
                            mRewardedAd = null;
                            loadRewardedAd();
                        }

                        @Override
                        public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                            isShowingFullScreenAd = false;
                            mRewardedAd = null;
                            loadRewardedAd();
                        }
                    });
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                    isRewardedLoading = false;
                    mRewardedAd = null;
                    mainHandler.postDelayed(MainActivity.this::loadRewardedAd, 5000);
                }
            }
        );
    }

    public void showRewardedAd(final String rewardType) {
        final String safeType = (rewardType == null || rewardType.isEmpty())
            ? "save_life"
            : rewardType.replaceAll("[^a-zA-Z0-9_]", "");

        if (mRewardedAd != null && !isShowingFullScreenAd && !isFinishing() && !isDestroyed()) {
            RewardedAd adToShow = mRewardedAd;
            mRewardedAd = null;
            adToShow.show(MainActivity.this, rewardItem -> {
                Toast.makeText(
                    MainActivity.this,
                    "Reward Earned!",
                    Toast.LENGTH_SHORT
                ).show();

                if (wv != null) {
                    wv.evaluateJavascript(
                        "window.onRewardEarned && window.onRewardEarned(); if(window.giveRewardFromAd){window.giveRewardFromAd('" + safeType + "');}else if(window.giveLifeFromAd){window.giveLifeFromAd();}",
                        null
                    );
                }
                loadRewardedAd();
            });
        } else {
            // Preload fresh Rewarded Ad and notify user
            Toast.makeText(MainActivity.this, "Ad load ho raha hai, dobara try karo", Toast.LENGTH_SHORT).show();
            loadRewardedAd();
            if (wv != null) {
                wv.evaluateJavascript(
                    "if(window.onNativeRewardedAdUnavailable){window.onNativeRewardedAdUnavailable('" + safeType + "');}",
                    null
                );
            }
        }
    }

    public class WebAppAdBridge {
        @JavascriptInterface
        public void showRewarded() {
            runOnUiThread(() -> MainActivity.this.showRewardedAd("save_life"));
        }

        @JavascriptInterface
        public void showAppOpen() {
            runOnUiThread(MainActivity.this::showAppOpenAdIfAvailable);
        }

        @JavascriptInterface
        public void watchSaveLife() {
            runOnUiThread(() -> MainActivity.this.showRewardedAd("save_life"));
        }

        @JavascriptInterface
        public void watchRewardedAd(String rewardType) {
            runOnUiThread(() -> MainActivity.this.showRewardedAd(rewardType));
        }

        @JavascriptInterface
        public void preloadRewardedAd() {
            runOnUiThread(MainActivity.this::loadRewardedAd);
        }

        @JavascriptInterface
        public void showInterstitial() {
            MainActivity.this.showInterstitial();
        }

        @JavascriptInterface
        public void preloadInterstitial() {
            runOnUiThread(MainActivity.this::loadInterstitial);
        }

        @JavascriptInterface
        public String getBannerId() {
            return BANNER_ID;
        }

        @JavascriptInterface
        public boolean isNativeAndroid() {
            return true;
        }
    }

    @Override
    protected void onPause() {
        lastBackgroundTimestampMs = SystemClock.elapsedRealtime();
        if (adView != null) {
            adView.pause();
        }
        if (wv != null) {
            wv.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (wv != null) {
            wv.onResume();
        }
        if (adView != null) {
            adView.resume();
        }
        // Show App Open Ad when user returns to app after >= 3 minutes in background
        if (lastBackgroundTimestampMs > 0L) {
            long awayMs = SystemClock.elapsedRealtime() - lastBackgroundTimestampMs;
            lastBackgroundTimestampMs = 0L;
            if (awayMs >= 180_000L) {
                showAppOpenAdIfAvailable();
            }
        }
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacksAndMessages(null);
        if (adView != null) {
            adView.destroy();
            adView = null;
        }
        if (wv != null) {
            wv.destroy();
            wv = null;
        }
        super.onDestroy();
    }
}
