/// <reference lib="webworker" />
import { decoderModule, decodeGeometry, type TaskConfig } from './dracoCore'

/*
 * 공유 빌드 Draco 해독 Worker (dracoMain.ts 가 만듦, docs/rendering-experiments.md 2번).
 * 메시지 { id, buffer, cfg } → { id, data } (배열은 transfer) 또는 { id, error }
 */
const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (e: MessageEvent<{ id: number; buffer: ArrayBuffer; cfg: TaskConfig }>) => {
  const { id, buffer, cfg } = e.data
  try {
    const draco = await decoderModule()
    const decoder = new draco.Decoder()
    try {
      const data = decodeGeometry(draco, decoder, new Int8Array(buffer), cfg)
      const transfer: Transferable[] = data.attributes.map((a) => (a.array as unknown as { buffer: ArrayBuffer }).buffer)
      if (data.index) transfer.push(data.index.array.buffer as ArrayBuffer)
      scope.postMessage({ id, data }, transfer)
    } finally {
      draco.destroy(decoder)
    }
  } catch (err) {
    scope.postMessage({ id, error: String(err) })
  }
}
