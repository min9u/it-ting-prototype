#!/bin/sh
# 기준 측정 묶음 (2026-11-16, docs/rendering-experiments-2.md). 사용: sh explore/gpu/run-base.sh <prefix> [hwoff|gpu]
# 공유 빌드를 http://localhost:5301 에 띄워 둔 상태에서
P=${1:-base}; M=${2:-hwoff}; H=http://localhost:5301/#
cd "$(dirname "$0")/../.."
S=explore/gpu/sweep.mjs
node $S $P-ex $M explore "$H/burrow/explore" s2=
node $S $P-ex $M explore "$H/burrow/explore?floor=2026%20%ED%95%98%EB%B0%98%EA%B8%B0%7C%EC%84%9C%EC%9A%B8%7C3" s3=
node $S $P-chat $M chat "$H/chat/r-yerin" dm=
node $S $P-chat $M chat "$H/chat/g-m1" group=
node $S $P-room $M room "$H/burrow" mine=
node $S $P-room $M room "$H/burrow/yerin" visit=
node $S $P-nav $M nav "$H/burrow" seq=
node $S $P-land $M landing "$H/start" start=
node $S $P-onb $M idle "$H/onboarding/preview?demo" preview=
