// 땅굴 다양성 비교 페이지 만들기 (2026-11-18 1차, 같은 날 2차 전·후: docs/room-diversity-2-2026-11-18.md)
// 사용 (저장소 루트에서, analyze.py 다음에):  node tools/room-diversity/build.mjs
// - room-diversity.html(원본)의 {{이름}} 자리에 out/data.json 숫자를 넣고, 맨 아래 const DATA = ... 에 data.json(+ 저사양 측정 perf.json)을 넣어
//   out/room-diversity.html 로 씀 (게시용: <html>/<head>/<body> 없음, 게시할 때 붙음)
// - out/files.json = 페이지와 같이 올릴 사진 경로 목록 (페이지 기준 상대 경로). 페이지가 실제로 쓰는 것만 (없는 파일이면 멈춤)
// - 저사양 측정 표: tools/room-diversity/perf.json (explore/gpu/cdp-scene.mjs 결과 요약, 있으면)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, 'out')
const data = JSON.parse(fs.readFileSync(path.join(OUT, 'data.json'), 'utf8'))
const perfPath = path.join(HERE, 'perf.json')
data.perf = fs.existsSync(perfPath) ? JSON.parse(fs.readFileSync(perfPath, 'utf8')) : null
const src = fs.readFileSync(path.join(HERE, 'room-diversity.html'), 'utf8')
const B = data.sets.before, A = data.sets.after
if (!B || !A) { console.error('전(before) · 후(after) 두 묶음이 다 있어야 해요 (analyze.py)'); process.exit(1) }
const RB = Object.fromEntries(B.rooms.map((r) => [r.key, r]))
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`
const pairOf = (S, a, b) => { const i = S.rooms.findIndex((r) => r.key === a), j = S.rooms.findIndex((r) => r.key === b); return S.pair[i][j] }
const nameOf = (k) => (RB[k]?.group === 'b' && RB[k].seat ? `${RB[k].name}(자리 ${RB[k].seat})` : RB[k]?.name ?? k)
const baVals = Object.values(data.beforeAfter ?? {}).sort((a, b) => a - b)
const tokens = {
  N: String(A.meta.n),
  N_A: String(A.rooms.filter((r) => r.group === 'a').length),
  N_B: String(A.rooms.filter((r) => r.group === 'b').length),
  N_PAIRS: String(A.meta.n * (A.meta.n - 1) / 2),
  // 빈 방과 똑같은 넓이 (벽지 그림 같게) · 보이는 그대로
  B_FURN_NEVER: pct(B.vsEmpty.never), A_FURN_NEVER: pct(A.vsEmpty.never),
  B_EMPTY_NEVER: pct(B.vsEmptySeen.never), A_EMPTY_NEVER: pct(A.vsEmptySeen.never),
  B_EMPTY_MED: pct(B.vsEmptySeen.median), A_EMPTY_MED: pct(A.vsEmptySeen.median),
  B_SEEN_NEVER: pct(B.seen.never), A_SEEN_NEVER: pct(A.seen.never),
  B_SCORE_MED: pct(B.seen.scoreMedian), A_SCORE_MED: pct(A.seen.scoreMedian),
  B_PAIR_MED: pct(B.seen.pairMedian), A_PAIR_MED: pct(A.seen.pairMedian),
  B_PAIR_UNDER10: pct(B.seen.pairUnder10), A_PAIR_UNDER10: pct(A.seen.pairUnder10),
  B_PAIR_MIN: pct(B.seen.pairMin), A_PAIR_MIN: pct(A.seen.pairMin),
  B_PAIRLO: `${nameOf(B.seen.pairLo[0])} · ${nameOf(B.seen.pairLo[1])}`, A_PAIRLO: `${nameOf(A.seen.pairLo[0])} · ${nameOf(A.seen.pairLo[1])}`,
  B_SPORT_OUT: pct(pairOf(B, 'a01-sports', 'a11-outdoor')), A_SPORT_OUT: pct(pairOf(A, 'a01-sports', 'a11-outdoor')),
  B_LANG_BOOK: pct(pairOf(B, 'a06-language', 'a05-book')), A_LANG_BOOK: pct(pairOf(A, 'a06-language', 'a05-book')),
  BA_MED: baVals.length ? pct(baVals[baVals.length >> 1]) : '-', BA_MIN: baVals.length ? pct(baVals[0]) : '-', BA_MAX: baVals.length ? pct(baVals.at(-1)) : '-',
  MOLE: pct(A.meta.moleShare, 0),
  RENDERER: String(A.meta.renderer ?? '').replace(/^ANGLE \(|\)$/g, ''),
  N_THEMES: String(A.themes.length),
}
const missing = new Set()
let html = src.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : (missing.add(k), m)))
if (missing.size) { console.error('data.json 에 없는 자리:', [...missing].join(', ')); process.exit(1) }
const marker = 'const DATA = null /*__DATA__*/'
if (!html.includes(marker)) { console.error(`원본에 ${marker} 가 없어요`); process.exit(1) }
html = html.replace(marker, `const DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')}`)
fs.writeFileSync(path.join(OUT, 'room-diversity.html'), html)

// 같이 올릴 사진: 묶음마다 방 카드 · 크게 보기 · 두더지 뺀 그림 · 다른 곳 + 평균 방 · 빈 방 + 차이 지도 3장
const files = []
for (const s of ['before', 'after']) {
  const S = data.sets[s]
  const keys = [...S.rooms.map((r) => r.key), 'median', 'empty']
  files.push(`img/${s}/diffmap.jpg`, `img/${s}/diffmap-furn.jpg`, `img/${s}/diffmap-empty.jpg`,
    ...keys.flatMap((k) => [`img/${s}/rooms/${k}.jpg`, `img/${s}/full/${k}.jpg`, `img/${s}/nomole/${k}.jpg`]),
    ...S.rooms.map((r) => `img/${s}/mask/${r.key}.png`))
}
const lost = files.filter((p) => !fs.existsSync(path.join(OUT, p)))
if (lost.length) { console.error('없는 사진:', lost.join(', ')); process.exit(1) }
fs.writeFileSync(path.join(OUT, 'files.json'), JSON.stringify(files, null, 1))
const bytes = files.reduce((n, p) => n + fs.statSync(path.join(OUT, p)).size, 0) + Buffer.byteLength(html)
const big = files.map((p) => [p, fs.statSync(path.join(OUT, p)).size]).sort((a, b) => b[1] - a[1])[0]
console.log(`out/room-diversity.html (${(Buffer.byteLength(html) / 1e3).toFixed(0)}KB) · 사진 ${files.length}장 · 합계 ${(bytes / 1e6).toFixed(2)}MB · 가장 큰 사진 ${big[0]} ${(big[1] / 1e3).toFixed(0)}KB`)
console.log(Object.entries(tokens).filter(([k]) => /^(A|B)_/.test(k)).map(([k, v]) => `${k}=${v}`).join(' · '))
