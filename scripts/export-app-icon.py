"""把 design/app-icon 里选定的 SVG 导出成安卓启动图标和开屏图标。

用法（在 mobile-app 目录下）：
    python scripts/export-app-icon.py               # 启动图标 + 开屏图标
    python scripts/export-app-icon.py --splash-only # 只导出开屏图标

SVG 用了滤镜做手绘抖动，先用本机 Edge 无界面渲染成 1728px 大图，再用 Pillow 缩小到
各密度，避免小尺寸直接渲染时线条出现碎点。生成：
- mipmap-*/ic_launcher_foreground.png：自适应图标前景（透明底，108dp 画布）
- mipmap-*/ic_launcher.png / ic_launcher_round.png：安卓 8 以下的旧式图标（48dp）
- values/ic_launcher_background.xml：自适应图标底色，取自 SVG 的底色矩形
- drawable-*/splash_icon.png：系统开屏图标（透明底、带荧光笔，288dp）。index.html 里的
  静态兜底小本子要和它同大同位，才看不出交接
"""

import os
import re
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'design', 'app-icon', 'icon-v4-page-lemon.svg')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
RENDER = 1728  # 108dp × 16
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
BG_RECT = re.compile(r'\s*<rect width="108" height="108" fill="(#[0-9a-fA-F]{6})"/>')
SPLASH_DP = 288  # androidx 开屏无底色图标的显示尺寸，108dp 画布整张铺满它


def find_edge():
    for path in (r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                 r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'):
        if os.path.exists(path):
            return path
    raise SystemExit('找不到 Edge，无法渲染 SVG')


def render(svg_text, out_png, tmp):
    svg_path = os.path.join(tmp, os.path.basename(out_png) + '.svg')
    html_path = os.path.join(tmp, os.path.basename(out_png) + '.html')
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_text)
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(f'<body style="margin:0;background:transparent">'
                f'<img src="{os.path.basename(svg_path)}" width="{RENDER}" height="{RENDER}" style="display:block"></body>')
    subprocess.run([find_edge(), '--headless=new', '--disable-gpu', '--hide-scrollbars',
                    '--default-background-color=00000000', '--force-device-scale-factor=1',
                    f'--window-size={RENDER},{RENDER}', f'--screenshot={out_png}',
                    'file:///' + html_path.replace(os.sep, '/')], check=True, capture_output=True, timeout=120)
    img = Image.open(out_png).convert('RGBA')
    if img.size != (RENDER, RENDER):
        raise SystemExit(f'渲染尺寸不对：{img.size}')
    return img


def masked(img, size, shape):
    """裁出自适应图标在桌面上可见的中间 72/108，缩到 size，再套圆角方或圆形。"""
    edge = RENDER * 18 // 108
    crop = img.crop((edge, edge, RENDER - edge, RENDER - edge)).resize((size * 4, size * 4), Image.LANCZOS)
    mask = Image.new('L', crop.size, 0)
    draw = ImageDraw.Draw(mask)
    if shape == 'round':
        draw.ellipse((0, 0, crop.width - 1, crop.height - 1), fill=255)
    else:
        draw.rounded_rectangle((0, 0, crop.width - 1, crop.height - 1), radius=int(crop.width * 0.22), fill=255)
    crop.putalpha(mask)
    return crop.resize((size, size), Image.LANCZOS)


def main():
    svg = open(SOURCE, encoding='utf-8').read()
    match = BG_RECT.search(svg)
    if not match:
        raise SystemExit('SVG 里找不到 108×108 的底色矩形')
    bg_color = match.group(1).upper()
    fg_svg = BG_RECT.sub('', svg, count=1)
    splash_only = '--splash-only' in sys.argv[1:]

    with tempfile.TemporaryDirectory() as tmp:
        splash = render(fg_svg, os.path.join(tmp, 'splash.png'), tmp)
        if not splash_only:
            full = render(svg, os.path.join(tmp, 'full.png'), tmp)
            fg = render(fg_svg, os.path.join(tmp, 'fg.png'), tmp)

    for name, scale in DENSITIES.items():
        folder = os.path.join(RES, f'drawable-{name}')
        os.makedirs(folder, exist_ok=True)
        splash.resize((round(SPLASH_DP * scale),) * 2, Image.LANCZOS).save(os.path.join(folder, 'splash_icon.png'))
    if splash_only:
        print(f'已导出开屏图标：{os.path.basename(SOURCE)}')
        return

    for name, scale in DENSITIES.items():
        folder = os.path.join(RES, f'mipmap-{name}')
        fg.resize((round(108 * scale),) * 2, Image.LANCZOS).save(os.path.join(folder, 'ic_launcher_foreground.png'))
        legacy = round(48 * scale)
        masked(full, legacy, 'square').save(os.path.join(folder, 'ic_launcher.png'))
        masked(full, legacy, 'round').save(os.path.join(folder, 'ic_launcher_round.png'))

    with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                f'    <color name="ic_launcher_background">{bg_color}</color>\n</resources>\n')
    print(f'已导出：{os.path.basename(SOURCE)}，底色 {bg_color}')


if __name__ == '__main__':
    main()
