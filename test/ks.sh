#!/bin/bash
cd /home/claude/entropy
for k in none glass conflag overgrid abszero singularity dimret prismatic chaos unbreakable; do
  kk=$k; [ "$k" = none ] && kk=""
  for i in 0 1; do SEED=$i node test/smartbot.js 1 50 1 1 40 $kk > /tmp/ks_${k}_$i.txt 2>&1 & done; wait
  echo "$k: $(grep -hE '^│ [0-9]' /tmp/ks_${k}_*.txt | awk -F'│' '{printf "%s/%s ", $3,$4}') $(grep -h Error /tmp/ks_${k}_*.txt | head -1)"
done
