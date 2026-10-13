package com.toge.campus;

import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // 首页一直没报到时，最多让系统开屏挡这么久，避免卡在开屏上
    private static final long SPLASH_MAX_MS = 3000;

    private volatile boolean appReady = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 系统开屏一直留到首页真正画到屏幕上（由网页通过 AppReady 插件报到），不按固定时间
        SplashScreen.installSplashScreen(this).setKeepOnScreenCondition(() -> !appReady);
        new Handler(Looper.getMainLooper()).postDelayed(() -> appReady = true, SPLASH_MAX_MS);

        registerPlugin(AppReadyPlugin.class);
        registerPlugin(SchoolImportPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().setBackgroundDrawable(new ColorDrawable(ContextCompat.getColor(this, R.color.splash_paper)));
    }

    void onAppReady() {
        runOnUiThread(() -> {
            WebView webView = bridge == null ? null : bridge.getWebView();
            if (webView == null) {
                appReady = true;
                return;
            }
            // 等首页这一帧真正上屏再撤开屏，中间不露空白页
            webView.postVisualStateCallback(0, new WebView.VisualStateCallback() {
                @Override
                public void onComplete(long requestId) {
                    appReady = true;
                }
            });
        });
    }
}
