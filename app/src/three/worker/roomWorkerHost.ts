import type { HostScreen, SceneHandle } from '../engine'
import type { RoomSceneOptions } from '../roomScene'
import { getLab } from '../../lib/lowLab'

/*
 * D 땅굴을 Worker 에서 그리기 — 메인 스레드 쪽 (시험판).
 * 캔버스를 만들어 OffscreenCanvas 로 Worker(roomWorker.ts)에 넘기고, 입력·크기를 메시지로 보낸다.
 * Worker 를 못 만들거나 시작하다 실패하면 원래대로 메인 스레드에서 그림 (fallback).
 * 시험판 한계: 리액션 말풍선·가구 이름표가 안 보임, 마우스 커서 모양이 안 바뀜 (집주인 머리 위 위치는 메시지로 받아 onHostScreen 으로 넘김)
 */
export const workerRenderSupported = () =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' && 'transferControlToOffscreen' in HTMLCanvasElement.prototype

const POINTER_KEYS = ['type', 'button', 'buttons', 'pointerId', 'pointerType', 'isPrimary', 'deltaX', 'deltaY', 'deltaMode', 'ctrlKey', 'shiftKey', 'altKey', 'metaKey'] as const

export function mountRoomWorker(container: HTMLElement, opts: RoomSceneOptions, fallback: () => SceneHandle): SceneHandle {
  let impl: SceneHandle | null = null // fallback 으로 바뀌면 이것
  let alive = true
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:pointer'
  container.appendChild(canvas)
  const off = canvas.transferControlToOffscreen()
  const worker = new Worker(new URL('./roomWorker.ts', import.meta.url), { type: 'module', name: 'room-3d' })
  const post = (m: unknown, t?: Transferable[]) => { if (alive && !impl) worker.postMessage(m, t ?? []) }

  let hostCb: ((p: HostScreen | null) => void) | null = null
  let hostLast: HostScreen | null = null
  const cleanupInputs: (() => void)[] = []
  const switchToFallback = (why: string) => {
    if (!alive || impl) return
    console.warn('[3D] Worker 로 그리기를 못 해서 원래대로 그려요:', why)
    worker.terminate()
    cleanupInputs.forEach((f) => f())
    canvas.remove()
    impl = fallback()
    if (hostCb) impl.onHostScreen?.(hostCb)
  }
  worker.onmessage = (e) => {
    const m = e.data
    if (m.type === 'frames') (window as unknown as { __sceneFrames?: number }).__sceneFrames = m.n
    else if (m.type === 'host') { hostLast = m.p; hostCb?.(m.p) }
    else if (m.type === 'error') {
      console.warn('[3D worker]', m.message)
      if (!ready) switchToFallback(m.message)
    } else if (m.type === 'ready') ready = true
  }
  worker.onerror = (e) => { e.preventDefault(); if (!ready) switchToFallback(e.message || 'worker error') }
  let ready = false

  post({ type: 'init', canvas: off, w: container.clientWidth || 1, h: container.clientHeight || 1, opts: { ...opts, canvas: undefined }, lab: getLab() }, [off])

  // 크기
  const ro = new ResizeObserver(() => post({ type: 'resize', w: container.clientWidth || 1, h: container.clientHeight || 1 }))
  ro.observe(container)
  cleanupInputs.push(() => ro.disconnect())

  // 누르기·끌기·휠: 캔버스 기준 좌표로 보냄 (Worker 쪽 getBoundingClientRect 는 left/top 0)
  const fwd = (e: PointerEvent | WheelEvent) => {
    const r = canvas.getBoundingClientRect()
    const ev: Record<string, unknown> = { clientX: e.clientX - r.left, clientY: e.clientY - r.top }
    for (const k of POINTER_KEYS) if (k in e) ev[k] = (e as unknown as Record<string, unknown>)[k]
    if (e.type === 'wheel') e.preventDefault()
    post({ type: 'pointer', ev })
  }
  const types = ['pointerdown', 'pointermove', 'pointerup', 'pointerleave', 'pointercancel'] as const
  types.forEach((t) => canvas.addEventListener(t, fwd))
  canvas.addEventListener('wheel', fwd, { passive: false })
  cleanupInputs.push(() => { types.forEach((t) => canvas.removeEventListener(t, fwd)); canvas.removeEventListener('wheel', fwd) })

  // 키 (입력 칸에 쓰는 중이면 보내지 않음)
  const key = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
    if (/^(Key[WASD]|Arrow)/.test(e.code) && !e.altKey && !e.ctrlKey && !e.metaKey && e.type === 'keydown') e.preventDefault()
    post({ type: 'key', ev: { type: e.type, code: e.code, key: e.key, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey } })
  }
  const blur = () => post({ type: 'key', ev: { type: 'blur' } })
  window.addEventListener('keydown', key); window.addEventListener('keyup', key); window.addEventListener('blur', blur)
  cleanupInputs.push(() => { window.removeEventListener('keydown', key); window.removeEventListener('keyup', key); window.removeEventListener('blur', blur) })

  const call = (name: string, arg: unknown) => post({ type: 'call', name, arg })
  return {
    resize() { if (impl) impl.resize(); else post({ type: 'resize', w: container.clientWidth || 1, h: container.clientHeight || 1 }) },
    setFocusX(x) { if (impl) impl.setFocusX(x); else call('setFocusX', x) },
    react(kind) { if (impl) impl.react?.(kind); else call('react', kind) },
    setWorn(ids) { if (impl) impl.setWorn?.(ids); else call('setWorn', ids) },
    setFrozen(on) { if (impl) impl.setFrozen?.(on); else call('setFrozen', on) },
    onHostScreen(cb) { hostCb = cb; if (impl) impl.onHostScreen?.(cb); else cb?.(hostLast) },
    dispose() {
      hostCb = null
      if (impl) { impl.dispose(); alive = false; return }
      post({ type: 'dispose' })
      alive = false
      setTimeout(() => worker.terminate(), 500)
      cleanupInputs.forEach((f) => f())
      canvas.remove()
    },
  }
}
