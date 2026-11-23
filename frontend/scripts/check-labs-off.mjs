#!/usr/bin/env node
/**
 * 실험실이 꺼진 배포 빌드 검사 (docs/team-repo-migration.md "실험실: 로컬에서만", docs/nextjs-migration.md "실험실")
 *
 * 1. NEXT_PUBLIC_LABS=0 으로 next build (--no-build 면 지금 .next 를 그대로 검사)
 * 2. 빌드 결과 라우트 목록(app-path-routes-manifest.json)에 실험실 주소가 없는지
 * 3. next start -p 3100 으로 띄워 실험실 주소가 404 인지 (/lab/style · /lab/rooms · /screens · /dev/crash)
 * 4. .next 안 모든 파일(브라우저 · 서버 청크)에 실험실 코드에만 있는 글이 없는지 (글자 그대로 + \uXXXX 이스케이프 둘 다)
 *    + 대조군: 일반 화면 글("잠시 문제가 생겼어요")은 있어야 함 (검색이 제대로 되는지)
 *
 * 사용 (frontend/ 에서): npm run check:labs-off   (CI 에서도 이것만 부르면 됨)
 * 옵션: --no-build (빌드 생략) --port=3100
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const NEXT_DIR = path.join(APP, '.next')
const NEXT_BIN = path.join(APP, 'node_modules/next/dist/bin/next')
const args = new Set(process.argv.slice(2))
const PORT = Number([...args].find((a) => a.startsWith('--port='))?.slice(7) ?? 3100)

/** 실험실 주소 */
const LAB_ROUTES = ['/lab/style', '/lab/rooms', '/screens', '/dev/crash']
/**
 * 실험실 코드에만 있는 글 (파일마다 하나 이상). 실험실 파일을 고치면 여기도 확인
 * 주석은 빌드에서 빠지므로 문자열 값만 고름
 */
const NEEDLES = [
  ['components/LowLab.tsx', '땅굴을 별도 스레드에서 (시험판)'],
  ['components/ApiKnobBadge.tsx', '목 서버 손잡이 끄기'],
  ['screens/lab/StyleLab.tsx', '꾸미기 없음 (지금)'],
  ['screens/lab/RoomsLab.tsx', '?interests=소설,영화 · ?user=yerin'],
  ['screens/ScreenIndex.tsx', '탐색 시안 A · 들판 점프'],
  ['app/(app)/dev/crash/page.lab.tsx', '개발용: 화면 에러 경계 확인'],
]
/** 대조군: 빌드에 있어야 하는 글 (없으면 검색 방식이 틀린 것) */
const CONTROL = '잠시 문제가 생겼어요'

const problems = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 검사용 글이 아직 원본에 있는지 (원본 글이 바뀌었는데 여기만 남으면 검사가 늘 통과해 버림)
for (const [file, s] of NEEDLES) {
  const src = fs.readFileSync(path.join(APP, 'src', file), 'utf8')
  if (!src.includes(s)) problems.push(`검사 글이 원본에 없어요: ${file} 에 "${s}" → scripts/check-labs-off.mjs NEEDLES 를 고쳐 주세요`)
}

/* 1. 빌드 */
if (!args.has('--no-build')) {
  console.log('1) NEXT_PUBLIC_LABS=0 next build ...')
  const r = spawnSync(process.execPath, [NEXT_BIN, 'build'], { cwd: APP, stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_LABS: '0', NEXT_TELEMETRY_DISABLED: '1' } })
  if (r.status !== 0) { console.error('빌드 실패'); process.exit(1) }
}

/* 2. 라우트 목록 */
const manifest = JSON.parse(fs.readFileSync(path.join(NEXT_DIR, 'app-path-routes-manifest.json'), 'utf8'))
const routes = new Set(Object.values(manifest))
for (const r of LAB_ROUTES) if (routes.has(r)) problems.push(`빌드 라우트에 실험실 주소가 있어요: ${r} (NEXT_PUBLIC_LABS 가 켜진 빌드?)`)
console.log(`2) 라우트 ${routes.size}개 중 실험실 주소 ${LAB_ROUTES.filter((r) => routes.has(r)).length}개`)

/* 3. 404 */
const child = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(PORT), '-H', '127.0.0.1'], { cwd: APP, stdio: 'ignore', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } })
try {
  const base = `http://127.0.0.1:${PORT}`
  let up = false
  for (let i = 0; i < 300 && !up; i++) {
    try { up = (await fetch(`${base}/start`)).ok } catch { await sleep(100) }
  }
  if (!up) problems.push(`next start 가 포트 ${PORT} 에서 뜨지 않았어요`)
  else {
    for (const r of LAB_ROUTES) {
      const st = (await fetch(`${base}${r}`, { redirect: 'manual' })).status
      console.log(`3) ${r} → ${st}`)
      if (st !== 404) problems.push(`${r} 응답이 404 가 아니에요 (${st})`)
    }
    const ok = (await fetch(`${base}/burrow`)).status
    if (ok !== 200) problems.push(`대조군 /burrow 응답이 200 이 아니에요 (${ok})`)
  }
} finally { child.kill() }

/* 4. 결과물 글 검색 */
const esc = (s, upper) => [...s].map((c) => (c.charCodeAt(0) > 127 ? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}` : c)).join('')[upper ? 'replace' : 'toString'](/\\u([0-9a-f]{4})/g, (_, h) => `\\u${h.toUpperCase()}`)
const forms = (s) => [...new Set([s, esc(s, false), esc(s, true)])]
const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name)
    // .next/cache(빌드 캐시) · .next/dev(next dev 결과, 배포에 안 쓰임. next build 가 지우지 않음)는 건너뜀
    if (e.isDirectory()) { if (!(d === NEXT_DIR && (e.name === 'cache' || e.name === 'dev'))) walk(f) } else if (/\.(js|mjs|cjs|html|rsc|json|txt|map|css)$/.test(e.name)) files.push(f)
  }
}
walk(NEXT_DIR)
let control = false
const hits = new Map()
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  if (!control && forms(CONTROL).some((x) => text.includes(x))) control = true
  for (const [file, s] of NEEDLES) if (forms(s).some((x) => text.includes(x))) hits.set(file, [...(hits.get(file) ?? []), path.relative(APP, f)])
}
console.log(`4) .next 파일 ${files.length}개 검색 · 대조군 "${CONTROL}" ${control ? '있음' : '없음'}`)
if (!control) problems.push(`대조군 글 "${CONTROL}" 을 결과물에서 못 찾았어요 (검색 방식 확인 필요)`)
for (const [file, where] of hits) problems.push(`실험실 코드(${file})의 글이 결과물에 있어요: ${where.slice(0, 3).join(', ')}`)

if (problems.length) {
  console.error(`\n실패 ${problems.length}건`)
  for (const p of problems) console.error(`- ${p}`)
  process.exit(1)
}
console.log('\n통과: 실험실 주소 404 · 결과물에 실험실 코드 없음')
