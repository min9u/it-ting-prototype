import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import Modal from '../../components/Modal'
import MonthCalendar from '../../components/MonthCalendar'
import Footer from '../../components/Footer'
import { CalendarIcon, PlusIcon } from '../../components/Icons'
import { MEETUPS, dday, toneOf } from '../../data/mock'
import type { Meetup } from '../../data/types'
import { dateLabel, dateParts } from '../../lib/format'
import s from './Meetups.module.css'

const MINE = MEETUPS.filter((m) => m.myStatus && m.myStatus !== '찜' && !m.past).sort((a, b) => a.date.localeCompare(b.date))
/** 확정된 일정: 참여 확정 + 내가 연 모임 (2026-11-11 "다가오는 일정" → "확정된 일정", 신청 대기는 빠짐) */
const CONFIRMED = MINE.filter((m) => m.myStatus === '참여 확정' || m.myStatus === '내가 주최')
const PENDING = MINE.filter((m) => m.myStatus === '신청 대기')
const HOSTING = MINE.filter((m) => m.myStatus === '내가 주최')
const STATUS_LABEL: Record<string, string> = { '참여 확정': '참여 확정', '신청 대기': '신청 대기', '내가 주최': '내가 주최' }

/**
 * 모임 ↔ 내 모임 공용 틀 (Motion 408:11786)
 * 헤더·오른쪽 사이드는 그대로 두고 왼쪽 박스만 24px 밀리며 바뀐다.
 * 2026-11-11 사이드: 모임 = 내 모임 + 확정된 일정, 내 모임 = 확정된 일정 + 신청 대기 모임 + 내가 연 모임
 * 신청 대기 모임 전체보기 팝업 633:7941 (?modal=pending)
 * 앞으로(/meetups → /meetups/me): 나감 0–160ms ease-in, 들어옴 80–320ms ease-out
 */
export default function MeetupsShell() {
  const loc = useLocation()
  const [params] = useSearchParams()
  const isMe = loc.pathname.startsWith('/meetups/me')
  const prev = useRef(isMe)
  const dir = isMe === prev.current ? 'none' : isMe ? 'forward' : 'back'
  useEffect(() => { prev.current = isMe }, [isMe])
  const [calOpen, setCalOpen] = useState(params.get('modal') === 'calendar')
  const [pendingOpen, setPendingOpen] = useState(params.get('modal') === 'pending')

  return (
    <div className={s.shellWrap}>
      <div className={s.shell}>
        <section key={loc.pathname} className={`${s.mainBox} ${dir === 'forward' ? s.inFromRight : dir === 'back' ? s.inFromLeft : ''}`}>
          <Outlet />
        </section>
        <aside className={s.side}>
          {!isMe && (
            <div className={s.widget}>
              <div className={s.widgetHead}><h2 className="display">내 모임 <span className={s.cnt}>{MINE.length}</span></h2><Link to="/meetups/me" className={s.allLink}>전체 보기</Link></div>
              <ul className={s.mineList}>
                {MINE.slice(0, 3).map((m) => <MiniRow key={m.id} m={m} tag={STATUS_LABEL[m.myStatus!]} />)}
              </ul>
            </div>
          )}
          {isMe && <Upcoming onCalendar={() => setCalOpen(true)} />}
          {isMe && (
            <div className={s.widget}>
              <div className={s.widgetHead}><h2 className="display">신청 대기 모임 <span className={s.cnt}>{PENDING.length}</span></h2><button className={s.allLink} onClick={() => setPendingOpen(true)}>전체 보기</button></div>
              <ul className={s.mineList}>{PENDING.map((m) => <MiniRow key={m.id} m={m} tag="신청 대기" />)}</ul>
            </div>
          )}
          {isMe && (
            <div className={s.widget}>
              <div className={s.widgetHead}><h2 className="display">내가 연 모임 <span className={s.cnt}>{HOSTING.length}</span></h2><Link to="/chat/requests?tab=meetup" className={s.allLink}>전체 보기</Link></div>
              <ul className={s.mineList}>{HOSTING.map((m) => <MiniRow key={m.id} m={m} tag="새 신청 1" />)}</ul>
            </div>
          )}
          {!isMe && <Upcoming onCalendar={() => setCalOpen(true)} />}
          <Link to="/meetups/new" className={`btn btn-cta btn-block ${s.makeBtn}`}><PlusIcon size={18} /> 모임 만들기</Link>
        </aside>
      </div>
      <Footer />
      <CalendarModal open={calOpen} onClose={() => setCalOpen(false)} />
      <PendingModal open={pendingOpen} onClose={() => setPendingOpen(false)} />
    </div>
  )
}

/** 사이드 목록 한 줄: 팻말 아이콘 + 제목 + 날짜·동네 + 상태 배지 */
function MiniRow({ m, tag }: { m: Meetup; tag: string }) {
  const tone = toneOf(m.interest)
  return (
    <li>
      <span className={s.miniSign} style={{ background: `var(--tone-${tone}-bg)` }} aria-hidden><i /></span>
      <Link to={`/meetups/${m.id}`}>
        <strong>{m.title}</strong>
        <span>{dateLabel(m.date)} · {m.area}</span>
      </Link>
      <em className={tag === '신청 대기' ? s.stWait : tag === '참여 확정' ? s.stOk : s.stHost}>{tag}</em>
    </li>
  )
}

function Upcoming({ onCalendar }: { onCalendar: () => void }) {
  return (
    <div className={s.widget}>
      <div className={s.widgetHead}><h2 className="display">확정된 일정</h2></div>
      <ul className={s.upcoming}>
        {CONFIRMED.map((m, i) => {
          const { d, w } = dateParts(m.date)
          return (
            <li key={m.id}>
              <Link to={`/meetups/${m.id}`} className={s.upRow}>
                <span className={i === 0 ? `${s.dayNum} ${s.dayNumOn}` : s.dayNum}><small>11월</small>{d}</span>
                <span className={s.upBody}>
                  <strong>{m.title}{i === 0 && <em className={s.dday}>{dday(m.date)}</em>}</strong>
                  <span>{w}요일 {m.start.replace(':00', '시')} · {m.area}</span>
                </span>
                <span className={s.chev} aria-hidden>›</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <button className={`btn btn-block btn-sm ${s.calBtn}`} onClick={onCalendar}><CalendarIcon size={16} /> 캘린더로 보기</button>
    </div>
  )
}

/** 내 모임 – 신청 대기 모임 전체보기 팝업 633:7941 */
function PendingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [list, setList] = useState(PENDING)
  return (
    <Modal open={open} onClose={onClose} width={560} labelledBy="pending-title">
      <div className={s.pendingModal}>
        <h2 id="pending-title" className="display">신청 대기 모임 <span className={s.cnt}>{list.length}</span></h2>
        <p className={s.calSub}>주최자가 확인하면 참여가 확정되고, 모임 채팅방에 초대돼요.</p>
        {list.length === 0 && <p className={s.calEmpty}>신청 대기 중인 모임이 없어요.</p>}
        {list.map((m) => (
          <div key={m.id} className={s.pendingItem}>
            <div className={s.pendingTop}>
              <span className={s.miniSign} style={{ background: `var(--tone-${toneOf(m.interest)}-bg)` }} aria-hidden><i /></span>
              <div>
                <strong>{m.title} <em className={s.ddayPill}>{dday(m.date)}</em></strong>
                <span>{dateLabel(m.date)} {m.start} · {m.area} · {m.mode}</span>
              </div>
            </div>
            {m.myNote && (
              <div className={s.pendingNote}>
                <small>내가 남긴 말 · {m.myNoteAgo}</small>
                <p>“{m.myNote}”</p>
              </div>
            )}
            <div className={s.pendingActions}>
              <Link to={`/meetups/${m.id}`} className="btn btn-line" onClick={onClose}>모임 상세</Link>
              <button className={`btn btn-line ${s.cancelBtn}`} onClick={() => setList((l) => l.filter((x) => x.id !== m.id))}>신청 취소</button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/** 모임 – 캘린더 팝업 544:6128 · 내 모임 캘린더 팝업 544:7132 */
function CalendarModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [day, setDay] = useState(8)
  const marks = Object.fromEntries(MEETUPS.filter((m) => m.myStatus && m.date.startsWith('2026-11')).map((m) => [dateParts(m.date).d, m.interest]))
  const picked = MEETUPS.filter((m) => m.myStatus && dateParts(m.date).d === day && m.date.startsWith('2026-11'))
  return (
    <Modal open={open} onClose={onClose} width={760} labelledBy="cal-title">
      <div className={s.calModal}>
        <div>
          <h2 id="cal-title" className="display">모임 캘린더</h2>
          <p className={s.calSub}>2026년 11월 · 이번 달 내 모임 {Object.keys(marks).length}개</p>
          <MonthCalendar year={2026} month={11} selected={day} onSelect={setDay} marks={marks} />
        </div>
        <div className={s.calDetail}>
          <h3 className="display">11월 {day}일 ({dateParts(`2026-11-${String(day).padStart(2, '0')}`).w})</h3>
          <p className={s.calSub}>모임 {picked.length}개</p>
          {picked.length === 0 && <p className={s.calEmpty}>이 날은 모임이 없어요.</p>}
          {picked.map((m) => (
            <div key={m.id} className={s.calItem}>
              <em className={s.stOk}>{m.myStatus}</em>
              <strong>{m.title}</strong>
              <span>{m.start} – {m.end}</span>
              <span>{m.area} · {m.mode}</span>
              <span>{m.memberIds.length} / {m.capacity}명</span>
              <div className={s.calActions}>
                <Link to={`/meetups/${m.id}`} className="btn btn-ghost btn-sm" onClick={onClose}>모임 상세</Link>
                <Link to="/chat/r-book" className="btn btn-primary btn-sm" onClick={onClose}>모임 채팅</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
