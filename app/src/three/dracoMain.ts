import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import type { GeoData, TaskConfig } from './dracoCore'
import { testParam } from './engine'

/*
 * 공유 빌드(아티팩트) 전용 Draco 해독 — glb.ts 가 공유 빌드에서만 불러옴.
 * three.js DRACOLoader 는 해독기 파일을 fetch 해서 blob 워커로 돌리는데, 아티팩트에서는 .wasm·blob 워커가 막힐 수 있어서
 * 순수 JS 해독기(dracoCore.ts)를 번들에 넣어 씀.
 * - 2026-11-13 (docs/rendering-experiments.md 2번): 빌드에 들어간 module Worker(dracoWorker.ts)에서 풀어 메인 스레드를 비움.
 *   Worker 를 못 만들거나 실패하면 예전처럼 메인 스레드에서 풂. 시험용 ?dracow=0 으로 끔
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Worker 하나 (해독기 초기화 비용이 있어서 재사용). null = 못 씀 → 메인 스레드 */
let worker: Worker | null | undefined
let seq = 0
const waits = new Map<number, { ok: (d: GeoData) => void; fail: (e: unknown) => void }>()

function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  if (typeof Worker === 'undefined' || testParam('dracow') === '0') return (worker = null)
  try {
    const w = new Worker(new URL('./dracoWorker.ts', import.meta.url), { type: 'module', name: 'draco' })
    w.onmessage = (e: MessageEvent<{ id: number; data?: GeoData; error?: string }>) => {
      const p = waits.get(e.data.id); if (!p) return
      waits.delete(e.data.id)
      if (e.data.data) p.ok(e.data.data); else p.fail(new Error(e.data.error))
    }
    w.onerror = (e) => {
      // 시작부터 막힘 (CSP 등) → 이후는 메인 스레드, 기다리던 것도 메인 스레드로 다시
      console.warn('[3D] Draco Worker 를 못 써서 메인 스레드에서 풀어요', e.message)
      worker = null
      for (const p of waits.values()) p.fail(new Error('worker'))
      waits.clear()
    }
    worker = w
  } catch (e) {
    console.warn('[3D] Draco Worker 를 못 만들어서 메인 스레드에서 풀어요', e)
    worker = null
  }
  return worker
}

/** 메인 스레드 해독 (Worker 를 못 쓸 때만 해독기를 불러옴 → 평소엔 메인 스레드가 해독기 455KB 를 읽지 않음) */
function decodeHere(buffer: ArrayBuffer, cfg: TaskConfig): Promise<GeoData> {
  return import('./dracoCore').then(({ decoderModule, decodeGeometry }) => decoderModule().then((draco) => {
    const decoder = new draco.Decoder()
    try { return decodeGeometry(draco, decoder, new Int8Array(buffer), cfg) } finally { draco.destroy(decoder) }
  }))
}

function decodeInWorker(buffer: ArrayBuffer, cfg: TaskConfig): Promise<GeoData> {
  const w = getWorker()
  if (!w) return decodeHere(buffer, cfg)
  const id = ++seq
  // buffer 는 glb 안 조각을 복사한 것이라 넘겨도(transfer) 됨
  const copy = buffer.slice(0)
  return new Promise<GeoData>((ok, fail) => {
    waits.set(id, { ok, fail })
    w.postMessage({ id, buffer: copy, cfg }, [copy])
  }).catch(() => decodeHere(buffer, cfg))
}

class SharedDracoLoader extends DRACOLoader {
  preload() { getWorker(); return this }
  // GLTFLoader 가 부르는 decodeDracoFile → decodeGeometry 를 여기서 처리
  decodeGeometry(buffer: ArrayBuffer, taskConfig: TaskConfig) {
    return decodeInWorker(buffer, taskConfig).then((data) => (this as any)._createGeometry(data))
  }
}

export function createMainThreadDracoLoader(): DRACOLoader {
  return new SharedDracoLoader()
}
