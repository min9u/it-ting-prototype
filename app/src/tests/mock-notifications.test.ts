/**
 * 다른 영역 목 서버가 알림을 만드는 때 (명세 09 "알림의 종류"). 목에서 알림을 받는 계정은 나 하나라서
 * "다른 사람이 한 일" 흉내(mock*Actors · 채팅 상대 메시지 · 요청)가 받는 사람이 나일 때만 알림을 만든다
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  sessionStorage.clear(); localStorage.clear()
  vi.resetModules()
  window.history.replaceState(null, '', '/?api=fast&rt=quiet')
})
const latest = async () => (await import('../data/notifications')).noticeStore.get().list[0]

describe('목 서버의 알림 만들기', () => {
  it('누가 내 모임에 신청 → MEETUP_APPLICATION_RECEIVED (actor 신청자, 갈 곳 그 모임), 신청 관리에도 보임', async () => {
    const { mockMeetupActors } = await import('../api/meetups/mock')
    const S = await import('../data/meetupStore')
    const id = mockMeetupActors.apply('kim') // 내가 연 모집 중 모임 하나
    expect(id).toBeTruthy()
    expect(S.findMeetup(id!)?.hostId).toBe('me')
    expect(await latest()).toMatchObject({ type: 'MEETUP_APPLICATION_RECEIVED', actorId: 'kim', targetId: id, readAt: null })
    expect(S.applicantsOf(id!).map((a) => a.userId)).toContain('kim')
  })
  it('남의 모임에 남이 신청하면 받는 사람이 내가 아니라 알림 없음', async () => {
    const { mockMeetupActors } = await import('../api/meetups/mock')
    const N = await import('../data/notifications')
    const S = await import('../data/meetupStore')
    const before = N.noticeStore.get().list.length
    const other = S.getMeetupState().list.find((m) => m.hostId !== 'me' && m.hostId !== 'ha' && S.recruitOf(m) === 'open')!
    mockMeetupActors.apply('ha', other.id)
    expect(N.noticeStore.get().list.length).toBe(before)
  })
  it('주최자가 내 신청을 수락 → MEETUP_APPLICATION_ACCEPTED, 내 상태는 참여 확정', async () => {
    const { mockMeetupActors, mock } = await import('../api/meetups/mock')
    const S = await import('../data/meetupStore')
    const ids = await import('../api/common/ids')
    const pend = S.getMeetupState().list.find((m) => S.myOf(m.id)?.st === 'pending')!
    expect(mockMeetupActors.decide(pend.id, true)).toBe(true)
    expect(await latest()).toMatchObject({ type: 'MEETUP_APPLICATION_ACCEPTED', actorId: pend.hostId, targetId: pend.id })
    expect((await mock.get(ids.toDtoId(pend.id))).myStatus).toBe('CONFIRMED')
  })
  it('누가 내 방명록에 글 → GUESTBOOK_ENTRY_CREATED, 내 방명록 목록 맨 위', async () => {
    const { mockGuestbookActors } = await import('../api/explore/mock')
    const B = (await import('../api/burrow/mock')).mock
    const ids = await import('../api/common/ids')
    mockGuestbookActors.write('yerin', '놀러 왔어요')
    expect(await latest()).toMatchObject({ type: 'GUESTBOOK_ENTRY_CREATED', actorId: 'yerin', targetId: null })
    expect((await B.guestbookEntries(ids.toDtoId('me'), { page: 1 })).items[0].content).toBe('놀러 왔어요')
  })
  it('내 글에 댓글 · 좋아요 → POST_COMMENTED · POST_LIKED', async () => {
    const { mockCommunityActors } = await import('../api/community/mock')
    expect(mockCommunityActors.comment('yerin')).toBeTruthy()
    expect(await latest()).toMatchObject({ type: 'POST_COMMENTED', actorId: 'yerin' })
    expect(mockCommunityActors.like('mingu')).toBe(true)
    expect(await latest()).toMatchObject({ type: 'POST_LIKED', actorId: 'mingu' })
  })
  it('채팅: 대화방을 읽으면 그 방의 새 메시지 알림도 읽음', async () => {
    const N = await import('../data/notifications')
    const { pushMockNotification } = await import('../api/notifications/mock')
    const C = (await import('../api/chat/mock')).mock
    const ids = await import('../api/common/ids')
    pushMockNotification('CHAT_MESSAGE_RECEIVED', { actorId: 'yerin', targetId: 'r-yerin' })
    const msgs = await C.messages(ids.toDtoId('r-yerin'))
    await C.read(ids.toDtoId('r-yerin'), msgs.items[0].id)
    expect(N.noticeStore.get().list.filter((n) => n.type === 'CHAT_MESSAGE_RECEIVED' && n.targetId === 'r-yerin' && n.readAt == null)).toHaveLength(0)
  })
})
