#!/usr/bin/env bash
# 탐색 들판 v3.10 측정 묶음 (2026-11-18, docs/explore-field-v3-10.md)
# 띄워 두기: 이 브랜치 공유 빌드 → vite preview --outDir dist-share --port 5345 (NEW), 기준(main 4304257 공유 빌드) → --port 5346 (BASE)
# 사용: bash explore/gpu/zoom/run-zoom.sh [결과 폴더]
# - zoom: 줌 시나리오 (cdp-scene.mjs zoom) — 가속 켬 / 끔 16스레드 / 끔 2코어(AFF=3)
# - explore: 예전 탐색 시나리오(점프 4번·클릭·들판 바꾸기)를 기준과 이 브랜치에서 (흙 노드가 늘어난 바닥이 near 를 느리게 하지 않는지)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$HERE/../results/zoom}"
NEW="${NEW:-http://localhost:5345/#/burrow/explore}"
BASE="${BASE:-http://localhost:5346/#/burrow/explore}"
mkdir -p "$OUT"
run() { echo "== $1"; OUT="$OUT" REPS="${REPS:-3}" node "$HERE/../cdp-scene.mjs" "$@" 2>/dev/null | tail -c 400; echo; }
run zoom-gpu gpu "$NEW" zoom
run zoom-hwoff hwoff "$NEW" zoom
AFF=3 run zoom-hwoff-2c hwoff "$NEW" zoom
run explore-new-hwoff hwoff "$NEW" explore
run explore-base-hwoff hwoff "$BASE" explore
AFF=3 run explore-new-hwoff-2c hwoff "$NEW" explore
AFF=3 run explore-base-hwoff-2c hwoff "$BASE" explore
