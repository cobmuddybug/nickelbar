#!/bin/bash
# Loads every game in the real QML harness, plays a few inputs, round-trips
# a save, and fails if QML reports an error or the harness doesn't finish.
#   make smoke            # every game
#   dev/tools/smoke.sh snake tempest
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
games=("$@")
[ ${#games[@]} -eq 0 ] && mapfile -t games < <(node -e "
const {load}=require('$ROOT/dev/tests/lib');load('engine/GamesCatalog.js').GAMES.forEach(g=>console.log(g.id))")
steps="w,w,w,l,w,w,a,w,w,w,j,w,w,A,w,w,w,A,w,w,R,w,w,w,w,h,w,k,w,a,w,R,w,w"
fail=0
for g in "${games[@]}"; do
  out=$("$ROOT/dev/tools/harness-run.sh" "$g" "$steps")
  if echo "$out" | grep -q NICKELBAR_STATUS && ! echo "$out" | grep -v NICKELBAR_STATUS | grep -q .; then
    printf '  ok    %s\n' "$g"
  else
    printf '  FAIL  %s\n%s\n' "$g" "$(echo "$out" | sed 's/^/        /')"
    fail=$((fail + 1))
  fi
done
echo
echo "${#games[@]} games, $fail failed"
[ $fail -eq 0 ]
