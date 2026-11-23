// n8ao@1.10.1 에는 타입 선언이 없어서 쓰는 부분만 적어 둔 shim
declare module 'n8ao' {
  import type { Camera, Scene } from 'three'
  import { Pass } from 'three/examples/jsm/postprocessing/Pass.js'

  export class N8AOPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number)
    configuration: {
      aoRadius: number
      distanceFalloff: number
      intensity: number
      aoSamples: number
      denoiseSamples: number
      denoiseRadius: number
      halfRes: boolean
      gammaCorrection: boolean
      [key: string]: unknown
    }
    setSize(width: number, height: number): void
    setDisplayMode(mode: string): void
  }
}
