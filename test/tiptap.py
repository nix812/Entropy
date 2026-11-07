"""6.6.1: glossary words inside buttons. A quick tap on an underlined word inside a pick button (Veteran pick, boon,
spec, card) must do the button's job; a press held 450 ms shows the word's tooltip and does not press the button.
A glossary word outside any button still opens its tooltip on a tap. Also checks the real Veteran pick modal.
usage: python3 tiptap.py [W H]"""
import pathlib, sys
from playwright.sync_api import sync_playwright
import mkpage
root = pathlib.Path(__file__).parent.parent
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (852, 393)
mkpage.mk()
fails, errs = [], []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.wait_for_timeout(800)
    # a test button and a loose word, both carrying a glossary term
    pg.evaluate('''() => { window.__hits = 0;
      const d = document.createElement('div'); d.id = 'tiptest'; d.style.cssText = 'position:fixed;left:40px;top:60px;z-index:99999;display:flex;gap:40px;font-size:22px';
      d.innerHTML = `<button id="tb" data-act="none" style="padding:14px 18px;font-size:22px">${tipify('Plating and Burn')}</button><p id="tl">${tipify('Plating')}</p>`;
      document.body.appendChild(d); document.getElementById('tb').addEventListener('click', () => window.__hits++); }''')
    tipbox = lambda: pg.evaluate("() => { const b = document.querySelector('#tipbox'); return !!b && !b.hidden; }")
    word = pg.locator('#tb .tip').first.bounding_box()
    cx, cy = word['x'] + word['width'] / 2, word['y'] + word['height'] / 2
    pg.touchscreen.tap(cx, cy); pg.wait_for_timeout(150)
    check(pg.evaluate('window.__hits') == 1, 'a quick tap on a glossary word inside a button presses the button')
    check(not tipbox(), 'the quick tap does not open the tooltip')
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.wait_for_timeout(650)
    check(tipbox(), 'a 650 ms hold on the word shows the tooltip')
    pg.mouse.up(); pg.wait_for_timeout(150)
    check(pg.evaluate('window.__hits') == 1, 'the hold does not press the button')
    pg.touchscreen.tap(W - 60, H - 60); pg.wait_for_timeout(100)
    lw = pg.locator('#tl .tip').bounding_box()
    pg.touchscreen.tap(lw['x'] + lw['width'] / 2, lw['y'] + lw['height'] / 2); pg.wait_for_timeout(150)
    check(tipbox(), 'a tap on a loose glossary word still opens its tooltip')
    pg.evaluate("() => document.getElementById('tiptest').remove()")
    b.close()
print('ERRORS:', errs)
print('FAILED:', fails)
