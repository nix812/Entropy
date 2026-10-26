#!/bin/bash
# usage: par.sh N args...  -> runs N single-run bots in parallel and prints combined rows
N=$1; shift
for i in $(seq 0 $((N-1))); do SEED=$i node test/smartbot.js 1 "$@" > /tmp/par_$i.txt 2>&1 & done
wait
for i in $(seq 0 $((N-1))); do grep -E "^│ [0-9]" /tmp/par_$i.txt; grep -E "Error|at " /tmp/par_$i.txt | head -3; done
