// 가속 끈 헤드리스 크롬에서 식 하나를 평가해 출력 (기능 지원 확인용)
// node explore/gpu/cdp-eval.mjs <url> <expression>
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
const [url, expr] = process.argv.slice(2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpeval-'))
fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
const port = 9800 + Math.floor(Math.random() * 100)
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [`--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--headless=new', '--no-first-run', url], { stdio: 'ignore' })
let t; for (let i = 0; i < 50; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (t.length) break } catch {} await sleep(200) }
await sleep(1500)
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id === 1) { console.log(JSON.stringify(m.result?.result?.value ?? m.result, null, 1)); ws.close(); chrome.kill(); setTimeout(() => process.exit(0), 500) } })
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }))
