import { useState } from 'react'
import NotFound from '../../components/NotFound'
import { Link, Navigate, useParams, useSearchParams } from '@/lib/nav'
import Avatar from '../../components/Avatar'
import Footer from '../../components/Footer'
import ProfilePopup from '../../components/ProfilePopup'
import { ConfirmDialog, TOAST } from '../../components/Feedback'
import { CalendarIcon, HeartIcon, HomeIcon, PinIcon } from '../../components/Icons'
import { ME_ID, USERS } from '../../data/mock'
import { meetupCategoryOf, meetupToneOf } from '../../data/meetupCategory'
import { affOf } from '../../data/field'
import { chatKeys, useChatPreview, useMyId } from '../../api/chat'
import type { User } from '../../data/types'
import { type MeetupX, deadlineLabel, hourLabel, parseHour } from '../../data/meetupStore'
import { patch, useOptimistic } from '../../api'
import { MEETUP_ERRORS, MEETUP_LIMITS, meetupCalls, meetupKeys, useMeetupDetail, type MeetupDetailVM } from '../../api/meetups'
import { DetailSkeleton, QueryGate } from '../../components/AsyncState'
import { dateParts } from '../../lib/format'
import { ActionToast, type MToast, SignHero } from './parts'
import s from './Meetups.module.css'

/** 보는 사람에 따라 달라지는 행동 카드 (상태 표 03-status-table) */
export type View = 'open' | 'blocked' | 'pending' | 'rejected' | 'joined' | 'host' | 'hostZero' | 'full' | 'past' | 'cancelled'
const VIEWS: View[] = ['open', 'blocked', 'pending', 'rejected', 'joined', 'host', 'hostZero', 'full', 'past', 'cancelled']

const KO = ['영', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열']
const num = (n: number) => KO[n] ?? String(n)

/**
 * 서버가 준 모집 상태(recruitStatus) · 내 상태(myStatus) · can* 로 행동 카드를 고름 (프론트가 시각을 다시 계산하지 않음)
 * - 취소된 모임 · 신청 대기 중 취소됨(MEETUP_CANCELED) → 취소된 모임 카드, 지난 모임 → 지난 모임 카드 (참여자 · 주최자도: 명세 미정 → 모집 상태 카드)
 * - 주최자: canDelete 면 "모임 수정 · 삭제"(확정자 0명), 아니면 "모임 수정 · 취소"
 * - 미신청(NONE)인데 모집 완료면 모집 완료 카드, 참여 취소 · 내보내짐은 미신청 화면 + "다시 신청할 수 없어요"
 */
export function viewOf(d: Pick<MeetupDetailVM, 'recruit' | 'my' | 'can'>): View {
  if (d.recruit === 'cancelled' || d.my === 'MEETUP_CANCELED') return 'cancelled'
  if (d.recruit === 'past') return 'past'
  switch (d.my) {
    case 'HOST': return d.can.delete ? 'hostZero' : 'host'
    case 'CONFIRMED': return 'joined'
    case 'PENDING': return 'pending'
    case 'REJECTED': return 'rejected'
    // 명세 07 API: CANCELED · KICKED 는 모집 상태와 상관없이 미신청 화면 + "이 모임에는 다시 신청할 수 없어요"
    case 'CANCELED': case 'KICKED': return 'blocked'
    default: return d.recruit === 'closed' ? 'full' : 'open'
  }
}

/** "11월 8일 일요일 오후 2시부터 4시까지" */
function whenText(m: MeetupX) {
  const { m: mm, d, w } = dateParts(m.date)
  const a = hourLabel(m.start)
  if (!m.end) return `${mm}월 ${d}일 ${w}요일 ${a}`
  const sameHalf = /^(오전|오후)/.exec(m.start)?.[1] === /^(오전|오후)/.exec(m.end)?.[1] && parseHour(m.end) > parseHour(m.start)
  const b = sameHalf ? hourLabel(m.end).replace(/^(오전|오후)\s*/, '') : hourLabel(m.end)
  return `${mm}월 ${d}일 ${w}요일 ${a}부터 ${b}까지`
}

/**
 * 모임 – 상세 (Figma 02 F7 1073:9749) + 상태 화면 9개 (미신청 · 신청 대기 · 미승인 · 참여 확정 · 주최자 · 주최자 확정 0명 · 모집 완료 · 지난 · 취소)
 * API: GET /meetups/{id} (내 상태 · can* · chatRoomId), 찜 PUT/DELETE …/like, 신청 POST …/applications,
 *      신청 취소 POST …/withdraw-application, 참여 취소 POST …/cancel-participation
 * 1 브레드크럼(모임 / 카테고리) · 카테고리 칩 · 모집 상태 (모집 중(남은 자리) / 모집 완료 / 지난 모임 / 취소됨)
 * 2 공유(링크 복사) · 찜  3 대표 이미지(표지판)  4 모집 현황(participants: 주최자가 첫 자리, 정원에 주최자 포함, 겹치는 관심사 수)
 * 5 주최자에게 남길 말(isMessageEnabled 가 false 면 숨김)  6 참여 신청하기(canApply)  7 모임 소개  8 모임 정보(접속 링크는 joinUrl 이 올 때만)
 * 9 모임 대화 미리보기: chatRoomId 가 있을 때만 최근 3개 (없으면 가림)
 * 명세에서 뺀 것: 모임 신고(이번 범위 아님), 마감 임박 표시
 * 데모용 쿼리: ?as=open|blocked|pending|rejected|joined|host|hostZero|full|past|cancelled (행동 카드만 바꿔 봄), ?toast=applied|edited
 */
export default function MeetupDetail() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  // 서버에서 받기 (api/meetups queries). 로딩 · 오류(다시 시도) · 진짜 없음(404) 을 나눠 그림
  const q = useMeetupDetail(id)
  if (params.get('modal') === 'applicants') return <Navigate to={`/meetups/me?tab=hosting&manage=${id}`} replace />
  return (
    <QueryGate q={q} skeleton={<DetailSkeleton label="모임을 불러오는 중" />} notFound={<NotFound what="meetup" />}>
      {(d) => <MeetupDetailView key={id} d={d} />}
    </QueryGate>
  )
}

function MeetupDetailView({ d: data }: { d: MeetupDetailVM }) {
  const [params] = useSearchParams()
  const m = data.meetup
  const run = useOptimistic()
  const asParam = params.get('as') as View | null
  const [demo, setDemo] = useState<View | null>(asParam && VIEWS.includes(asParam) ? asParam : null)
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<MToast | null>(() => {
    const t = params.get('toast')
    if (t === 'applied') return APPLIED
    if (t === 'edited') return TOAST.edited
    return null
  })
  const [confirm, setConfirm] = useState<null | 'withdraw' | 'quit'>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const key = meetupKeys.detail(m.id)
  const detailPatch = (f: (o: MeetupDetailVM) => MeetupDetailVM) => patch<MeetupDetailVM>(key, f, true)

  /** 찜: 화면을 먼저 바꾸고 실패하면 되돌림. 찜을 풀면 빈자리 알림도 꺼짐 → "되돌리기"는 알림까지 다시 켬 */
  const like = (on: boolean, hadAlert = false) => run.mutate({
    call: () => (on ? meetupCalls.relike(m.id, hadAlert) : meetupCalls.unlike(m.id)), errors: MEETUP_ERRORS, invalidate: [meetupKeys.all],
    errorTitle: on ? '찜하지 못했어요' : '찜을 해제하지 못했어요',
    patches: [detailPatch((o) => ({ ...o, liked: on, alert: on ? hadAlert : false }))],
  }, { onError: () => setToast(null) })

  const view: View = demo ?? viewOf(data)
  const act = (fn: () => void) => { setDemo(null); fn() }
  const isHostView = view === 'host' || view === 'hostZero'
  const rec = data.recruit
  const cat = meetupCategoryOf(m.category)
  const chatTo = data.chatRoomId ? `/chat/${data.chatRoomId}` : null
  const similar = `/meetups${cat ? `?cat=${cat.id}` : ''}`

  // 좌석: 주최자가 첫 자리 → 확정된 순서 (나 포함) → (신청하면 들어갈 내 자리) → 빈자리. 데모 보기는 좌석만 맞춰 그림
  type Seat = { kind: 'host' | 'member' | 'me' | 'meWait' | 'empty'; user?: User }
  let real = data.seats
  if (view === 'hostZero') real = real.filter((x) => x.isHost)
  const seats: Seat[] = real.map((x) => ({ kind: x.isHost ? 'host' : x.isMe ? 'me' : 'member', user: x.isMe ? undefined : x.person }))
  if (view === 'joined' && !real.some((x) => x.isMe)) seats.push({ kind: 'me' })
  const count = seats.length
  const left = Math.max(0, m.capacity - count)
  if ((view === 'open' || view === 'pending') && left > 0) seats.push({ kind: 'meWait' })
  // 미승인 카드는 그림처럼 빈자리 하나만 (03 상태: 신청 대기 · 미승인)
  while (seats.length < m.capacity && view !== 'rejected') seats.push({ kind: 'empty' })
  if (view === 'rejected' && left > 0) seats.push({ kind: 'empty' })
  const shown = seats.slice(0, 10)
  const more = seats.length - shown.length
  const hostSeat = data.seats.find((x) => x.isHost)
  const host = data.host
  const mine = data.my === 'HOST' || host.id === ME_ID

  const applyOn = demo === 'open' || (!demo && data.can.apply)
  const quitOn = demo === 'joined' || (!demo && data.can.cancelParticipation)
  const deadline = data.deadline && rec === 'open' ? `${deadlineLabel(data.deadline)}에 신청이 마감돼요.` : null
  const chip = rec === 'cancelled' ? { label: '취소됨', cls: s.chipCancel } : rec === 'past' ? { label: '지난 모임', cls: s.chipDone }
    : rec === 'closed' || view === 'full' ? { label: '모집 완료', cls: s.chipDone } : { label: `모집 중 · ${num(left)} 자리 남았어요`, cls: '' }

  // 모임 대화 미리보기: chatRoomId 가 있는 사람만 (그 밖은 내용을 받지 않음). 06 메시지 조회 size=3 (안내 메시지는 문구 없이 빼고 보임)
  const preview = useChatPreview(data.chatRoomId)
  const myId = useMyId()
  const recent = (preview.data ?? []).filter((x) => x.type === 'TEXT')

  const titleOf: Record<View, string> = {
    open: `${num(left)} 자리 남았어요`, blocked: `${num(left)} 자리 남았어요`, pending: '신청을 보냈어요', rejected: '참여가 어려워요', joined: '참여가 확정됐어요',
    host: '내가 연 모임이에요', hostZero: '내가 연 모임이에요', full: '모집이 끝났어요', past: '끝난 모임이에요', cancelled: '취소된 모임이에요',
  }
  const { m: mm, d } = dateParts(m.date)
  const linkLine = m.link
    ? <>접속 링크 <a href={m.link} target="_blank" rel="noreferrer">{m.link}</a></>
    : data.my === 'HOST' || data.my === 'CONFIRMED' ? '접속 링크는 주최자가 모임 대화방에서 알려줘요' : '접속 링크는 참여가 확정되면 보여요'

  return (
    <div className={s.detailWrap}>
      <nav className={s.crumb}><Link to="/meetups">모임</Link> / <Link to={similar}>{cat?.name ?? m.category}</Link></nav>
      <div className={s.titleRow}>
        <div>
          <p className={s.titleChips}>
            <span className={s.topicChip} style={{ background: `var(--tone-${meetupToneOf(m.category)}-bg)`, color: `var(--tone-${meetupToneOf(m.category)}-fg)` }}>{m.category}</span>
            <span className={`${s.recruitChip} ${chip.cls}`}><i aria-hidden />{chip.label}</span>
          </p>
          <h1 className="display">{m.title}</h1>
        </div>
        <div className={s.utility}>
          <button className={s.util} aria-label="공유하기 (링크 복사)" onClick={() => { void navigator.clipboard?.writeText(location.href.split('?')[0]).catch(() => {}); setToast({ title: '모임 링크를 복사했어요', desc: '로그인하지 않은 사람은 로그인한 뒤 이 모임으로 와요' }) }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
          </button>
          <button className={data.liked ? s.utilOn : s.util} aria-pressed={data.liked} aria-label="찜하기" disabled={run.isPending}
            onClick={() => {
              const on = data.liked
              const hadAlert = data.alert
              like(!on)
              setToast(on ? { title: '찜을 해제했어요', undo: () => like(true, hadAlert) } : { title: '찜한 모임에 담았어요', desc: rec === 'closed' ? '찜한 모임에서 빈자리 알림을 받을 수 있어요' : undefined, link: { label: '찜한 모임 보기', to: '/meetups/me?tab=wish' } })
            }}>
            <HeartIcon size={20} />
          </button>
        </div>
      </div>

      <div className={s.columns}>
        <div className={s.mainCol}>
          <SignHero m={m} />
          <section className={s.block}>
            <h2 className="display">모임 소개</h2>
            <p className={s.intro}>{m.intro || '주최자가 아직 소개를 적지 않았어요.'}</p>
          </section>
          <section className={s.block}>
            <h2 className="display">모임 정보</h2>
            <dl className={s.infoGrid}>
              <div><dt><CalendarIcon size={18} /><span>언제</span></dt><dd>{whenText(m)}</dd></div>
              <div><dt><PinIcon size={18} /><span>어디서</span></dt><dd>
                {m.mode === '오프라인'
                  ? <>{m.place}{m.placeDetail && `, ${m.placeDetail}`}</>
                  : <>온라인<span className={s.linkLine}>{linkLine}</span></>}
              </dd></div>
              <div><dt><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg><span>어떻게</span></dt><dd>{m.mode}</dd></div>
              <div><dt><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></svg><span>정원</span></dt><dd>{m.capacity}명 중 {count}명 확정 <small className={s.ddHint}>주최자 포함</small></dd></div>
              <div><dt><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2.5h6V4" /></svg><span>준비물</span></dt><dd>{m.prep || '없어요'}</dd></div>
            </dl>
          </section>
        </div>

        <aside className={s.chatCol}>
          {/* 4~6 행동 카드 */}
          <div className={s.actCard}>
            <h2 className="display">{titleOf[view]}</h2>
            <ul className={s.seatRow}>
              {shown.map((x, i) => {
                const name = x.kind === 'host' ? '주최' : x.kind === 'member' ? (x.user?.nickname ?? '두더지') : x.kind === 'me' || x.kind === 'meWait' ? '나' : '빈자리'
                const filled = x.kind === 'host' || x.kind === 'member' || x.kind === 'me'
                return (
                  <li key={i} className={x.kind === 'meWait' ? s.seatWait : x.kind === 'empty' ? s.seatEmpty : ''}>
                    {filled ? (
                      <button type="button" className={s.seatAva} onClick={() => x.user && setProfile(x.user)} aria-label={x.user ? `${x.user.nickname}님 프로필` : '나'}>
                        <Avatar size={40} /><i className={s.seatCheck} aria-hidden>✓</i>
                      </button>
                    ) : <span className={s.seatHole}>{x.kind === 'meWait' && <Avatar size={34} />}</span>}
                    <span>{name}</span>
                  </li>
                )
              })}
              {more > 0 && <li className={s.seatEmpty}><span className={s.seatHole}>+{more}</span><span>빈자리</span></li>}
            </ul>
            {view === 'hostZero'
              ? <p className={s.seatsNote}><strong>아직 함께하는 두더지가 없어요</strong></p>
              : <p className={s.seatsNote}><strong>{count}명 참여 중</strong>{(view === 'open' || view === 'pending') && left > 0 && <> · 신청하면 {count + 1}번째 두더지가 돼요</>}</p>}
            {view !== 'hostZero' && data.sharedCount > 0 && <p className={s.overlap}><i aria-hidden>✓</i> 나와 관심사가 겹치는 두더지 {data.sharedCount}명</p>}

            {view === 'open' && <>
              <p className={s.actText}>신청하면 주최자가 확인한 뒤 확정돼요. 확정되면 모임 채팅방이 열려요.</p>
              {m.askMsg && <>
                <label className={s.applyLabel} htmlFor="host-note">주최자에게 남길 말 <em>선택</em></label>
                <div className={s.applyInput}>
                  <textarea id="host-note" maxLength={MEETUP_LIMITS.message} value={note} onChange={(e) => setNote(e.target.value)} placeholder={m.category === '취미/문화' && /독서|책/.test(m.title) ? '어떤 책을 읽고 계신지 알려주세요' : '간단한 인사나 궁금한 점을 남겨 주세요'} />
                  <span>{note.length} / {MEETUP_LIMITS.message}</span>
                </div>
              </>}
              <button className={`btn btn-cta btn-block ${s.applyBtn}`} disabled={!applyOn || run.isPending} onClick={() => act(() => {
                const msg = m.askMsg ? note.trim() : ''
                run.mutate({
                  call: () => meetupCalls.apply(m.id, msg || null), errors: MEETUP_ERRORS, errorTitle: '참여 신청을 보내지 못했어요', invalidate: [meetupKeys.all],
                  patches: [detailPatch((o) => ({ ...o, my: 'PENDING', can: { ...o.can, apply: false } }))],
                }, { onSuccess: () => { setNote(''); setToast(APPLIED) } })
              })}>참여 신청하기</button>
            </>}
            {view === 'blocked' && <>
              <p className={s.actText}>신청하면 주최자가 확인한 뒤 확정돼요. 확정되면 모임 채팅방이 열려요.</p>
              <p className={s.noReapply}>이 모임에는 다시 신청할 수 없어요</p>
            </>}
            {view === 'pending' && <>
              <p className={s.actText}>주최자가 확인하면 알림으로 알려 드려요. 모집 마감까지 확인하지 않으면 자동으로 미승인돼요.</p>
              <button className={`btn btn-line btn-block ${s.applyBtn} ${s.cancelBtn}`} disabled={run.isPending} onClick={() => setConfirm('withdraw')}>신청 취소</button>
            </>}
            {view === 'rejected' && <p className={s.actText}>아쉽게도 모임 참여가 승인되지 않았어요.<br />다른 모임을 둘러보세요.</p>}
            {view === 'joined' && <>
              <p className={s.actText}>모임 대화방에서 다른 참여자와 먼저 인사해 보세요.</p>
              {chatTo ? <Link to={chatTo} className={`btn btn-cta btn-block ${s.applyBtn}`}>모임 대화 열기</Link> : <button className={`btn btn-cta btn-block ${s.applyBtn}`} disabled>모임 대화 열기</button>}
              <button className={`btn btn-line btn-block ${s.applyBtn} ${s.cancelBtn}`} disabled={!quitOn || run.isPending} onClick={() => setConfirm('quit')}>참여 취소</button>
              {!quitOn && <p className={s.actWarn}>시작 24시간 전부터는 참여를 취소할 수 없어요. 주최자에게 모임 대화로 알려주세요.</p>}
            </>}
            {isHostView && <>
              <p className={s.actText}>{view === 'hostZero' ? '아직 확정된 참여자가 없어요.' : '모임 대화방에서 참여자와 이야기해 보세요.'} 확정 {count} / {m.capacity}명</p>
              {chatTo ? <Link to={chatTo} className={`btn btn-cta btn-block ${s.applyBtn}`}>모임 대화 열기</Link> : <button className={`btn btn-cta btn-block ${s.applyBtn}`} disabled>모임 대화 열기</button>}
              <Link to={`/meetups/${m.id}/edit`} className={`btn btn-line btn-block ${s.applyBtn} ${s.cancelBtn}`}>{view === 'hostZero' ? '모임 수정 · 삭제' : '모임 수정 · 취소'}</Link>
            </>}
            {(view === 'full' || view === 'past' || view === 'cancelled') && <>
              <p className={s.actText}>{view === 'full' ? (count < m.capacity ? '모집 마감 시각이 지났어요. 비슷한 모임을 둘러보세요.' : '정원이 모두 찼어요. 비슷한 모임을 둘러보세요.') : view === 'past' ? `${mm}월 ${d}일에 열린 모임이에요.` : '주최자가 모임을 취소했어요.'}</p>
              <button className={`btn btn-block ${s.applyBtn}`} disabled>{view === 'full' ? '모집 완료' : view === 'past' ? '지난 모임' : '취소된 모임'}</button>
              {view === 'full' && <Link to={similar} className={s.similar}>같은 {cat?.name ?? m.category} 모임 보기 →</Link>}
            </>}
            {deadline && ['open', 'pending', 'joined', 'host', 'hostZero', 'blocked'].includes(view) && <span className={s.deadline}>🕑 {deadline}</span>}
          </div>

          {/* 주최자 카드 (명세에 항목은 없지만 Figma 에 있어 둠 — open-issues). 신고는 이번 범위가 아니라 뺌 */}
          <div className={s.hostBox}>
            <div className={s.hostTop}>
              <button type="button" className={s.hostAva} onClick={() => setProfile(host)} aria-label={`${host.nickname}님 프로필`}><Avatar size={48} /></button>
              <div>
                <button type="button" className={s.hostName} onClick={() => setProfile(host)}>{mine ? '내가 열었어요' : `${host.nickname}님이 열었어요`}</button>
                <span>{host.affiliation || affOf(USERS[host.id] ?? host)}</span>
              </div>
            </div>
            {!mine && hostSeat?.shared && <p className={s.hostChips}><span>✓ 나와 겹치는 관심사가 있어요</span></p>}
            <Link to={mine ? '/burrow' : `/burrow/${host.id}`} className={`btn btn-line btn-block ${s.hostGo}`}><HomeIcon size={16} /> {mine ? '내 땅굴로 가기' : '주최자 땅굴 놀러 가기'}</Link>
          </div>

          {/* 9 모임 대화 미리보기: chatRoomId 가 있는 사람(확정자 · 주최자)만 최근 3개, 그 밖은 흐리게 */}
          <div className={s.chatPreview}>
            <div className={s.widgetHead}><h2 className="display">모임 대화</h2>{chatTo ? <Link to={chatTo} className={s.allLink}>모임 대화로 이동</Link> : <span className={s.muted}>참여 후 확인</span>}</div>
            {chatTo ? (
              <Link to={chatTo} className={s.chatMsgs}>
                {recent.length === 0 && <span className={s.calEmpty}>아직 대화가 없어요. 먼저 인사해 보세요.</span>}
                {recent.map((c) => (
                  <span key={c.id} className={s.chatLine}><small>{c.authorId === myId ? '나' : c.author.nickname}</small>{c.text || (c.card ? '[모임 카드]' : c.images.length ? '[사진]' : '')}</span>
                ))}
              </Link>
            ) : (
              <div className={s.chatBlur}>
                <div aria-hidden className={s.blurLines}><i /><i /><i /><i /><i /></div>
                <span className={s.blurPill}>참여가 확정되면 모임 대화를 볼 수 있어요</span>
              </div>
            )}
          </div>
        </aside>
      </div>
      <Footer />

      <ConfirmDialog open={confirm === 'withdraw'} onClose={() => setConfirm(null)} title="신청을 취소할까요?" desc="취소하면 주최자에게 보낸 신청과 남긴 말이 사라져요. 스스로 취소한 신청은 다시 신청할 수 있어요." confirmLabel="신청 취소"
        onConfirm={() => act(() => run.mutate({
          call: () => meetupCalls.withdrawApplication(m.id), errors: MEETUP_ERRORS, errorTitle: '신청을 취소하지 못했어요', invalidate: [meetupKeys.all],
          patches: [detailPatch((o) => ({ ...o, my: 'NONE', can: { ...o.can, apply: o.recruit === 'open' } }))],
        }, { onSuccess: () => setToast({ title: '신청을 취소했어요', desc: '마감 전까지 다시 신청할 수 있어요' }) }))} />
      <ConfirmDialog open={confirm === 'quit'} onClose={() => setConfirm(null)} title="참여를 취소할까요?" desc="주최자에게 알림이 가고 모임 대화방에서도 나가요. 확정 후 참여를 취소하면 이 모임에는 다시 신청할 수 없어요." confirmLabel="참여 취소"
        onConfirm={() => act(() => run.mutate({
          // 참여를 취소하면 모임 대화방에서도 나감(명세 06): 그 대화방 · 메시지 · 대화 목록도 다시 받게 (뒤로 가기로 대화방에 돌아와도 이전 메시지가 안 남게)
          call: () => meetupCalls.cancelParticipation(m.id), errors: MEETUP_ERRORS, errorTitle: '참여를 취소하지 못했어요',
          invalidate: [meetupKeys.all, chatKeys.rooms, ...(data.chatRoomId ? [chatKeys.room(data.chatRoomId), chatKeys.messages(data.chatRoomId)] : [])],
          patches: [detailPatch((o) => ({ ...o, my: 'CANCELED', confirmed: o.confirmed - 1, seats: o.seats.filter((x) => !x.isMe), chatRoomId: null, can: { ...o.can, cancelParticipation: false } }))],
        }, { onSuccess: () => setToast({ title: '참여를 취소했어요', desc: '주최자에게 알림으로 전했어요' }) }))} />
      <ProfilePopup user={profile} onClose={() => setProfile(null)} />
      <ActionToast toast={toast} onClose={() => setToast(null)} duration={5000} />
    </div>
  )
}

/** 참여 신청 완료 토스트 (28-apply-toast): "신청 내역 보기" → 내 모임 "신청 대기" 탭 */
const APPLIED: MToast = { title: '참여 신청이 완료되었습니다', link: { label: '신청 내역 보기', to: '/meetups/me?tab=pending' } }
