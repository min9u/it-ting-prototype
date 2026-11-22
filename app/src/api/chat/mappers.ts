/** 06 채팅 DTO → 앱 모양 (목록 타일 · 요청 카드) */
import { toAppId, toPerson, type Person } from '../common'
import { ME_ID } from '../../data/mock'
import type { Req } from '../../data/chat'
import { parseIso } from '../../lib/time'
import type { ChatRequestDto, ChatRoomSummaryDto } from './types'

const ms = (iso: string | null | undefined) => (iso ? parseIso(iso) : undefined)

export interface ChatRoomItem {
  id: string
  kind: 'dm' | 'group'
  title: string
  /** 목록 타일 색을 정할 관심사 */
  topic: string
  memberCount: number
  partnerId?: string
  lastAt?: number
  preview: string
  unread: number
  closed?: 'left' | 'gone'
  ended: boolean
}
export function toChatRoomItem(d: ChatRoomSummaryDto): ChatRoomItem {
  const m = d.lastMessage
  const partner = d.partner ? toPerson(d.partner) : undefined
  let preview = ''
  if (m) {
    const body = m.type === 'MEETUP_SHARE' && !m.content ? `[모임] ${m.meetupTitle ?? ''}` : m.content ?? ''
    preview = d.type === 'MEETUP' && m.type !== 'SYSTEM' ? `${toAppId(m.senderId) === ME_ID ? '나' : m.senderNickname ?? '탈퇴한 사용자'}: ${body}` : body
  }
  return {
    id: toAppId(d.id), kind: d.type === 'DIRECT' ? 'dm' : 'group', title: d.title, topic: d.topic ?? partner?.id ?? d.title,
    memberCount: d.memberCount, partnerId: partner?.id, lastAt: ms(m?.createdAt), preview, unread: d.unreadCount,
    closed: d.closedReason === 'PARTNER_LEFT' ? 'left' : d.closedReason === 'PARTNER_WITHDRAWN' ? 'gone' : undefined, ended: d.ended,
  }
}
export interface ChatReqVM extends Req { person: Person }
const CONTEXT_TEXT = { BURROW_VISIT: '땅굴에 다녀갔어요', SAME_MEETUP: '같은 모임 참여 예정' } as const
export function toChatReq(d: ChatRequestDto): ChatReqVM {
  const person = toPerson(d.counterpart)
  return {
    id: toAppId(d.id), direction: d.direction === 'RECEIVED' ? 'received' : 'sent', userId: person.id, message: d.message ?? '',
    at: parseIso(d.createdAt), person,
    context: d.context === 'OTHER' ? (d.direction === 'SENT' ? '내가 먼저 대화를 요청했어요' : '대화를 요청했어요') : CONTEXT_TEXT[d.context],
  }
}
