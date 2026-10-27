# Auto-update: an open old copy notices a newer release on GitHub Pages and reloads once, only from the menu.
import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
html = (root / 'dist' / 'pages' / 'index.html').read_text()
newer = lambda v: html.replace("const VERSION = '", "const VERSION = '" + v + "' || '", 1)
def run(label, serve_new_doc_after, start_run=False):
    st = {'docs': 0}
    def handle(route):
        rt = route.request.resource_type
        if rt == 'document': st['docs'] += 1
        live_new = rt != 'document' or st['docs'] > serve_new_doc_after
        route.fulfill(status=200, content_type='text/html', body=newer('9.9.9') if live_new else html)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 852, 'height': 393})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('https://nix812.github.io/Entropy/', handle)
        pg.route('https://fonts.**', lambda r: r.abort())
        if start_run:
            pg.add_init_script("try { localStorage.setItem('entropy.save.v1', JSON.stringify({ seenHelp: true })); } catch (e) {}")
        pg.goto('https://nix812.github.io/Entropy/')
        if start_run:
            pg.wait_for_timeout(150)
            try: pg.click('#bLaunch', timeout=2000); pg.wait_for_timeout(150); pg.click('[data-act=launch]', timeout=2000)
            except Exception as e: print('  (could not start run:', str(e)[:60], ')')
        pg.wait_for_timeout(5000)
        print(label, '-> page loads:', st['docs'], '| version running:', pg.evaluate('VERSION'), '| screen:', pg.evaluate('UI.screen'), '| errors:', errs)
        b.close()
run('old copy open on the menu, newer live', serve_new_doc_after=1)
run('reload still serves old (stale cache)', serve_new_doc_after=99)
run('mid-run when the newer one appears', serve_new_doc_after=1, start_run=True)
