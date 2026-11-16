// 여러 주소를 차례로 cdp-scene.mjs 로 재고 한 줄 요약 (2026-11-16, docs/rendering-experiments-2.md)
// node explore/gpu/sweep.mjs <prefix> <gpu|hwoff> <scenario> <baseUrl> <label=쿼리> [label=쿼리 ...]
// 예: node explore/gpu/sweep.mjs pr hwoff idle "http://localhost:5301/#/burrow/explore?spin=1" base= pr03=pr=0_3
// 환경변수는 cdp-scene.mjs 로 그대로 넘어감 (REPS, AFF, LAB ...). 결과는 results/scene/<prefix>-<label>.json
import { execFileSync } from 'node:child_process'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const [prefix, mode, scenario, base, ...vars] = process.argv.slice(2)
const here = path.dirname(fileURLToPath(import.meta.url))
const rows = []
for (const v of vars) {
  const i = v.indexOf('='); const label = v.slice(0, i), q = v.slice(i + 1)
  const url = q ? base + (base.includes('?') ? '&' : '?') + q : base
  const outp = execFileSync('node', [path.join(here, 'cdp-scene.mjs'), `${prefix}-${label}`, mode, url, scenario], { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'ignore'], timeout: 900000 })
  const s = JSON.parse(outp.trim().split('\n').pop())
  const pick = (ph) => s[ph] ? `${ph}: scene ${s[ph].sceneFps} raf ${s[ph].rafFps} lt ${s[ph].longTaskMs} gpu% ${s[ph].cpuGpu} ren% ${s[ph].cpuRenderer} draws ${s[ph].drawsPerFrame ?? '-'} ktri ${s[ph].ktrisPerFrame ?? '-'} msCPU/f ${s[ph].sceneFps ? Math.round(s[ph].cpuGpu * 10 / s[ph].sceneFps) : '-'}${s[ph].panFps != null ? ` pan ${s[ph].panFps}fps gap${s[ph].panWorstGap}` : ''} sgap ${s[ph].sceneWorstGap} rgap ${s[ph].worstGap}` : ''
  const line = `${label.padEnd(12)} load ready ${s.load?.readyMs} lt ${s.load?.longTaskMs} max ${s.load?.longTaskMax} frz ${s.load?.worstFreezeMs}${s.load?.warmMs != null ? ` warm ${s.load.warmMs}` : ''} | ${['idle', 'hop', 'idle2', 'click', 'floor', 'send', 'walk', 'scroll'].map(pick).filter(Boolean).join(' | ')}${s.floorSwitchMs != null ? ` | floorSwitch ${s.floorSwitchMs}` : ''}${s.typeLatencyMs != null ? ` | type ${s.typeLatencyMs}` : ''}${s.roomReadyMs != null ? ` | roomReady ${s.roomReadyMs}` : ''}${s.captures ? ` | cap bd ${s.captures.bdMax} sharp ${s.captures.sharpMed}/${s.captures.sharpMax}` : ''}${s.nav ? ' | nav ' + s.nav.map((n) => `${n.to} ${n.switchMs}ms lt${n.longTaskMs}/${n.longTaskMax}`).join(', ') : ''}`
  console.log(line); rows.push(line)
}
