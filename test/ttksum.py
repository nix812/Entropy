"""Aggregate TTK lines from a par.sh file run with TTK=1 (par.sh keeps them): per wave band and enemy type, the share
that died early (<20% of the road), mid (20-75%) and late or leaked (>75%). usage: python3 ttksum.py file [section]"""
import sys, re, collections
f = sys.argv[1]; want = sys.argv[2] if len(sys.argv) > 2 else None
sec = None; agg = collections.defaultdict(lambda: [0, 0.0, 0.0, 0.0])
for line in open(f):
    if line.startswith('== '): sec = line[3:].strip(); continue
    if want and sec != want: continue
    m = re.match(r'TTK (\S+) (\S+)\s+n=\s*(\d+) died<20%:\s*(\d+)%\s+20-75%:\s*(\d+)%\s+>75%/leak:\s*(\d+)%', line)
    if not m: continue
    band, ty, n, a, b, c = m.groups(); n = int(n); A = agg[(band, ty)]
    A[0] += n; A[1] += n * int(a); A[2] += n * int(b); A[3] += n * int(c)
order = ['1-10', '11-25', '26-45', '46-65', '66+']
for band in order:
    rows = [(k[1], v) for k, v in agg.items() if k[0] == band and v[0]]
    if not rows: continue
    print(f'-- {band}')
    for ty, (n, a, b, c) in sorted(rows):
        print(f'  {ty:10s} n={n:6d}  early {a / n:5.1f}%  mid {b / n:5.1f}%  late/leak {c / n:5.1f}%')
