/**
 * F6 채팅 사진 첨부 (팀 명세 06 메시지 입력창 7 · api 08 사진):
 * 메시지당 3장, 글 없이 사진만 가능, 글도 사진도 없으면 불가. JPEG · PNG · WebP, 한 장 5MB
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Chat from '../data/chat'
import { IMAGE_MAX, IMAGE_MAX_BYTES, checkImageFile, pickImageFiles, type PickedImage } from '../lib/imageRules'

const f = (type: string, size = 1000) => ({ type, size })
const pic = (n: number): PickedImage => ({ id: `img-${n}`, url: `blob:test/${n}` })

describe('사진 규칙 (lib/imageRules)', () => {
  it('JPEG · PNG · WebP 만, 5MB 까지', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp']) expect(checkImageFile(f(t)), t).toBeNull()
    expect(checkImageFile(f('image/gif'))).toMatch(/JPEG, PNG, WebP/)
    expect(checkImageFile(f('application/pdf'))).toMatch(/JPEG, PNG, WebP/)
    expect(checkImageFile(f('image/png', IMAGE_MAX_BYTES))).toBeNull()
    expect(checkImageFile(f('image/png', IMAGE_MAX_BYTES + 1))).toMatch(/5MB/)
  })
  it('한 번에 고른 것은 남은 자리까지만: 3장', () => {
    const five = Array.from({ length: 5 }, () => f('image/jpeg'))
    const r = pickImageFiles(five, 0)
    expect(r.ok).toHaveLength(IMAGE_MAX)
    expect(r.note).toMatch(/3장/)
    expect(pickImageFiles(five, 2).ok).toHaveLength(1)
    expect(pickImageFiles(five, 3).ok).toHaveLength(0)
  })
  it('규칙에 안 맞는 파일은 빼고 나머지는 받음, 안내는 첫 까닭', () => {
    const r = pickImageFiles([f('image/gif'), f('image/png'), f('image/jpeg', IMAGE_MAX_BYTES + 1)], 0)
    expect(r.ok).toHaveLength(1)
    expect(r.note).toMatch(/JPEG, PNG, WebP/)
    expect(pickImageFiles([f('image/png')], 0).note).toBeNull()
  })
})

describe('채팅 사진 보내기 (data/chat.send)', () => {
  let C: typeof Chat
  beforeEach(async () => { vi.resetModules(); C = await import('../data/chat') })
  const count = (id: string) => C.roomOf(id)!.messages.length

  it('글 없이 사진만 보낼 수 있음', () => {
    const n = count('r-yerin')
    C.send('r-yerin', '', undefined, [pic(1)])
    expect(count('r-yerin')).toBe(n + 1)
    const last = C.lastMsg(C.roomOf('r-yerin')!)
    expect(last.text).toBe('')
    expect(last.images).toEqual([pic(1)])
  })
  it('글과 사진 둘 다 보낼 수 있고, 사진은 보낸 순서 그대로', () => {
    C.send('r-yerin', '여기예요', undefined, [pic(1), pic(2)])
    const last = C.lastMsg(C.roomOf('r-yerin')!)
    expect(last.text).toBe('여기예요')
    expect(last.images?.map((i) => i.id)).toEqual(['img-1', 'img-2'])
  })
  it('글도 사진도 없으면 보내지 않음 (공백만도 같음)', () => {
    const n = count('r-yerin')
    C.send('r-yerin', '   ', undefined, [])
    C.send('r-yerin', '')
    expect(count('r-yerin')).toBe(n)
  })
  it('한 메시지에 3장까지 (넘게 넘겨도 앞의 3장만)', () => {
    C.send('r-yerin', '', undefined, [pic(1), pic(2), pic(3), pic(4), pic(5)])
    expect(C.lastMsg(C.roomOf('r-yerin')!).images).toHaveLength(IMAGE_MAX)
  })
  it('읽기 전용 방(상대가 나감·탈퇴)에는 사진도 못 보냄', () => {
    for (const id of ['r-seoyeon', 'r-gone']) {
      const n = count(id)
      C.send(id, '', undefined, [pic(1)])
      expect(count(id), id).toBe(n)
    }
  })
  it('모임 대화방에서도 같음', () => {
    const n = count('g-m1')
    C.send('g-m1', '', undefined, [pic(1)])
    expect(count('g-m1')).toBe(n + 1)
  })
})

describe('대화 목록 미리보기 (api/mappers)', () => {
  it('글 없이 사진만 보낸 마지막 메시지는 "사진"으로 보임', async () => {
    const { toChatRoomItem } = await import('../api/mappers')
    const dto = {
      id: 'r1', type: 'DIRECT', meetupId: null, title: '예린', partner: null, topic: null, memberCount: 2, unreadCount: 0, closedReason: null, ended: false,
      lastMessage: { id: 'm1', type: 'TEXT', senderId: 'yerin', senderNickname: '예린', content: null, meetupId: null, meetupTitle: null, createdAt: '2026-11-22T10:00:00+09:00' },
    } as unknown as Parameters<typeof toChatRoomItem>[0]
    expect(toChatRoomItem(dto).preview).toBe('사진')
    expect(toChatRoomItem({ ...dto, lastMessage: { ...dto.lastMessage!, content: '안녕' } }).preview).toBe('안녕')
  })
})
