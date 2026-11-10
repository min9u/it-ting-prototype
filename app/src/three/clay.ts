import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

/* 방(땅굴) 공용 재료·도형 헬퍼. explore/3d/room.html 의 헬퍼를 그대로 옮김 */

export function noiseTex(size = 256, lo = 118, span = 20, rep = 3) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!, d = g.createImageData(size, size)
  for (let i = 0; i < d.data.length; i += 4) { const v = lo + Math.random() * span; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255 }
  g.putImageData(d, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rep, rep)
  return t
}

let NOISE: THREE.CanvasTexture | null = null
/** 무광 점토용 미세 울퉁불퉁 (한 장을 같이 씀. dispose 뒤 다시 써도 새로 올라감) */
export const roomNoise = () => (NOISE ??= noiseTex())

const matCache = new Map<string, THREE.MeshStandardMaterial>()
/** 무광 점토 재질 (색·옵션별로 캐시) */
export function clay(hex: string, o: THREE.MeshStandardMaterialParameters = {}) {
  const k = hex + JSON.stringify(o)
  const hit = matCache.get(k)
  if (hit) return hit
  const m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.92, metalness: 0, bumpMap: roomNoise(), bumpScale: 0.6, ...o })
  matCache.set(k, m)
  return m
}

export function add<T extends THREE.Object3D>(mesh: T, parent: THREE.Object3D): T {
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}
export function rbox(w: number, h: number, d: number, hex: string, r = 0.08, o?: THREE.MeshStandardMaterialParameters) {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2) * 0.999), clay(hex, o))
}
export function at<T extends THREE.Object3D>(m: T, x: number, y: number, z: number, ry = 0): T {
  m.position.set(x, y, z)
  m.rotation.y = ry
  return m
}
/** box: y = 바닥 기준 */
export function box(p: THREE.Object3D, w: number, h: number, d: number, hex: string, x: number, y: number, z: number, r = 0.08, ry = 0) {
  return add(at(rbox(w, h, d, hex, r), x, y + h / 2, z, ry), p)
}
export function cyl(p: THREE.Object3D, rt: number, rb: number, h: number, hex: string, x: number, y: number, z: number, seg = 28, o?: THREE.MeshStandardMaterialParameters) {
  return add(at(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), clay(hex, o)), x, y + h / 2, z), p)
}
export function sph(p: THREE.Object3D, r: number, hex: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, o?: THREE.MeshStandardMaterialParameters) {
  const m = add(at(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), clay(hex, o)), x, y, z), p)
  m.scale.set(sx, sy, sz)
  return m
}
export function group(parent: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 1) {
  const g = new THREE.Group()
  g.position.set(x, y, z)
  g.rotation.y = ry
  g.scale.setScalar(s)
  parent.add(g)
  return g
}
