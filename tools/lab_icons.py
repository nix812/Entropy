# Makes the LAB (test environment) home-screen icons from the real ones:
# the core recoloured amber, hazard stripes and a big pixel "TEST" across the bottom.
# usage: python3 tools/lab_icons.py <dir with icon-512.png> <out dir>
import sys, colorsys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
im = Image.open(f'{src}/icon-512.png').convert('RGB')
px = im.load()
for y in range(512):
    for x in range(512):
        r, g, b = px[x, y]
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if s > 0.25 and 0.35 < h < 0.55:  # the green/teal core -> amber
            r2, g2, b2 = colorsys.hls_to_rgb(0.10, l, min(1, s * 1.05))
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255))
d = ImageDraw.Draw(im)
# hazard band
y0, y1 = 352, 512
band = Image.new('RGB', (512, y1 - y0), (12, 10, 8))
bd = ImageDraw.Draw(band)
for k in range(-200, 712, 64):
    bd.polygon([(k, 0), (k + 32, 0), (k + 32 - (y1 - y0), y1 - y0), (k - (y1 - y0), y1 - y0)], fill=(255, 176, 58))
im.paste(band, (0, y0))
d.rectangle([0, y0 - 8, 511, y0 - 1], fill=(12, 10, 8))
# plate behind the word
d.rectangle([56, y0 + 20, 455, y1 - 20], fill=(12, 10, 8))
G = {'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
     'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
     'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110']}
word, cell, gap = 'TEST', 15, 1
w = len(word) * 5 * cell + (len(word) - 1) * cell * gap
x0, yt = (512 - w) // 2, y0 + 20 + ((y1 - 20 - (y0 + 20)) - 7 * cell) // 2
for i, ch in enumerate(word):
    for ry, row in enumerate(G[ch]):
        for rx, v in enumerate(row):
            if v == '1':
                X = x0 + i * (5 + gap) * cell + rx * cell; Y = yt + ry * cell
                d.rectangle([X, Y, X + cell - 1, Y + cell - 1], fill=(255, 176, 58))
for n in (512, 192, 180):
    im.resize((n, n), Image.NEAREST if n == 512 else Image.LANCZOS).save(f'{out}/icon-{n}.png')
print('ok')
