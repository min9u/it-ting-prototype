// 디버그용: 페이지와 그 Worker 의 콘솔·예외를 모아 출력 (2026-11-12, 땅굴 Worker 시험판 확인)
// node explore/gpu/cdp-console.mjs <gpu|hwoff> <url> [초=12]   (LAB='{"D":true}' 로 저사양 실험실 선택)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
const [mode, url, secs = '12'] = process.argv.slice(2)
const port = 9300 + Math.floor(Math.random() * 500)
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpprof-'))
if (mode === 'hwoff') fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
const chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [`--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--headless=new', '--no-first-run', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets; for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.length) break } catch {} await sleep(200) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pending = new Map()
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })) })
ws.addEventListener('message', async (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  const who = m.sessionId ? 'worker' : 'page'
  if (m.method === 'Target.attachedToTarget') { await send('Runtime.enable', {}, m.params.sessionId); await send('Runtime.runIfWaitingForDebugger', {}, m.params.sessionId); console.log('[attach]', m.params.targetInfo.type, m.params.targetInfo.url.slice(-60)) }
  if (m.method === 'Runtime.consoleAPICalled') console.log(`[${who} ${m.params.type}]`, m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 800))
  if (m.method === 'Runtime.exceptionThrown') console.log(`[${who} EXC]`, (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 1500))
})
await send('Runtime.enable'); await send('Page.enable')
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true })
if (process.env.LAB) await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('digul.lowlab.v2', ${JSON.stringify(process.env.LAB)})}catch(e){}` })
await send('Page.navigate', { url })
await sleep(Number(secs) * 1000)
// CLICK="x,y" 면 그 자리를 한 번 누르고 1초 기다림 (패널 열기 확인용)
if (process.env.CLICK) { const [x, y] = process.env.CLICK.split(',').map(Number); for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); await sleep(1000) }
const shot = await send('Page.captureScreenshot', { format: 'png' }); if (process.env.SHOT) fs.writeFileSync(process.env.SHOT, Buffer.from(shot.result.data, 'base64'))
ws.close(); chrome.kill(); await sleep(800); try { fs.rmSync(prof, { recursive: true, force: true }) } catch {}; process.exit(0)
