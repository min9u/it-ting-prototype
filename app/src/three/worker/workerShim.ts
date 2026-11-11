/*
 * D 땅굴을 Worker 에서 그리기 (시험판, docs/gpu-lowspec-ideas.md): Worker 에는 DOM 이 없어서
 * roomScene·engine 이 쓰는 최소한만 흉내 낸다. roomWorker.ts 가 가장 먼저 import 해야 함 (다른 모듈보다 먼저 실행).
 * - window = self, document (hidden, createElement: canvas 는 OffscreenCanvas, 나머지는 가짜 요소)
 * - ResizeObserver: 메인에서 크기 메시지가 오면 fireResize() 로 콜백을 부름
 * - 말풍선·가구 이름표처럼 DOM 에 붙이는 것은 가짜 요소라 화면에 안 보임 (시험판 한계)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const g = self as any

export function fakeElement(): any {
  const t: any = new EventTarget()
  Object.assign(t, {
    style: {}, textContent: '', tagName: 'DIV', clientWidth: 1, clientHeight: 1,
    append() {}, appendChild() {}, remove() {}, removeChild() {}, focus() {},
    getBoundingClientRect() { return { left: 0, top: 0, x: 0, y: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight } },
  })
  return t
}

const makeCanvas = () => new OffscreenCanvas(1, 1)
if (!g.window) g.window = g
if (!g.document) {
  const doc: any = new EventTarget()
  Object.assign(doc, {
    hidden: false, visibilityState: 'visible',
    createElement: (tag: string) => (tag === 'canvas' ? makeCanvas() : fakeElement()),
    createElementNS: (_ns: string, tag: string) => (tag === 'canvas' ? makeCanvas() : fakeElement()),
    body: fakeElement(), documentElement: fakeElement(),
  })
  g.document = doc
}

// GLTFLoader 의 WebP 지원 확인(EXT_texture_webp detectSupport)이 new Image() 를 씀. Worker 크롬은 WebP 를 createImageBitmap 으로 풀 수 있으니 "됨"으로 답함
if (!g.Image) {
  g.Image = class {
    width = 0; height = 0
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_v: string) { queueMicrotask(() => { this.width = this.height = 1; this.onload?.() }) }
  }
}

const observers = new Set<{ cb: () => void }>()
if (!g.ResizeObserver) {
  g.ResizeObserver = class {
    cb: () => void
    constructor(cb: () => void) { this.cb = cb }
    observe() { observers.add(this) }
    unobserve() { observers.delete(this) }
    disconnect() { observers.delete(this) }
  }
}
export function fireResize() { for (const o of [...observers]) o.cb() }

/** 넘겨받은 OffscreenCanvas 를 three·OrbitControls·roomScene 이 캔버스처럼 쓸 수 있게 */
export function dressCanvas(c: OffscreenCanvas, size: () => { w: number; h: number }) {
  Object.assign(c as any, {
    style: {}, remove() {}, focus() {},
    ownerDocument: g.document, getRootNode: () => g.document,
    setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture: () => false,
    getBoundingClientRect() { const s = size(); return { left: 0, top: 0, x: 0, y: 0, width: s.w, height: s.h, right: s.w, bottom: s.h } },
  })
  Object.defineProperty(c, 'clientWidth', { get: () => size().w })
  Object.defineProperty(c, 'clientHeight', { get: () => size().h })
}
