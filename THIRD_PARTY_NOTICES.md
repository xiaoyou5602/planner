# 第三方组件与开源说明

## PDF.js（读取 PDF 课表）

- 依赖：`pdfjs-dist` 4.10.38，Mozilla，Apache-2.0。用途：在 App 内读取 PDF 每行文字和页面位置，供课表识别。
- 随包附带中文等 CJK 编码映射表（`pdfjs-cmaps/`，Adobe，BSD 式许可，二进制分发须保留版权声明）。
- 许可证随安装包保存在 `open-source/pdfjs/LICENSE.txt` 与 `open-source/pdfjs/cmaps-LICENSE.txt`（打包时从依赖复制）。
- 文件只在本机读取，不上传；读取结果只在导入页内存里，导入后保存的是课程，不保存 PDF。
- 2026-10-14 起不再使用 Google ML Kit；扫描件识别以后若需要再单独评估。

## 拾光课程表适配仓库

- 项目：`shiguang_warehouse`
- 上游：https://github.com/XingHeYuZhuan/shiguang_warehouse
- 本次同步版本：`174396aca3edaa0d2df72a55d28a93a2e71c8272`
- 许可证：MIT
- 用途：学校索引、教务适配脚本、WakeUp/星链分享码导入脚本及拾光桥接协议的数据格式。

安装包内同时保留 `open-source/shiguang/LICENSE.txt`、`NOTICE.txt` 和带各适配器维护者信息的目录数据。
本项目自己的课表存储、预览确认、Capacitor 插件和 Android WebView 宿主为独立实现。
