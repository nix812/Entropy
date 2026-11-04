"""Deploys the live game and the lab together, so the lab is never behind the live game (Nic, Nov 4 2026:
"When we make changes to prod, the test environment should also be updated").

  Live = branch `source` (this repo on `release`/`source`), served at the root of `main`  -> nix812.github.io/Entropy/
  Lab  = `source` + whatever feature is under test, served at main:/lab/                  -> nix812.github.io/Entropy/lab/

usage:
  python3 tools/deploy.py --site ~/entropy-site --live                        live release; lab rebuilt from the same code
  python3 tools/deploy.py --site ~/entropy-site --live --lab-from /root/wt/x  live release; lab = feature clone x (must contain source)
  python3 tools/deploy.py --site ~/entropy-site --lab-from /root/wt/x         lab only (a feature under test)
Run the test gate first (HANDOFF "Environments and releases"). The script refuses a lab that is missing the live code.
"""
import argparse, os, re, shutil, subprocess, sys
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser(); ap.add_argument('--site', required=True); ap.add_argument('--live', action='store_true'); ap.add_argument('--lab-from'); ap.add_argument('--label')
a = ap.parse_args(); site = os.path.expanduser(a.site)
def sh(cmd, cwd, **k): return subprocess.run(cmd, cwd=cwd, check=True, text=True, capture_output=True, **k).stdout.strip()
def ver(d): return re.search(r"const VERSION = '([^']+)'", open(os.path.join(d, 'src/data.js')).read()).group(1)
trailer = "\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: " + os.environ.get('CLAUDE_SESSION', '(see HANDOFF)')
sh(['git', 'pull', '-q', 'origin', 'main'], site)
live_ver = ver(here); msg = []
if a.live:
    br = sh(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], here)
    if br not in ('release', 'source'): sys.exit(f'live deploys come from release/source, not {br}')
    sh([sys.executable, 'build.py'], here)
    for f in os.listdir(os.path.join(here, 'dist/pages')):
        s, d = os.path.join(here, 'dist/pages', f), os.path.join(site, f)
        (shutil.copytree(s, d, dirs_exist_ok=True) if os.path.isdir(s) else shutil.copy2(s, d))
    msg.append(f'Deploy {live_ver}')
else:
    m = re.search(r"const VERSION = '([^']+)'", open(os.path.join(site, 'index.html')).read()); live_ver = m.group(1) if m else live_ver
lab = os.path.abspath(a.lab_from) if a.lab_from else here
if lab != here:
    src_head = sh(['git', 'rev-parse', 'source'], here)
    try: sh(['git', 'merge-base', '--is-ancestor', src_head, 'HEAD'], lab)
    except subprocess.CalledProcessError: sys.exit(f'{lab} is missing the live code (source {src_head[:7]}). Merge source into it first.')
if lab != here or not a.live: sh([sys.executable, 'build.py'], lab)
out = sh([sys.executable, 'tools/make_lab.py'] + ([a.label] if a.label else []), lab)
lab_ver = ver(lab)
shutil.rmtree(os.path.join(site, 'lab'), ignore_errors=True); shutil.copytree(os.path.join(lab, 'dist/lab'), os.path.join(site, 'lab'))
lab_br = a.label or sh(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], lab)
msg.append(f'lab {lab_ver}' + (f' + {lab_br}' if lab != here else ' (same as live)'))
sh(['git', 'add', '-A'], site)
if not sh(['git', 'status', '--porcelain'], site): print('nothing to deploy'); sys.exit(0)
sh(['git', '-c', 'user.name=Claude', '-c', 'user.email=noreply@anthropic.com', 'commit', '-q', '-m', ', '.join(msg) + trailer], site)
sh(['git', 'push', '-q', 'origin', 'HEAD:main'], site)
print(', '.join(msg), '|', out.splitlines()[-1], '|', sh(['git', 'log', '--oneline', '-1'], site))
