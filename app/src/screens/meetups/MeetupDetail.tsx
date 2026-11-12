import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import Footer from '../../components/Footer'
import Modal from '../../components/Modal'
import { ConfirmDialog, TOAST, Toast, type ToastSpec } from '../../components/Feedback'
import { CalendarIcon, HeartIcon, PinIcon, SendIcon } from '../../components/Icons'
import { ME_ID, USERS, meetupOf, toneOf, userOf } from '../../data/mock'
import type { Meetup } from '../../data/types'
import { dateParts } from '../../lib/format'
import s from './Meetups.module.css'

const PREVIEW_CHAT = [
  { who: 'seoyeon', text: '이번 주 책은 다들 어디까지 읽으셨어요? 저는 절반쯤이요!' },
  { who: 'mingu', text: '저는 이제 막 2장 들어갔어요 ㅎㅎ 토요일까지 따라갈게요' },
  { who: 'me', text: '저도 절반쯤 읽었어요! 이번 주 모임 기대돼요' },
  { who: 'yejin', text: '혹시 성수역 근처에 조용한 카페 아시는 분 계신가요?' },
]

/** 신청 관리 팝업 805:1358 의 신청자 (목 데이터) */
const APPLICANTS = [
  { id: 'a1', name: '하린', overlap: 2, when: '1시간 전 신청', msg: '저도 요즘 소설 위주로 읽고 있어요. 같이 이야기 나눠요!' },
  { id: 'a2', name: '도윤', overlap: 1, when: '어제 신청', msg: '처음이라 떨리지만 참여해 보고 싶어요.' },
  { id: 'a3', name: '솔', overlap: 3, when: '어제 신청', msg: '' },
]

/** 모임 상세 상태 (2026-11-12 Figma 804:2 ~ 805:587) */
export type DetailState = 'open' | 'pending' | 'joined' | 'host' | 'full' | 'past' | 'cancelled'
const STATES: DetailState[] = ['open', 'pending', 'joined', 'host', 'full', 'past', 'cancelled']

function stateOf(m: Meetup): DetailState {
  if (m.cancelled) return 'cancelled'
  if (m.past) return 'past'
  if (m.myStatus === '내가 주최') return 'host'
  if (m.myStatus === '참여 확정') return 'joined'
  if (m.myStatus === '신청 대기') return 'pending'
  if (m.memberIds.length >= m.capacity) return 'full'
  return 'open'
}
const num = (n: number) => (n === 2 ? '두' : n === 1 ? '한' : String(n))

/**
 * 모임 상세 (Desktop) — 2026-11-12 Figma 상태별 화면 6개 + 신청 관리 팝업
 * - 신청 전(open): 오른쪽 신청 박스 (주최자에게 남길 말 + 참여 신청하기)
 * - 신청 대기 804:2: "신청을 보냈어요" + 남긴 말 + 신청 취소, 자리에 "대기 · 나"
 * - 참여 확정 804:246: 모임 대화 열기 + 참여 취소, 채팅 입력 열림
 * - 주최자 804:469: 확정 n / 정원 · 대기 n, 신청 관리(팝업 805:1358) · 모임 수정·취소(805:1677)
 * - 모집 완료 805:151 · 지난 모임 805:378 · 취소된 모임 805:587: 꺼진 버튼 + "비슷한 ○○ 모임 보기 →"
 * 데모용 쿼리: ?as=open|pending|joined|host|full|past|cancelled, ?modal=applicants, ?toast=applied|edited
 */
export default function MeetupDetail() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const m = meetupOf(id)
  const asParam = params.get('as') as DetailState | null
  const [state, setState] = useState<DetailState>(() => (asParam && STATES.includes(asParam) ? asParam : m ? stateOf(m) : 'open'))
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<ToastSpec | null>(() => (params.get('toast') === 'applied' ? TOAST.applied : params.get('toast') === 'edited' ? TOAST.edited : null))
  const [liked, setLiked] = useState(m?.myStatus === '찜')
  const [manage, setManage] = useState(params.get('modal') === 'applicants')
  const [applicants, setApplicants] = useState(APPLICANTS)
  const [accepted, setAccepted] = useState<string[]>([])
  const [confirm, setConfirm] = useState<null | 'cancelApply' | 'leave'>(null)
  if (!m) return <Navigate to="/meetups" replace />

  const me = USERS[ME_ID]
  const host = state === 'host'
  // 자리: 주최자 보기면 첫 자리가 "나", 참여 확정이면 나도 한 자리
  const members = host ? [ME_ID, ...m.memberIds.filter((u) => u !== m.hostId && u !== ME_ID)] : m.memberIds.filter((u) => u !== ME_ID)
  const seatNames = [...members.map((u) => (u === ME_ID ? '나' : userOf(u).nickname)), ...accepted, ...(state === 'joined' ? ['나'] : [])]
  const count = state === 'full' ? m.capacity : Math.min(m.capacity, seatNames.length)
  const left = Math.max(0, m.capacity - count)
  const waiting = applicants.length
  const { m: mm, d, w } = dateParts(m.date)
  const chatOpen = state === 'joined' || state === 'host'
  const closed = state === 'full' || state === 'past' || state === 'cancelled'
  const overlapMembers = m.memberIds.filter((uid) => userOf(uid).interests.some((i) => me.interests.includes(i))).length
  const chip = state === 'full' ? { label: '모집 완료', cls: s.chipDone } : state === 'past' ? { label: '지난 모임', cls: s.chipDone } : state === 'cancelled' ? { label: '취소됨', cls: s.chipCancel } : { label: `모집 중 · ${num(left)} 자리 남았어요`, cls: '' }
  const similar = `/meetups?q=${encodeURIComponent(m.interest)}`

  return (
    <div className={s.detailWrap}>
      <nav className={s.crumb}><Link to="/meetups">모임 탐색</Link> / <span>{m.interest}</span></nav>
      <div className={s.titleRow}>
        <div>
          <p className={s.titleChips}>
            <span className={s.topicChip} style={{ background: `var(--tone-${toneOf(m.interest)}-bg)`, color: `var(--tone-${toneOf(m.interest)}-fg)` }}>✓ {m.interest}</span>
            <span className={`${s.recruitChip} ${chip.cls}`}><i aria-hidden />{chip.label}</span>
          </p>
          <h1 className="display">{m.title}</h1>
        </div>
        <div className={s.utility}>
          <button className={s.util} aria-label="공유하기"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg></button>
          <button className={liked ? s.utilOn : s.util} onClick={() => setLiked((v) => !v)} aria-pressed={liked} aria-label="찜하기"><HeartIcon size={20} /></button>
        </div>
      </div>

      <div className={s.columns}>
        <div className={s.mainCol}>
          <section className={s.block}>
            <h2 className="display">모임 소개</h2>
            <p className={s.intro}>{m.intro}</p>
          </section>
          <section className={s.block}>
            <h2 className="display">모임 정보</h2>
            <dl className={s.infoGrid}>
              <div><dt><CalendarIcon size={18} /><span>언제</span></dt><dd>{mm}월 {d}일 {w}요일 {m.start.replace(':00', '시')}부터 {m.end.replace(':00', '시')}까지</dd></div>
              <div><dt><PinIcon size={18} /><span>어디서</span></dt><dd><strong>{m.place}</strong> <em>{m.mode}</em></dd></div>
            </dl>
            {state !== 'past' && state !== 'cancelled' && (
              <p className={s.seatsTitle}><strong>{left > 0 ? `${num(left)} 자리 남았어요` : '자리가 다 찼어요'}</strong></p>
            )}
            <ul className={s.seats}>
              {seatNames.slice(0, m.capacity).map((n, i) => (
                <li key={`${n}${i}`}><Avatar size={44} /><span>{n}</span>{i === 0 && <em>주최</em>}</li>
              ))}
              {state === 'full' && Array.from({ length: Math.max(0, m.capacity - seatNames.length) }).map((_, i) => (
                <li key={`f${i}`}><Avatar size={44} /><span>{['하린', '도윤', '솔'][i] ?? '두더지'}</span></li>
              ))}
              {state === 'pending' && left > 0 && <li className={s.waitSeat}><span className={s.seatHole}>대기</span><span>나</span></li>}
              {state !== 'full' && state !== 'past' && Array.from({ length: Math.max(0, left - (state === 'pending' ? 1 : 0)) }).map((_, i) => (
                <li key={`e${i}`} className={s.emptySeat}><span className={s.seatHole} /><span>{state === 'open' && i === 0 ? '나' : '빈자리'}</span></li>
              ))}
            </ul>
            <p className={s.seatsNote}>
              {state === 'open' && <>{count}명 참여 중 <span>· 신청하면 {count + 1}번째 두더지가 돼요</span></>}
              {state === 'pending' && <>{count}명 참여 중 <span>· 확정되면 {count + 1}번째 두더지가 돼요</span></>}
              {state === 'joined' && <>{count}명 참여 중 · 나도 함께해요</>}
              {state === 'host' && <>{count}명 참여 중 · 신청 대기 {waiting}명</>}
              {state === 'full' && <>{m.capacity}명 모두 모였어요</>}
              {state === 'cancelled' && <>참여자와 신청자에게는 알림이 전달됐어요</>}
            </p>
            {state !== 'host' && state !== 'cancelled' && <p className={s.overlap}>나와 관심사가 겹치는 두더지 {overlapMembers}명</p>}
          </section>
        </div>

        <aside className={s.chatCol}>
          <div className={s.chatPreview}>
            <div className={s.widgetHead}><h2 className="display">모임 채팅 <span className={s.cnt}>{count}</span></h2></div>
            <ul className={s.chatMsgs}>
              {PREVIEW_CHAT.map((c, i) => (
                <li key={i} className={c.who === 'me' ? s.chatMine : ''}>
                  {c.who !== 'me' && <span className={s.chatWho}>{userOf(c.who).nickname}</span>}
                  <p>{c.text}</p>
                </li>
              ))}
            </ul>
            {chatOpen ? (
              <form className={s.chatInput} onSubmit={(e) => e.preventDefault()}>
                <input placeholder="메시지를 입력하세요" /><button aria-label="전송"><SendIcon size={16} /></button>
              </form>
            ) : (
              <p className={s.chatLocked}>
                {state === 'past' ? <>지난 모임의 채팅은<br />읽기만 할 수 있어요.</> : state === 'cancelled' ? <>취소된 모임이라<br />채팅이 닫혔어요.</> : <>참여가 확정되면<br />모임 채팅에 참여할 수 있어요.</>}
              </p>
            )}
          </div>

          {state === 'open' && (
            <div className={s.applyBox}>
              <p>신청하면 주최자가 확인한 뒤 확정돼요.<br />확정되면 모임 채팅방이 열려요.</p>
              <label className={s.applyLabel} htmlFor="host-note">주최자에게 남길 말 <em>선택</em></label>
              <div className={s.applyInput}>
                <textarea id="host-note" maxLength={100} value={note} onChange={(e) => setNote(e.target.value)} placeholder="어떤 책을 읽고 계신지 알려주세요" />
                <span>{note.length} / 100</span>
              </div>
              <button className={`btn btn-primary btn-block ${s.applyBtn}`} disabled={left <= 0} onClick={() => { setState('pending'); setToast(TOAST.applied) }}>참여 신청하기</button>
              <span className={s.deadline}>{m.closesAt}에 신청이 마감돼요.</span>
            </div>
          )}

          {state === 'pending' && (
            <div className={s.stateBox}>
              <h2 className="display">신청을 보냈어요</h2>
              <p>주최자가 확인하면 알림으로 알려 드려요.</p>
              <span className={s.stateLabel}>주최자에게 남긴 말</span>
              <p className={s.sentNote}>{note || m.myNote || '요즘 『작별하지 않는다』 읽고 있어요!'}</p>
              <button className={`btn btn-line btn-block ${s.applyBtn}`} onClick={() => setConfirm('cancelApply')}>신청 취소</button>
              <span className={s.deadline}>{m.closesAt}에 신청이 마감돼요.</span>
            </div>
          )}

          {state === 'joined' && (
            <div className={s.stateBox}>
              <h2 className="display">참여가 확정됐어요</h2>
              <p>모임 날 만나요! 궁금한 건 모임 채팅에 물어보세요.</p>
              <Link to="/chat/r-book" className={`btn btn-primary btn-block ${s.applyBtn}`}>모임 대화 열기</Link>
              <button className={`btn btn-line btn-block ${s.applyBtn}`} onClick={() => setConfirm('leave')}>참여 취소</button>
              <span className={s.deadline}>{m.closesAt}에 신청이 마감돼요.</span>
            </div>
          )}

          {host && (
            <div className={s.stateBox}>
              <h2 className="display">내가 연 모임이에요</h2>
              <p>{waiting > 0 ? `신청 ${waiting}명이 확인을 기다리고 있어요.` : '확인을 기다리는 신청이 없어요.'}</p>
              <div className={s.hostStats}>
                <div><span>확정</span><strong>{count} / {m.capacity}명</strong></div>
                <div><span>대기</span><strong className={s.accentNum}>{waiting}명</strong></div>
              </div>
              <button className={`btn btn-cta btn-block ${s.applyBtn}`} onClick={() => setManage(true)}>신청 관리 {waiting > 0 && <span className={s.btnBadge}>{waiting}</span>}</button>
              <Link to={`/meetups/${m.id}/edit`} className={`btn btn-line btn-block ${s.applyBtn}`}>모임 수정 · 취소</Link>
              <span className={s.deadline}>{m.closesAt}에 신청이 마감돼요.</span>
            </div>
          )}

          {closed && (
            <div className={s.stateBox}>
              <h2 className="display">{state === 'full' ? '자리가 다 찼어요' : state === 'past' ? '끝난 모임이에요' : '주최자가 모임을 취소했어요'}</h2>
              <p>{state === 'full' ? '빈자리가 생기거나 비슷한 모임이 열리면 알려 드릴게요.' : state === 'past' ? `${mm}월 ${d}일에 모였어요. 다음 모임을 찾아보세요.` : '참여자와 신청자에게는 알림이 전달됐어요.'}</p>
              <button className={`btn btn-block ${s.applyBtn}`} disabled>{state === 'full' ? '모집 완료' : state === 'past' ? '지난 모임' : '취소된 모임'}</button>
              <Link to={similar} className={s.similar}>비슷한 {m.interest} 모임 보기 →</Link>
            </div>
          )}
        </aside>
      </div>
      <Footer />

      {/* 신청 관리 팝업 805:1358 */}
      <Modal open={manage} onClose={() => setManage(false)} width={560} labelledBy="manage-title">
        <div className={s.manage}>
          <h2 id="manage-title" className="display">신청 관리 <span className={s.cnt}>{waiting}</span></h2>
          <p className={s.manageSub}>{m.title}<span>확정 {count} / {m.capacity}명</span><span>대기 {waiting}명</span></p>
          <ul className={s.manageList}>
            {applicants.map((a) => (
              <li key={a.id}>
                <div className={s.manageHead}>
                  <Avatar size={44} />
                  <div><strong>{a.name}</strong><em>겹치는 관심사 {a.overlap}개</em><span>{a.when}</span></div>
                  <button className="btn btn-line" onClick={() => setApplicants((l) => l.filter((x) => x.id !== a.id))}>거절</button>
                  <button className="btn btn-primary" disabled={count >= m.capacity} onClick={() => { setApplicants((l) => l.filter((x) => x.id !== a.id)); setAccepted((l) => [...l, a.name]) }}>수락</button>
                </div>
                <p className={s.manageMsg}>{a.msg ? `"${a.msg}"` : '남긴 말이 없어요'}</p>
              </li>
            ))}
            {applicants.length === 0 && <li className={s.manageEmpty}>확인할 신청이 없어요.</li>}
          </ul>
          <p className={s.manageNote}>거절해도 상대에게 알리지 않아요. 수락하면 참여가 확정되고 알림이 가요.</p>
        </div>
      </Modal>

      <ConfirmDialog open={confirm === 'cancelApply'} onClose={() => setConfirm(null)} title="신청을 취소할까요?" desc="취소하면 주최자에게 보낸 신청과 남긴 말이 사라져요." confirmLabel="신청 취소"
        onConfirm={() => { setState('open'); setToast({ title: '신청을 취소했어요', desc: '마감 전까지 다시 신청할 수 있어요' }) }} />
      <ConfirmDialog open={confirm === 'leave'} onClose={() => setConfirm(null)} title="참여를 취소할까요?" desc="주최자와 참여자에게 알림이 가요. 다시 참여하려면 새로 신청해야 해요." confirmLabel="참여 취소"
        onConfirm={() => { setState('open'); setToast({ title: '참여를 취소했어요', desc: '주최자에게 알림으로 전했어요' }) }} />
      <Toast open={!!toast} onClose={() => setToast(null)} duration={6000} placement="top" {...(toast ?? { title: '' })} />
    </div>
  )
}
