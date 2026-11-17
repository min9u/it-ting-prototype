import * as THREE from 'three'

/*
 * 선명한 배경 굽기 (docs/rendering-experiments-3.md 1·3번). 땅굴 방 S·탐색 들판 S 가 같이 씀.
 *
 * 움직이지 않는 층(layer 0)을 화면 해상도(기기 배율, 1배)로 렌더 타깃에 그리고, 다 되면 톤매핑·sRGB 를 한 번에 해서
 * 비동기로(PBO + fence) 읽어 2D 캔버스에 넣는다. 저사양(WARP)에서 WebGL 캔버스는 0.55배 그대로 두고 두더지만 그리고,
 * 그 뒤 2D 캔버스에 이 선명한 그림을 깐다.
 *
 * 예전(2차)과 다른 점
 * - 띠로 나누기(strips): 한 프레임에 띠 하나만 그림 (scissor). WARP 는 픽셀 처리가 병목이라 띠 하나의 일이 그만큼 작아져서,
 *   CPU 가 약한 PC(2코어)에서 고해상도 그림 한 장(0.3~0.5초) 동안 3D(두더지)가 통째로 밀리던 것이 여러 프레임으로 나뉨
 * - 렌더 타깃이라 캔버스 크기를 바꾸지 않음 → 굽는 동안에도 두더지 층은 그대로 그림 (예전엔 캔버스를 1배로 키웠다 되돌림)
 * - MSAA(samples 4): GPU 화면(안티앨리어싱 켬)과 같은 방식으로 가장자리를 매끈하게. 땅굴의 1.5배 슈퍼샘플(픽셀 2.2배)보다 쌈
 * - 땅굴은 예전엔 그 자리에서 읽어(drawImage) 메인 스레드가 그림을 기다렸음 (16스레드 0.13초, 2코어 0.5초) → 비동기
 *
 * 색 공간 (2026-11-17 고침): 처음엔 선형(HalfFloat) 렌더 타깃에 그리고 마지막에 톤매핑·sRGB 를 한 번에 했는데, 그러면 반투명 물체가
 *   **선형 공간에서 섞여** 캔버스(sRGB 공간에서 섞임)와 달라짐 → 땅굴 가구 밑 그림자 판(shadow_*)이 거의 사라졌음 (화질 비교에서 발견).
 *   이제는 렌더 타깃을 캔버스처럼 다룸: isXRRenderTarget + colorSpace sRGB 로 three 가 재질 셰이더 안에서 톤매핑·sRGB 를 하게 하고,
 *   저장 형식은 RGBA8 로 못 박아(internalFormat, 하드웨어 sRGB 변환 없음) 캔버스와 같은 값·같은 섞임. 반으로 줄어든 픽셀 크기(16 → 8비트)도 덤.
 *   이 렌더 타깃용 셰이더는 캔버스용과 같아서, 저사양(layer 0 은 배경 렌더 타깃에만 그림)에서는 따로 예열해야 함 → warmTarget() 을 warm.ts extra 로.
 *   시험용 ?bakelin=1 = 예전(선형 + 마지막 톤매핑)
 * 렌더 타깃 내용은 (MSAA 가장자리·바깥 투명 때문에) 알파가 곱해진 색이라 마지막 한 번에 알파로 나눠 2D 캔버스(곱해지지 않은 색)에
 */
export interface BakeOptions {
  /** MSAA 샘플 수 (0 = 없음) */
  samples: number
  /** 몇 프레임에 나눠 그릴지 (1 = 한 번에) */
  strips: number
  /** true = 예전 방식(선형 HalfFloat 에 그리고 마지막에 톤매핑·sRGB). 기본 false = 캔버스처럼 (위 설명) */
  linear?: boolean
}

/** 캔버스처럼 다루는 렌더 타깃 (재질 셰이더가 톤매핑·sRGB, 저장은 RGBA8 그대로). 위 "색 공간" 설명 */
function displayTarget(w: number, h: number, samples: number, depth: boolean) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, internalFormat: 'RGBA8', depthBuffer: depth, samples })
  ;(rt as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true
  return rt
}

export interface SharpBaker {
  /** 예열: 아주 작은 크기로 한 번 구워 톤매핑 셰이더·MSAA 렌더 타깃 준비 (들어올 때 예열 단계에서, 첫 굽기가 멈추지 않게) */
  warm(scene: THREE.Scene, camera: THREE.Camera): void
  /**
   * 굽기 시작 (진행 중이던 것은 버림). w·h = 결과 그림 크기(기기 픽셀). 카메라·장면은 끝날 때까지 그대로여야 함 (바뀌면 cancel).
   * into: 이번 결과를 넣을 2D 캔버스 (없으면 기본 결과 캔버스). 탐색 들판이 도착할 자리를 지금 그림을 둔 채 따로 구울 때 (docs/explore-move-quality.md)
   */
  start(scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, into?: HTMLCanvasElement): void
  /**
   * 매 프레임 한 번: 띠 하나를 그리거나, 다 그렸으면 읽기를 걸거나, 읽기가 끝났으면 2D 캔버스에 넣음.
   * 반환: 'idle' 할 일 없음 · 'busy' 진행 중 · 'done' 이번에 2D 캔버스에 그림이 들어감
   */
  step(): 'idle' | 'busy' | 'done'
  busy(): boolean
  cancel(): void
  dispose(): void
  /** 마지막으로 다 구운 시간 (start → 2D 캔버스, ms. 측정·느린 PC 판단용) */
  readonly lastMs: number
  /** 결과 2D 캔버스 (처음 start 때 만듦) */
  readonly canvas: HTMLCanvasElement | null
  /**
   * 결과 캔버스의 2D 컨텍스트를 얻지 못해 굽기를 그만둠 (가속 끈 크롬에서 페이지를 떠나는 도중 등, 2026-11-17 스모크에서 발견).
   * 이후 start 는 아무것도 안 함 → 부르는 쪽은 선명한 배경 없이 원래대로 WebGL 캔버스에 전부 그림
   */
  readonly broken: boolean
  /** 예열용: 굽는 렌더 타깃과 같은 종류의 작은 렌더 타깃 (셰이더 종류가 같음, warm.ts extra) */
  warmTarget(): THREE.WebGLRenderTarget
}

const QUAD_VS = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

export function createSharpBaker(renderer: THREE.WebGLRenderer, o: BakeOptions, out: () => HTMLCanvasElement): SharpBaker {
  let rtScene: THREE.WebGLRenderTarget | null = null
  let rtOut: THREE.WebGLRenderTarget | null = null
  let job: { scene: THREE.Scene; camera: THREE.Camera; w: number; h: number; i: number; t0: number; into?: HTMLCanvasElement } | null = null
  let pending: { pbo: WebGLBuffer; sync: WebGLSync; w: number; h: number; t0: number; into?: HTMLCanvasElement } | null = null
  let lastMs = 0
  let canvas: HTMLCanvasElement | null = null
  let broken = false
  const strips = Math.max(1, Math.round(o.strips))
  const linear = !!o.linear
  let warmRt: THREE.WebGLRenderTarget | null = null

  // 톤매핑 + sRGB (renderer 와 같은 함수, three 의 tonemapping_pars_fragment 를 그대로 씀. 노출값 이름만 바꿈)
  const tm = renderer.toneMapping === THREE.AgXToneMapping ? 'AgXToneMapping' : renderer.toneMapping === THREE.NeutralToneMapping ? 'NeutralToneMapping'
    : renderer.toneMapping === THREE.ACESFilmicToneMapping ? 'ACESFilmicToneMapping' : renderer.toneMapping === THREE.NoToneMapping ? '' : 'LinearToneMapping'
  const mat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: null }, uExposure: { value: renderer.toneMappingExposure } },
    vertexShader: QUAD_VS,
    fragmentShader: /* glsl */`
      #define toneMappingExposure uExposure
      #include <tonemapping_pars_fragment>
      uniform sampler2D tColor;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tColor, vUv);
        vec3 rgb = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
        ${linear ? `${tm ? `rgb = ${tm}(rgb);` : ''}
        gl_FragColor = vec4(sRGBTransferOETF(vec4(rgb, 1.0)).rgb, c.a);` : 'gl_FragColor = vec4(rgb, c.a);'}
      }`,
    depthTest: false, depthWrite: false, toneMapped: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  const quadScene = new THREE.Scene(); quadScene.add(quad)
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const ensure = (w: number, h: number) => {
    if (!rtScene || rtScene.width !== w || rtScene.height !== h) {
      rtScene?.dispose()
      rtScene = linear ? new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true, samples: o.samples }) : displayTarget(w, h, o.samples, true)
    }
    if (!rtOut || rtOut.width !== w || rtOut.height !== h) {
      rtOut?.dispose()
      rtOut = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false })
    }
    mat.uniforms.tColor.value = rtScene.texture
  }
  const gl = renderer.getContext() as WebGL2RenderingContext
  const dropPending = () => {
    if (!pending) return
    gl.deleteSync(pending.sync); gl.deleteBuffer(pending.pbo)
    pending = null
  }

  /** 띠 하나 (아래에서 위로, GL 좌표) */
  const drawStrip = () => {
    const j = job!, rt = rtScene!
    const bh = Math.ceil(j.h / strips), y0 = j.i * bh
    const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear
    const cam = j.camera, mask = cam.layers.mask
    cam.layers.set(0)
    rt.viewport.set(0, 0, j.w, j.h)
    rt.scissor.set(0, y0, j.w, Math.min(bh, j.h - y0))
    rt.scissorTest = strips > 1
    renderer.setRenderTarget(rt)
    renderer.autoClear = true
    renderer.render(j.scene, cam)
    rt.scissorTest = false
    rt.scissor.set(0, 0, j.w, j.h)
    renderer.setRenderTarget(prevTarget)
    renderer.autoClear = prevAuto
    cam.layers.mask = mask
    j.i++
  }
  /** 다 그렸으면: 톤매핑해서 rtOut 에, 그리고 비동기 읽기를 걸어 둠 */
  const finish = () => {
    const j = job!, ro = rtOut!
    const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear
    renderer.setRenderTarget(ro)
    renderer.autoClear = true
    renderer.render(quadScene, quadCam)
    const pbo = gl.createBuffer()!
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo)
    gl.bufferData(gl.PIXEL_PACK_BUFFER, j.w * j.h * 4, gl.STREAM_READ)
    gl.readPixels(0, 0, j.w, j.h, gl.RGBA, gl.UNSIGNED_BYTE, 0)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!
    gl.flush()
    renderer.setRenderTarget(prevTarget)
    renderer.autoClear = prevAuto
    pending = { pbo, sync, w: j.w, h: j.h, t0: j.t0, into: j.into }
    job = null
  }
  /** 읽기가 끝났으면 2D 캔버스로 (위아래 뒤집어서) */
  const poll = (): boolean => {
    const pd = pending!
    const st = gl.clientWaitSync(pd.sync, 0, 0)
    if (st !== gl.ALREADY_SIGNALED && st !== gl.CONDITION_SATISFIED) return false
    const data = new Uint8Array(pd.w * pd.h * 4)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pd.pbo)
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    const t0 = pd.t0, into = pd.into
    dropPending()
    const img = new ImageData(pd.w, pd.h), row = pd.w * 4
    for (let y = 0; y < pd.h; y++) img.data.set(data.subarray((pd.h - 1 - y) * row, (pd.h - y) * row), y * row)
    const cv = into ?? (canvas ??= out())
    if (cv.width !== pd.w || cv.height !== pd.h) { cv.width = pd.w; cv.height = pd.h }
    const ctx = cv.getContext('2d')
    if (!ctx) { broken = true; return false } // 2D 컨텍스트를 못 얻음 → 이 그림은 버리고 굽기를 그만둠 (broken)
    ctx.putImageData(img, 0, 0)
    lastMs = performance.now() - t0
    return true
  }

  return {
    warm(scene, camera) {
      ensure(2, 2)
      job = { scene, camera, w: 2, h: 2, i: 0, t0: performance.now() }
      const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear
      while (job.i < strips) drawStrip()
      renderer.setRenderTarget(rtOut)
      renderer.autoClear = true
      renderer.render(quadScene, quadCam)
      renderer.setRenderTarget(prevTarget)
      renderer.autoClear = prevAuto
      job = null
    },
    start(scene, camera, w, h, into) {
      dropPending()
      if (broken) return
      ensure(w, h)
      if (!into) canvas ??= out()
      job = { scene, camera, w, h, i: 0, t0: performance.now(), into }
    },
    step() {
      if (pending) return poll() ? 'done' : 'busy'
      if (!job) return 'idle'
      drawStrip()
      if (job.i >= strips) finish()
      return 'busy'
    },
    busy: () => !!job || !!pending,
    cancel() { job = null; dropPending() },
    dispose() {
      job = null; dropPending()
      rtScene?.dispose(); rtOut?.dispose(); warmRt?.dispose(); rtScene = rtOut = warmRt = null
      quad.geometry.dispose(); mat.dispose()
    },
    get lastMs() { return lastMs },
    get canvas() { return canvas },
    get broken() { return broken },
    warmTarget() {
      return (warmRt ??= linear ? new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: true }) : displayTarget(2, 2, 0, true))
    },
  }
}
