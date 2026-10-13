"""截对外 README 用的界面图：假数据模式（?demo=1）、手机尺寸 375×812、2 倍清晰度，存到 screenshots/。

先 npm run dev，再在 mobile-app 目录运行：
    python scripts/shoot-readme.py http://localhost:5173
需要 Python 版 Playwright；直接用本机 Edge，不用另外下载浏览器。
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173'
OUT = Path(__file__).resolve().parent.parent / 'screenshots'
SHOTS = [
    ('home', '?tab=home'),
    ('schedule', '?tab=sched'),
    ('course', '?tab=sched&page=course'),
    ('import', '?tab=me&page=schoolImport'),
]

OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge')
    ctx = browser.new_context(viewport={'width': 375, 'height': 812}, device_scale_factor=2)
    for name, query in SHOTS:
        page = ctx.new_page()
        page.goto(f'{BASE}/index.html{query}&demo=1', wait_until='networkidle')
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / f'{name}.png'))
        print(f'{name}.png')
        page.close()
    browser.close()
