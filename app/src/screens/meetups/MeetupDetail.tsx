import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import Footer from '../../components/Footer'
import Modal from '../../components/Modal'
import { ChipList } from '../../components/InterestChip'
import { CalendarIcon, HeartIcon, PinIcon, SendIcon } from '../../components/Icons'
import { ME_ID, USERS, meetupOf, userOf } from '../../data/mock'
import { dateParts } from '../../lib/format'
import s from './Meetups.module.css'

const PREVIEW_CHAT = [
  { who: 'seoyeon', text: '이번 주 책은 다들 어디까지 읽으셨어요? 저는 절반쯤이요!' },
  { who: 'mingu', text: '저는 이제 막 2장 들어갔어요 ㅎㅎ 토요일까지 따라갈게요' },
  { who: 'me', text: '저도 절반쯤 읽었어요! 이번 주 모임 기대돼요' },
  { who: 'yejin', text: '혹시 성수역 근처에 조용한 카페 아시는 분 계신가요?' },
]

/**
 * 모임 상세 (Desktop) · 채팅 수정안 494:13857 + 기본 408:13129 의 모임 정보 블록
 * 참여 신청 팝업 544:7521 — 메타데이터 기반, 스크린샷 대조 필요 ("모임 상세 화면 아직 미정")
 * 데모용 쿼리: ?modal=apply
 */
export default function MeetupDetail() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const m = meetupOf(id)
  const [applyOpen, setApplyOpen] = useState(params.get('modal') === 'apply')
  const [note, setNote] = useState('')
  const [applied, setApplied] = useState(false)
  const [liked, setLiked] = useState(m?.myStatus === '찜')
  if (!m) return <Navigate to="/meetups" replace />

  const me = USERS[ME_ID]
  const host = userOf(m.hostId)
  const left = m.capacity - m.memberIds.length
  const { m: mm, d, w } = dateParts(m.date)
  const joined = m.myStatus === '참여 확정' || m.myStatus === '내가 주최'
  const overlapMembers = m.memberIds.filter((uid) => userOf(uid).interests.some((i) => me.interests.includes(i))).length

  return (
    <div className={s.detailWrap}>
      <nav className={s.crumb}><Link to="/meetups">모임 탐색</Link> / <span>{m.interest}</span></nav>
      <div className={s.titleRow}>
        <div>
          <p className={s.recruit}>{left > 0 ? `모집 중 · ${left === 2 ? '두' : left}자리 남았어요` : '모집 마감'}</p>
          <h1 className="display">{m.title}</h1>
          <p className={s.titleMeta}>{mm}/{d} {w} · {m.area}</p>
        </div>
        <div className={s.utility}>
          <button className={liked ? s.utilOn : s.util} onClick={() => setLiked((v) => !v)} aria-pressed={liked} aria-label="찜하기"><HeartIcon size={20} /></button>
          <button className={s.util} aria-label="공유하기">↗</button>
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
              <div><dt><CalendarIcon size={18} /></dt><dd>{mm}월 {d}일 ({w}) {m.start} – {m.end}</dd></div>
              <div><dt><PinIcon size={18} /></dt><dd>{m.place} · {m.mode}</dd></div>
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
          <section className={`${s.block} ${s.hostCard}`}>
            <Avatar size={56} />
            <div>
              <strong className="display">{host.nickname}이 열었어요</strong>
              <span>{host.affiliation}</span>
              <div className={s.hostChips}>겹치는 관심사 <ChipList items={host.interests.filter((i) => me.interests.includes(i))} /></div>
            </div>
            <div className={s.hostActions}>
              <Link to={`/burrow/${host.id}`} className="btn btn-ghost btn-sm">주최자 땅굴 놀러 가기</Link>
              <span><button>신고</button> · <button>차단</button></span>
            </div>
          </section>
        </div>

        <aside className={s.chatCol}>
          <div className={s.chatPreview}>
            <div className={s.widgetHead}><h2 className="display">모임 채팅</h2><button className="link-accent">참여자 보기 {m.memberIds.length}</button></div>
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
              <p className={s.chatLocked}>참여가 확정되면 모임 채팅에 들어갈 수 있어요.</p>
            )}
          </div>
          {!joined && (
            <div className={s.applyBox}>
              <p>신청하면 주최자가 확인한 뒤 확정돼요. 확정되면 모임 채팅방이 열려요.</p>
              <button className="btn btn-primary btn-block" disabled={applied || left <= 0} onClick={() => setApplyOpen(true)}>
                {applied ? '신청 완료 · 주최자 확인 중' : '참여 신청하기'}
              </button>
              <span className="hint">{m.closesAt}에 신청이 마감돼요.</span>
            </div>
          )}
        </aside>
      </div>
      <Footer />

      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} width={480} labelledBy="apply-title">
        <div className={s.applyModal}>
          <h2 id="apply-title" className="display">참여 신청</h2>
          <p className={s.applyLead}>신청하면 주최자가 확인한 뒤 확정돼요. 확정되면 모임 채팅방이 열려요.</p>
          <div className="field">
            <span className="field-label">주최자에게 남길 말 <span className="hint">선택</span></span>
            <textarea className="textarea" maxLength={100} value={note} onChange={(e) => setNote(e.target.value)} placeholder="어떤 책을 읽고 계신지 알려주세요" />
            <span className="hint" style={{ textAlign: 'right' }}>{note.length} / 100</span>
          </div>
          <div className={s.applyActions}>
            <button className="btn btn-ghost" onClick={() => setApplyOpen(false)}>취소</button>
            <button className="btn btn-primary" onClick={() => { setApplied(true); setApplyOpen(false) }}>신청하기</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
