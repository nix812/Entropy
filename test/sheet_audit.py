"""Tile the uiaudit screenshots of one size into contact sheets (12 per sheet) for a quick visual pass.
usage: python3 sheet_audit.py 667x375"""
import sys, pathlib
from PIL import Image, ImageDraw
d = pathlib.Path(__file__).parent / 'out' / 'uiaudit' / sys.argv[1]
files = sorted(d.glob('*.png')); n = 12; cols = 3
for si in range(0, len(files), n):
    chunk = files[si:si + n]; ims = [Image.open(f) for f in chunk]
    w, h = 560, int(560 * ims[0].height / ims[0].width)
    sheet = Image.new('RGB', (cols * w, ((len(ims) + cols - 1) // cols) * (h + 18)), 'black'); dr = ImageDraw.Draw(sheet)
    for i, (f, im) in enumerate(zip(chunk, ims)):
        x, y = (i % cols) * w, (i // cols) * (h + 18)
        sheet.paste(im.resize((w, h)), (x, y + 18)); dr.text((x + 4, y + 3), f.stem, fill='yellow')
    out = d.parent / f'sheet_{sys.argv[1]}_{si // n:02d}.png'; sheet.save(out); print(out)
