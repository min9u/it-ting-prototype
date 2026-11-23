/**
 * 10 설정 · 계정 DTO → 앱 모양, 그리고 "API 없이 프론트엔드가 갖는 글"(명세 10 "화면마다 부르는 API"의 오른쪽 칸):
 * 알림 갈래마다의 한 줄 설명, 탈퇴 사유의 글, 공지 분류 이름
 */
import { toAppId } from '../common/ids'
import { dotDate, parseIso } from '../../lib/time'
import type {
  AccountDto, NoticeCategory, NoticeDetailDto, NoticeSummaryDto, NotificationSettingValuesDto, WithdrawalCheckDto, WithdrawReason,
} from './types'
import type { PageDto } from '../common/types'

/* ===== 계정 ===== */
export interface AccountVM {
  hasPassword: boolean
  /** Google 로만 가입 (비밀번호 없음) → 비밀번호 변경 메뉴 없음 · 첫 화면 Google 연동하기 · 탈퇴는 Google 인증 */
  googleOnly: boolean
  googleLinked: boolean
  googleEmail: string | null
  canUnlinkGoogle: boolean
}
export const toAccount = (d: AccountDto): AccountVM => ({
  hasPassword: d.hasPassword, googleOnly: !d.hasPassword, googleLinked: d.isGoogleLinked, googleEmail: d.googleEmail, canUnlinkGoogle: d.canUnlinkGoogle,
})
/** 설정의 첫 화면 (10 영역 규칙 "가입 방법에 따라 달라지는 것") */
export const settingsHomePath = (a: AccountVM) => (a.hasPassword ? '/settings/password' : '/settings/google')

/* ===== 알림 설정 ===== */
export type NotifKey = keyof NotificationSettingValuesDto
/** 다섯 갈래 (알림 화면 탭과 같은 순서) + 한 줄 설명 · 아이콘 글자 · 색 */
export const NOTIF_KINDS: readonly { key: NotifKey; label: string; letter: string; color: string; desc: string }[] = [
  { key: 'isMeetupOn', label: '모임', letter: '모', color: '#A5532F', desc: '참여 신청, 수락, 일정, 빈자리 같은 모임 소식을 알려드려요.' },
  { key: 'isChatOn', label: '채팅', letter: '채', color: '#5B8A72', desc: '새 메시지와 대화 요청을 알려드려요.' },
  { key: 'isCommunityOn', label: '게시판', letter: '게', color: '#C28A2E', desc: '내 글과 댓글에 달린 댓글, 좋아요를 알려드려요.' },
  { key: 'isBurrowOn', label: '땅굴', letter: '땅', color: '#7A8448', desc: '내 방명록에 새 글이 남겨지면 알려드려요.' },
  { key: 'isNoticeOn', label: '공지', letter: '공', color: '#6B4533', desc: '서비스 공지를 알려드려요.' },
]
export interface NotifSettingsVM { values: NotificationSettingValuesDto; pushPublicKey: string }
export const pickValues = (d: NotificationSettingValuesDto): NotificationSettingValuesDto => ({
  isMeetupOn: d.isMeetupOn, isChatOn: d.isChatOn, isCommunityOn: d.isCommunityOn, isBurrowOn: d.isBurrowOn, isNoticeOn: d.isNoticeOn,
})

/* ===== 공지 ===== */
export const NOTICE_CAT_LABEL: Record<NoticeCategory, '공지' | '업데이트' | '이벤트'> = { NOTICE: '공지', UPDATE: '업데이트', EVENT: '이벤트' }
export interface NoticeRowVM { id: string; cat: '공지' | '업데이트' | '이벤트'; title: string; date: string }
export interface NoticeVM extends NoticeRowVM { body: string[] }
export const toNoticeRow = (d: NoticeSummaryDto): NoticeRowVM => ({ id: toAppId(d.id), cat: NOTICE_CAT_LABEL[d.category] ?? '공지', title: d.title, date: dotDate(parseIso(d.createdAt)) })
/** 본문은 줄바꿈만 살려 그대로 (꾸밈 없음) */
export const toNotice = (d: NoticeDetailDto): NoticeVM => ({ ...toNoticeRow(d), body: d.content.split('\n') })
export interface NoticePageVM { rows: NoticeRowVM[]; page: number; totalItems: number; totalPages: number }
export const toNoticePage = (d: PageDto<NoticeSummaryDto>): NoticePageVM => ({ rows: d.items.map(toNoticeRow), page: d.page, totalItems: d.totalItems, totalPages: d.totalPages })

/* ===== 탈퇴 ===== */
/** 탈퇴 사유 여섯 가지 (명세 10 회원 탈퇴 2). 글은 프론트가 갖고 서버에는 코드로 */
export const WITHDRAW_REASONS: readonly { code: WithdrawReason; label: string }[] = [
  { code: 'NOT_USING', label: '자주 쓰지 않아요' },
  { code: 'COURSE_ENDED', label: 'SSAFY 과정이 끝났어요' },
  { code: 'NO_MATCH', label: '맞는 사람이나 모임을 찾지 못했어요' },
  { code: 'INCONVENIENT', label: '쓰기 불편해요' },
  { code: 'UNPLEASANT', label: '불쾌한 일을 겪었어요' },
  { code: 'ETC', label: '기타' },
]
export interface WithdrawalCheckVM {
  canWithdraw: boolean
  hosting: { id: string; title: string; startsAt: number }[]
  googleVerified: boolean
}
export const toWithdrawalCheck = (d: WithdrawalCheckDto): WithdrawalCheckVM => ({
  canWithdraw: d.canWithdraw,
  hosting: d.hostingMeetups.map((m) => ({ id: toAppId(m.id), title: m.title, startsAt: parseIso(m.startsAt) })),
  googleVerified: d.isGoogleVerified,
})
