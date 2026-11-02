from PIL import Image, ImageDraw
W, H = 64, 56
def col(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)
img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
# --- masks
def mask(): return Image.new('1', (W, H), 0)
cat = mask(); cd = ImageDraw.Draw(cat)
cd.ellipse([24, 26, 53, 45], fill=1)            # body lying to the right
cd.ellipse([20, 14, 43, 33], fill=1)            # head
cd.polygon([(21, 21), (23, 7), (30, 15)], fill=1)  # left ear
cd.polygon([(34, 15), (41, 7), (43, 21)], fill=1)  # right ear
cd.ellipse([22, 30, 34, 42], fill=1)            # chest
couch_back = mask(); ImageDraw.Draw(couch_back).rounded_rectangle([7, 27, 57, 40], 6, fill=1)
arm_l = mask(); ImageDraw.Draw(arm_l).rounded_rectangle([3, 31, 17, 53], 6, fill=1)
arm_r = mask(); ImageDraw.Draw(arm_r).rounded_rectangle([47, 31, 61, 53], 6, fill=1)
front = mask(); ImageDraw.Draw(front).rounded_rectangle([12, 40, 52, 53], 5, fill=1)
P = {'g0': '#3b3a48', 'g1': '#55546a', 'g2': '#727189', 'g3': '#9a99b3', 'g4': '#bdbcd3',
     'c0': '#0d0b14', 'c1': '#1a1726', 'c2': '#2b2740', 'c3': '#5d4f8a',
     'eye': '#cfd65c', 'eyeh': '#f4f7c8', 'pup': '#0a0a0a', 'ear': '#5a3a52', 'nose': '#3e2c3a', 'white': '#e9e4d4'}
px = img.load()
def at(m, x, y): return 0 <= x < W and 0 <= y < H and m.getpixel((x, y))
def paint(m, base, hi, lo, hi2=None):
    for y in range(H):
        for x in range(W):
            if not at(m, x, y): continue
            c = base
            if not at(m, x, y - 1) or not at(m, x - 1, y): c = hi
            if hi2 and not at(m, x, y - 2) and at(m, x, y - 1) and not at(m, x - 1, y): c = hi2
            if not at(m, x, y + 1) or not at(m, x + 1, y): c = lo
            px[x, y] = col(c)
# draw back to front: couch back, cat, arms, front cushion
paint(couch_back, P['g2'], P['g3'], P['g1'])
paint(cat, P['c1'], P['c3'], P['c0'], P['c2'])
paint(arm_l, P['g2'], P['g4'], P['g1'], P['g3'])
paint(arm_r, P['g1'], P['g3'], P['g0'], P['g2'])
paint(front, P['g2'], P['g4'], P['g0'], P['g3'])
# the leg: one front leg stretched out and draped over the front cushion (his usual pose)
leg = mask(); ld = ImageDraw.Draw(leg)
for y in range(33, 50):
    cx = 27.5 - (y - 33) * 0.55
    ld.rectangle([round(cx - 2.4), y, round(cx + 2.2), y], fill=1)
ld.ellipse([13, 46, 23, 53], fill=1)  # paw
paint(leg, P['c1'], P['c3'], P['c0'], P['c2'])

for x in range(16, 49):
    if (x // 2) % 2 == 0 and not at(leg, x, 47): px[x, 47] = col(P['g1'])
# inner ears
for (x, y) in [(24, 12), (24, 13), (25, 13), (24, 14), (25, 14), (26, 15), (39, 12), (39, 13), (38, 13), (39, 14), (38, 14), (37, 15)]:
    px[x, y] = col(P['ear'])
# eyes: round 4x4 with a round pupil and a glint (Nigel is wide-eyed)
for ex in (25, 35):
    for dx, dy in [(1,0),(2,0),(0,1),(1,1),(2,1),(3,1),(0,2),(1,2),(2,2),(3,2),(1,3),(2,3)]: px[ex + dx, 21 + dy] = col(P['eye'])
    for dx, dy in [(1,1),(2,1),(1,2),(2,2)]: px[ex + dx, 21 + dy] = col(P['pup'])
    px[ex + 1, 22] = col(P['eyeh'])
# nose and the little white chest spot
px[31, 27] = col(P['nose']); px[32, 27] = col(P['nose'])
for (x, y) in [(31, 35), (32, 35), (31, 36), (32, 36), (31, 37)]: px[x, y] = col(P['white'])
px[31, 28] = col(P['c0']); px[32, 28] = col(P['c0']); px[30, 29] = col(P['c2']); px[33, 29] = col(P['c2'])
# toe beans: two dark lines on the paw
for (x, y) in [(16, 52), (18, 52), (20, 52)]: px[x, y] = col(P['c0'])
# whiskers, faint
for (x, y) in [(18, 27), (19, 27), (20, 28), (44, 27), (45, 27), (43, 28)]: px[x, y] = col('#6e6a85')
img.save('nigel_px.png')
img.resize((W * 8, H * 8), Image.NEAREST).save('nigel_8x.png')
