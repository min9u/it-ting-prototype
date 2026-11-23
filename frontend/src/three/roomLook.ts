import * as THREE from 'three'

/**
 * 두더지 발밑 둥근 그림자 (바닥이 구운 텍스처라 실시간 그림자를 받지 않아서 대신 깖).
 * 지름 size(m), 바닥 위 1cm. 가구 접촉 그림자(shadow_*)와 같은 방식: 검정 + 알파, depthWrite 끔.
 */
let tex: THREE.CanvasTexture | null = null
export function blobShadow(size: number, opacity = .32) {
  if (!tex) {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d')!
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(.45, 'rgba(0,0,0,.75)'); r.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = r; g.fillRect(0, 0, 128, 128)
    tex = new THREE.CanvasTexture(c)
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * .8), new THREE.MeshBasicMaterial({ color: 0x3a2214, alphaMap: tex, transparent: true, opacity, depthWrite: false }))
  m.rotation.x = -Math.PI / 2
  m.position.y = .01
  m.renderOrder = 2
  m.name = 'blob-shadow'
  return m
}
