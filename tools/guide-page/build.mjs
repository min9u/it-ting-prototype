// docs/frontend-guide.md + docs/frontend-guide-concepts.md → 아티팩트용 웹 페이지 한 장
// 사용: node tools/guide-page/build.mjs [출력 파일]   (기본 tools/guide-page/out/frontend-guide.html)
// 외부 패키지 없이 이 두 문서가 쓰는 마크다운만 처리함: 제목 · 문단 · 목록(2칸 들여쓰기) · 표 · 코드 블록 · 줄 · 링크 · 굵게 · 코드
// 문서 사이 링크는 페이지 안 이동으로, 다른 docs/ 문서는 GitHub 링크로 바꿈. 제목 id 는 ASCII(g-12, c-3)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const out = path.resolve(process.argv[2] ?? path.join(here, 'out', 'frontend-guide.html'))
const GH = 'https://github.com/min9u/it-ting-prototype/blob/main/'

const DOCS = [
  { prefix: 'g', file: 'docs/frontend-guide.md', label: '가이드', note: '왜 이 기술을 썼고, 어떤 사고가 있었나' },
  { prefix: 'c', file: 'docs/frontend-guide-concepts.md', label: '개념 학습', note: '개념 → 이 프로젝트에서는 → 직접 해 볼 것' },
]
const byFile = Object.fromEntries(DOCS.map((d) => [path.basename(d.file), d]))
const warnings = []

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s) => esc(s).replace(/"/g, '&quot;')

/* ---------- 제목 id: GitHub 방식 slug → ASCII id ---------- */
const plain = (s) => s.replace(/`([^`]*)`/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
const ghSlug = (s) => plain(s).trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '').replace(/ /g, '-')

for (const d of DOCS) {
  d.src = fs.readFileSync(path.join(root, d.file), 'utf8').replace(/\r\n/g, '\n')
  d.slugs = new Map()   // github slug → ascii id
  d.heads = []          // { level, text, id }
  const seen = new Map()
  let inFence = false, n = 0
  for (const line of d.src.split('\n')) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const m = /^(#{1,6})\s+(.*)$/.exec(line)
    if (!m) continue
    const base = ghSlug(m[2])
    const k = seen.get(base) ?? 0
    seen.set(base, k + 1)
    const slug = k ? `${base}-${k}` : base
    const id = `${d.prefix}-${++n}`
    d.slugs.set(slug, id)
    d.heads.push({ level: m[1].length, text: m[2], id })
  }
}

/* ---------- 링크 바꾸기 ---------- */
function rewrite(href, doc) {
  if (/^https?:/.test(href)) return { href, ext: true }
  const [p, hash = ''] = href.split('#')
  const target = p ? byFile[path.basename(p)] && !p.includes('/') ? byFile[path.basename(p)] : null : doc
  if (target) {
    if (!hash) return { href: `#${target.prefix}-top` }
    const id = target.slugs.get(decodeURIComponent(hash))
    if (!id) warnings.push(`앵커 없음: ${href} (${doc.file})`)
    return { href: `#${id ?? target.prefix + '-top'}` }
  }
  // 그 밖의 저장소 파일 → GitHub
  const rel = path.posix.normalize(path.posix.join('docs', p))
  return { href: GH + rel + (hash ? `#${hash}` : ''), ext: true }
}

/* ---------- 인라인 ---------- */
function inline(text, doc) {
  const slots = []
  const keep = (html) => `\u0000${slots.push(html) - 1}\u0000`
  let s = text.replace(/(`+)([\s\S]*?)\1/g, (_, __, code) => keep(`<code>${esc(code)}</code>`))
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const r = rewrite(href, doc)
    return keep(`<a href="${escAttr(r.href)}"${r.ext ? ' target="_blank" rel="noopener"' : ''}>${inlineRest(label, slots)}</a>`)
  })
  s = inlineRest(s, slots)
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[+i])
}
function inlineRest(s, slots) {
  const keep = (html) => `\u0000${slots.push(html) - 1}\u0000`
  // 맨 주소는 링크로 (이미 바꾼 링크·코드는 자리표시로 빠져 있음)
  s = s.replace(/https?:\/\/[A-Za-z0-9\-._~:/?#@!$&'*+,;=%]*[A-Za-z0-9\-_~/#=%&]/g, (u) => keep(`<a href="${escAttr(u)}" target="_blank" rel="noopener">${esc(u)}</a>`))
  s = s.split(/(\u0000\d+\u0000)/).map((part) => (/^\u0000\d+\u0000$/.test(part) ? part : esc(part))).join('')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  return s
}

/* ---------- 표 ---------- */
function splitRow(line) {
  const cells = []
  let cur = '', tick = false
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === '\\' && body[i + 1] === '|') { cur += '|'; i++; continue }
    if (ch === '`') tick = !tick
    if (ch === '|' && !tick) { cells.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  cells.push(cur.trim())
  return cells
}
const CHIP = [
  [/^높음$/, 'sev-high'], [/^중간$/, 'sev-mid'], [/^낮음$/, 'sev-low'],
  [/^(대부분 해결|공유본 해결)/, 'st-partial'], [/^해결/, 'st-done'], [/^예방/, 'st-prevent'], [/^운영 규칙/, 'st-rule'],
]
function table(rows, doc) {
  const head = splitRow(rows[0])
  const align = splitRow(rows[1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : ''))
  const chipCols = new Set(head.map((h, i) => (/^(상태|심각도)$/.test(plain(h)) ? i : -1)).filter((i) => i >= 0))
  const caseCol = head[0] === '#' ? head.findIndex((h) => plain(h) === '사건') : -1
  const th = head.map((h, i) => `<th${align[i] ? ` style="text-align:${align[i]}"` : ''}>${inline(h, doc)}</th>`).join('')
  const tr = rows.slice(2).map((r) => {
    const cells = splitRow(r)
    return `<tr>${cells.map((c, i) => {
      let html = inline(c, doc)
      if (chipCols.has(i)) { const hit = CHIP.find(([re]) => re.test(plain(c))); if (hit) html = `<span class="chip ${hit[1]}">${html}</span>` }
      if (i === caseCol) {
        const num = plain(cells[0]).trim()
        const h = doc.heads.find((x) => new RegExp(`^사건 ${num}\\.`).test(plain(x.text)))
        if (h) html = `<a href="#${h.id}">${html}</a>`
      }
      return `<td${align[i] ? ` style="text-align:${align[i]}"` : ''}>${html}</td>`
    }).join('')}</tr>`
  }).join('\n')
  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>\n${tr}\n</tbody></table></div>`
}

/* ---------- 블록 ---------- */
const indentOf = (l) => l.match(/^ */)[0].length
const LIST = /^( *)([-*]|\d+\.) +(.*)$/
const isBlockStart = (l) => /^\s*```/.test(l) || /^#{1,6}\s/.test(l) || /^---+\s*$/.test(l) || /^\s*\|/.test(l) || LIST.test(l)

function blocks(lines, doc, ctx) {
  const html = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    // 코드 블록
    const fence = /^( *)```(\S*)\s*$/.exec(line)
    if (fence) {
      const ind = fence[1].length, body = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { body.push(lines[i].slice(Math.min(ind, indentOf(lines[i])))); i++ }
      i++
      html.push(`<pre${fence[2] ? ` data-lang="${escAttr(fence[2])}"` : ''}><code>${esc(body.join('\n'))}</code></pre>`)
      continue
    }
    // 제목
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      const head = doc.heads[ctx.head++]
      const lv = h[1].length
      const inner = inline(h[2], doc)
      const caseM = lv === 4 && /^사건 (\d+)\.\s*/.exec(plain(h[2]))
      const body = caseM ? `<span class="case-no">사건 ${caseM[1]}</span>${inline(h[2].replace(/^사건 \d+\.\s*/, ''), doc)}` : inner
      html.push(`<h${lv} id="${head.id}">${body}</h${lv}>`)
      i++
      continue
    }
    if (/^---+\s*$/.test(line)) { html.push('<hr>'); i++; continue }
    // 표
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const rows = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++])
      html.push(table(rows, doc))
      continue
    }
    // 목록
    const lm = LIST.exec(line)
    if (lm) {
      const base = lm[1].length
      const ordered = /\d/.test(lm[2])
      const items = []
      let cur = null
      while (i < lines.length) {
        const l = lines[i]
        const m = LIST.exec(l)
        if (m && m[1].length === base && /\d/.test(m[2]) === ordered) {
          cur = { start: m[2], lines: [m[3]], width: m[2].length + 1 }
          items.push(cur); i++; continue
        }
        if (!l.trim()) {
          // 빈 줄 뒤에 같은 목록이나 들여쓴 줄이 이어지면 계속
          let j = i + 1
          while (j < lines.length && !lines[j].trim()) j++
          const next = lines[j]
          const nm = next && LIST.exec(next)
          if (next && (indentOf(next) > base || (nm && nm[1].length === base && /\d/.test(nm[2]) === ordered))) { cur.lines.push(''); i++; continue }
          break
        }
        if (indentOf(l) > base) { cur.lines.push(l.slice(Math.min(indentOf(l), base + Math.max(2, Math.min(cur.width, indentOf(l) - base))))); i++; continue }
        break
      }
      const tag = ordered ? 'ol' : 'ul'
      const start = ordered && items[0].start !== '1.' ? ` start="${parseInt(items[0].start, 10)}"` : ''
      html.push(`<${tag}${start}>${items.map((it) => `<li>${blocks(it.lines, doc, { head: ctx.head, tight: true })}</li>`).join('')}</${tag}>`)
      continue
    }
    // 문단
    const para = []
    while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i]))) para.push(lines[i++].trim())
    const text = inline(para.join(' '), doc)
    html.push(ctx.tight && !html.length ? text : `<p>${text}</p>`)
  }
  return html.join('\n')
}
// 제목은 목록 밖에만 있으므로 ctx.head 는 바깥 블록에서만 늘어남
function render(doc) {
  const ctx = { head: 0, tight: false }
  const lines = doc.src.split('\n')
  const html = blocks(lines, doc, ctx)
  if (ctx.head !== doc.heads.length) warnings.push(`${doc.file}: 제목 ${doc.heads.length}개 중 ${ctx.head}개만 그림`)
  return html
}

/* ---------- 목차 ---------- */
function toc(doc) {
  const items = []
  let open = false
  for (const h of doc.heads) {
    if (h.level === 2) {
      if (/^목차$/.test(plain(h.text))) continue
      if (open) items.push('</ul></li>')
      items.push(`<li><a href="#${h.id}" data-lv="2">${esc(plain(h.text))}</a><ul>`)
      open = true
    } else if (h.level === 3 && open) {
      items.push(`<li><a href="#${h.id}" data-lv="3">${esc(plain(h.text))}</a></li>`)
    }
  }
  if (open) items.push('</ul></li>')
  return `<section class="toc-doc"><a class="toc-doc-title" href="#${doc.prefix}-top">${doc.label}</a><p class="toc-doc-note">${doc.note}</p><ul class="toc-list">${items.join('')}</ul></section>`
}

const articles = DOCS.map((d) => `<article class="doc" id="${d.prefix}-top" aria-label="${d.label}">\n${render(d)}\n</article>`)
const tpl = fs.readFileSync(path.join(here, 'template.html'), 'utf8')
const built = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })
const page = tpl
  .replace('<!--TOC-->', DOCS.map(toc).join('\n'))
  .replace('<!--GUIDE-->', articles[0])
  .replace('<!--CONCEPTS-->', articles[1])
  .replace('<!--BUILT-->', esc(built))
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, page)
console.log(`${out} (${Math.round(page.length / 1024)}KB)`)
for (const w of warnings) console.warn('경고:', w)
