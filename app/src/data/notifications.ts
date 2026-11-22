import { createStore } from '../lib/store'
import { applicantsOf, isPast, onVacancy, useMeetups, userName } from './meetupStore'
import { ME_ID } from './mock'

/**
 * F9 알림 저장소 (Figma 02 F9 · 2026-11-16 명세 스크린샷 기준)
 * - 종류 5가지: 모임 / 채팅 / 커뮤니티 / 땅굴 / 공지 (알림 화면 탭 = 설정 › 알림 설정 순서)
 * - 커뮤니티: 내 글에 댓글 · 내 글 좋아요 · 내 댓글의 답글 · 댓글/답글 좋아요 · 내 글/내 댓글이 신고로 가려짐. 땅굴: 방명록 새 글 · 내가 쓴 방명록 글이 신고로 가려짐 · 방노트(11-20 명세)
 * - 지울 수 없고 읽음 처리만. 30일이 지난 알림은 목록에서 빠진다 (원본 요청은 남음)
 * - 설정 › 알림 설정에서 끈 종류는 새 알림과 GNB 빨간 점에 나타나지 않는다
 */
export type NoticeKind = '모임' | '채팅' | '커뮤니티' | '땅굴' | '공지'
export const NOTICE_KINDS: NoticeKind[] = ['모임', '채팅', '커뮤니티', '땅굴', '공지']

/** 종류 아이콘 (원형 · 종류별 색 · 한 글자). 땅굴 색은 명세에 "디자인에서 정한다"라 이끼색으로 정함 */
export const KIND_META: Record<NoticeKind, { label: string; bg: string; desc: string }> = {
  모임: { label: '모', bg: '#A5532F', desc: '참여 신청, 수락, 일정, 빈자리 같은 모임 소식을 알려드려요.' },
  채팅: { label: '채', bg: '#5B8A72', desc: '새 메시지와 대화 요청을 알려드려요.' },
  커뮤니티: { label: '커', bg: '#C28A2E', desc: '내 글과 댓글에 달린 댓글, 좋아요를 알려드려요.' },
  땅굴: { label: '땅', bg: '#7A8448', desc: '내 방명록에 새 글이 남겨지면 알려드려요.' },
  공지: { label: '공', bg: '#6B4533', desc: '서비스 공지를 알려드려요.' },
}

/** 원본이 사라진 알림이 가리키던 것 (00 공통 21 안내 화면 /gone/:what) */
export type GoneKind = 'meetup' | 'post' | 'burrow' | 'chat' | 'notice'

export interface AppNotice {
  id: string
  kind: NoticeKind
  /** 명세 "알림 종류" 의 세부 이름 (예: 참여 신청 받음) */
  type: string
  title: string
  sub: string
  at: number
  unread: boolean
  /** 누르면 가는 곳 */
  to: string
  /** 원본이 사라짐 → 누르면 안내 화면 */
  gone?: GoneKind
  /** 요청 알림(참여 신청 받음 · 대화 요청): 팝업에서는 위 고정 영역으로 모으고 목록에서 뺀다 */
  request?: boolean
}

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR
export const NOTICE_TTL_DAYS = 30

function seed(): AppNotice[] {
  const now = Date.now()
  const at = (m: number) => now - m * MIN
  const d = (n: number, h = 0) => now - n * DAY - h * HOUR
  const N = (id: string, kind: NoticeKind, type: string, title: string, sub: string, t: number, to: string, extra: Partial<AppNotice> = {}): AppNotice =>
    ({ id, kind, type, title, sub, at: t, to, unread: false, ...extra })
  return [
    // 요청 알림 (알림 화면 목록에는 나오고, 팝업에서는 고정 줄로 모음)
    N('r1', '모임', '참여 신청 받음', '‘일요일 아침 드로잉’에 새 참여 신청이 왔어요', '하린님이 참여를 신청했어요', at(1), '/meetups/me?tab=hosting&manage=m3', { unread: true, request: true }),
    N('r2', '채팅', '대화 요청', '대화 요청이 왔어요', '서벅이님이 대화를 요청했어요', at(12), '/chat/requests', { request: true }),
    N('r3', '채팅', '대화 요청', '대화 요청이 왔어요', '하늘님이 대화를 요청했어요', at(60), '/chat/requests', { request: true }),
    // 일반 알림
    N('n1', '채팅', '새 메시지', '새 메시지가 도착했어요', '민구: 레트로게임 좋아하신다길래 반가워서 요청했어요!', at(10), '/chat/r-mingu', { unread: true }),
    N('n2', '모임', '빈자리 생김', '찜한 ‘홈카페 원두 나눔회’가 곧 마감돼요', '남은 자리 4석', at(65), '/meetups/m8', { unread: true }),
    N('n6', '땅굴', '방명록 새 글', '내 땅굴 방명록에 새 글이 남겨졌어요', '서벅이: 이젤 너무 귀엽다. 그림 스터디 열리면 꼭 불러줘!', at(180), '/burrow?modal=guestbook'),
    N('n3', '커뮤니티', '내 글에 댓글', '내 글에 댓글이 달렸어요', '‘이번 달에 읽은 책 한 줄씩 남겨요’ · 예진님', d(1, 2), '/board/p4'),
    N('n4', '커뮤니티', '내 댓글의 답글', '내 댓글에 답글이 달렸어요', '‘첫 캠핑 모임 다녀왔어요!’ · 하늘님', d(1, 5), '/board/p1'),
    N('n5', '모임', '신청 수락', '참여 신청이 수락됐어요', '‘주말의 작은 독서 모임’ 채팅방이 열렸어요', d(2), '/chat/g-m1'),
    N('n9', '모임', '모임 일정 임박', '‘초보 환영, 가평 1박 캠핑’이 곧 시작돼요', '11월 15일 (일) 오전 10:00 · 가평 자라섬 캠핑장', d(3), '/meetups/m4'),
    N('n8', '공지', '서비스 공지', '디굴디굴 이용 안내가 업데이트됐어요', '새 기능과 변경 사항을 확인해 보세요', d(5), '/settings/notices/sn2'),
    N('n11', '모임', '빈자리 생김', '찜한 ‘한강 야경 출사’ 모임에 빈자리가 생겼어요', '남은 자리 1석', d(6), '', { gone: 'meetup' }),
    N('n10', '모임', '모임 정보 수정', '‘주말의 작은 독서 모임’ 정보가 바뀌었어요', '장소가 성수동 어반플레이스 3층으로 바뀌었어요', d(7), '/meetups/m1'),
    N('n12', '커뮤니티', '댓글 좋아요', '내 댓글에 좋아요가 눌렸어요', '‘필름 현상소 어디가 좋아요?’ · 서연님', d(8), '', { gone: 'post' }),
    N('n13', '커뮤니티', '내 글 좋아요', '내 글에 좋아요가 눌렸어요', '‘이번 달에 읽은 책 한 줄씩 남겨요’ · 민구님 외 3명', d(9), '/board/p4'),
    N('n14', '커뮤니티', '신고로 가려짐', '내 글이 신고로 가려졌어요', '‘중고 텐트 나눔해요’', d(10), '', { gone: 'post' }),
    // F9 11-20: 가려진 댓글 · 방명록 글도 쓴 사람에게 알림 (누가 신고했는지는 알리지 않음)
    N('n26', '커뮤니티', '내 댓글 신고로 가려짐', '내 댓글이 신고로 가려졌어요', '‘역삼역 근처 보드게임 카페 정리’', d(11), '/board/p2'),
    N('n27', '땅굴', '방명록 글 신고로 가려짐', '내가 쓴 방명록 글이 신고로 가려졌어요', '예린님의 땅굴에 남긴 글', d(13), '/burrow/yerin'),
    N('n15', '모임', '모임 취소', '‘북한산 아침 등산’ 모임이 취소됐어요', '주최자가 모임을 취소했어요', d(12), '', { gone: 'meetup' }),
    N('n16', '채팅', '대화 요청 수락', '예린님이 대화 요청을 수락했어요', '1:1 대화방이 열렸어요', d(14), '/chat/r-yerin'),
    N('n17', '공지', '서비스 공지', '가을 이벤트 안내', '땅굴을 꾸미고 이웃을 초대해 보세요', d(16), '/settings/notices/sn4'),
    N('n18', '땅굴', '방명록 새 글', '내 땅굴 방명록에 새 글이 남겨졌어요', '하늘: 캠핑 배낭 보고 반가워서 들렀어요. 가평 모임 같이 가요!', d(18), '/burrow?modal=guestbook'),
    N('n19', '모임', '신청 미승인', '참여가 승인되지 않았어요', '‘지브리 영화 같이 보기’', d(20), '/meetups/m9'),
    N('n20', '모임', '빈자리 생김', '찜한 ‘테라리움 같이 만들어요’에 빈자리가 생겼어요', '남은 자리 4석', d(21), '/meetups/m6'),
    N('n21', '커뮤니티', '답글 좋아요', '내 답글에 좋아요가 눌렸어요', '‘역삼역 근처 보드게임 카페 정리’ · 하늘님', d(22), '/board/p2'),
    N('n22', '모임', '참여 취소', '‘일요일 아침 드로잉’ 참여자가 참여를 취소했어요', '예진님이 참여를 취소했어요', d(24), '/meetups/m3'),
    N('n23', '공지', '서비스 공지', '알림 기능 개선 안내', '알림을 종류별로 켜고 끌 수 있어요', d(25), '/settings/notices/sn5'),
    N('n24', '채팅', '새 메시지', '새 메시지가 도착했어요', '예린: 방 구경하시고 편하게 연락주세요!!!', d(27), '/chat/r-yerin'),
    N('n25', '모임', '모임에서 내보내짐', '‘퇴근 후 보드게임 한 판’ 참여가 취소됐어요', '주최자가 참여를 취소했어요', d(28), '/meetups/m2'),
    // 30일이 지나 자동으로 사라진 알림 (목록에 안 보임)
    N('n99', '모임', '신청 수락', '참여 신청이 수락됐어요', '‘시월의 한강 피크닉’', d(35), '/meetups/m1'),
  ]
}

type Prefs = Record<NoticeKind, boolean>
const ALL_ON: Prefs = { 모임: true, 채팅: true, 커뮤니티: true, 땅굴: true, 공지: true }

/** 알림 목록 (메모리) */
export const noticeStore = createStore({ list: seed() })
/** 알림 설정 (F10, 브라우저에 저장) */
export const noticePrefs = createStore({ kinds: ALL_ON, browserPush: false }, 'digul.noticePrefs.v1')

export const useNotices = () => noticeStore.use().list
export const useNoticePrefs = () => noticePrefs.use()

/** 보여줄 알림: 30일 이내 + 켠 종류, 안 읽은 것 맨 위 → 최신순 */
export function visibleNotices(list: AppNotice[], kinds: Prefs, now = Date.now()) {
  return list
    .filter((n) => now - n.at < NOTICE_TTL_DAYS * DAY && kinds[n.kind] !== false)
    .sort((a, b) => Number(b.unread) - Number(a.unread) || b.at - a.at)
}

/** GNB 알림 아이콘 빨간 점 */
export function useHasUnread() {
  const list = useNotices()
  const { kinds } = useNoticePrefs()
  return visibleNotices(list, kinds).some((n) => n.unread)
}

export function markNoticeRead(id: string) {
  noticeStore.set((s) => ({ list: s.list.map((n) => (n.id === id && n.unread ? { ...n, unread: false } : n)) }))
}
export function markAllNoticesRead() {
  noticeStore.set((s) => ({ list: s.list.map((n) => (n.unread ? { ...n, unread: false } : n)) }))
}
/** 새 알림 (관리자 공지 작성 등). 끈 종류여도 저장은 하되 보이지 않는다 */
export function pushNotice(n: Omit<AppNotice, 'id' | 'at' | 'unread'>) {
  const item: AppNotice = { ...n, id: `x${Date.now().toString(36)}`, at: Date.now(), unread: true }
  noticeStore.set((s) => ({ list: [item, ...s.list] }))
  // 브라우저 알림을 허용했으면 같은 내용을 푸시 (00 공통 2)
  const p = noticePrefs.get()
  if (p.browserPush && p.kinds[n.kind] && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(n.title, { body: n.sub }) } catch { /* 무시 */ }
  }
}
// 모집 완료였던 모임에 자리가 나면 빈자리 알림을 켠 사람에게 (명세 09 "빈자리 생김")
onVacancy((m, left) => pushNotice({ kind: '모임', type: '빈자리 생김', title: `찜한 ‘${m.title}’ 모임에 빈자리가 생겼어요`, sub: `남은 자리 ${left}석`, to: `/meetups/${m.id}` }))

export function setNoticeKind(kind: NoticeKind, on: boolean) {
  noticePrefs.set((s) => ({ kinds: { ...s.kinds, [kind]: on } }))
}
export function setBrowserPush(on: boolean) { noticePrefs.set({ browserPush: on }) }

/**
 * 모임 참여 요청 (알림 팝업 고정 줄): 내가 연 예정 모임에 온, 아직 처리하지 않은 참여 신청.
 * 신청자 목록은 모임 상세(신청 관리 팝업)의 목 데이터와 같은 사람들. 모임 쪽 저장소가 생기면
 * setMeetupApplicants 로 바꿔 넣으면 팝업 숫자가 따라 바뀐다.
 */
export const meetupRequestStore = createStore<{ byMeetup: Record<string, string[]> }>({
  byMeetup: { m3: ['하린', '도윤', '솔'] },
})
export function setMeetupApplicants(meetupId: string, names: string[]) {
  meetupRequestStore.set((s) => ({ byMeetup: { ...s.byMeetup, [meetupId]: names } }))
}
export function useMeetupRequests() {
  // 모임 저장소(data/meetupStore.ts)의 처리 안 된 신청. 신청 관리에서 수락·거절하면 숫자가 따라 줄어듦
  const ms = useMeetups()
  const hosted = ms.list.filter((m) => m.hostId === ME_ID && !isPast(m) && !m.cancelled)
  const rows = hosted.map((m) => ({ meetup: m, names: applicantsOf(m.id, ms).map((x) => userName(x.userId)) })).filter((r) => r.names.length > 0)
  const count = rows.reduce((a, r) => a + r.names.length, 0)
  // 신청이 온 모임이 하나면 그 모임의 신청 관리, 여러 개면 내 모임 › 내가 연 모임 탭
  const to = rows.length === 1 ? `/meetups/me?tab=hosting&manage=${rows[0].meetup.id}` : '/meetups/me?tab=hosting'
  return { count, rows, to, first: rows[0]?.names[0] }
}
