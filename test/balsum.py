"""Summarise par.sh output files: median/mean wave, Lens share of damage, banked credits, killers.
usage: python3 balsum.py file [file...]   (sections start with '== label')"""
import sys, re, statistics as st
for f in sys.argv[1:]:
    sec = None; rows = {}
    for line in open(f):
        if line.startswith('== '): sec = line[3:].strip(); rows[sec] = []; continue
        if line.startswith('│ ') and re.match(r'│ \d', line):
            c = [x.strip() for x in line.split('│')]
            top = c[18]; lens = 0
            m = re.search(r'lens:(\d+)', top); lens = int(m.group(1)) if m else 0
            rows.setdefault(sec, []).append({'wave': int(c[2]), 'min': float(c[3]), 'killer': c[5].strip("'"), 'asc': int(c[10]), 'bank': int(c[13]), 'lens': lens, 'top': top.strip("'"), 'el': c[19].strip("'")})
    for s, R in rows.items():
        if not R: continue
        w = sorted(r['wave'] for r in R)
        print(f"{f.split('/')[-1]} | {s:28s} | n={len(R)} median {st.median(w):5.1f} mean {st.mean(w):5.1f} range {w[0]}-{w[-1]} | lens share {st.mean(r['lens'] for r in R):4.1f}% | bank med {st.median(r['bank'] for r in R):6.0f} | asc {st.median(r['asc'] for r in R):4.0f} | mins {st.median(r['min'] for r in R):4.1f}")
