import { MOLE_FELT } from '../../../app/src/three/mole'
import { mountBench, type Quality } from './roomBench'
import { detectGpu } from './detect'

/*
 * 그래픽 가속 꺼짐 대응 실험: 땅굴 방 장면을 품질 설정별로 그려 속도를 잰다.
 * 쿼리: name, secs, ao, grade, composer, shadow(0|크기), st(soft|pcf|basic), pr, aa, env, points, shells, msaa, detectOnly
 * 결과는 serve.mjs 로 POST (results/<name>.json, .png)
 */
const P = new URLSearchParams(location.search)
const num = (k: string, d: number) => (P.has(k) ? Number(P.get(k)) : d)
const bool = (k: string, d: boolean) => (P.has(k) ? P.get(k) === '1' : d)
const name = P.get('name') || 'run'
const secs = num('secs', 8)
const q: Quality = {
  ao: bool('ao', true), grade: bool('grade', true), composer: bool('composer', true),
  shadow: num('shadow', 2048), shadowType: (P.get('st') as Quality['shadowType']) || 'soft',
  pr: num('pr', Math.min(devicePixelRatio || 1, 2)), aa: bool('aa', true), env: bool('env', true),
  points: bool('points', true), shells: num('shells', 12), msaa: num('msaa', 0),
}
const out: Record<string, unknown> = { name, q, ua: navigator.userAgent, dpr: devicePixelRatio, w: innerWidth, h: innerHeight }
const post = (body: unknown) => fetch('/result?name=' + encodeURIComponent(name), { method: 'POST', body: JSON.stringify(body) })
const log = (s: string) => { document.getElementById('log')!.textContent += s + '\n' }

async function run() {
  out.detect = await detectGpu()
  log(JSON.stringify(out.detect))
  if (P.get('detectOnly') === '1') { await post(out); return }
  ;(MOLE_FELT as unknown as { shells: number }).shells = q.shells
  const t0 = performance.now()
  let b: ReturnType<typeof mountBench>
  try { b = mountBench(document.getElementById('stage')!, q) } catch (e) { out.error = String(e); await post(out); return }
  const gl = b.renderer.getContext()
  const px = new Uint8Array(4)
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  out.buildMs = Math.round(performance.now() - t0)
  const t1 = performance.now(); b.render(0, 0); sync(); out.firstFrameMs = Math.round(performance.now() - t1)
  // 동기 측정: 그리기 + GPU(또는 소프트웨어 렌더러) 작업이 끝날 때까지 기다린 시간, 6번 중 중앙값
  const st: number[] = []
  for (let i = 0; i < 6; i++) { const s = performance.now(); b.render(1 / 30, 1 + i / 30); sync(); st.push(performance.now() - s) }
  st.sort((a, c) => a - c); out.syncFrameMs = Math.round(st[3] * 10) / 10
  out.stats = b.stats()
  // rAF 측정 (실제 화면 갱신 속도)
  await new Promise<void>((res) => {
    let n = 0, start = 0, last = 0, worst = 0, done = false
    const finish = (note?: string) => { if (done) return; done = true; const el = (performance.now() - start) / 1000 || secs; out.rafFps = Math.round(n / el * 10) / 10; out.rafFrames = n; out.worstGapMs = Math.round(worst); if (note) out.rafNote = note; res() }
    const tick = (now: number) => {
      if (done) return
      if (!start) { start = last = now; requestAnimationFrame(tick); return }
      const dt = now - last; worst = Math.max(worst, dt); last = now; n++
      b.render(Math.min(dt / 1000, .1), (now - start) / 1000)
      if (now - start < secs * 1000) requestAnimationFrame(tick)
      else finish()
    }
    requestAnimationFrame(tick)
    setTimeout(() => finish('rAF timeout'), secs * 1000 + 20000)
  })
  b.render(0, 2); out.shot = b.canvas.toDataURL('image/png')
  log(`fps ${out.rafFps} sync ${out.syncFrameMs}ms first ${out.firstFrameMs}ms`)
  await post(out)
}
run().catch(async (e) => { out.error = String((e as Error)?.stack || e); await post(out) })
