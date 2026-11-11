import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'

/*
 * glb 불러오기 (같은 파일은 한 번만).
 * 공유 빌드(아티팩트)는 glb가 data URL로 JS에 들어옴 (vite.config.ts) → fetch 대신 직접 풀어서 parse (아티팩트 CSP 대비).
 * 핸드오프 원본은 Draco 압축본을 권장하지만, 해독기(wasm)를 따로 올려야 해서 쓰지 않음.
 * 대신 압축 없는 원본에서 텍스처만 WebP로, 메시는 KHR_mesh_quantization 으로 줄여 씀 (둘 다 three.js 기본 지원).
 */
const cache = new Map<string, Promise<GLTF>>()

export function loadGlb(url: string): Promise<GLTF> {
  let p = cache.get(url)
  if (!p) {
    const loader = new GLTFLoader()
    p = (url.startsWith('data:')
      ? loader.parseAsync(Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0)).buffer, '')
      : loader.loadAsync(url)
    ).catch((e) => { cache.delete(url); throw e })
    cache.set(url, p)
  }
  return p
}
