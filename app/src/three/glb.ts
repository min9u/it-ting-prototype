import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { testParam } from './engine'

/*
 * glb 불러오기 (같은 파일은 한 번만).
 * 공유 빌드(아티팩트)는 glb가 data URL로 JS에 들어옴 (vite.config.ts) → fetch 대신 직접 풀어서 parse (아티팩트 CSP 대비).
 *
 * Draco (3D 핸드오프 v3부터 *_draco_webp.glb 를 씀. WebP 텍스처는 GLTFLoader 기본 지원)
 * - glb 안 extensionsUsed 에 KHR_draco_mesh_compression 이 있을 때만 해독기를 준비함 (두더지·껍데기는 Draco 아님)
 * - 일반 빌드: three.js DRACOLoader + wasm 해독기(워커). 해독기 파일은 app/public/draco/ 에 복사해 둔 것
 *   (three/examples/jsm/libs/draco/gltf/ 에서 가져옴. three 버전을 올리면 같이 바꿀 것)
 * - 공유 빌드: 아티팩트는 .wasm·별도 파일 fetch·blob 워커가 막힐 수 있음
 *   → 순수 JS 해독기(draco_decoder.js, wasm2js)를 번들에 넣고 메인 스레드에서 풂 (./dracoMain.ts, 공유 빌드에서만 들어감)
 */
const cache = new Map<string, Promise<GLTF>>()
let draco: Promise<DRACOLoader> | null = null

function dracoLoader(): Promise<DRACOLoader> {
  if (!draco) {
    draco = import.meta.env.MODE === 'share'
      ? import('./dracoMain').then((m) => m.createMainThreadDracoLoader())
      : Promise.resolve(new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`).setDecoderConfig({ type: 'wasm' }))
  }
  return draco
}

/** glb JSON 덩어리에 Draco 확장이 쓰였는지 */
function usesDraco(buf: ArrayBuffer) {
  const v = new DataView(buf)
  if (buf.byteLength < 20 || v.getUint32(0, true) !== 0x46546c67) return false // 'glTF'
  const len = v.getUint32(12, true)
  const json = new TextDecoder().decode(new Uint8Array(buf, 20, Math.min(len, buf.byteLength - 20)))
  return json.includes('KHR_draco_mesh_compression')
}

async function bytesOf(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('data:')) {
    const b64 = url.slice(url.indexOf(',') + 1)
    // 브라우저 내장 base64 해독 (크롬 140+). 글자 하나씩 도는 atob 루프보다 훨씬 빠름 (docs/rendering-experiments.md 2번)
    const fromB64 = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array }).fromBase64
    if (fromB64 && testParam('b64') !== '0') return fromB64(b64).buffer as ArrayBuffer
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer
  }
  const r = await fetch(url)
  if (!r.ok) throw new Error(`glb 를 못 받았어요: ${url} (${r.status})`)
  return r.arrayBuffer()
}

export function loadGlb(url: string): Promise<GLTF> {
  let p = cache.get(url)
  if (!p) {
    p = (async () => {
      const buf = await bytesOf(url)
      const loader = new GLTFLoader()
      if (usesDraco(buf)) loader.setDRACOLoader(await dracoLoader())
      return loader.parseAsync(buf, '')
    })().catch((e) => { cache.delete(url); throw e })
    cache.set(url, p)
  }
  return p
}
