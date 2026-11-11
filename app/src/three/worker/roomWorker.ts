/*
 * D 땅굴을 별도 스레드(Worker)에서 그리기 — 시험판 (docs/gpu-lowspec-ideas.md).
 * 메인 스레드가 캔버스를 OffscreenCanvas 로 넘기면, 이 Worker 가 원래 roomScene 그대로를 돌린다.
 * 3D 가 아무리 느려도 메인 스레드(버튼·스크롤·글 입력)는 막히지 않음.
 * 입력(누르기·끌기·휠·키)과 크기는 메인(roomWorkerHost.ts)이 메시지로 보내고, 여기서 가짜 이벤트로 다시 쏨.
 */
import { dressCanvas, fakeElement, fireResize } from './workerShim'
import { setLab, type LabState } from '../../lib/lowLab'
import type { RoomSceneOptions } from '../roomScene'
import type { SceneHandle } from '../engine'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Msg =
  | { type: 'init'; canvas: OffscreenCanvas; w: number; h: number; opts: RoomSceneOptions; lab: LabState }
  | { type: 'resize'; w: number; h: number }
  | { type: 'pointer'; ev: Record<string, unknown> }
  | { type: 'key'; ev: Record<string, unknown> }
  | { type: 'call'; name: 'setFocusX' | 'react' | 'setWorn' | 'setFrozen'; arg: unknown }
  | { type: 'dispose' }

const size = { w: 1, h: 1 }
const container = fakeElement()
Object.defineProperty(container, 'clientWidth', { get: () => size.w })
Object.defineProperty(container, 'clientHeight', { get: () => size.h })
let canvas: OffscreenCanvas | null = null
let handle: SceneHandle | null = null

const fire = (target: EventTarget, ev: Record<string, unknown>) => {
  const e = new Event(String(ev.type), { cancelable: true })
  // type 은 Event 의 읽기 전용 속성이라 빼고 나머지(clientX, code …)를 붙임
  for (const [k, v] of Object.entries(ev)) if (k !== 'type') Object.defineProperty(e, k, { value: v })
  target.dispatchEvent(e)
}

// 장면을 실제로 그린 횟수를 메인에 알려 줌 (측정용, engine.ts countFrame)
setInterval(() => { const n = (self as any).__sceneFrames; if (n !== undefined) postMessage({ type: 'frames', n }) }, 500)

self.onmessage = async (e: MessageEvent<Msg>) => {
  const m = e.data
  try {
    if (m.type === 'init') {
      size.w = m.w; size.h = m.h
      setLab({ ...m.lab, force: 'low' }) // D 는 저사양에서만. Worker 에는 localStorage 가 없어서 메인 값을 받음
      canvas = m.canvas
      dressCanvas(canvas, () => size)
      const { mountRoomScene } = await import('../roomScene')
      handle = mountRoomScene(container, { ...m.opts, canvas })
      postMessage({ type: 'ready' })
    } else if (m.type === 'resize') {
      size.w = m.w; size.h = m.h
      fireResize()
    } else if (m.type === 'pointer') {
      if (canvas) fire(canvas, m.ev)
      fire(container, m.ev) // startLoop 은 컨테이너에서 듣는다 (진짜 DOM 에서는 캔버스에서 올라옴)
    } else if (m.type === 'key') {
      fire(self, m.ev)
    } else if (m.type === 'call') {
      const h = handle as any
      h?.[m.name]?.(m.arg)
    } else if (m.type === 'dispose') {
      handle?.dispose(); handle = null
      close()
    }
  } catch (err) {
    postMessage({ type: 'error', message: String((err as Error)?.stack ?? err) })
  }
}
self.addEventListener('error', (e) => postMessage({ type: 'error', message: String((e as ErrorEvent).message) }))
self.addEventListener('unhandledrejection', (e) => postMessage({ type: 'error', message: String((e as PromiseRejectionEvent).reason) }))
