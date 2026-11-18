// 줌 측정 결과 표 (docs/explore-field-v3-10.md "저사양 측정"). node explore/gpu/zoom/zoom-summary.mjs [결과 폴더]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const dir = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'zoom')
const read = (n) => { try { return JSON.parse(fs.readFileSync(path.join(dir, n + '.json'), 'utf8')).summary } catch { return null } }
const v = (x) => (x == null ? '-' : x)
const c = (p) => (p ? (p.cpuRenderer ?? 0) + (p.cpuGpu ?? 0) : '-')
const ZC = [['zoom-gpu', '가속 켬'], ['zoom-hwoff', '가속 끔 16스레드'], ['zoom-hwoff-2c', '가속 끔 2코어'], ['zoom2-hwoff', '가속 끔 16스레드 (줌 아웃 기다림)'], ['zoom2-hwoff-2c', '가속 끔 2코어 (줌 아웃 기다림)'], ['zoom3-hwoff', '가속 끔 16스레드 (최종: + 흙 칸)'], ['zoom3-hwoff-2c', '가속 끔 2코어 (최종: + 흙 칸)']]
console.log('| | 다 보이기까지 ms | 첫 진입 가장 긴 멈춤 ms | near→mid: 움직이기 시작 ms · fps · 최악 간격 ms · 선명까지 ms | mid→far | far→mid | mid→near | far 점프 카메라 fps | 가만히 CPU % (렌더러+GPU) near · mid · far |')
console.log('|---|---|---|---|---|---|---|---|---|')
for (const [n, label] of ZC) {
  const s = read(n); if (!s) continue
  const z = (p) => (s[p] ? `${v(s[p].startMs)} · ${v(s[p].zoomFps)} · ${v(s[p].zoomWorstGap)} · ${v(s[p].sharpMs)}` : '-')
  console.log(`| ${label} | ${v(s.load?.readyMs)} | ${v(s.load?.worstFreezeMs)} | ${z('out1')} | ${z('out2')} | ${z('in1')} | ${z('in2')} | ${v(s.hopFar?.panFps)} | ${c(s.idleNear)} · ${c(s.idleMid)} · ${c(s.idleFar)} |`)
}
console.log()
console.log('| | 다 보이기까지 ms | 첫 진입 가장 긴 멈춤 ms | 점프 카메라 fps · 가장 긴 간격 ms | 클릭 점프 카메라 fps | 들판 바꾸기 ms | 가만히 CPU 렌더러 · GPU % |')
console.log('|---|---|---|---|---|---|---|')
for (const [n, label] of [['explore-base-hwoff', '기준(main) 16스레드'], ['explore-new-hwoff', 'v3.10 흙 통째로 16스레드'], ['explore-split-hwoff', 'v3.10 최종(흙 칸) 16스레드'], ['explore-base-hwoff-2c', '기준(main) 2코어'], ['explore-new-hwoff-2c', 'v3.10 흙 통째로 2코어'], ['explore-new-hwoff-2c-nosoil', 'v3.10 흙 빼고 2코어'], ['explore-split-hwoff-2c', 'v3.10 최종(흙 칸) 2코어']]) {
  const s = read(n); if (!s) continue
  console.log(`| ${label} | ${v(s.load?.readyMs)} | ${v(s.load?.worstFreezeMs)} | ${v(s.hop?.panFps)} · ${v(s.hop?.sceneWorstGap)} | ${v(s.click?.panFps)} | ${v(s.floorSwitchMs)} | ${v(s.idle2?.cpuRenderer)} · ${v(s.idle2?.cpuGpu)} |`)
}
