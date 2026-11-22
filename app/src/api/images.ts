/**
 * 사진 올리기 (명세 api 08 POST /api/v1/images): 한 장씩 올려 id 와 주소를 받고, 채팅 메시지·글에 그 id 를 담음.
 * 목 서버는 올리지 않고 브라우저 안 주소(object URL)로 돌려줌
 */
import { API_MODE } from './config'
import { http } from './client'
import { mockWrite } from './mock/server'
import { checkImageFile, rememberImage, type PickedImage } from '../lib/imageRules'

let n = 0
export async function uploadImage(file: File): Promise<PickedImage> {
  const bad = checkImageFile(file)
  if (bad) throw new Error(bad)
  if (API_MODE === 'real') {
    const form = new FormData()
    form.append('file', file)
    const r = await http.post<{ imageId: number | string; url: string }>('/images', form)
    return { id: String(r.imageId), url: r.url }
  }
  return mockWrite(() => { const i = { id: `img-${Date.now().toString(36)}-${n++}`, url: URL.createObjectURL(file) }; rememberImage(i); return i })
}
