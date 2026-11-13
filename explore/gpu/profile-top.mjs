// cdp-load.mjs PROFILE=1 이 남긴 .cpuprofile 을 함수·파일별 자기 시간으로 요약
import fs from 'node:fs'
const p = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const byId = new Map(p.nodes.map((n) => [n.id, n])); const self = new Map()
const dt = p.timeDeltas; for (let i = 0; i < p.samples.length; i++) { const id = p.samples[i]; self.set(id, (self.get(id) ?? 0) + (dt[i] ?? 0) / 1000) }
const fn = new Map(), file = new Map()
for (const [id, ms] of self) { const n = byId.get(id); const cf = n.callFrame; const f = (cf.url.split('/').pop() || '(native)').replace(/-[\w-]{8}\.js/, '.js'); const k = `${cf.functionName || '(anon)'} @ ${f}`; fn.set(k, (fn.get(k) ?? 0) + ms); file.set(f, (file.get(f) ?? 0) + ms) }
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(0).padStart(6)}ms  ${k}`).join('\n')
console.log('== 파일별\n' + top(file, 12) + '\n== 함수별\n' + top(fn, 25))
// 가장 긴 연속 작업 구간(유휴 없이 이어진 샘플) 안의 함수별 시간 + 부모 체인
{
  const parent = new Map(); for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
  let t = p.startTime, best = null, cur = null
  for (let i = 0; i < p.samples.length; i++) {
    t += p.timeDeltas[i]; const n = byId.get(p.samples[i]); const idle = n.callFrame.functionName === '(idle)'
    if (!idle) { if (!cur) cur = { s: t, e: t, ids: [] }; cur.e = t; cur.ids.push([p.samples[i], p.timeDeltas[i + 1] ?? 0]) }
    else if (cur) { if (!best || cur.e - cur.s > best.e - best.s) best = cur; cur = null }
  }
  if (best) {
    const m = new Map()
    for (const [id, d] of best.ids) { let k = id, chain = []; while (k && chain.length < 14) { const cf = byId.get(k).callFrame; chain.push(cf.functionName || '(anon)'); k = parent.get(k) } const key = chain.slice(0, 12).join(' < '); m.set(key, (m.get(key) ?? 0) + d / 1000) }
    console.log(`== 가장 긴 연속 구간 ${((best.e - best.s) / 1000).toFixed(0)}ms (시작 ${((best.s - p.startTime) / 1000).toFixed(0)}ms)\n` + top(m, 15))
  }
}
