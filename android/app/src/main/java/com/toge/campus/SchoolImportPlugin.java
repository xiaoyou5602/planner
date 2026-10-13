package com.toge.campus;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SchoolImport")
public class SchoolImportPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        String assetPath = call.getString("assetPath");
        String title = call.getString("title", "课表导入");
        String mode = call.getString("mode", "school-web");
        String instructions = call.getString("instructions", "");
        if (url == null || assetPath == null) {
            call.reject("缺少导入网址或适配脚本");
            return;
        }
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        if (!("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) || uri.getHost() == null) {
            call.reject("只支持有效的 HTTP/HTTPS 导入网址");
            return;
        }
        if (!assetPath.startsWith("open-source/shiguang/resources/") || assetPath.contains("..")) {
            call.reject("适配脚本路径不合法");
            return;
        }
        Intent intent = new Intent(getContext(), SchoolImportActivity.class);
        intent.putExtra(SchoolImportActivity.EXTRA_URL, url);
        intent.putExtra(SchoolImportActivity.EXTRA_ASSET_PATH, assetPath);
        intent.putExtra(SchoolImportActivity.EXTRA_TITLE, title);
        intent.putExtra(SchoolImportActivity.EXTRA_MODE, mode);
        intent.putExtra(SchoolImportActivity.EXTRA_INSTRUCTIONS, instructions);
        startActivityForResult(call, intent, "handleResult");
    }

    @ActivityCallback
    private void handleResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject response = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        response.put("cancelled", false);
        response.put("data", data.getStringExtra(SchoolImportActivity.EXTRA_RESULT));
        call.resolve(response);
    }
}
