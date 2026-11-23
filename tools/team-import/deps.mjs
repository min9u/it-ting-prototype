// frontend/ 파일 사이의 import 관계를 읽는다 (import.mjs 의 "닫힘 검사"와 계획 짤 때 씀)
// - 정적 import · export from · import() · import '...' · import.meta.glob · new URL('./x', import.meta.url) · CSS @import
// - 주소: 상대 경로, '@/…' (= src/…). 쿼리(?url)는 뗌. 확장자 · index 를 차례로 시도
// 사용: node tools/team-import/deps.mjs [frontend 폴더] [--json]  → 파일마다 의존 파일 목록
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const EXTS = ['', '.ts', '.tsx', '.js', '.mjs', '.json', '.css', '/index.ts', '/index.tsx']

/** 아주 단순한 glob → 정규식 (*, **, ?) */
export function globToRe(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*'
        i++
        if (glob[i + 1] === '/') i++
      } else re += '[^/]*'
    } else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

/** 주석을 지움. 문자열(' " `) 안은 그대로 둠 ('../x/*.webp' 같은 glob 이 주석으로 읽히지 않게) */
function stripComments(src) {
  let out = ''
  let q = null
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      out += c
      if (c === '\\') out += src[++i] ?? ''
      else if (c === q) q = null
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end < 0 ? src.length : end + 1
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i)
      i = end < 0 ? src.length : end - 1
      continue
    }
    if (c === "'" || c === '"' || c === '`') q = c
    out += c
  }
  return out
}

/**
 * @param {string} root frontend 폴더
 * @param {string[]} files root 기준 상대 경로 목록
 * @returns {Map<string, Set<string>>} 파일 → 의존 파일(상대 경로)
 */
export function buildGraph(root, files) {
  const set = new Set(files)
  const graph = new Map()
  const resolve = (from, spec) => {
    spec = spec.replace(/\?.*$/, '')
    let base
    if (spec.startsWith('@/')) base = path.posix.join('src', spec.slice(2))
    else if (spec.startsWith('.')) base = path.posix.join(path.posix.dirname(from), spec)
    else return null // 패키지
    for (const e of EXTS) if (set.has(base + e)) return base + e
    return `?missing:${base}`
  }
  for (const f of files) {
    const deps = new Set()
    graph.set(f, deps)
    if (!/\.(tsx?|mjs|js|css)$/.test(f) || f.startsWith('public/')) continue
    const raw = fs.readFileSync(path.join(root, f), 'utf8')
    const src = f.endsWith('.css') ? raw.replace(/\/\*[\s\S]*?\*\//g, '') : stripComments(raw)
    const specs = []
    if (f.endsWith('.css')) {
      for (const m of src.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)) specs.push(m[1])
      for (const m of src.matchAll(/composes:[^;]*from\s+['"]([^'"]+)['"]/g)) specs.push(m[1])
    } else {
      for (const m of src.matchAll(/(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]/g)) specs.push(m[1])
      for (const m of src.matchAll(/import\s*['"]([^'"]+)['"]/g)) specs.push(m[1])
      for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(m[1])
      for (const m of src.matchAll(/vi\.mock\(\s*['"]([^'"]+)['"]/g)) specs.push(m[1])
      for (const m of src.matchAll(/new URL\(\s*['"](\.[^'"]+)['"]\s*,\s*import\.meta\.url/g)) specs.push(m[1])
      for (const m of src.matchAll(/import\.meta\.glob(?:<[^>]*>)?\(\s*['"]([^'"]+)['"]/g)) {
        const g = m[1].startsWith('@/') ? path.posix.join('src', m[1].slice(2)) : path.posix.join(path.posix.dirname(f), m[1])
        const re = globToRe(g)
        for (const x of files) if (re.test(x)) deps.add(x)
      }
    }
    for (const s of specs) {
      const r = resolve(f, s)
      if (r) deps.add(r)
    }
  }
  return graph
}

export function trackedFiles(root) {
  // git 이 추적하는 파일만 (node_modules · .next 제외)
  const out = execGit(['ls-files', '-z', '--', '.'], root)
  return out.split('\0').filter(Boolean)
}

import { execFileSync } from 'node:child_process'
function execGit(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 << 20 })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? 'frontend')
  const files = trackedFiles(root)
  const g = buildGraph(root, files)
  if (process.argv.includes('--json')) console.log(JSON.stringify(Object.fromEntries([...g].map(([k, v]) => [k, [...v]])), null, 1))
  else for (const [k, v] of g) if (v.size) console.log(`${k}\n  ${[...v].join('\n  ')}`)
}
