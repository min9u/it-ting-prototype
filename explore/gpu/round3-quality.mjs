// 그래픽 3차 화질 비교용 같은 장면 스크린샷 (2026-11-17, docs/rendering-experiments-3.md)
// node explore/gpu/round3-quality.mjs [화면 ...]
// 화면마다 변형: gpu(가속 켬 고화질 = 기준) · base(2차 결과, 가속 끔) · new(3차, 가속 끔, strong) · weak(3차, ?tier=weak) · c2(3차, 2코어)
// cdp-quality.mjs 로 찍어 SHOTS(기본 스크래치 폴더)에 png, 비교는 round3-quality.py
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'digul-round3-shots')
fs.mkdirSync(SHOTS, { recursive: true })
const BASE = process.env.BASE || 'http://localhost:5342/#'
const NEW = process.env.NEW || 'http://localhost:5341/#'
const SCREENS = {
  room: '/burrow?qshot=1',
  visit: '/burrow/yerin?qshot=1',
  explore: '/burrow/explore?qshot=1',
  onb: '/onboarding/preview?demo&qshot=1',
  landing: '/start',
  tea: '/chat/g-m1',
}
const VARIANTS = [
  ['gpu', 'gpu', NEW, ''],
  ['gpubase', 'gpu', BASE, ''], // GPU 에서 그림이 그대로인지 (2차 빌드 GPU 와 비교)
  ['base', 'hwoff', BASE, ''],
  ['new', 'hwoff', NEW, ''],
  ['weak', 'hwoff', NEW, 'tier=weak'],
]
const only = process.argv.slice(2)
for (const [screen, p] of Object.entries(SCREENS)) {
  if (only.length && !only.includes(screen)) continue
  for (const [label, mode, host, extra] of VARIANTS) {
    const name = `${screen}-${label}`
    if (fs.existsSync(path.join(SHOTS, name + '.png')) && !process.env.FORCE) continue
    const url = host + (extra ? p + (p.includes('?') ? '&' : '?') + extra : p)
    // 선명한 배경 굽기·찻방 예열이 끝날 때까지 (2코어 대비 넉넉히)
    const env = { ...process.env, OUT: SHOTS, WAIT: process.env.WAIT || '6000' }
    try {
      const out = execFileSync('node', [path.join(here, 'cdp-quality.mjs'), name, mode, url], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'ignore'], timeout: 300000 })
      console.log(name, out.trim().slice(0, 200))
    } catch (e) { console.log(name, '실패', String(e.message).slice(0, 200)) }
  }
}
