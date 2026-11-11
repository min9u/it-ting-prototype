/*
 * 두더지 직접 조종 키 (WASD, 방향키). explore/3d/lib 의 bindMoleKeys 와 같은 동작을 TS로 옮김.
 * 앱의 3D 장면이 모두 glb 두더지(moleActor)로 바뀌어서 예전 펠트 두더지 파일(mole.ts)을 불러오지 않으려고 따로 둠.
 * 입력 칸에 글을 쓰는 중이거나 Alt·Ctrl·Meta 조합이면 무시. 창이 포커스를 잃으면 멈춤.
 */
type Dir = [number, number]

export function bindDriveKeys(drive: (x: number, z: number) => void, o: { arrows?: boolean; target?: Window | HTMLElement } = {}) {
  const target = o.target ?? window
  const down = new Set<string>()
  const KEYS: Record<string, Dir> = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }
  if (o.arrows !== false) Object.assign(KEYS, { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] })
  const typing = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
  }
  const apply = () => {
    let x = 0, z = 0
    for (const k of down) { x += KEYS[k][0]; z += KEYS[k][1] }
    drive(x, z)
  }
  const kd = (e: Event) => {
    const k = e as KeyboardEvent
    if (!KEYS[k.code] || typing(k) || k.altKey || k.ctrlKey || k.metaKey) return
    k.preventDefault(); down.add(k.code); apply()
  }
  const ku = (e: Event) => { const k = e as KeyboardEvent; if (!KEYS[k.code]) return; down.delete(k.code); apply() }
  const blur = () => { down.clear(); apply() }
  target.addEventListener('keydown', kd); target.addEventListener('keyup', ku); window.addEventListener('blur', blur)
  return () => {
    target.removeEventListener('keydown', kd); target.removeEventListener('keyup', ku); window.removeEventListener('blur', blur)
    drive(0, 0)
  }
}
