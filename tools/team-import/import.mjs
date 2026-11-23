#!/usr/bin/env node
/**
 * 이 리포의 frontend/ 를 팀 리포(it-ting-team/it-ting)에 작은 커밋 여러 개로 옮긴다 (docs/team-import-rehearsal.md)
 *
 * 사용 (이 리포 맨 위에서):
 *   node tools/team-import/import.mjs --dry-run                         계획만 검사 (파일 배정 · import 닫힘 · 제목 규칙)
 *   node tools/team-import/import.mjs --target <팀 리포 폴더> --branch chore/fe/KAN-<번호>-frontend-import
 *        [--base origin/dev] [--no-checks] [--from <번호>] [--log <파일>]
 *
 * - plan.json 의 커밋을 차례로 만든다. 파일은 처음 맞는 커밋의 files 패턴에 들어감 (먼저 맞은 것이 이김)
 * - stubs: 그 커밋에서만 임시 내용(tools/team-import/stubs/…)을 넣고, 진짜 파일은 나중 커밋이 덮어씀
 * - team: 팀 리포 파일 추가(copy) 또는 한 줄 바꾸기(edit)
 * - 커밋마다 (--no-checks 가 아니면) 커밋 전에 frontend/ 에서 tsc · lint(오류 0) · test · build (+ 있으면 실험실 빠짐 검사)
 *   실패하면 커밋하지 않고 멈춤 (바뀐 파일은 스테이징된 채로 남김)
 * - 커밋은 사용자의 git 설정대로 서명됨 (--no-gpg-sign · --no-verify 를 쓰지 않음). 푸시 · 원격 변경 없음
 * - 끝나면 팀 리포 frontend/ 가 이 리포 frontend/ 와 같은지 비교 (plan.json 의 의도한 차이만 허용)
 * --from N: 이미 N-1 번까지 만든 브랜치에 이어서 (브랜치를 새로 만들지 않음)
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGraph, globToRe, trackedFiles } from './deps.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
const SRC = path.join(REPO, 'frontend')
const TITLE_RE = /^(feat|fix|refactor|test|docs|chore): (?!.*KAN-\d)\S.{0,48}[^.]$/
const TRAILER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'

/* ---------- 인자 ---------- */
const argv = process.argv.slice(2)
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`)
  if (i >= 0) return argv[i + 1]
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  return eq ? eq.slice(name.length + 3) : def
}
const has = (name) => argv.includes(`--${name}`)
const DRY = has('dry-run')
const CHECKS = !has('no-checks')
const TARGET = opt('target') && path.resolve(opt('target'))
const BRANCH = opt('branch')
const BASE = opt('base', 'origin/dev')
const FROM = Number(opt('from', '1'))
const PLAN_PATH = path.resolve(opt('plan', path.join(HERE, 'plan.json')))
const LOG = opt('log') && path.resolve(opt('log'))

const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'))
const commits = plan.commits

/* ---------- 1. 계획 검사 ---------- */
const problems = []
const files = trackedFiles(SRC)
const owner = new Map() // 파일 → 커밋 번호(0부터)
const reOf = commits.map((c) => (c.files ?? []).map((g) => [g, globToRe(g)]))
const used = commits.map((c) => (c.files ?? []).map(() => 0))
for (const f of files) {
  for (let i = 0; i < commits.length && !owner.has(f); i++) {
    reOf[i].forEach(([, re], j) => {
      if (!owner.has(f) && re.test(f)) {
        owner.set(f, i)
        used[i][j]++
      }
    })
  }
  if (!owner.has(f)) problems.push(`어느 커밋에도 안 들어간 파일: ${f}`)
}
commits.forEach((c, i) => {
  reOf[i].forEach(([g], j) => used[i][j] === 0 && problems.push(`#${i + 1} 패턴이 아무 파일도 안 잡음: ${g}`))
  if (!TITLE_RE.test(c.title)) problems.push(`#${i + 1} 제목이 팀 규칙에 안 맞음: ${c.title}`)
  if ([...c.title.replace(/^\w+: /, '')].length > 50) problems.push(`#${i + 1} 제목 50자 넘음: ${c.title}`)
  if (!/(추가|수정|삭제)$/.test(c.title)) problems.push(`#${i + 1} 제목이 추가 · 수정 · 삭제로 안 끝남: ${c.title}`)
  for (const s of c.stubs ?? []) if (!fs.existsSync(path.join(HERE, s.from))) problems.push(`#${i + 1} 임시 파일 없음: ${s.from}`)
  for (const t of c.team ?? []) if (t.copy && !fs.existsSync(path.join(HERE, t.copy))) problems.push(`#${i + 1} 팀 파일 원본 없음: ${t.copy}`)
})
const byCommit = commits.map(() => [])
for (const [f, i] of owner) byCommit[i].push(f)
byCommit.forEach((l, i) => l.length === 0 && !(commits[i].team ?? []).length && problems.push(`#${i + 1} 파일이 없음`))

// import 닫힘: 커밋 i 까지 쌓인 파일만으로 모든 import 가 풀리는지 (임시 파일은 그 내용의 import 로)
const graph = buildGraph(SRC, files)
const stubGraph = new Map()
for (const c of commits) for (const s of c.stubs ?? []) {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'stub-'))
  fs.mkdirSync(path.dirname(path.join(tmp, s.path)), { recursive: true })
  fs.copyFileSync(path.join(HERE, s.from), path.join(tmp, s.path))
  const g = buildGraph(tmp, [s.path])
  stubGraph.set(`${c.title}::${s.path}`, [...g.get(s.path)])
  fs.rmSync(tmp, { recursive: true })
}
const have = new Set()
commits.forEach((c, i) => {
  for (const f of byCommit[i]) have.add(f)
  const stubs = new Map((c.stubs ?? []).map((s) => [s.path, s]))
  for (const s of stubs.values()) have.add(s.path)
  const check = [...byCommit[i], ...[...stubs.keys()]]
  for (const f of check) {
    const deps = stubs.has(f) && !byCommit[i].includes(f) ? stubGraph.get(`${c.title}::${f}`) : graph.get(f)
    for (const d of deps ?? []) {
      if (d.startsWith('?missing')) continue // frontend 밖 (vitest.config 의 './src' 같은 것)
      if (!have.has(d)) problems.push(`#${i + 1} ${f} 가 아직 없는 ${d} 를 씀 (커밋 #${(owner.get(d) ?? -1) + 1})`)
    }
  }
})
// 임시 파일은 나중 커밋이 진짜로 바꿔야 함
commits.forEach((c, i) => {
  for (const s of c.stubs ?? []) {
    const j = owner.get(s.path)
    if (j == null || j <= i) problems.push(`#${i + 1} 임시 파일 ${s.path} 를 나중에 바꾸는 커밋이 없음`)
  }
})

const pad = (s, n) => String(s).padEnd(n)
if (DRY || problems.length) {
  commits.forEach((c, i) => {
    const n = byCommit[i].length
    console.log(`${pad(`#${i + 1}`, 4)} ${pad(n, 4)} ${c.title}${c.stubs ? '  [임시: ' + c.stubs.map((s) => s.path).join(', ') + ']' : ''}${c.team ? '  [팀 파일: ' + c.team.map((t) => t.path).join(', ') + ']' : ''}`)
    if (has('verbose')) for (const f of byCommit[i].sort()) console.log(`        ${f}`)
  })
  console.log(`파일 ${files.length}개 · 커밋 ${commits.length}개`)
}
if (problems.length) {
  console.error(`\n계획 문제 ${problems.length}개:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
if (DRY) {
  console.log('계획 검사 통과')
  process.exit(0)
}

/* ---------- 2. 팀 리포에 커밋 만들기 ---------- */
if (!TARGET || !BRANCH) {
  console.error('--target 과 --branch 가 필요해요 (또는 --dry-run)')
  process.exit(2)
}
const git = (args, opts = {}) => execFileSync('git', args, { cwd: TARGET, encoding: 'utf8', maxBuffer: 64 << 20, ...opts }).trim()
const dirtySrc = execFileSync('git', ['status', '--porcelain', '--', 'frontend', 'tools/team-import'], { cwd: REPO, encoding: 'utf8' }).trim()
if (dirtySrc && !has('allow-dirty')) {
  console.error(`이 리포 frontend/ 나 tools/team-import/ 에 커밋 안 한 변경이 있어요 (--allow-dirty 로 무시):\n${dirtySrc}`)
  process.exit(2)
}
if (git(['status', '--porcelain'])) {
  console.error(`팀 리포 작업 트리가 깨끗하지 않아요: ${TARGET}`)
  process.exit(2)
}
if (FROM === 1) {
  git(['switch', '-c', BRANCH, BASE])
} else {
  if (git(['rev-parse', '--abbrev-ref', 'HEAD']) !== BRANCH) git(['switch', BRANCH])
}
const srcHead = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim()

const FE = path.join(TARGET, 'frontend')
const log = { source: srcHead, branch: BRANCH, base: BASE, started: new Date().toISOString(), node: process.version, commits: [] }
const saveLog = () => LOG && fs.writeFileSync(LOG, JSON.stringify(log, null, 2))
let lastLockHash = null

function sh(cmd, args, cwd) {
  const t0 = Date.now()
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 256 << 20, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', FORCE_COLOR: '0', NO_COLOR: '1' } })
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, sec: Math.round((Date.now() - t0) / 100) / 10 }
}

function runChecks() {
  const res = {}
  const lock = path.join(FE, 'package-lock.json')
  const lockHash = fs.existsSync(lock) ? execFileSync('git', ['hash-object', lock], { encoding: 'utf8' }).trim() : null
  if (lockHash && (lockHash !== lastLockHash || !fs.existsSync(path.join(FE, 'node_modules')))) {
    const r = sh('npm', ['ci', '--no-audit', '--no-fund'], FE)
    res.npmCi = { ok: r.ok, sec: r.sec }
    if (!r.ok) return [false, res, r.out]
    lastLockHash = lockHash
  }
  // 지난 빌드가 남긴 라우트 타입이 tsc 에 섞이지 않게
  fs.rmSync(path.join(FE, '.next/types'), { recursive: true, force: true })
  fs.rmSync(path.join(FE, '.next/dev'), { recursive: true, force: true })
  let r = sh('npx', ['tsc', '--noEmit'], FE)
  res.tsc = { ok: r.ok, sec: r.sec }
  if (!r.ok) return [false, res, r.out]
  r = sh('npm', ['run', 'lint'], FE)
  const m = /(\d+) problems? \((\d+) errors?, (\d+) warnings?\)/.exec(r.out)
  res.lint = { ok: r.ok, errors: m ? +m[2] : 0, warnings: m ? +m[3] : 0, sec: r.sec }
  if (!r.ok) return [false, res, r.out]
  const hasTests = fs.existsSync(path.join(FE, 'src')) && trackedLike(FE).some((f) => /\.test\.ts$/.test(f))
  r = hasTests ? sh('npm', ['test'], FE) : sh('npx', ['vitest', 'run', '--passWithNoTests'], FE)
  const tf = /Test Files\s+(\d+) passed/.exec(r.out)
  const tt = /Tests\s+(\d+) passed(?: \| (\d+) todo)?/.exec(r.out)
  res.test = { ok: r.ok, files: tf ? +tf[1] : 0, passed: tt ? +tt[1] : 0, todo: tt?.[2] ? +tt[2] : 0, sec: r.sec, none: !hasTests }
  if (!r.ok) return [false, res, r.out]
  r = sh('npm', ['run', 'build'], FE)
  const routes = (r.out.match(/^[├└┌]\s+[○ƒ●◐]\s+\//gm) ?? []).length
  res.build = { ok: r.ok, routes, sec: r.sec }
  if (!r.ok) return [false, res, r.out]
  if (fs.existsSync(path.join(FE, 'scripts/check-labs-off.mjs'))) {
    r = sh('npm', ['run', 'check:labs-off', '--', '--no-build'], FE)
    res.labsOff = { ok: r.ok, sec: r.sec }
    if (!r.ok) return [false, res, r.out]
  }
  return [true, res, '']
}
/** 팀 리포 frontend/ 안의 파일 목록 (스테이징 포함) */
function trackedLike(dir) {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '.'], { cwd: dir, encoding: 'utf8', maxBuffer: 64 << 20 })
    .split('\0')
    .filter(Boolean)
}

function copyIn(rel, from) {
  const dst = path.join(FE, rel)
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(from, dst)
}

const t0 = Date.now()
for (let i = FROM - 1; i < commits.length; i++) {
  const c = commits[i]
  const ts = Date.now()
  const touched = []
  for (const f of byCommit[i]) {
    const override = (plan.overrides ?? {})[f]
    copyIn(f, override ? path.join(HERE, override) : path.join(SRC, f))
    touched.push(`frontend/${f}`)
  }
  for (const s of c.stubs ?? []) {
    if (byCommit[i].includes(s.path)) continue
    copyIn(s.path, path.join(HERE, s.from))
    touched.push(`frontend/${s.path}`)
  }
  for (const t of c.team ?? []) {
    const dst = path.join(TARGET, t.path)
    if (t.copy) {
      fs.mkdirSync(path.dirname(dst), { recursive: true })
      fs.copyFileSync(path.join(HERE, t.copy), dst)
    } else if (t.edit) {
      const before = fs.readFileSync(dst, 'utf8')
      if (before.split(t.edit.old).length !== 2) {
        console.error(`#${i + 1} ${t.path} 에서 바꿀 줄을 정확히 하나 찾지 못함: ${t.edit.old}`)
        process.exit(1)
      }
      fs.writeFileSync(dst, before.replace(t.edit.old, t.edit.new))
    }
    touched.push(t.path)
  }
  git(['add', '--', ...touched])
  const entry = { n: i + 1, title: c.title, files: byCommit[i].length, stubs: (c.stubs ?? []).map((s) => s.path), team: (c.team ?? []).map((t) => t.path) }
  process.stdout.write(`#${i + 1} ${c.title} (파일 ${byCommit[i].length}) `)
  if (CHECKS) {
    const [ok, res, out] = runChecks()
    entry.checks = res
    if (!ok) {
      log.commits.push(entry)
      log.failedAt = i + 1
      saveLog()
      console.log('→ 검사 실패, 커밋하지 않고 멈춤\n')
      console.log(out.split('\n').slice(-60).join('\n'))
      process.exit(1)
    }
  }
  const msg = [c.title, '', ...(c.body ? [c.body, ''] : []), TRAILER, ''].join('\n')
  const msgFile = path.join(TARGET, '.git', 'TEAM_IMPORT_MSG')
  fs.writeFileSync(msgFile, msg)
  git(['commit', '-q', '-F', msgFile])
  fs.rmSync(msgFile)
  entry.sha = git(['rev-parse', '--short', 'HEAD'])
  entry.signed = git(['log', '-1', '--format=%G?'])
  entry.sec = Math.round((Date.now() - ts) / 1000)
  log.commits.push(entry)
  saveLog()
  const ch = entry.checks
  console.log(
    `→ ${entry.sha} ${entry.signed}` +
      (ch ? ` · tsc ${ch.tsc.ok ? 'OK' : 'X'} · lint 오류 ${ch.lint.errors} 경고 ${ch.lint.warnings} · test ${ch.test.none ? '없음' : `${ch.test.files}파일 ${ch.test.passed}개`} · build ${ch.build.ok ? 'OK' : 'X'}${ch.labsOff ? ' · labs-off OK' : ''}` : '') +
      ` · ${entry.sec}s`,
  )
}

/* ---------- 3. 끝 상태 비교 ---------- */
const diffs = []
const teamFiles = new Set(execFileSync('git', ['ls-files', '-z', '--', '.'], { cwd: FE, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter(Boolean))
for (const f of files) {
  if (!teamFiles.has(f)) {
    diffs.push(`없음: ${f}`)
    continue
  }
  const a = fs.readFileSync(path.join(SRC, f))
  const b = Buffer.from(execFileSync('git', ['show', `HEAD:frontend/${f}`], { cwd: TARGET, maxBuffer: 64 << 20 }))
  if (a.equals(b)) continue
  const why = (plan.intendedDiffs ?? {})[f]
  if (why) diffs.push(`의도한 차이: ${f} (${why})`)
  else if (a.toString('latin1').replace(/\r\n/g, '\n') === b.toString('latin1')) diffs.push(`줄바꿈만 다름(CRLF→LF, 팀 .gitattributes): ${f}`)
  else diffs.push(`다름: ${f}`)
}
for (const f of teamFiles) if (!files.includes(f)) diffs.push(`팀 리포에만 있음: ${f}`)
log.finalDiff = diffs
log.totalSec = Math.round((Date.now() - t0) / 1000)
log.finished = new Date().toISOString()
saveLog()
console.log(`\n끝: 커밋 ${commits.length - FROM + 1}개 · ${Math.round(log.totalSec / 60)}분 · frontend/ 비교:`)
console.log(diffs.length ? `- ${diffs.join('\n- ')}` : '- 모두 같음')
const bad = diffs.filter((d) => !d.startsWith('의도한') && !d.startsWith('줄바꿈만'))
process.exit(bad.length ? 1 : 0)
