/*
 * 3D 장면 정지 그림 (docs/rendering-experiments-3.md 4·5번). three.js 를 불러오지 않음 (3D 청크 밖에서도 가볍게 씀)
 *
 * 1) 빌드에 넣은 고해상도 그림 — stillFor(kind)
 *    가속 켠 GPU 로 미리 찍은 webp (explore/gpu/make-stills.mjs, 기기 배율 1.5 로 그려 줄임). WebGL 이 없거나 3D 가 실패했을 때,
 *    3D 가 준비되기 전에 같은 자리에 보여 줌. 예전 자리표시(room-cutout.png 636px, room-v2.webp 1200px 디자이너 확인 렌더)가
 *    늘어나 흐리게 보이던 문제를 대신함. 아티팩트(공유 빌드)는 svg·avif data URL 을 막으므로 webp 파일 자산으로 넣음
 * 2) 이 브라우저에서 구운 그림 (IndexedDB) — getCachedStill / putCachedStill / peekCachedStill
 *    저사양에서 선명한 배경(S)을 구우면 장면 키(방 주인·관심사·크기·구도 …)로 저장 → 다음에 같은 화면에 오면
 *    3D 가 준비되기 전부터 같은 구도의 그림을 보여 주고, 선명한 배경을 다시 굽지 않음 (새로고침·다음 방문에도)
 *
 * 사용 예 (3D 실패 대체 그림, React):
 *   const s = stillFor('room')
 *   <img src={s.src} alt={s.alt} style={stillStyle(s, focusX)} />   // 장면 컨테이너(position: relative/absolute) 안에
 */
import roomUrl from '../assets/stills/room.webp'
import { ENV } from '../lib/env'
import visitUrl from '../assets/stills/visit.webp'
import fieldUrl from '../assets/stills/field.webp'
import landingUrl from '../assets/stills/landing.webp'
import teaDuoUrl from '../assets/stills/tea-duo.webp'
import teaGroupUrl from '../assets/stills/tea-group.webp'

/** 화면 종류. room = 내 땅굴·온보딩 미리 보기(관심사로 꾸민 방), visit = 남의 땅굴(집주인 + 나), field = 탐색 들판, landing = 랜딩·둘러보기 밭, tea = 찻방 두더지(투명 배경, 2D 방 위에) */
export type StillKind = 'room' | 'visit' | 'field' | 'landing' | 'tea' | 'tea-group'

export interface Still {
  src: string
  /** 그림 픽셀 크기 */
  width: number
  height: number
  /**
   * 놓는 법
   * - room: 땅굴 4:3 구도 상자 (three/roomFrame.ts ROOM_FRAME 과 같은 자리·높이, 가로 가운데 = focusX). 3D 땅굴과 같은 자리
   * - cover: 장면 전체를 덮음 (object-fit: cover, 가로 가운데 = focusX). 들판·밭
   * - fill: 장면 상자에 꽉 (찻방 상자)
   */
  fit: 'room' | 'cover' | 'fill'
  /** 투명 배경이 있음 (방 바깥·찻방) */
  alpha: boolean
  alt: string
}

// 크기·투명 여부는 make-stills.mjs 결과 (explore/gpu/results/round3/stills.json)
// 2026-11-22: room · visit 을 v3.8.1 방(두더지 방석, 침대·빈백·오락기 없음)으로 다시 찍음 (Apple M4 Pro GPU).
//   tea · tea-group 은 채팅방이 3D 방(chatRoomScene)이 되면서 아무 데서도 안 쓰임 (옛 찻방 2D 그림 위 두더지) → 다시 찍지 않음
const STILLS: Record<StillKind, Still> = {
  room: { src: roomUrl, width: 2048, height: 1536, fit: 'room', alpha: true, alt: '관심사로 꾸민 땅굴 방 모습' },
  visit: { src: visitUrl, width: 2032, height: 1524, fit: 'room', alpha: true, alt: '집주인 두더지가 있는 땅굴 방 모습' },
  field: { src: fieldUrl, width: 1920, height: 1016, fit: 'cover', alpha: false, alt: '구멍이 모여 있는 들판 모습' },
  landing: { src: landingUrl, width: 1920, height: 1088, fit: 'cover', alpha: false, alt: '두더지가 사는 밭 모습' },
  tea: { src: teaDuoUrl, width: 624, height: 858, fit: 'fill', alpha: true, alt: '찻상에 마주 앉은 두더지 둘' },
  'tea-group': { src: teaGroupUrl, width: 624, height: 858, fit: 'fill', alpha: true, alt: '찻상에 둘러앉은 두더지들' },
}

/** 빌드에 넣은 정지 그림 (opts.host: 땅굴에 집주인이 있으면 visit 그림) */
export function stillFor(kind: StillKind, opts: { host?: boolean } = {}): Still {
  if (kind === 'room' && opts.host) return STILLS.visit
  return STILLS[kind]
}

/** ROOM_FRAME (three/roomFrame.ts) 과 같은 값. 이 파일이 three 를 불러오지 않게 따로 적음 (바꾸면 같이) */
const ROOM_TOP = -0.053, ROOM_H = 0.89

/** 장면 컨테이너 안에서 그림을 놓는 CSS (React style 로 그대로). focusX = 장면 가운데 가로 위치(0–1) */
export function stillStyle(s: Pick<Still, 'fit'>, focusX = 0.5): Record<string, string | number> {
  const base = { position: 'absolute', pointerEvents: 'none', userSelect: 'none' }
  if (s.fit === 'room') return { ...base, left: `${focusX * 100}%`, top: `${ROOM_TOP * 100}%`, height: `${ROOM_H * 100}%`, aspectRatio: '4 / 3', transform: 'translateX(-50%)' }
  if (s.fit === 'cover') return { ...base, inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${focusX * 100}% 50%` }
  return { ...base, inset: 0, width: '100%', height: '100%' }
}

/* ---------- 2) 이 브라우저에서 구운 그림 (IndexedDB) ---------- */
const DB = 'digul-stills', STORE = 'stills', MAX_KEEP = 8
/** 열어 둔 뒤 읽어 온 그림 (키 → 그림). 3D 장면이 바로(동기로) 꺼내 쓰려고 미리 받아 둠 */
const mem = new Map<string, ImageBitmap>()
let dbP: Promise<IDBDatabase | null> | null = null
const off = () => { try { return /[?&]stillcache=0\b/.test(location.search + location.hash) } catch { return false } }
/**
 * 빌드 표시: 빌드마다 바뀌는 값(next.config.ts NEXT_PUBLIC_BUILD_STAMP). 저장 키 앞에 붙여서, 다시 배포하면(모델·색이 바뀌었을 수 있음)
 * 예전 빌드가 구운 그림을 쓰지 않음 (오래된 것은 trim 이 지움). 개발 서버에서는 늘 'dev'.
 * (Vite 앱은 이 모듈이 든 청크 파일 이름을 썼음. Next 에서는 import.meta.url 이 청크 주소가 아니라서 바꿈)
 */
const BUILD = ENV.buildStamp
const dbKey = (key: string) => `${BUILD}#${key}`

function openDb(): Promise<IDBDatabase | null> {
  return (dbP ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch { resolve(null) }
  }))
}
const tx = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> =>
  openDb().then((db) => new Promise<T | null>((resolve) => {
    if (!db) return resolve(null)
    try {
      const r = fn(db.transaction(STORE, mode).objectStore(STORE))
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => resolve(null)
    } catch { resolve(null) }
  }))

interface Row { blob: Blob; at: number; w: number; h: number }

/** 저장해 둔 그림 (없으면 null). 받은 그림은 peekCachedStill 로 바로 꺼낼 수 있게 기억 */
export async function getCachedStill(key: string): Promise<ImageBitmap | null> {
  if (off()) return null
  const hit = mem.get(key)
  if (hit) return hit
  const row = await tx<Row | undefined>('readonly', (s) => s.get(dbKey(key)) as IDBRequest<Row | undefined>)
  if (!row?.blob) return null
  try {
    const bmp = await createImageBitmap(row.blob)
    mem.set(key, bmp)
    return bmp
  } catch { return null }
}

/** 이미 받아 둔 그림 (동기) */
export const peekCachedStill = (key: string): ImageBitmap | null => (off() ? null : mem.get(key) ?? null)

/** 구운 그림 저장 (webp, 쉴 때). 오래된 것부터 지워 MAX_KEEP 개까지 */
export function putCachedStill(key: string, canvas: HTMLCanvasElement) {
  if (off() || typeof indexedDB === 'undefined') return
  // 이 탭에서 곧 다시 쓸 수 있게 메모리에도 (저장은 쉴 때 webp 로 바꾸느라 몇 초 걸려서, 그 전에 같은 자리로 돌아오면 다시 구웠음.
  // 탐색 들판 점프의 도착 자리 미리 굽기가 왔다 갔다 할 때 바로 씀, docs/explore-move-quality.md)
  if (typeof createImageBitmap === 'function') createImageBitmap(canvas).then((b) => { mem.set(key, b) }).catch(() => {})
  const w = canvas.width, h = canvas.height
  const run = () => canvas.toBlob((blob) => {
    if (!blob) return
    void tx('readwrite', (s) => s.put({ blob, at: Date.now(), w, h } satisfies Row, dbKey(key))).then(() => trim())
  }, 'image/webp', 0.92)
  const idle = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (idle) idle(run, { timeout: 3000 }); else setTimeout(run, 500)
}

async function trim() {
  const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())
  if (!keys || keys.length <= MAX_KEEP) return
  const rows = await Promise.all(keys.map(async (k) => [k, (await tx<Row | undefined>('readonly', (s) => s.get(k) as IDBRequest<Row | undefined>))?.at ?? 0] as const))
  rows.sort((a, b) => a[1] - b[1])
  for (const [k] of rows.slice(0, rows.length - MAX_KEEP)) { const sk = String(k); mem.delete(sk.slice(sk.indexOf('#') + 1)); await tx('readwrite', (s) => s.delete(k)) }
}

/**
 * 장면 키 → 문자열. 같은 화면·같은 크기·같은 구도일 때만 같은 키 (구도가 조금만 달라도 그림이 어긋나므로)
 * parts 에는 장면이 그림을 정하는 값만 (방 주인·관심사·가구·벽지·자리 …), 크기는 기기 픽셀
 */
export function stillKey(kind: string, parts: (string | number | undefined | null)[], w: number, h: number, focusX: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  return [kind, ...parts.map((p) => p ?? ''), Math.round(w * dpr), Math.round(h * dpr), focusX.toFixed(3), 'v1'].join('|')
}
