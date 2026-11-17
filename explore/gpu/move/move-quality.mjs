// 이동 도중 화질 비교 묶음 (2026-11-17, docs/explore-move-quality.md)
// node explore/gpu/move/move-quality.mjs            → SHOTS 폴더에 png·json (있으면 건너뜀, FORCE=1 다시)
// PYTHONIOENCODING=utf-8 python -I explore/gpu/move/move-quality.py <SHOTS>   → results/move.json(quality) + results/move/*.webp
// 장면: 서울-2층 13번(내 구멍)에서 → 또는 ↑ 로 점프, 카메라 이동을 k = 0.25·0.5·0.75 에서 멈춤(?movefreeze), 그리고 도착 뒤 멈춘 화면(stop)
// 변형: gpu(가속 켬, 기준) · old(가속 끔, ?fslide=0 = 지금 main 과 같은 길: 이동 중 0.33배) · new(가속 끔 strong = gl 옮기기) · css(strong + 띠 밀기) · weak(?tier=weak = 띠 밀기 + MSAA 없는 굽기)
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'digul-move-shots')
const HOST = process.env.NEW || 'http://localhost:5351/#'
fs.mkdirSync(SHOTS, { recursive: true })
const VARIANTS = [['gpu', 'gpu', ''], ['old', 'hwoff', 'fslide=0&tier=strong'], ['new', 'hwoff', 'tier=strong'], ['css', 'hwoff', 'tier=strong&slidemode=css'], ['weak', 'hwoff', 'tier=weak']]
const CASES = []
for (const [dir, key] of [['r', 'ArrowRight'], ['u', 'ArrowUp']]) {
  for (const k of ['0_25', '0_5', '0_75']) CASES.push([`${dir}${k.replace('0_', '')}`, key, `movefreeze=${k}`])
  CASES.push([`${dir}stop`, key, ''])
}
const only = process.argv.slice(2)
for (const [label, key, extra] of CASES) {
  if (only.length && !only.includes(label)) continue
  for (const [v, mode, vq] of VARIANTS) {
    if ((v === 'weak' || v === 'css') && !['r5', 'u5', 'rstop'].includes(label)) continue
    const name = `${label}-${v}`
    if (fs.existsSync(path.join(SHOTS, name + '.png')) && !process.env.FORCE) continue
    const q = ['qshot=1', extra, vq].filter(Boolean).join('&')
    const url = `${HOST}/burrow/explore?${q}`
    try {
      const out = execFileSync('node', [path.join(here, 'move-shots.mjs'), SHOTS, name, mode, url, key], { encoding: 'utf8', env: { ...process.env, WAIT: '6000' }, stdio: ['ignore', 'pipe', 'ignore'], timeout: 240000 })
      console.log(out.trim().slice(0, 300))
    } catch (e) { console.log(name, '실패', String(e.message).slice(0, 200)) }
  }
}
