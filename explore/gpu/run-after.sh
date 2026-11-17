#!/bin/sh
# 개선 후 측정 묶음 (2026-11-16, docs/rendering-experiments-2.md). 사용: sh explore/gpu/run-after.sh <prefix> [hwoff|gpu]
# 공유 빌드를 http://localhost:5301 에 띄워 둔 상태에서. 쿼리 손잡이로 켜고 끈 것끼리 비교
P=${1:-after}; M=${2:-hwoff}; H=http://localhost:5301/#
cd "$(dirname "$0")/../.."
S=explore/gpu/sweep.mjs
# 찻방: 저사양 숨쉬기·두리번 fps 제한(teafps 기본 15) vs 끔
node $S $P-chat $M chat "$H/chat/g-m1" group= group_nocap=teafps=0
node $S $P-chat $M chat "$H/chat/r-yerin" dm= dm_nocap=teafps=0
# 랜딩: 숨긴 층 그리기 멈춤 vs 끔
node $S $P-land $M landing "$H/start" start= start_nopause=lpause=0
# 땅굴 (회귀 확인)
node $S $P-room $M room "$H/burrow" mine=
node $S $P-room $M room "$H/burrow/yerin" visit=
# 화면 전환
node $S $P-nav $M nav "$H/burrow" seq=
node $S $P-onb $M idle "$H/onboarding/preview?demo" preview=
