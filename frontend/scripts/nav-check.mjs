#!/usr/bin/env node
/**
 * 화면 이동 어댑터(src/lib/nav.tsx) 동작 확인 — 헤드리스 크롬으로 실제 앱을 눌러 봄 (docs/nextjs-migration.md "라우팅")
 * react-router 에서 되던 것이 Next 위에서도 되는지:
 *   1. 저장 전 나가기 막기(useBlocker): 앱 안 링크 · 브라우저 뒤로가기 둘 다 (게시판 글쓰기)
 *   2. 이동 state(navigate(to, { state })): 로그인 → 회원가입 이메일 넘기기
 *   3. 주소 파라미터가 바뀌어도 화면 유지: 온보딩 단계 사이에서 입력값이 남는지
 *
 * 사용 (frontend/ 에서, 서버가 떠 있어야 함): node scripts/nav-check.mjs --url=http://127.0.0.1:3000
 * 크롬 경로는 CHROME=... (scripts/smoke.mjs 와 같음)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true] }))
const BASE = String(args.url ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const CHROME = process.env.CHROME ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome')

const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'digul-nav-'))
const chrome = spawn(CHROME, [`--user-data-dir=${prof}`, '--headless=new', '--no-first-run', '--window-size=1440,960', '--remote-debugging-port=0', 'about:blank', ...(process.env.CI ? ['--no-sandbox'] : [])], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((res, rej) => { let b = ''; chrome.stderr.on('data', (d) => { b += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(b); if (m) res(m[1]) }); setTimeout(() => rej(new Error('크롬이 안 떴어요')), 30000) })
const port = new URL(wsUrl).port
let page
for (let i = 0; i < 50 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page') } catch { /* 아직 */ } if (!page) await sleep(100) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  // 글쓰기 화면의 beforeunload 확인 창 등은 바로 수락 (다음 검사로 넘어가게)
  else if (m.method === 'Page.javascriptDialogOpening') ws.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: true } }))
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const until = async (expr, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await evaluate(expr)) return true; await sleep(150) } return false }
const open = async (p) => { const r = await send('Page.navigate', { url: `${BASE}${p}` }); if (r.error || r.result?.errorText) console.log('  이동 실패', p, JSON.stringify(r.error ?? r.result)); await until(`location.pathname === ${JSON.stringify(p.split('?')[0])}`, 10000); await sleep(300); await until("document.readyState === 'complete' && !!document.querySelector('#root > *')", 30000) }
const text = (s) => `(document.body.innerText || '').includes(${JSON.stringify(s)})`
const typeInto = async (selector, value) => {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`)
  await send('Input.insertText', { text: value })
}
const click = (expr) => evaluate(`(() => { const el = ${expr}; if (!el) return false; el.click(); return true })()`)
const byText = (tag, t) => `[...document.querySelectorAll(${JSON.stringify(tag)})].find((e) => e.textContent.trim().includes(${JSON.stringify(t)}))`
const pathNow = () => evaluate('location.pathname')

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'OK  ' : '실패'} ${name}${detail ? ` (${detail})` : ''}`) }

try {
  await send('Page.enable'); await send('Runtime.enable')

  // 1-a 앱 안 링크 막기: 글쓰기에 입력 → 헤더 "모임" → 확인 창, 주소 그대로 → 나가기 → /meetups
  await open('/board/write')
  await until("!!document.querySelector('input')", 15000)
  await typeInto('input', '쓰다 만 제목')
  await sleep(300)
  await click(byText('header a', '모임'))
  await sleep(800)
  const blocked = (await pathNow()) === '/board/write' && (await evaluate("!!document.querySelector('[role=dialog], [role=alertdialog]')"))
  check('글쓰기 중 헤더 링크 → 나가기 확인 창 (주소 그대로)', blocked, `${await pathNow()} · 입력 "${await evaluate("document.querySelector('input')?.value")}" · 창 ${await evaluate("document.querySelectorAll('[role=dialog]').length")}`)
  await click(`${byText('[role=dialog] button, [role=alertdialog] button', '나가기')}`)
  check('확인 창 "나가기" → 가려던 주소로', await until("location.pathname === '/meetups'"), await pathNow())

  // 1-b 브라우저 뒤로가기 막기: 게시판 → 글쓰기(앱 안 이동)에서 입력 후 history.back()
  await open('/board')
  await until("!!document.querySelector('a[href=\"/board/write\"]')")
  await click("document.querySelector('a[href=\"/board/write\"]')")
  await until("location.pathname === '/board/write' && !!document.querySelector('input')")
  await typeInto('input', '뒤로가기 시험')
  await sleep(300)
  await evaluate('history.back()')
  await sleep(1200)
  check('입력 중 브라우저 뒤로가기 → 나가기 확인 창 (주소 그대로)', (await pathNow()) === '/board/write' && await evaluate("!!document.querySelector('[role=dialog]')"), await pathNow())
  await click(byText('[role=dialog] button', '나가기'))
  check('"나가기" → 뒤로 간 주소(/board)', await until("location.pathname === '/board'"), await pathNow())

  // 2 이동 state: 로그인 화면 이메일 → "회원가입" 링크 → 회원가입 이메일 칸에 그대로
  await open('/login')
  await until("!!document.querySelector('input[type=email], input[name=email], input')")
  const emailSel = (await evaluate("!!document.querySelector('input[type=email]')")) ? 'input[type=email]' : 'input'
  await typeInto(emailSel, 'state@ssafy.com')
  await sleep(200)
  await click(byText('a', '회원가입'))
  await until("location.pathname === '/signup'")
  await sleep(600)
  check('로그인 → 회원가입 링크 state 로 이메일 넘김', await evaluate("[...document.querySelectorAll('input')].some((i) => i.value === 'state@ssafy.com')"))

  // 3 온보딩: 이름 입력 → 다음 단계 → 뒤로 → 이름이 남아 있음 (단계가 바뀌어도 화면 유지)
  await open('/onboarding/name')
  await until("!!document.querySelector('input')", 15000)
  await typeInto('input', '유지두더지')
  await sleep(300)
  const nextOk = await click(byText('button', '다음'))
  await until("location.pathname !== '/onboarding/name'", 6000)
  const moved = await pathNow()
  await evaluate('history.back()')
  await until("location.pathname === '/onboarding/name'")
  await sleep(500)
  check('온보딩 단계를 오가도 입력 유지', nextOk && moved !== '/onboarding/name' && await evaluate("[...document.querySelectorAll('input')].some((i) => i.value === '유지두더지')"), `다음 → ${moved}`)
} finally {
  ws.close(); chrome.kill(); await sleep(300); try { fs.rmSync(prof, { recursive: true, force: true }) } catch { /* 무시 */ }
}
const bad = results.filter((r) => !r.ok).length
console.log(`\n${results.length - bad}/${results.length} 통과`)
process.exit(bad ? 1 : 0)
