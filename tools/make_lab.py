# Turns a normal build (dist/pages) into the LAB test environment (dist/lab), published at nix812.github.io/Entropy/lab/.
# The lab copy can never touch real progress and can't be mistaken for the real game:
#  - its own save keys (lastgradient.lab.*), separate from the real game's entropy.* keys
#  - home-screen name "LG TEST", tab title "Last Gradient (TEST)", amber TEST icons (tools/lab_icons.py)
#  - a TEST ribbon on screen at all times, and a "start as new player" button on the main menu (?fresh does the same)
# usage: python3 build.py && python3 tools/make_lab.py [extra-label]   (label defaults to the branch name; none on release/source)
import json, os, re, shutil, subprocess, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, out = os.path.join(root, 'dist/pages'), os.path.join(root, 'dist/lab')
shutil.rmtree(out, ignore_errors=True); shutil.copytree(src, out)
subprocess.run([sys.executable, os.path.join(root, 'tools/lab_icons.py'), src, out], check=True)
p = os.path.join(out, 'index.html'); s = open(p, encoding='utf-8').read()
# what the ribbon says: the version, and what this lab build carries on top of the live game
VER = re.search(r"const VERSION = '([^']+)'", s).group(1)
try: BR = subprocess.run(['git', '-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'], capture_output=True, text=True).stdout.strip()
except Exception: BR = ''
EXTRA = sys.argv[1] if len(sys.argv) > 1 else ('' if BR in ('release', 'source', 'main', '') else BR)
LABEL = f"TEST ENVIRONMENT \u00b7 v{VER} " + (f"+ {EXTRA.upper()}" if EXTRA else "\u00b7 SAME AS LIVE")
SAVE, LOG = 'lastgradient.lab.v1', 'lastgradient.lab.runlog'
for old, new in (("'entropy.save.v1'", f"'{SAVE}'"), ("'entropy.runlog'", f"'{LOG}'")):
    assert s.count(old) == 1, old
    s = s.replace(old, new)
s = re.sub(r'<title>(.*?)</title>', r'<title>\1 (TEST)</title>', s, count=1)
s = s.replace('<meta name="apple-mobile-web-app-title" content="Last Gradient">', '<meta name="apple-mobile-web-app-title" content="LG TEST">', 1)
head = f"""<script>try{{if(/[?&]fresh/.test(location.search)){{localStorage.removeItem('{SAVE}');history.replaceState(null,'',location.pathname);}}}}catch(e){{}}</script>"""
s = s.replace('<head>', '<head>' + head, 1)
tail = f"""<style>
#labRib{{position:fixed;z-index:99999;left:50%;top:0;transform:translateX(-50%);pointer-events:none;font:700 10px/1 monospace;letter-spacing:.3em;color:#0c0a08;padding:3px 10px 3px 13px;background:repeating-linear-gradient(-45deg,#ffb03a 0 8px,#ffcf7a 8px 16px);border:1px solid #0c0a08;border-top:0}}
#labRib.thin{{padding:0;height:4px;width:100%;left:0;transform:none;border:0;font-size:0;color:transparent}}
#labFresh{{position:absolute;left:max(16px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));z-index:5;font:inherit;font-size:12px;letter-spacing:.12em;text-transform:uppercase;padding:10px 14px;background:#2a1a08;color:#ffcf7a;border:2px solid #ffb03a;cursor:pointer}}
#labFresh.arm{{background:#ff4d6a;border-color:#ff4d6a;color:#07080f}}
</style>
<script>document.addEventListener('DOMContentLoaded',function(){{var r=document.createElement('div');r.id='labRib';r.textContent='{LABEL}';document.body.appendChild(r);setInterval(function(){{var g=document.getElementById('game');r.classList.toggle('thin',!!(g&&!g.hidden));}},500);
var h=document.getElementById('hangar');if(!h)return;var b=document.createElement('button');b.id='labFresh';var L='Test: start as new player';b.textContent=L;var t=null;
b.addEventListener('click',function(e){{e.stopPropagation();if(!b.classList.contains('arm')){{b.classList.add('arm');b.textContent='Tap again to erase the test save';clearTimeout(t);t=setTimeout(function(){{b.classList.remove('arm');b.textContent=L;}},4000);return;}}location.replace(location.pathname+'?fresh');}});h.appendChild(b);}});</script>"""
s = s.replace('</head>', tail + '</head>', 1)
open(p, 'w', encoding='utf-8').write(s)
m = os.path.join(out, 'manifest.webmanifest'); M = json.load(open(m))
M.update(name='Last Gradient TEST', short_name='LG TEST', theme_color='#ffb03a')
json.dump(M, open(m, 'w'), indent=1)
print('lab build ok:', out, '|', LABEL.replace('\\u00b7', '·'))
