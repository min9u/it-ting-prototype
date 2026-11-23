/**
 * 재배포 뒤 옛 탭의 청크 404 (docs/dev-deploy-risks.md D2).
 * 사용자가 앱을 열어 둔 채로 새 버전이 올라가면, 그 탭이 기억하는 옛 해시 파일(RoomCanvas-옛해시.js)이 서버에 없어서
 * 지연 로딩(lazy import)이 실패함 → 한 번만 새로고침해서 새 index.html·새 파일 이름을 받게 함.
 *
 * - Next.js: 페이지 이동 중 파일을 못 받으면 Next 가 스스로 새로 불러옴(주소로 이동). 화면 안 지연 로딩(dynamic · lazy)이 실패하면
 *   에러가 에러 경계까지 올라옴 → RouteError(NotFound.tsx, src/app 의 error.tsx)·SceneBoundary 가 isChunkLoadError 로 가려냄
 *   (Vite 앱의 vite:preloadError 처리(installChunkReload)는 Next 에 없는 이벤트라 옮기지 않음)
 * 무한 새로고침 막기: 30초 안에 이미 한 번 새로고침했으면 다시 하지 않고 에러 화면("다시 시도")을 보여 줌.
 * 저장소(sessionStorage)를 못 쓰는 곳에서는 표시를 못 남기므로 자동 새로고침을 하지 않음.
 */
const KEY = 'digul.chunkReloadAt'
const WINDOW_MS = 30_000

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false
  const e = err as { name?: string; message?: string }
  const msg = `${e.name ?? ''} ${e.message ?? String(err)}`
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (CSS )?chunk [\w-]+ failed|ChunkLoadError|Outdated Optimize Dep/i.test(msg)
}

/** 한 번만 새로고침. 했으면 true (호출한 쪽은 에러 화면 대신 아무것도 안 그려도 됨) */
export function reloadOnce(reason: string): boolean {
  if (typeof window === 'undefined') return false
  let last = 0
  try { last = Number(sessionStorage.getItem(KEY)) || 0 } catch { return false }
  if (Date.now() - last < WINDOW_MS) return false
  try { sessionStorage.setItem(KEY, String(Date.now())) } catch { return false }
  console.warn('[배포] 새 버전 파일을 받으려고 한 번 새로고침해요:', reason)
  window.location.reload()
  return true
}
