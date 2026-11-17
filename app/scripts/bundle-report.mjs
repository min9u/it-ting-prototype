#!/usr/bin/env node
/**
 * 번들 크기 보고 · 예산 (docs/testing-ci.md)
 * 빌드 결과(dist/ 또는 dist-share/)의 파일별 크기(원본 · gzip)를 표로 만들고,
 * index.html 이 바로 불러오는 JS(+ 그 JS 가 정적으로 import 하는 청크) = "첫 화면 JS" 합계를 낸다.
 * 예산을 넘으면 경고 (GitHub Actions 에서는 ::warning 주석 + 작업 요약). --strict 면 종료 코드 1.
 *
 * 사용 (app/ 에서)
 *   npm run build && npm run bundle-report
 *   npm run bundle-report -- --dist=dist-share     # 공유 빌드 (glb 가 JS 안에 들어감)
 *   npm run bundle-report -- --md=bundle.md --json=bundle.json --strict
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true] }))
const DIST = path.resolve(APP, String(args.dist ?? 'dist'))
const SHARE = path.basename(DIST) === 'dist-share'

/**
 * 예산 (gzip KB) = "더 커지지 않게" 막는 선. 2026-11-16 실측(첫 화면 340 · 가장 큰 청크 270 · CSS 62 · 공유 glb 청크 1737)에
 * 5~10% 여유를 둠. 줄이는 목표(첫 화면 200 이하 등)는 docs/testing-ci.md "번들 크기" — 줄이면 이 값도 같이 낮출 것
 * - firstJs: 첫 화면에 실리는 JS 합계 (지금 라우트가 모두 정적 import 라 화면 코드 전부가 여기 들어감)
 * - chunk: 지연 로딩 JS 청크 하나 (three.js 본체 moleActor, Worker 실험용 roomScene 이 큼)
 * - css: CSS 합계 (Pretendard 동적 서브셋 @font-face 92개 포함)
 * - shareChunk: 공유 빌드에서 glb 를 data URL 로 품은 청크 하나 (아티팩트 한 파일 16MB 제한)
 */
const BUDGET = { firstJs: Number(args['budget-first'] ?? 360), chunk: Number(args['budget-chunk'] ?? 300), css: Number(args['budget-css'] ?? 70), shareChunk: Number(args['budget-share-chunk'] ?? 2000) }

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error(`${path.relative(APP, DIST)}/index.html 이 없어요. 먼저 npm run build${SHARE ? ':share' : ''}`)
  process.exit(2)
}

/* ---------- 파일 목록 ---------- */
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])) }
const rel = (f) => path.relative(DIST, f).split(path.sep).join('/')
const files = walk(DIST).filter((f) => !f.endsWith('.map')).map((f) => {
  const buf = fs.readFileSync(f)
  const ext = path.extname(f).slice(1)
  const compressible = ['js', 'mjs', 'css', 'html', 'json', 'svg', 'wasm', 'txt'].includes(ext)
  return { file: rel(f), ext, raw: buf.length, gz: compressible ? zlib.gzipSync(buf, { level: 9 }).length : buf.length, buf }
})
const byFile = new Map(files.map((f) => [f.file, f]))

/* ---------- 첫 화면 JS: index.html 의 module script + modulepreload + 그 JS 의 정적 import ---------- */
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
const norm = (u) => u.replace(/^\.?\//, '')
const entry = [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g), ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map((m) => norm(m[1]))
const cssFirst = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => norm(m[1]))
const first = new Set()
const staticImports = (f) => {
  const code = byFile.get(f)?.buf.toString('utf8') ?? ''
  const dir = path.posix.dirname(f)
  // import{a}from"./x.js" · import"./x.js" (import( 로 시작하는 동적 import 는 괄호 때문에 안 걸림)
  return [...code.matchAll(/\bimport\s*(?:[\w$*{}\s,]*?\bfrom\s*)?["'](\.{1,2}\/[^"']+\.js)["']/g)].map((m) => path.posix.normalize(path.posix.join(dir, m[1])))
}
const visit = (f) => { if (first.has(f) || !byFile.has(f)) return; first.add(f); staticImports(f).forEach(visit) }
entry.forEach(visit)

/* ---------- 표 ---------- */
const kb = (n) => (n / 1024).toFixed(1)
const js = files.filter((f) => f.ext === 'js').sort((a, b) => b.gz - a.gz)
const css = files.filter((f) => f.ext === 'css')
const other = files.filter((f) => !['js', 'css', 'html'].includes(f.ext)).sort((a, b) => b.raw - a.raw)
const sum = (l, k) => l.reduce((n, f) => n + f[k], 0)
const firstJs = js.filter((f) => first.has(f.file))
const lazyJs = js.filter((f) => !first.has(f.file))
const hasGlb = (f) => f.raw > 200 * 1024 && f.buf.includes('data:model/gltf-binary')

const warnings = []
const firstGz = sum(firstJs, 'gz') / 1024
if (firstGz > BUDGET.firstJs) warnings.push(`첫 화면 JS ${firstGz.toFixed(1)}KB(gzip) > 예산 ${BUDGET.firstJs}KB`)
if (sum(css, 'gz') / 1024 > BUDGET.css) warnings.push(`CSS 합계 ${kb(sum(css, 'gz'))}KB(gzip) > 예산 ${BUDGET.css}KB`)
for (const f of lazyJs) {
  const limit = hasGlb(f) ? BUDGET.shareChunk : BUDGET.chunk
  if (f.gz / 1024 > limit) warnings.push(`${f.file} ${kb(f.gz)}KB(gzip) > 청크 예산 ${limit}KB${hasGlb(f) ? ' (glb 내장)' : ''}`)
}

const lines = []
lines.push(`# 번들 크기 (${path.relative(APP, DIST)}${SHARE ? ', 공유 빌드' : ''})`, '')
lines.push(`| 구분 | 파일 수 | 원본 KB | gzip KB | 예산 (gzip) |`, '|---|---|---|---|---|')
lines.push(`| **첫 화면 JS** (index.html + 정적 import) | ${firstJs.length} | ${kb(sum(firstJs, 'raw'))} | **${kb(sum(firstJs, 'gz'))}** | ${BUDGET.firstJs} |`)
lines.push(`| 지연 로딩 JS | ${lazyJs.length} | ${kb(sum(lazyJs, 'raw'))} | ${kb(sum(lazyJs, 'gz'))} | 청크마다 ${BUDGET.chunk}${SHARE ? ` (glb 내장 ${BUDGET.shareChunk})` : ''} |`)
lines.push(`| CSS | ${css.length} | ${kb(sum(css, 'raw'))} | ${kb(sum(css, 'gz'))} | ${BUDGET.css} |`)
lines.push(`| 그 밖 (glb · 그림 · 글꼴 · wasm) | ${other.length} | ${kb(sum(other, 'raw'))} | ${kb(sum(other, 'gz'))} | — |`)
lines.push(`| 합계 | ${files.length} | ${kb(sum(files, 'raw'))} | ${kb(sum(files, 'gz'))} | |`, '')
lines.push('## JS 청크 (gzip 큰 순)', '', '| 청크 | 첫 화면 | 원본 KB | gzip KB | 비고 |', '|---|---|---|---|---|')
for (const f of js) {
  const note = [hasGlb(f) ? 'glb 내장' : '', f.gz / 1024 > (hasGlb(f) ? BUDGET.shareChunk : BUDGET.chunk) && !first.has(f.file) ? '⚠ 예산 초과' : ''].filter(Boolean).join(' · ')
  lines.push(`| \`${f.file}\` | ${first.has(f.file) ? '●' : ''} | ${kb(f.raw)} | ${kb(f.gz)} | ${note} |`)
}
lines.push('', '## 큰 파일 (JS · CSS 말고, 상위 15)', '', '| 파일 | 원본 KB |', '|---|---|')
for (const f of other.slice(0, 15)) lines.push(`| \`${f.file}\` | ${kb(f.raw)} |`)
if (other.length > 15) lines.push(`| … 그 밖 ${other.length - 15}개 | ${kb(sum(other.slice(15), 'raw'))} |`)
lines.push('', warnings.length ? `## 예산 초과 ${warnings.length}건\n\n${warnings.map((w) => `- ${w}`).join('\n')}` : '## 예산 안 ✅')
const md = lines.join('\n')
console.log(md)

if (args.md) fs.writeFileSync(path.resolve(String(args.md)), md)
if (args.json) fs.writeFileSync(path.resolve(String(args.json)), JSON.stringify({
  dist: rel(DIST), budget: BUDGET, firstJs: { files: firstJs.map((f) => f.file), raw: sum(firstJs, 'raw'), gz: sum(firstJs, 'gz') },
  css: { raw: sum(css, 'raw'), gz: sum(css, 'gz') }, files: files.map(({ buf: _b, ...f }) => ({ ...f, first: first.has(f.file) })), warnings,
}, null, 2))
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`)
if (process.env.GITHUB_ACTIONS) for (const w of warnings) console.log(`::warning title=번들 크기 예산::${w}`)
process.exit(warnings.length && args.strict ? 1 : 0)
