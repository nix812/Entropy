import pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
js = '\n'.join((src / f).read_text() for f in ['data.js', 'sim.js', 'audio.js', 'art.js', 'units.js', 'render.js', 'ui.js'])
html = (src / 'template.html').read_text().replace('/*__SCRIPT__*/', js)
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'entropy.html').write_text(html)
(root / 'dist' / 'bundle.js').write_text(js)
print('built', len(html) // 1024, 'KB')

# ---- standalone Home Screen build (GitHub Pages) ----
pages = root / 'dist' / 'pages'; pages.mkdir(parents=True, exist_ok=True)
i = html.index('<div id="app">')
head_extra = ('<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">\n'
  '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="Entropy">\n'
  '<meta name="theme-color" content="#07080f">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-180.png">\n<link rel="icon" href="icon-192.png">\n')
(pages / 'index.html').write_text('<!doctype html>\n<html lang="en">\n<head>\n' + head_extra + html[:i] + '\n</head>\n<body>\n' + html[i:] + '\n</body>\n</html>\n')
import json
(pages / 'manifest.webmanifest').write_text(json.dumps({'name': 'Entropy', 'short_name': 'Entropy', 'start_url': './', 'scope': './', 'display': 'fullscreen',
  'orientation': 'landscape', 'background_color': '#07080f', 'theme_color': '#07080f',
  'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'}]}, indent=1))
from PIL import Image, ImageDraw
def icon(n):
    g = 32; im = Image.new('RGB', (g, g), (7, 8, 15)); d = ImageDraw.Draw(im)
    import math
    for y in range(g):
        for x in range(g):
            r = math.hypot(x - 15.5, y - 15.5)
            if 10.5 <= r < 12.5: im.putpixel((x, y), (31, 107, 85))
            elif r < 10.5: im.putpixel((x, y), (11, 42, 34))
            if r < 4.6: im.putpixel((x, y), (89, 240, 180))
    for k in range(8):
        a = k / 8 * 6.283; cx, cy = 15.5 + math.cos(a) * 8, 15.5 + math.sin(a) * 8
        d.rectangle([round(cx) - 1, round(cy) - 1, round(cx), round(cy)], fill=(89, 240, 180))
    d.rectangle([13, 13, 14, 14], fill=(184, 255, 230))
    for k in range(6):
        a = k / 6 * 6.283 + 0.4
        d.point((round(15.5 + math.cos(a) * 14.2), round(15.5 + math.sin(a) * 14.2)), fill=[(184, 108, 255), (255, 77, 106), (255, 176, 58)][k % 3])
    im.resize((n, n), Image.NEAREST).save(pages / f'icon-{n}.png')
for n in (180, 192, 512): icon(n)
print('pages build ok')
