package com.colorstack3d.game;

import android.annotation.SuppressLint;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.appopen.AppOpenAd;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import java.io.InputStream;
import java.net.URLConnection;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {
    private InterstitialAd mInterstitialAd;
    private boolean isInterstitialLoading = false;
    private AdView adView;
    private WebView wv;

    String BANNER = "ca-app-pub-8318388001860392/4000077808";
    String INTERSTITIAL = "ca-app-pub-8318388001860392/3808506117";
    String APPOPEN = "ca-app-pub-8318388001860392/6741791216";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        MobileAds.initialize(this, status -> {});

        // 1. Banner Ad (Bottom Always)
        adView = findViewById(R.id.bannerAd);
        if (adView != null) {
            adView.loadAd(new AdRequest.Builder().build());
        }

        // 2. Interstitial Ad Preload at Game Start (reloads automatically after close)
        loadInterstitial();

        // 3. App Open Ad Load & Show
        AppOpenAd.load(
            this,
            APPOPEN,
            new AdRequest.Builder().build(),
            AppOpenAd.APP_OPEN_AD_ORIENTATION_PORTRAIT,
            new AppOpenAd.AppOpenAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull AppOpenAd ad) {
                    ad.show(MainActivity.this);
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                    // Continue game if App Open ad fails to load
                }
            }
        );

        // 4. WebView Game + JavaScript Ad Bridge (window.Android.showInterstitial())
        wv = findViewById(R.id.gameWebView);
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
                        // Fall back to index.html for SPA routes (/leaderboard, /profile, etc.)
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
        // Serve local APK assets over https:// origin so ES modules, localStorage, and Three.js work cleanly
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

    public void loadInterstitial() {
        if (mInterstitialAd != null || isInterstitialLoading) {
            return;
        }
        isInterstitialLoading = true;
        InterstitialAd.load(
            this,
            INTERSTITIAL,
            new AdRequest.Builder().build(),
            new InterstitialAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull InterstitialAd ad) {
                    isInterstitialLoading = false;
                    mInterstitialAd = ad;
                    mInterstitialAd.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override
                        public void onAdDismissedFullScreenContent() {
                            mInterstitialAd = null;
                            // Immediately preload next Interstitial Ad after close
                            loadInterstitial();
                        }

                        @Override
                        public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                            mInterstitialAd = null;
                            loadInterstitial();
                        }
                    });
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                    isInterstitialLoading = false;
                    mInterstitialAd = null;
                }
            }
        );
    }

    public void showInterstitial() {
        runOnUiThread(() -> {
            if (mInterstitialAd != null) {
                mInterstitialAd.show(MainActivity.this);
            } else {
                loadInterstitial();
            }
        });
    }

    public class WebAppAdBridge {
        @JavascriptInterface
        public void showInterstitial() {
            MainActivity.this.showInterstitial();
        }

        @JavascriptInterface
        public void preloadInterstitial() {
            runOnUiThread(MainActivity.this::loadInterstitial);
        }

        @JavascriptInterface
        public boolean isNativeAndroid() {
            return true;
        }
    }

    @Override
    protected void onPause() {
        if (adView != null) {
            adView.pause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (adView != null) {
            adView.resume();
        }
    }

    @Override
    protected void onDestroy() {
        if (adView != null) {
            adView.destroy();
        }
        super.onDestroy();
    }
}
