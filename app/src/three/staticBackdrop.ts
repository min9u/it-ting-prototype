import * as THREE from 'three'

/*
 * A "배경은 한 번, 두더지만 매 프레임" (docs/gpu-lowspec-ideas.md, 탐색하기 저사양).
 * 움직이지 않는 것(밭·꽃·둔덕·하늘)을 렌더 타깃에 색 + 깊이로 한 번 그려 두고,
 * 매 프레임은 그 그림을 화면에 붙이면서(깊이까지 써서 가림이 맞게) 움직이는 것(두더지 층)만 그 위에 그린다.
 * CPU 렌더러(WARP)는 꽃·덤불 정점 수가 병목이라, 매 프레임 일이 "사각형 하나 + 두더지"로 줄어든다.
 *
 * - 렌더 타깃은 톤매핑 전(선형 HalfFloat) 색이라, 붙일 때 같은 톤매핑·sRGB 변환을 해서 원래 그림과 같게 만든다
 * - 깊이는 DepthTexture → gl_FragDepth 로 그대로 씀 (depthFunc Always)
 * - 움직이는 것은 layer 1 에 두고, 배경 그릴 때는 camera layer 0, 두더지 그릴 때는 layer 1 만
 */
export interface Backdrop {
  /** 배경을 다시 그려야 함 (크기·카메라 구도가 바뀜) */
  invalidate(): void
  isDirty(): boolean
  /** 배경 렌더 (layer 0 만, 두더지 빼고) */
  capture(scene: THREE.Scene, camera: THREE.Camera): void
  /** 저장해 둔 배경을 지금 그리기 대상에 붙임 (색 + 깊이) */
  blit(): void
  /** 깊이만 붙임 (색은 안 씀). 방을 다른 캔버스에 고해상도로 깔아 두고 두더지만 그릴 때 가림용 */
  blitDepth(): void
  dispose(): void
}

export function createBackdrop(renderer: THREE.WebGLRenderer): Backdrop {
  const size = new THREE.Vector2()
  let rt: THREE.WebGLRenderTarget | null = null
  let dirty = true
  const mat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: null }, tDepth: { value: null } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(tColor, vUv);
        gl_FragDepth = texture2D(tDepth, vUv).x;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth, toneMapped: true,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  const quadScene = new THREE.Scene(); quadScene.add(quad)
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const ensure = () => {
    renderer.getDrawingBufferSize(size)
    if (rt && rt.width === size.x && rt.height === size.y) return rt
    rt?.dispose()
    rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType, depthBuffer: true,
      depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType),
    })
    mat.uniforms.tColor.value = rt.texture
    mat.uniforms.tDepth.value = rt.depthTexture
    return rt
  }

  return {
    invalidate() { dirty = true },
    isDirty: () => dirty,
    capture(scene, camera) {
      const target = ensure()
      const layers = camera.layers.mask
      camera.layers.set(0)
      const prevTarget = renderer.getRenderTarget(), prevClear = renderer.autoClear
      renderer.setRenderTarget(target)
      renderer.autoClear = true
      renderer.render(scene, camera)
      renderer.setRenderTarget(prevTarget)
      renderer.autoClear = prevClear
      camera.layers.mask = layers
      dirty = false
    },
    blit() {
      if (!rt) return
      const bg = quadScene.background
      renderer.render(quadScene, quadCam)
      quadScene.background = bg
    },
    blitDepth() {
      if (!rt) return
      mat.colorWrite = false
      renderer.render(quadScene, quadCam)
      mat.colorWrite = true
    },
    dispose() {
      rt?.depthTexture?.dispose(); rt?.dispose(); rt = null
      quad.geometry.dispose(); mat.dispose()
    },
  }
}

/** 이 물체와 자식을 모두 움직이는 층(layer 1)으로 (액세서리를 바꾸면 다시 불러야 함) */
export function toDynamicLayer(o: THREE.Object3D) {
  o.traverse((c) => c.layers.set(1))
}
