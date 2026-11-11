// 브라우저를 그래픽 가속 설정별로 띄워 벤치를 돌린다 (serve.mjs 를 먼저 켜 둘 것)
// node explore/gpu/run.mjs <이름> <chrome|edge> <gpu|hwoff|nogpu> [headless|headed] [쿼리]
//   gpu   = 새 프로필 기본값
//   hwoff = 새 프로필 + Local State 의 "가능한 경우 그래픽 가속 사용" 꺼짐 (설정 화면 토글과 같은 값)
//   nogpu = --disable-gpu 플래그
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const [name, browser = 'chrome', mode = 'gpu', show = 'headless', query = ''] = process.argv.slice(2)
const exe = browser === 'edge'
  ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  : 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const prof = fs.mkdtempSync(path.join(process.env.BENCH_TMP || os.tmpdir(), 'gpuprof-'))
if (mode === 'hwoff') fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
const args = [`--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--window-size=1920,1080', '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
if (show === 'headless') args.push('--headless=new')
if (mode === 'nogpu') args.push('--disable-gpu')
const out = path.join(here, 'results', name + '.json')
try { fs.unlinkSync(out) } catch {}
const url = `http://127.0.0.1:5191/?name=${encodeURIComponent(name)}&${query}`
args.push(url)
const p = spawn(exe, args, { stdio: 'ignore' })
const t0 = Date.now()
const iv = setInterval(() => {
  const ok = fs.existsSync(out)
  if (ok || Date.now() - t0 > 180000) {
    clearInterval(iv)
    p.kill()
    setTimeout(() => {
      try { fs.rmSync(prof, { recursive: true, force: true }) } catch {}
      if (!ok) { console.log(name, 'TIMEOUT'); process.exit(1) }
      const j = JSON.parse(fs.readFileSync(out, 'utf8'))
      const d = j.detect || {}
      console.log(JSON.stringify({ name, wall: Math.round((Date.now() - t0) / 1000), renderer: d.webgl2?.unmaskedRenderer ?? d.webgl?.unmaskedRenderer ?? null, webgl2: !!d.webgl2, webgl: !!d.webgl, caveat: [d.caveat_webgl, d.caveat_webgl2], webgpu: d.webgpu, microMs: d.microMs, buildMs: j.buildMs, firstFrameMs: j.firstFrameMs, syncFrameMs: j.syncFrameMs, rafFps: j.rafFps, worstGapMs: j.worstGapMs, rafNote: j.rafNote, error: j.error, stats: j.stats }))
    }, 1500)
  }
}, 500)
