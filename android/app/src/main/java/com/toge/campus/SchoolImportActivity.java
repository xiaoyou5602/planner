package com.toge.campus;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;

public class SchoolImportActivity extends Activity {
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_ASSET_PATH = "assetPath";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_MODE = "mode";
    public static final String EXTRA_INSTRUCTIONS = "instructions";
    public static final String EXTRA_RESULT = "result";

    private WebView webView;
    private Button importButton;
    private TextView urlView;
    private String adapterScript;
    private String hostScript;
    private volatile boolean importRunning = false;
    private volatile int importRunId = 0;
    private JSONObject payload = new JSONObject();
    private boolean shareCodeMode = false;
    private boolean shareCodeAutoStarted = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String url = getIntent().getStringExtra(EXTRA_URL);
        String assetPath = getIntent().getStringExtra(EXTRA_ASSET_PATH);
        String title = getIntent().getStringExtra(EXTRA_TITLE);
        String mode = getIntent().getStringExtra(EXTRA_MODE);
        String instructions = getIntent().getStringExtra(EXTRA_INSTRUCTIONS);
        shareCodeMode = "share-code".equals(mode);
        if (url == null || assetPath == null) {
            finish();
            return;
        }
        try {
            adapterScript = readAsset("public/" + assetPath);
            hostScript = readAsset("public/school-import-host.js");
        } catch (IOException error) {
            Toast.makeText(this, "适配脚本读取失败", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(248, 250, 255));

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(10), dp(8), dp(14), dp(8));
        Button close = new Button(this);
        close.setText("返回");
        close.setAllCaps(false);
        close.setOnClickListener(v -> finish());
        top.addView(close, new LinearLayout.LayoutParams(dp(72), dp(46)));
        TextView titleView = new TextView(this);
        titleView.setText(title == null ? "课表导入" : title);
        titleView.setTextSize(17);
        titleView.setTextColor(Color.rgb(46, 58, 92));
        titleView.setGravity(Gravity.CENTER);
        titleView.setMaxLines(1);
        top.addView(titleView, new LinearLayout.LayoutParams(0, dp(46), 1));
        View spacer = new View(this);
        top.addView(spacer, new LinearLayout.LayoutParams(dp(72), dp(46)));
        root.addView(top, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.addJavascriptInterface(new ImportBridge(), "CampusImportHost");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String loadedUrl) {
                super.onPageFinished(view, loadedUrl);
                if (urlView != null) urlView.setText(loadedUrl);
                if (!importRunning) {
                    importButton.setEnabled(true);
                    importButton.setText(shareCodeMode ? "输入分享内容" : "执行导入");
                }
                if (shareCodeMode && !shareCodeAutoStarted) {
                    shareCodeAutoStarted = true;
                    runAdapter();
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    runOnUiThread(() -> Toast.makeText(SchoolImportActivity.this, message.message(), Toast.LENGTH_LONG).show());
                }
                return super.onConsoleMessage(message);
            }
        });
        if (shareCodeMode) {
            webView.setVisibility(View.INVISIBLE);
            root.addView(webView, new LinearLayout.LayoutParams(dp(1), dp(1)));
            LinearLayout explanation = new LinearLayout(this);
            explanation.setOrientation(LinearLayout.VERTICAL);
            explanation.setGravity(Gravity.CENTER_VERTICAL);
            explanation.setPadding(dp(28), dp(24), dp(28), dp(24));
            TextView heading = new TextView(this);
            heading.setText("不用登录教务系统");
            heading.setTextSize(24);
            heading.setTextColor(Color.rgb(46, 58, 92));
            explanation.addView(heading, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            TextView body = new TextView(this);
            body.setText(instructions == null || instructions.isEmpty()
                ? "复制课表分享内容后，在弹出的输入框里粘贴即可。"
                : instructions);
            body.setTextSize(15);
            body.setTextColor(Color.rgb(91, 102, 135));
            body.setLineSpacing(0, 1.45f);
            body.setPadding(0, dp(14), 0, 0);
            explanation.addView(body, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            root.addView(explanation, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        } else {
            root.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        }

        LinearLayout bottom = new LinearLayout(this);
        bottom.setOrientation(LinearLayout.VERTICAL);
        bottom.setPadding(dp(14), dp(10), dp(14), dp(14));
        urlView = new TextView(this);
        urlView.setText(url);
        urlView.setTextSize(11);
        urlView.setTextColor(Color.rgb(91, 102, 135));
        urlView.setSingleLine(true);
        if (!shareCodeMode) bottom.addView(urlView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(24)));
        importButton = new Button(this);
        importButton.setText(shareCodeMode ? "正在准备输入框…" : "页面加载中…");
        importButton.setAllCaps(false);
        importButton.setEnabled(false);
        importButton.setOnClickListener(v -> runAdapter());
        bottom.addView(importButton, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)));
        TextView hint = new TextView(this);
        hint.setText(shareCodeMode
            ? "分享内容只用于这次导入，不会保存。"
            : "先在上方完成登录并进入课表页面，再执行导入；账号密码只留在这个 WebView。");
        hint.setTextSize(11);
        hint.setTextColor(Color.rgb(91, 102, 135));
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(0, dp(6), 0, 0);
        bottom.addView(hint, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(bottom, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        setContentView(root);
        if (shareCodeMode) {
            webView.loadDataWithBaseURL(
                url,
                "<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>",
                "text/html",
                "UTF-8",
                null
            );
        } else {
            webView.loadUrl(url);
        }
    }

    private void runAdapter() {
        if (importRunning) return;
        payload = new JSONObject();
        importRunning = true;
        int runId = ++importRunId;
        importButton.setEnabled(false);
        importButton.setText("正在读取课表…");
        String script = hostScript
            + "\nwindow.__campusInstallImportHost(" + runId + ");"
            + "\nwindow.__campusImportRun(" + JSONObject.quote(adapterScript) + ");";
        webView.evaluateJavascript(script, null);
    }

    private void resetImport() {
        importRunning = false;
        if (importButton != null) {
            importButton.setEnabled(true);
            importButton.setText(shareCodeMode ? "再次输入" : "再次执行");
        }
    }

    private String readAsset(String path) throws IOException {
        try (InputStream input = getAssets().open(path); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) >= 0) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8);
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void resolve(int runId, String id, boolean ok, Object value) {
        if (id == null || id.isEmpty()) return;
        String literal;
        if (value == null) literal = "null";
        else if (value instanceof Boolean || value instanceof Number) literal = String.valueOf(value);
        else literal = JSONObject.quote(String.valueOf(value));
        String script = "window.__campusImportResolve(" + runId + "," + JSONObject.quote(id) + "," + ok + "," + literal + ")";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void finishSuccess() {
        JSONArray courses = payload.optJSONArray("courses");
        if (courses == null || courses.length() == 0) {
            resetImport();
            Toast.makeText(this, "适配脚本没有返回课程", Toast.LENGTH_LONG).show();
            return;
        }
        Intent result = new Intent();
        result.putExtra(EXTRA_RESULT, payload.toString());
        setResult(RESULT_OK, result);
        finish();
    }

    @Override
    public void onBackPressed() {
        if (!shareCodeMode && webView != null && webView.canGoBack() && !importRunning) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("CampusImportHost");
            webView.destroy();
        }
        super.onDestroy();
    }

    private class ImportBridge {
        @JavascriptInterface
        public void postMessage(String raw) {
            if (!importRunning) return;
            try {
                JSONObject message = new JSONObject(raw);
                int runId = message.optInt("runId", -1);
                if (runId != importRunId) return;
                String id = message.optString("id", "");
                String method = message.optString("method", "");
                JSONArray parsedArgs = message.optJSONArray("args");
                final JSONArray args = parsedArgs == null ? new JSONArray() : parsedArgs;
                switch (method) {
                    case "showToast" -> runOnUiThread(() -> Toast.makeText(SchoolImportActivity.this, args.optString(0), Toast.LENGTH_SHORT).show());
                    case "showAlert" -> showAlert(runId, id, args);
                    case "showPrompt" -> showPrompt(runId, id, args);
                    case "showSingleSelection" -> showSelection(runId, id, args);
                    case "saveImportedCourses" -> saveArray(runId, id, "courses", args.optString(0));
                    case "savePresetTimeSlots" -> saveArray(runId, id, "timeSlots", args.optString(0));
                    case "saveCourseConfig" -> saveConfig(runId, id, args.optString(0));
                    case "saveComboSchedule" -> saveObject(runId, id, "comboSchedule", args.optString(0));
                    case "notifyTaskCompletion" -> runOnUiThread(SchoolImportActivity.this::finishSuccess);
                    case "notifyTaskFinished" -> runOnUiThread(() -> {
                        if (runId == importRunId && importRunning) resetImport();
                    });
                    case "notifyTaskFailed" -> runOnUiThread(() -> {
                        if (runId != importRunId) return;
                        resetImport();
                        Toast.makeText(SchoolImportActivity.this, "导入失败：" + args.optString(0, "适配脚本执行失败"), Toast.LENGTH_LONG).show();
                    });
                    default -> {
                        resolve(runId, id, false, "不支持的桥接方法：" + method);
                    }
                }
            } catch (JSONException error) {
                runOnUiThread(() -> {
                    resetImport();
                    Toast.makeText(SchoolImportActivity.this, "适配脚本消息格式错误", Toast.LENGTH_LONG).show();
                });
            }
        }

        private void saveArray(int runId, String id, String key, String json) {
            try {
                payload.put(key, new JSONArray(json));
                resolve(runId, id, true, true);
            } catch (JSONException error) {
                resolve(runId, id, false, key + " 数据格式错误");
            }
        }

        private void saveObject(int runId, String id, String key, String json) {
            try {
                payload.put(key, new JSONObject(json));
                resolve(runId, id, true, true);
            } catch (JSONException error) {
                resolve(runId, id, false, key + " 数据格式错误");
            }
        }

        private void saveConfig(int runId, String id, String json) {
            try {
                JSONObject incoming = new JSONObject(json);
                JSONObject saved = payload.optJSONObject("config");
                if (saved == null) saved = new JSONObject();
                Iterator<String> keys = incoming.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    saved.put(key, incoming.get(key));
                }
                payload.put("config", saved);
                resolve(runId, id, true, true);
            } catch (JSONException error) {
                resolve(runId, id, false, "学期配置格式错误");
            }
        }

        private void showAlert(int runId, String id, JSONArray args) {
            runOnUiThread(() -> new AlertDialog.Builder(SchoolImportActivity.this)
                .setTitle(args.optString(0, "提示"))
                .setMessage(args.optString(1))
                .setPositiveButton(args.optString(2, "确定"), (dialog, which) -> resolve(runId, id, true, true))
                .setNegativeButton("取消", (dialog, which) -> resolve(runId, id, true, false))
                .setOnCancelListener(dialog -> resolve(runId, id, true, false))
                .show());
        }

        private void showPrompt(int runId, String id, JSONArray args) {
            runOnUiThread(() -> {
                EditText input = new EditText(SchoolImportActivity.this);
                input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
                input.setText(args.optString(2));
                input.setSelection(input.length());
                int pad = dp(20);
                LinearLayout holder = new LinearLayout(SchoolImportActivity.this);
                holder.setPadding(pad, 0, pad, 0);
                holder.addView(input, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                new AlertDialog.Builder(SchoolImportActivity.this)
                    .setTitle(args.optString(0, "请输入"))
                    .setMessage(args.optString(1))
                    .setView(holder)
                    .setPositiveButton("确定", (dialog, which) -> resolve(runId, id, true, input.getText().toString()))
                    .setNegativeButton("取消", (dialog, which) -> resolve(runId, id, true, null))
                    .setOnCancelListener(dialog -> resolve(runId, id, true, null))
                    .show();
            });
        }

        private void showSelection(int runId, String id, JSONArray args) {
            runOnUiThread(() -> {
                try {
                    JSONArray values = new JSONArray(args.optString(1, "[]"));
                    String[] labels = new String[values.length()];
                    for (int i = 0; i < values.length(); i++) labels[i] = values.optString(i);
                    final int[] selected = { args.optInt(2, -1) };
                    new AlertDialog.Builder(SchoolImportActivity.this)
                        .setTitle(args.optString(0, "请选择"))
                        .setSingleChoiceItems(labels, selected[0], (dialog, which) -> selected[0] = which)
                        .setPositiveButton("确定", (dialog, which) -> resolve(runId, id, true, selected[0]))
                        .setNegativeButton("取消", (dialog, which) -> resolve(runId, id, true, null))
                        .setOnCancelListener(dialog -> resolve(runId, id, true, null))
                        .show();
                } catch (JSONException error) {
                    resolve(runId, id, false, "选项格式错误");
                }
            });
        }
    }
}
