/**
 * 사진 올리기 규칙 (팀 명세 api 08 "사진" · 06 메시지): JPEG · PNG · WebP, 한 장 5MB까지, 글 하나·메시지 하나에 3장까지.
 * 게시판 글쓰기와 채팅 첨부가 같은 규칙을 씀
 */
export const IMAGE_MAX = 3
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',')

export interface PickedImage { id: string; url: string }

/** 올린 사진의 주소를 id 로 찾는 기억 (목 서버가 메시지에 붙은 사진 id 를 주소로 바꿀 때). 실제 서버에서는 안 씀 */
const known = new Map<string, string>()
export const rememberImage = (i: PickedImage) => { known.set(i.id, i.url) }
export const imageUrlOf = (id: string) => known.get(id)

/** 파일 하나를 검사. 올릴 수 없으면 까닭(화면 문구), 되면 null */
export function checkImageFile(f: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(f.type)) return 'JPEG, PNG, WebP 사진만 올릴 수 있어요'
  if (f.size > IMAGE_MAX_BYTES) return '사진은 한 장에 5MB까지 올릴 수 있어요'
  return null
}

/**
 * 고른 파일들 중 올릴 수 있는 것만 남김: 규칙에 맞는 것을 차례로 받다가 남은 자리(max - have)가 차면 멈춤
 * 돌려주는 것: 받을 파일 · 안내(없으면 null)
 */
export function pickImageFiles<T extends { type: string; size: number }>(files: readonly T[], have: number, max = IMAGE_MAX): { ok: T[]; note: string | null } {
  const ok: T[] = []
  let note: string | null = null
  for (const f of files) {
    const bad = checkImageFile(f)
    if (bad) { note ??= bad; continue }
    if (have + ok.length >= max) { note ??= `사진은 ${max}장까지 붙일 수 있어요`; continue }
    ok.push(f)
  }
  return { ok, note }
}
