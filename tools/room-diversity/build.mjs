// 땅굴 다양성 비교 페이지 만들기 (2026-11-18, docs/room-diversity-2026-11-18.md)
// 사용 (저장소 루트에서, analyze.py 다음에):  node tools/room-diversity/build.mjs
// - room-diversity.html(원본)의 {{이름}} 자리에 out/data.json 숫자를 넣고, 맨 아래 const DATA = ... 에 data.json 을 그대로 넣어
//   out/room-diversity.html 로 씀 (게시용: <html>/<head>/<body> 없음, 게시할 때 붙음)
// - out/files.json = 페이지와 같이 올릴 사진 경로 목록 (페이지 기준 상대 경로). 페이지가 실제로 쓰는 것만 (없는 파일이면 멈춤)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, 'out')
const data = JSON.parse(fs.readFileSync(path.join(OUT, 'data.json'), 'utf8'))
const src = fs.readFileSync(path.join(HERE, 'room-diversity.html'), 'utf8')
const R = Object.fromEntries(data.rooms.map((r) => [r.key, r]))
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`
const nameOf = (k) => (R[k]?.group === 'b' && R[k].seat ? `${R[k].name}(자리 ${R[k].seat})` : R[k]?.name ?? k)
const s = data.seen, e = data.vsEmpty, f = data.furn
const tokens = {
  N: String(data.meta.n),
  N_A: String(data.rooms.filter((r) => r.group === 'a').length),
  N_B: String(data.rooms.filter((r) => r.group === 'b').length),
  FURN_NEVER: pct(e.never, 0), FURN_ANY: pct(e.any, 0), FURN_HALF: pct(e.half, 1),
  SEEN_NEVER: pct(s.never, 0), SEEN_ANY: pct(s.any, 0), SEEN_HALF: pct(s.half, 1),
  SCORE_MED: pct(s.scoreMedian), SCORE_MIN: pct(s.scoreMin), SCORE_MAX: pct(s.scoreMax),
  EMPTY_MED: pct(e.median), EMPTY_MIN: pct(e.min), EMPTY_MAX: pct(e.max),
  PAIR_MED: pct(s.pairMedian), PAIR_UNDER10: pct(s.pairUnder10, 0), PAIR_UNDER5: pct(s.pairUnder5, 0),
  PAIRF_MED: pct(f.pairMedian), PAIRF_UNDER10: pct(f.pairUnder10, 0), PAIRF_MAX: pct(f.pairMax),
  PAIRLO: `${nameOf(s.pairLo[0])} · ${nameOf(s.pairLo[1])}`, PAIRLO_V: pct(s.pairMin),
  PAIRHI: `${nameOf(s.pairHi[0])} · ${nameOf(s.pairHi[1])}`, PAIRHI_V: pct(s.pairMax),
  MOLE: pct(data.meta.moleShare, 0),
  SENS5: `${s.sensitivity['5']}%`, SENS10: `${s.sensitivity['10']}%`, SENS15: `${s.sensitivity['15']}%`, SENS20: `${s.sensitivity['20']}%`,
  RENDERER: String(data.meta.renderer ?? '').replace(/^ANGLE \(|\)$/g, ''),
  WP_LIST: Object.entries(data.wallpapers).map(([k, v]) => `${k} ${v}`).join(' · '),
}
const missing = new Set()
let html = src.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : (missing.add(k), m)))
if (missing.size) { console.error('data.json 에 없는 자리:', [...missing].join(', ')); process.exit(1) }
const marker = 'const DATA = null /*__DATA__*/'
if (!html.includes(marker)) { console.error(`원본에 ${marker} 가 없어요`); process.exit(1) }
html = html.replace(marker, `const DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')}`)
fs.writeFileSync(path.join(OUT, 'room-diversity.html'), html)

// 같이 올릴 사진: 방마다 카드 · 크게 보기 · 두더지 뺀 그림 · 다른 곳 + 평균 방 · 빈 방 + 차이 지도 2장
const keys = [...data.rooms.map((r) => r.key), 'median', 'empty']
const files = [
  'img/diffmap.jpg', 'img/diffmap-furn.jpg',
  ...keys.flatMap((k) => [`img/rooms/${k}.jpg`, `img/full/${k}.jpg`, `img/nomole/${k}.jpg`]),
  ...data.rooms.map((r) => `img/mask/${r.key}.png`),
]
const lost = files.filter((p) => !fs.existsSync(path.join(OUT, p)))
if (lost.length) { console.error('없는 사진:', lost.join(', ')); process.exit(1) }
fs.writeFileSync(path.join(OUT, 'files.json'), JSON.stringify(files, null, 1))
const bytes = files.reduce((n, p) => n + fs.statSync(path.join(OUT, p)).size, 0) + Buffer.byteLength(html)
const big = files.map((p) => [p, fs.statSync(path.join(OUT, p)).size]).sort((a, b) => b[1] - a[1])[0]
console.log(`out/room-diversity.html (${(Buffer.byteLength(html) / 1e3).toFixed(0)}KB) · 사진 ${files.length}장 · 합계 ${(bytes / 1e6).toFixed(2)}MB · 가장 큰 사진 ${big[0]} ${(big[1] / 1e3).toFixed(0)}KB`)
