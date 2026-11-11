import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import Footer from '../../components/Footer'
import { Toast } from '../../components/Feedback'
import { CalendarIcon, HeartIcon, PinIcon, SendIcon } from '../../components/Icons'
import { ME_ID, USERS, meetupOf, toneOf, userOf } from '../../data/mock'
import { dateParts } from '../../lib/format'
import s from './Meetups.module.css'

const PREVIEW_CHAT = [
  { who: 'seoyeon', text: '이번 주 책은 다들 어디까지 읽으셨어요? 저는 절반쯤이요!' },
  { who: 'mingu', text: '저는 이제 막 2장 들어갔어요 ㅎㅎ 토요일까지 따라갈게요' },
  { who: 'me', text: '저도 절반쯤 읽었어요! 이번 주 모임 기대돼요' },
  { who: 'yejin', text: '혹시 성수역 근처에 조용한 카페 아시는 분 계신가요?' },
]

/**
 * 모임 상세 (Desktop) · 채팅 수정안 494:13857 — 2026-11-11 스크린샷 대조
 * - 기본안 408:13129 와 참여 신청 팝업 544:7521 은 Figma에서 지워짐 → 신청은 오른쪽 "신청 박스"에서 바로
 *   (주최자에게 남길 말 100자 + 참여 신청하기 + 마감일)
 * - 주최자 카드도 없어지고 참여자 첫 자리에 "주최" 배지
 * - 참여 신청 완료 토스트 642:7955
 * 데모용 쿼리: ?toast=applied
 */
export default function MeetupDetail() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const m = meetupOf(id)
  const [note, setNote] = useState('')
  const [applied, setApplied] = useState(params.get('toast') === 'applied')
  const [toast, setToast] = useState(params.get('toast') === 'applied')
  const [liked, setLiked] = useState(m?.myStatus === '찜')
  if (!m) return <Navigate to="/meetups" replace />

  const me = USERS[ME_ID]
  const left = m.capacity - m.memberIds.length
  const { m: mm, d, w } = dateParts(m.date)
  const joined = m.myStatus === '참여 확정' || m.myStatus === '내가 주최'
  const overlapMembers = m.memberIds.filter((uid) => userOf(uid).interests.some((i) => me.interests.includes(i))).length

  return (
    <div className={s.detailWrap}>
      <nav className={s.crumb}><Link to="/meetups">모임 탐색</Link> / <span>{m.interest}</span></nav>
      <div className={s.titleRow}>
        <div>
          <p className={s.titleChips}>
            <span className={s.topicChip} style={{ background: `var(--tone-${toneOf(m.interest)}-bg)`, color: `var(--tone-${toneOf(m.interest)}-fg)` }}>✓ {m.interest}</span>
            <span className={s.recruitChip}><i aria-hidden />{left > 0 ? `모집 중 · ${left === 2 ? '두' : left} 자리 남았어요` : '모집 마감'}</span>
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
            <p className={s.seatsTitle}><strong>{left > 0 ? `${left === 2 ? '두' : left} 자리 남았어요` : '자리가 다 찼어요'}</strong></p>
            <ul className={s.seats}>
              {m.memberIds.map((uid) => (
                <li key={uid}><Avatar size={44} /><span>{userOf(uid).nickname}</span>{uid === m.hostId && <em>주최</em>}</li>
              ))}
              {Array.from({ length: Math.max(0, left) }).map((_, i) => (
                <li key={`e${i}`} className={s.emptySeat}><span className={s.seatHole} />{i === 0 && !joined ? <span>나</span> : <span>빈자리</span>}</li>
              ))}
            </ul>
            <p className={s.seatsNote}>{m.memberIds.length}명 참여 중 {!joined && left > 0 && <span>· 신청하면 {m.memberIds.length + 1}번째 두더지가 돼요</span>}</p>
            <p className={s.overlap}>나와 관심사가 겹치는 두더지 {overlapMembers}명</p>
          </section>
        </div>

        <aside className={s.chatCol}>
          <div className={s.chatPreview}>
            <div className={s.widgetHead}><h2 className="display">모임 채팅 <span className={s.cnt}>{m.memberIds.length}</span></h2></div>
            <ul className={s.chatMsgs}>
              {PREVIEW_CHAT.map((c, i) => (
                <li key={i} className={c.who === 'me' ? s.chatMine : ''}>
                  {c.who !== 'me' && <span className={s.chatWho}>{userOf(c.who).nickname}</span>}
                  <p>{c.text}</p>
                </li>
              ))}
            </ul>
            {joined ? (
              <form className={s.chatInput} onSubmit={(e) => e.preventDefault()}>
                <input placeholder="메시지를 입력하세요" /><button aria-label="전송"><SendIcon size={16} /></button>
              </form>
            ) : (
              <p className={s.chatLocked}>참여가 확정되면<br />모임 채팅에 참여할 수 있어요.</p>
            )}
          </div>
          {!joined && (
            <div className={s.applyBox}>
              <p>신청하면 주최자가 확인한 뒤 확정돼요.<br />확정되면 모임 채팅방이 열려요.</p>
              <label className={s.applyLabel} htmlFor="host-note">주최자에게 남길 말 <em>선택</em></label>
              <div className={s.applyInput}>
                <textarea id="host-note" maxLength={100} value={note} disabled={applied} onChange={(e) => setNote(e.target.value)} placeholder="어떤 책을 읽고 계신지 알려주세요" />
                <span>{note.length} / 100</span>
              </div>
              <button className={`btn btn-primary btn-block ${s.applyBtn}`} disabled={applied || left <= 0} onClick={() => { setApplied(true); setToast(true) }}>
                {applied ? <>신청 완료 <span className={s.applyGap}>주최자 확인 중</span></> : '참여 신청하기'}
              </button>
              <span className={s.deadline}>{m.closesAt}에 신청이 마감돼요.</span>
            </div>
          )}
        </aside>
      </div>
      <Footer />

      <Toast open={toast} onClose={() => setToast(false)} duration={6000} placement="top"
        title="참여 신청이 완료되었습니다" desc="주최자가 확인하면 알림으로 알려드릴게요"
        action={{ label: '신청 내역 보기', to: '/meetups/me?modal=pending' }} />
    </div>
  )
}
