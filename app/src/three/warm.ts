import * as THREE from 'three'

/*
 * 예열 (docs/rendering-experiments.md 2번, -2.md, -3.md): 장면을 처음 그리기 전에
 * 1) 셰이더 미리 컴파일 (compileAsync: KHR_parallel_shader_compile 이 있으면(WARP 도 있음) 드라이버가 따로 하는 동안 메인 스레드가 놂)
 * 2) 텍스처를 한 장씩 나눠 올림
 * 3) 물체마다 1×1 영역에 한 번씩 그리기. 같은 셰이더·정점 형식 묶음은 하나만.
 *    프로그램을 처음 쓸 때 three 가 부르는 동기 호출(getProgramInfoLog 등)은 GPU 프로세스가 그 프로그램 링크·앞의 일을 끝낼 때까지
 *    기다림 (WARP 에서 프로그램 하나에 0.1~0.3초). 그래서 하나 그릴 때마다 펜스를 넣고 GPU 프로세스가 끝낼 때까지 비동기로
 *    기다린 뒤 다음 것 (waitGpu). 예전엔 25ms 씩 묶어 그려서 다음 묶음이 앞 묶음의 일을 기다리며 멈췄음
 *
 * 묶기 (3차, 2026-11-17): 3) 의 1×1 그리기는 셰이더가 이미 다 링크된 뒤라(1 이 끝날 때까지 기다림) 하나마다 펜스를 기다릴 필요가 적음.
 *   펜스 왕복이 한 번에 한 프레임쯤 걸려서(GPU 프로세스가 다른 일과 같이 돎) 물체가 많으면 예열이 길어졌음
 *   (탐색 들판 바꾸기 0.4 → 1.65초, 남의 땅굴 다 보이기까지 +0.7초). 그래서 메인 스레드 WARM_BATCH_MS 동안은 이어서 그리고 그 뒤에 한 번 기다림.
 *   시험용 ?wbatch=0 = 하나마다 기다림(11-16 방식), ?wbatch=<ms>
 *
 * split (3차): 저사양 A(배경 한 번)에서는 움직이지 않는 층(layer 0)은 배경 렌더 타깃에만, 움직이는 층(layer 1)은 캔버스에만 그려짐.
 *   예전엔 모든 물체를 두 군데 다 예열해서 쓰지 않는 셰이더 조합까지 링크를 기다렸음 (프로그램 수 2배) → 층마다 실제로 그려지는 곳만.
 *   카메라 층도 실제와 같게 (조명이 층으로 걸러져서 셰이더가 달라질 수 있음)
 */

/** 지금까지 건 GL 일을 GPU(프로세스)가 끝낼 때까지 비동기로 기다림 (펜스를 4ms 마다 확인, 메인 스레드는 막지 않음). 최대 3초 */
export function waitGpu(renderer: THREE.WebGLRenderer): Promise<void> {
  const gl = renderer.getContext() as WebGL2RenderingContext
  if (typeof gl.fenceSync !== 'function') return new Promise((r) => setTimeout(r, 0))
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
  if (!sync) return new Promise((r) => setTimeout(r, 0))
  gl.flush()
  const t0 = performance.now()
  return new Promise((resolve) => {
    const poll = () => {
      if (gl.isContextLost()) { resolve(); return }
      const st = gl.clientWaitSync(sync, 0, 0)
      if (st === gl.TIMEOUT_EXPIRED && performance.now() - t0 < 3000) { setTimeout(poll, 4); return }
      gl.deleteSync(sync)
      resolve()
    }
    setTimeout(poll, 0)
  })
}

const DYNAMIC = 1 << 1 // layer 1
/** 1×1 그리기를 이어서 하는 메인 스레드 시간 (ms). 넘으면 GPU 가 끝낼 때까지 한 번 기다림 */
const WARM_BATCH_MS = 8
const oneWait = () => { try { return !/[?&]wone=0\b/.test(location.search + location.hash) } catch { return true } }

/**
 * 렌더러가 만든 셰이더 프로그램이 모두 링크될 때까지 (KHR_parallel_shader_compile 의 완료 표시를 16ms 마다 확인, 메인 스레드는 놂). 최대 5초.
 * 확장이 없으면 three 가 바로 준비됨으로 봄
 */
export function programsReady(renderer: THREE.WebGLRenderer, dead: () => boolean = () => false): Promise<void> {
  const t0 = performance.now()
  return new Promise((resolve) => {
    const check = () => {
      if (dead()) { resolve(); return }
      const ps = (renderer.info.programs ?? []) as unknown as { isReady(): boolean }[]
      if (ps.every((p) => p.isReady()) || performance.now() - t0 > 5000) { resolve(); return }
      setTimeout(check, 16)
    }
    check()
  })
}

const batchMs = () => {
  try { const m = (location.search + location.hash).match(/[?&]wbatch=(\d+)/); return m ? +m[1] : WARM_BATCH_MS } catch { return WARM_BATCH_MS }
}

/**
 * @param o.split 배경 렌더 타깃 (저사양 A): layer 0 물체는 여기, layer 1 물체는 캔버스. 없으면 모두 캔버스(두 층 같이)
 * @param o.all 후처리(EffectComposer)처럼 장면 전체를 렌더 타깃에 그리는 경우 그 렌더 타깃 (GPU 옛 밭: 셰이더가 캔버스용과 다름)
 * @param o.roots 이 물체들만 (예: 나중에 불러온 두더지). 나머지는 그동안 숨김 → 그동안 보통 프레임은 쉬어야 함
 * @param o.extra 움직이지 않는 층(layer 0)을 여기에도 컴파일·그리기 (선명한 배경 굽기 렌더 타깃: 캔버스처럼 톤매핑·sRGB 셰이더, sharpBake warmTarget)
 * @param o.draw false 면 캔버스에는 1×1 그리기를 안 함 (컴파일·텍스처·렌더 타깃 그리기만). 캔버스가 이미 보이고 지난 그림을 남기지 않는
 *   렌더러는 캔버스에 1×1 만 그려도 지워진 화면이 보임
 */
export async function warmScene(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, o: {
  split?: THREE.WebGLRenderTarget | null
  extra?: THREE.WebGLRenderTarget | null
  all?: THREE.WebGLRenderTarget | null
  roots?: THREE.Object3D[]
  draw?: boolean
  dead?: () => boolean
} = {}) {
  const dead = o.dead ?? (() => false)
  const w0 = performance.now()
  const stat = { meshes: 0, texs: 0, compileMs: 0, texMs: 0, drawMs: 0, fences: 0 }
  const split = o.split ?? null
  const within = (ob: THREE.Object3D) => !o.roots || o.roots.some((r) => { for (let x: THREE.Object3D | null = ob; x; x = x.parent) if (x === r) return true; return false })
  const isDyn = (ob: THREE.Object3D) => (ob.layers.mask & DYNAMIC) !== 0
  /** 물체가 그려지는 곳과 그때 카메라 층 */
  const passOf = (ob: THREE.Object3D): { rt: THREE.WebGLRenderTarget | null; mask: number } =>
    o.all ? { rt: o.all, mask: 0xffffffff } : !split ? { rt: null, mask: 0xffffffff } : isDyn(ob) ? { rt: null, mask: DYNAMIC } : { rt: split, mask: 1 }

  // 같은 셰이더·같은 정점 형식·같은 그리는 곳이면 하나만
  const meshes: THREE.Mesh[] = [], seen = new Set<string>()
  scene.traverse((ob) => {
    const m = ob as THREE.InstancedMesh
    if (!m.isMesh || !within(ob)) return
    const attrs = Object.entries(m.geometry.attributes).map(([k, a]) => `${k}:${a.itemSize}:${(a as THREE.BufferAttribute).array?.constructor.name}`).sort().join()
    const mats = ([] as THREE.Material[]).concat(m.material).map((x) => x.uuid).join()
    const key = `${mats}|${m.isInstancedMesh ? 1 : 0}|${m.instanceColor ? 1 : 0}|${(m as unknown as THREE.SkinnedMesh).isSkinnedMesh ? 1 : 0}|${m.geometry.index?.array.constructor.name}|${attrs}|${isDyn(ob) ? 1 : 0}`
    if (seen.has(key)) return
    seen.add(key); meshes.push(m)
  })

  // 물체 × 그려지는 곳 (layer 0 은 extra 에도)
  const jobs = meshes.map((m) => ({ m, ...passOf(m) }))
  if (o.extra && split && !o.all) for (const m of meshes) if (!isDyn(m)) jobs.push({ m, rt: o.extra, mask: 1 })

  // 1) 셰이더: 그려지는 곳(렌더 타깃·층)마다 그 물체들만 컴파일하고 다 될 때까지 기다림
  const groups = new Map<string, { rt: THREE.WebGLRenderTarget | null; mask: number; list: THREE.Mesh[] }>()
  for (const j of jobs) {
    const k = `${j.rt ? j.rt.texture.uuid : 'canvas'}|${j.mask}`
    let g = groups.get(k)
    if (!g) groups.set(k, (g = { rt: j.rt, mask: j.mask, list: [] }))
    g.list.push(j.m)
  }
  const mask0 = camera.layers.mask
  if (oneWait()) {
    /*
     * 2026-11-17: 물체마다 compileAsync 를 부르면 물체마다 10ms 간격 확인 루프가 따로 돌아서(54개), 확인용 동기 호출
     * (COMPLETION_STATUS)이 셰이더 링크 중인 GPU 프로세스를 계속 붙잡아 컴파일이 오히려 느려졌음 (탐색 들판 바꾸기 예열 중 컴파일 1.0초).
     * 이제는 그려지는 곳마다 compile(동기, 컴파일만 걸어 둠)을 다 부르고, 렌더러의 프로그램 전부가 준비될 때까지 루프 하나로 기다림.
     * 시험용 ?wone=0 = 물체마다 compileAsync (11-16 방식)
     */
    for (const g of groups.values()) {
      const prev = renderer.getRenderTarget()
      renderer.setRenderTarget(g.rt)
      camera.layers.mask = g.mask
      for (const m of g.list) { try { renderer.compile(m, camera, scene) } catch { /* 셰이더 오류는 그릴 때 three 가 알림 */ } }
      camera.layers.mask = mask0
      renderer.setRenderTarget(prev)
    }
    await programsReady(renderer, dead)
    if (dead()) return
  } else {
    for (const g of groups.values()) {
      const prev = renderer.getRenderTarget()
      renderer.setRenderTarget(g.rt)
      camera.layers.mask = g.mask
      const ps = g.list.map((m) => renderer.compileAsync(m, camera, scene).catch(() => {}))
      camera.layers.mask = mask0
      renderer.setRenderTarget(prev)
      await Promise.all(ps)
      if (dead()) return
    }
  }
  stat.compileMs = Math.round(performance.now() - w0)
  // 2) 텍스처 한 장씩
  const texs = new Set<THREE.Texture>()
  for (const m of meshes) for (const mm of ([] as THREE.Material[]).concat(m.material)) for (const v of Object.values(mm)) if ((v as THREE.Texture)?.isTexture) texs.add(v as THREE.Texture)
  // 올리기(밉맵 만들기 포함)는 GPU 프로세스에서 하므로 한 장마다 끝날 때까지 비동기로 기다림 (안 그러면 다음 동기 호출이 그만큼 멈춤).
  // 2026-11-17: 8ms 씩 묶어 한 번만 기다리는 것도 해 봤는데, GPU(가속 켬) 탐색 들판에서 텍스처 2장 기다리기가 0.06 → 0.29초로 늘어
  // (다 보이기까지 +0.35초) 되돌림. 가속 끈 남의 땅굴(20장)에서 얻는 것은 0.1초 안팎이라 흔들림 안쪽 (docs/rendering-experiments-3.md 5-4)
  const t1 = performance.now()
  for (const t of texs) { if (dead()) return; renderer.initTexture(t); await waitGpu(renderer) }
  stat.texs = texs.size; stat.texMs = Math.round(performance.now() - t1)

  // 3) 하나씩 1×1 그리기. 보이는 것을 모두 숨기고 그 물체만 보이게 (부모가 숨어 있으면 안 그려지므로 조상도 잠깐)
  const all: THREE.Object3D[] = []
  scene.traverse((ob) => { if ((ob as THREE.Mesh).isMesh && ob.visible) all.push(ob) })
  const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear
  const vp = renderer.getViewport(new THREE.Vector4()), sc = renderer.getScissor(new THREE.Vector4()), scOn = renderer.getScissorTest()
  for (const m of all) m.visible = false
  const t2 = performance.now(), budget = batchMs()
  let b0 = performance.now()
  try {
    for (const { m, rt, mask } of jobs) {
      if (dead()) return
      if (o.draw === false && !rt) continue
      m.visible = true
      const hidden: THREE.Object3D[] = []
      for (let p = m.parent; p; p = p.parent) if (!p.visible) { hidden.push(p); p.visible = true }
      camera.layers.mask = mask
      renderer.autoClear = false
      renderer.setRenderTarget(rt)
      if (rt) { rt.viewport.set(0, 0, 1, 1); rt.scissor.set(0, 0, 1, 1); rt.scissorTest = true }
      else { renderer.setViewport(0, 0, 1, 1); renderer.setScissor(0, 0, 1, 1); renderer.setScissorTest(true) }
      renderer.render(scene, camera)
      if (rt) { rt.viewport.set(0, 0, rt.width, rt.height); rt.scissor.set(0, 0, rt.width, rt.height); rt.scissorTest = false }
      else { renderer.setViewport(vp); renderer.setScissor(sc); renderer.setScissorTest(scOn) }
      hidden.forEach((p) => { p.visible = false })
      m.visible = false
      camera.layers.mask = mask0
      stat.meshes++
      if (performance.now() - b0 >= budget) { stat.fences++; await waitGpu(renderer); b0 = performance.now() }
    }
    stat.fences++; await waitGpu(renderer)
  } finally {
    for (const m of all) m.visible = true
    camera.layers.mask = mask0
    renderer.setRenderTarget(prevTarget); renderer.autoClear = prevAuto
    renderer.setViewport(vp); renderer.setScissor(sc); renderer.setScissorTest(scOn)
  }
  stat.drawMs = Math.round(performance.now() - t2)
  const w = window as unknown as { __warmSteps?: unknown[] }
  ;(w.__warmSteps ??= []).push(stat) // 측정용
}
