#!/bin/bash
# usage: par.sh N args...  -> runs N single-run bots in parallel and prints combined rows
# temp files carry this shell's PID so two batches can run at once (e.g. a frozen baseline copy beside the working tree)
N=$1; shift
D=$(dirname "$0"); T=${TMPDIR:-/tmp}/par_$$
for i in $(seq 0 $((N-1))); do SEED=$i node "$D/smartbot.js" 1 "$@" > ${T}_$i.txt 2>&1 & done
wait
for i in $(seq 0 $((N-1))); do grep -E "^│ [0-9]" ${T}_$i.txt; grep -E "Error|at " ${T}_$i.txt | head -3; rm -f ${T}_$i.txt; done
