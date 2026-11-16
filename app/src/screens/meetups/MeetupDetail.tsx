import { useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import Footer from '../../components/Footer'
import InterestChip from '../../components/InterestChip'
import ProfilePopup from '../../components/ProfilePopup'
import { ConfirmDialog, ReportDialog, TOAST } from '../../components/Feedback'
import { CalendarIcon, HeartIcon, HomeIcon, PinIcon } from '../../components/Icons'
import { ME_ID, USERS, categoryOf, toneOf } from '../../data/mock'
import { affOf } from '../../data/field'
import { groupRoomId, leaveRoom, roomOf, useChat } from '../../data/chat'
import type { User } from '../../data/types'
import {
  type MeetupX, apply, canQuit, deadlineLabel, deadlinePassed, findMeetup, hourLabel, leftOf, membersOf, myOf,
  parseHour, quit, recruitOf, report, toggleWish, useMeetups, withdraw,
} from '../../data/meetupStore'
import { dateParts } from '../../lib/format'
import { ActionToast, type MToast, SignHero, useOutside } from './parts'
import s from './Meetups.module.css'

/** 보는 사람에 따라 달라지는 행동 카드 (상태 표 03-status-table) */
export type View = 'open' | 'blocked' | 'pending' | 'rejected' | 'joined' | 'host' | 'hostZero' | 'full' | 'past' | 'cancelled'
const VIEWS: View[] = ['open', 'blocked', 'pending', 'rejected', 'joined', 'host', 'hostZero', 'full', 'past', 'cancelled']

const KO = ['영', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열']
const num = (n: number) => KO[n] ?? String(n)

function viewOf(m: MeetupX): View {
  const rec = recruitOf(m)
  if (rec === 'cancelled') return 'cancelled'
  if (rec === 'past') return 'past'
  const r = myOf(m.id)
  if (r?.st === 'host') return membersOf(m.id).length === 0 ? 'hostZero' : 'host'
  if (r?.st === 'joined') return 'joined'
  if (r?.st === 'pending') return 'pending'
  if (r?.st === 'rejected') return 'rejected'
  if (rec === 'closed') return 'full'
  if (r?.st === 'quit' || r?.st === 'kicked') return 'blocked'
  return 'open'
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
 * 1 브레드크럼(모임 탐색 / 대표 관심사 분야) · 대표 관심사 칩 · 모집 상태 (모집 중(남은 자리) / 모집 완료 / 지난 모임 / 취소됨)
 * 2 공유(링크 복사) · 찜  3 대표 이미지(표지판)  4 모집 현황(주최자가 첫 자리, 정원에 주최자 포함, 겹치는 관심사 수)
 * 5 주최자에게 남길 말(메시지를 안 받는 모임은 숨김)  6 참여 신청하기  7 모임 소개  8 모임 정보  9 모임 대화 미리보기(확정자·주최자만)
 * 주최자 카드: 사용자 표시(F0 4) → 프로필 팝업, 겹치는 관심사, 주최자 땅굴, 신고(M10)
 * 데모용 쿼리: ?as=open|blocked|pending|rejected|joined|host|hostZero|full|past|cancelled, ?toast=applied|edited|created
 */
export default function MeetupDetail() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const st = useMeetups()
  const chat = useChat()
  const m = findMeetup(id, st)
  const asParam = params.get('as') as View | null
  const [demo, setDemo] = useState<View | null>(asParam && VIEWS.includes(asParam) ? asParam : null)
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<MToast | null>(() => {
    const t = params.get('toast')
    if (t === 'applied') return APPLIED
    if (t === 'edited') return TOAST.edited
    if (t === 'created') return { title: '모임이 만들어졌어요', desc: '모임 탐색에 표지판이 세워졌어요' }
    return null
  })
  const [confirm, setConfirm] = useState<null | 'withdraw' | 'quit'>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [menu, setMenu] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useOutside(menuRef, menu, () => setMenu(false))

  if (params.get('modal') === 'applicants') return <Navigate to={`/meetups/me?tab=hosting&manage=${id}`} replace />
  if (!m) return <Navigate to="/meetups" replace />

  const view: View = demo ?? viewOf(m)
  const act = (fn: () => void) => { setDemo(null); fn() }
  const me = USERS[ME_ID]
  const host = USERS[m.hostId] ?? me
  const isHostView = view === 'host' || view === 'hostZero'
  const r = myOf(m.id, st)
  const member = r?.st === 'joined' || r?.st === 'host' || view === 'joined' || isHostView
  const mem = view === 'hostZero' ? [] : membersOf(m.id, st).filter((u) => u !== ME_ID)
  const meSeat = view === 'joined' || (r?.st === 'joined' && (view === 'past' || view === 'cancelled'))
  const count = view === 'hostZero' ? 1 : 1 + mem.length + (meSeat ? 1 : 0)
  const left = Math.max(0, m.capacity - count)
  const rec = recruitOf(m, st)
  const cat = categoryOf(m.interest)
  const shared = host.id === ME_ID ? [] : host.interests.filter((i) => me.interests.includes(i))
  const overlapMembers = [m.hostId, ...mem].filter((u) => u !== ME_ID && (USERS[u]?.interests ?? []).some((i) => me.interests.includes(i))).length
  const quitOk = canQuit(m)
  const deadline = m.deadline && !deadlinePassed(m) ? `${deadlineLabel(m.deadline)}에 신청이 마감돼요.` : null
  const similar = `/meetups${cat ? `?cat=${cat.id}` : ''}`
  const chip = rec === 'cancelled' ? { label: '취소됨', cls: s.chipCancel } : rec === 'past' ? { label: '지난 모임', cls: s.chipDone }
    : rec === 'closed' || view === 'full' ? { label: '모집 완료', cls: s.chipDone } : { label: `모집 중 · ${num(left)} 자리 남았어요`, cls: '' }

  // 자리: 주최자가 첫 자리 → 확정자 → (나) → 빈자리. 정원이 많으면 10자리까지 그리고 +N
  type Seat = { kind: 'host' | 'member' | 'me' | 'meWait' | 'empty'; uid?: string }
  const seats: Seat[] = [{ kind: 'host', uid: m.hostId === ME_ID && !isHostView ? undefined : m.hostId }]
  mem.forEach((u) => seats.push({ kind: 'member', uid: u }))
  if (meSeat) seats.push({ kind: 'me' })
  if ((view === 'open' || view === 'pending') && left > 0) seats.push({ kind: 'meWait' })
  // 미승인 카드는 그림처럼 빈자리 하나만 (03 상태: 신청 대기 · 미승인)
  while (seats.length < m.capacity && view !== 'rejected') seats.push({ kind: 'empty' })
  if (view === 'rejected' && left > 0) seats.push({ kind: 'empty' })
  const shown = seats.slice(0, 10)
  const more = seats.length - shown.length

  const room = roomOf(groupRoomId(m.id), chat)
  const recent = (room?.messages ?? []).filter((x) => !x.system).slice(-3)

  const titleOf: Record<View, string> = {
    open: `${num(left)} 자리 남았어요`, blocked: `${num(left)} 자리 남았어요`, pending: '신청을 보냈어요', rejected: '참여가 어려워요', joined: '참여가 확정됐어요',
    host: '내가 연 모임이에요', hostZero: '내가 연 모임이에요', full: '모집이 끝났어요', past: '끝난 모임이에요', cancelled: '취소된 모임이에요',
  }
  const { m: mm, d } = dateParts(m.date)

  return (
    <div className={s.detailWrap}>
      <nav className={s.crumb}><Link to="/meetups">모임 탐색</Link> / <Link to={similar}>{cat?.name ?? m.interest}</Link></nav>
      <div className={s.titleRow}>
        <div>
          <p className={s.titleChips}>
            <span className={s.topicChip} style={{ background: `var(--tone-${cat?.tone ?? 'sand'}-bg)`, color: `var(--tone-${cat?.tone ?? 'sand'}-fg)` }}>✓ {m.interest}</span>
            <span className={`${s.recruitChip} ${chip.cls}`}><i aria-hidden />{chip.label}</span>
          </p>
          <h1 className="display">{m.title}</h1>
        </div>
        <div className={s.utility}>
          <button className={s.util} aria-label="공유하기 (링크 복사)" onClick={() => { void navigator.clipboard?.writeText(location.href).catch(() => {}); setToast({ title: '모임 링크를 복사했어요', desc: '로그인하지 않은 사람은 로그인한 뒤 이 모임으로 와요' }) }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
          </button>
          <button className={st.wish.includes(m.id) ? s.utilOn : s.util} aria-pressed={st.wish.includes(m.id)} aria-label="찜하기"
            onClick={() => { const on = st.wish.includes(m.id); toggleWish(m.id); setToast(on ? { title: '찜을 해제했어요', undo: () => toggleWish(m.id) } : { title: '찜한 모임에 담았어요', desc: rec === 'closed' ? '찜한 모임에서 빈자리 알림을 받을 수 있어요' : undefined, link: { label: '찜한 모임 보기', to: '/meetups/me?tab=wish' } }) }}>
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
                  ? <>{m.campus && <span className={s.campusTag}>{m.campus}</span>}{m.place}{m.placeDetail && `, ${m.placeDetail}`}</>
                  : <>{m.platform === '기타' || !m.platform ? m.place : m.platform}
                    <span className={s.linkLine}>{member ? (m.link ? <>접속 링크 <a href={m.link} target="_blank" rel="noreferrer">{m.link}</a></> : '접속 링크는 주최자가 모임 대화방에서 알려줘요') : '접속 링크는 참여가 확정되면 보여요'}</span></>}
              </dd></div>
              <div><dt><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg><span>어떻게</span></dt><dd>{m.mode}</dd></div>
              <div><dt><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></svg><span>정원</span></dt><dd>{m.capacity}명 중 {count}명 확정 <small className={s.ddHint}>주최자 포함</small></dd></div>
              <div><dt><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2.5h6V4" /></svg><span>준비물</span></dt><dd>{m.prep || '없어요'}</dd></div>
            </dl>
            {m.tags.length > 0 && <p className={s.tagLine}><span>관심사 태그</span>{m.tags.map((t) => <InterestChip key={t} label={t} />)}</p>}
          </section>
        </div>

        <aside className={s.chatCol}>
          {/* 4~6 행동 카드 */}
          <div className={s.actCard}>
            <h2 className="display">{titleOf[view]}</h2>
            <ul className={s.seatRow}>
              {shown.map((x, i) => {
                const name = x.kind === 'host' ? '주최' : x.kind === 'member' ? (USERS[x.uid!]?.nickname ?? '두더지') : x.kind === 'me' || x.kind === 'meWait' ? '나' : '빈자리'
                const filled = x.kind === 'host' || x.kind === 'member' || x.kind === 'me'
                return (
                  <li key={i} className={x.kind === 'meWait' ? s.seatWait : x.kind === 'empty' ? s.seatEmpty : ''}>
                    {filled ? (
                      <button type="button" className={s.seatAva} onClick={() => x.uid && setProfile(USERS[x.uid] ?? null)} aria-label={x.uid ? `${USERS[x.uid]?.nickname}님 프로필` : '나'}>
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
            {view !== 'hostZero' && overlapMembers > 0 && <p className={s.overlap}><i aria-hidden>✓</i> 나와 관심사가 겹치는 두더지 {overlapMembers}명</p>}

            {view === 'open' && <>
              <p className={s.actText}>신청하면 주최자가 확인한 뒤 확정돼요. 확정되면 모임 채팅방이 열려요.</p>
              {m.askMsg && <>
                <label className={s.applyLabel} htmlFor="host-note">주최자에게 남길 말 <em>선택</em></label>
                <div className={s.applyInput}>
                  <textarea id="host-note" maxLength={100} value={note} onChange={(e) => setNote(e.target.value)} placeholder={m.interest === '독서' ? '어떤 책을 읽고 계신지 알려주세요' : '간단한 인사나 궁금한 점을 남겨 주세요'} />
                  <span>{note.length} / 100</span>
                </div>
              </>}
              <button className={`btn btn-cta btn-block ${s.applyBtn}`} disabled={left <= 0} onClick={() => act(() => { apply(m.id, note); setNote(''); setToast(APPLIED) })}>참여 신청하기</button>
            </>}
            {view === 'blocked' && <>
              <p className={s.actText}>신청하면 주최자가 확인한 뒤 확정돼요. 확정되면 모임 채팅방이 열려요.</p>
              <p className={s.noReapply}>이 모임에는 다시 신청할 수 없어요</p>
            </>}
            {view === 'pending' && <>
              <p className={s.actText}>주최자가 확인하면 알림으로 알려 드려요.</p>
              {r?.note && <><span className={s.stateLabel}>주최자에게 남긴 말</span><p className={s.sentNote}>{r.note}</p></>}
              <button className={`btn btn-line btn-block ${s.applyBtn} ${s.cancelBtn}`} onClick={() => setConfirm('withdraw')}>신청 취소</button>
            </>}
            {view === 'rejected' && <p className={s.actText}>아쉽게도 모임 참여가 승인되지 않았어요.<br />다른 모임을 둘러보세요.</p>}
            {view === 'joined' && <>
              <p className={s.actText}>모임 대화방에서 다른 참여자와 먼저 인사해 보세요.</p>
              <Link to={`/chat/${groupRoomId(m.id)}`} className={`btn btn-cta btn-block ${s.applyBtn}`}>모임 대화 열기</Link>
              <button className={`btn btn-line btn-block ${s.applyBtn} ${s.cancelBtn}`} disabled={!quitOk} onClick={() => setConfirm('quit')}>참여 취소</button>
              {!quitOk && <p className={s.actWarn}>시작 24시간 전부터는 참여를 취소할 수 없어요. 주최자에게 모임 대화로 알려주세요.</p>}
            </>}
            {isHostView && <>
              <p className={s.actText}>{view === 'hostZero' ? '아직 확정된 참여자가 없어요.' : '모임 대화방에서 참여자와 이야기해 보세요.'} 확정 {count} / {m.capacity}명</p>
              <Link to={`/chat/${groupRoomId(m.id)}`} className={`btn btn-cta btn-block ${s.applyBtn}`}>모임 대화 열기</Link>
              <Link to={`/meetups/${m.id}/edit`} className={`btn btn-line btn-block ${s.applyBtn} ${s.cancelBtn}`}>{view === 'hostZero' ? '모임 수정 · 삭제' : '모임 수정 · 취소'}</Link>
            </>}
            {(view === 'full' || view === 'past' || view === 'cancelled') && <>
              <p className={s.actText}>{view === 'full' ? (deadlinePassed(m) && leftOf(m, st) > 0 ? '모집 마감 시각이 지났어요. 비슷한 모임을 둘러보세요.' : '정원이 모두 찼어요. 비슷한 모임을 둘러보세요.') : view === 'past' ? `${mm}월 ${d}일에 열린 모임이에요.` : '주최자가 모임을 취소했어요.'}</p>
              <button className={`btn btn-block ${s.applyBtn}`} disabled>{view === 'full' ? '모집 완료' : view === 'past' ? '지난 모임' : '취소된 모임'}</button>
              {view === 'full' && <Link to={similar} className={s.similar}>비슷한 {cat?.name ?? m.interest} 모임 보기 →</Link>}
            </>}
            {deadline && ['open', 'pending', 'joined', 'host', 'hostZero', 'blocked'].includes(view) && <span className={s.deadline}>🕑 {deadline}</span>}
          </div>

          {/* 주최자 카드 */}
          <div className={s.hostBox}>
            <div className={s.hostTop}>
              <button type="button" className={s.hostAva} onClick={() => setProfile(host)} aria-label={`${host.nickname}님 프로필`}><Avatar size={48} /></button>
              <div>
                <button type="button" className={s.hostName} onClick={() => setProfile(host)}>{host.id === ME_ID ? '내가 열었어요' : `${host.nickname}님이 열었어요`}</button>
                <span>{affOf(host)}</span>
              </div>
              {host.id !== ME_ID && (
                <div className={s.moreWrap} ref={menuRef}>
                  <button type="button" className={s.moreBtn} aria-label="더 보기" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>⋯</button>
                  {menu && (
                    <ul className={s.moreMenu} role="menu">
                      <li><button type="button" role="menuitem" disabled={st.reported.includes(m.id)} onClick={() => { setMenu(false); setReportOpen(true) }}>{st.reported.includes(m.id) ? '이미 신고한 모임이에요' : '모임 신고'}</button></li>
                    </ul>
                  )}
                </div>
              )}
            </div>
            {shared.length > 0 && <p className={s.hostChips}><span>겹치는 관심사</span>{shared.slice(0, 4).map((i) => <InterestChip key={i} label={`✓ ${i}`} tone={toneOf(i)} />)}</p>}
            <Link to={host.id === ME_ID ? '/burrow' : `/burrow/${host.id}`} className={`btn btn-line btn-block ${s.hostGo}`}><HomeIcon size={16} /> {host.id === ME_ID ? '내 땅굴로 가기' : '주최자 땅굴 놀러 가기'}</Link>
          </div>

          {/* 9 모임 대화 미리보기: 확정자·주최자만 실제 메시지, 그 밖은 흐리게 */}
          <div className={s.chatPreview}>
            <div className={s.widgetHead}><h2 className="display">모임 대화</h2>{member ? <Link to={`/chat/${groupRoomId(m.id)}`} className={s.allLink}>모임 대화로 이동</Link> : <span className={s.muted}>참여 후 확인</span>}</div>
            {member ? (
              <Link to={`/chat/${groupRoomId(m.id)}`} className={s.chatMsgs}>
                {recent.length === 0 && <span className={s.calEmpty}>아직 대화가 없어요. 먼저 인사해 보세요.</span>}
                {recent.map((c) => (
                  <span key={c.id} className={s.chatLine}><small>{c.authorId === ME_ID ? '나' : USERS[c.authorId]?.nickname ?? '두더지'}</small>{c.text || '[모임 카드]'}</span>
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
        onConfirm={() => act(() => { withdraw(m.id); setToast({ title: '신청을 취소했어요', desc: '마감 전까지 다시 신청할 수 있어요' }) })} />
      <ConfirmDialog open={confirm === 'quit'} onClose={() => setConfirm(null)} title="참여를 취소할까요?" desc="주최자에게 알림이 가고 모임 대화방에서도 나가요. 확정 후 참여를 취소하면 이 모임에는 다시 신청할 수 없어요." confirmLabel="참여 취소"
        onConfirm={() => act(() => { quit(m.id); leaveRoom(groupRoomId(m.id)); setToast({ title: '참여를 취소했어요', desc: '주최자에게 알림으로 전했어요' }) })} />
      <ReportDialog open={reportOpen} target="모임" onClose={() => setReportOpen(false)} onConfirm={() => { report(m.id); setToast(TOAST.reported) }} />
      <ProfilePopup user={profile} onClose={() => setProfile(null)} />
      <ActionToast toast={toast} onClose={() => setToast(null)} duration={5000} />
    </div>
  )
}

/** 참여 신청 완료 토스트 (28-apply-toast): "신청 내역 보기" → 내 모임 "신청 대기" 탭 */
const APPLIED: MToast = { title: '참여 신청이 완료되었습니다', link: { label: '신청 내역 보기', to: '/meetups/me?tab=pending' } }
