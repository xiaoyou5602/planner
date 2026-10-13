package com.toge.campus;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// 首页画好后由 src/main.jsx 调一次，通知 MainActivity 撤掉系统开屏
@CapacitorPlugin(name = "AppReady")
public class AppReadyPlugin extends Plugin {
    @PluginMethod
    public void ready(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).onAppReady();
        }
        call.resolve();
    }
}
