import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
// 순수 JS(wasm2js) Draco 해독기. three/examples/jsm/libs/draco/gltf/draco_decoder.js 를 ES 모듈로 복사한 것
import DracoDecoderModule from './draco/draco_decoder.js'

/*
 * 공유 빌드(아티팩트) 전용 Draco 해독 — glb.ts 가 공유 빌드에서만 불러옴.
 * three.js DRACOLoader 는 해독기 파일을 fetch 해서 blob 워커로 돌리는데, 아티팩트에서는
 * 별도 파일 fetch·.wasm·blob 워커가 막힐 수 있어서 같은 해독 코드를 메인 스레드에서 돌림.
 * 해독 함수는 DRACOLoader 의 워커 코드(decodeGeometry·decodeIndex·decodeAttribute)를 그대로 옮김.
 * 우리 방 모델은 합쳐서 수십만 꼭짓점 정도라 메인 스레드에서도 한 번에 끝남.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Draco = any
interface TaskConfig { attributeIDs: Record<string, number | string>; attributeTypes: Record<string, string>; useUniqueIDs: boolean; vertexColorSpace: string }
interface GeoData { index: { array: Uint32Array; itemSize: number } | null; attributes: { name: string; array: ArrayLike<number>; itemSize: number; vertexColorSpace?: string }[] }

let modulePending: Promise<Draco> | null = null
function decoderModule(): Promise<Draco> {
  if (!modulePending) {
    modulePending = new Promise((resolve) => {
      // Module 은 then 이 있는 객체라 그대로 resolve 하면 무한히 기다림 → 감싸서 넘김 (DRACOLoader 워커와 같음)
      ;(DracoDecoderModule as any)({ onModuleLoaded: (draco: Draco) => resolve({ draco }) })
    }).then((m: any) => m.draco)
  }
  return modulePending
}

const ARRAYS: Record<string, any> = { Float32Array, Int8Array, Int16Array, Int32Array, Uint8Array, Uint16Array, Uint32Array }

function dataType(draco: Draco, T: any) {
  switch (T) {
    case Float32Array: return draco.DT_FLOAT32
    case Int8Array: return draco.DT_INT8
    case Int16Array: return draco.DT_INT16
    case Int32Array: return draco.DT_INT32
    case Uint8Array: return draco.DT_UINT8
    case Uint16Array: return draco.DT_UINT16
    case Uint32Array: return draco.DT_UINT32
  }
}

function decodeIndex(draco: Draco, decoder: Draco, geo: Draco) {
  const n = geo.num_faces() * 3, bytes = n * 4
  const ptr = draco._malloc(bytes)
  decoder.GetTrianglesUInt32Array(geo, bytes, ptr)
  const index = new Uint32Array(draco.HEAPF32.buffer, ptr, n).slice()
  draco._free(ptr)
  return { array: index, itemSize: 1 }
}

function decodeAttribute(draco: Draco, decoder: Draco, geo: Draco, name: string, T: any, attribute: Draco) {
  const comps = attribute.num_components(), n = geo.num_points() * comps, bytes = n * T.BYTES_PER_ELEMENT
  const ptr = draco._malloc(bytes)
  decoder.GetAttributeDataArrayForAllPoints(geo, attribute, dataType(draco, T), bytes, ptr)
  const array = new T(draco.HEAPF32.buffer, ptr, n).slice()
  draco._free(ptr)
  return { name, array, itemSize: comps }
}

function decodeGeometry(draco: Draco, decoder: Draco, array: Int8Array, cfg: TaskConfig): GeoData {
  let geo: Draco, status: Draco
  const type = decoder.GetEncodedGeometryType(array)
  if (type === draco.TRIANGULAR_MESH) { geo = new draco.Mesh(); status = decoder.DecodeArrayToMesh(array, array.byteLength, geo) }
  else if (type === draco.POINT_CLOUD) { geo = new draco.PointCloud(); status = decoder.DecodeArrayToPointCloud(array, array.byteLength, geo) }
  else throw new Error('THREE.DRACOLoader: Unexpected geometry type.')
  if (!status.ok() || geo.ptr === 0) throw new Error('THREE.DRACOLoader: Decoding failed: ' + status.error_msg())
  const out: GeoData = { index: null, attributes: [] }
  for (const name in cfg.attributeIDs) {
    const T = ARRAYS[cfg.attributeTypes[name]]
    let attribute: Draco
    if (cfg.useUniqueIDs) attribute = decoder.GetAttributeByUniqueId(geo, cfg.attributeIDs[name])
    else {
      const id = decoder.GetAttributeId(geo, draco[cfg.attributeIDs[name] as string])
      if (id === -1) continue
      attribute = decoder.GetAttribute(geo, id)
    }
    const r: GeoData['attributes'][number] = decodeAttribute(draco, decoder, geo, name, T, attribute)
    if (name === 'color') r.vertexColorSpace = cfg.vertexColorSpace
    out.attributes.push(r)
  }
  if (type === draco.TRIANGULAR_MESH) out.index = decodeIndex(draco, decoder, geo)
  draco.destroy(geo)
  return out
}

class MainThreadDracoLoader extends DRACOLoader {
  preload() { decoderModule(); return this }
  // GLTFLoader 가 부르는 decodeDracoFile → decodeGeometry 를 워커 대신 여기서 처리
  decodeGeometry(buffer: ArrayBuffer, taskConfig: TaskConfig) {
    return decoderModule().then((draco) => {
      const decoder = new draco.Decoder()
      try {
        const data = decodeGeometry(draco, decoder, new Int8Array(buffer), taskConfig)
        return (this as any)._createGeometry(data)
      } finally {
        draco.destroy(decoder)
      }
    })
  }
}

export function createMainThreadDracoLoader(): DRACOLoader {
  return new MainThreadDracoLoader()
}
