import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import Modal from '../../components/Modal'
import MonthCalendar from '../../components/MonthCalendar'
import Footer from '../../components/Footer'
import { CalendarIcon, PlusIcon } from '../../components/Icons'
import { MEETUPS } from '../../data/mock'
import { dateLabel, dateParts } from '../../lib/format'
import s from './Meetups.module.css'

const MINE = MEETUPS.filter((m) => m.myStatus && m.myStatus !== '찜' && !m.past)

/**
 * 모임 ↔ 내 모임 공용 틀 (Motion 408:11786)
 * 헤더·오른쪽 사이드는 그대로 두고 왼쪽 박스만 24px 밀리며 바뀐다.
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

  return (
    <div className={s.shellWrap}>
      <div className={s.shell}>
        <section key={loc.pathname} className={`${s.mainBox} ${dir === 'forward' ? s.inFromRight : dir === 'back' ? s.inFromLeft : ''}`}>
          <Outlet />
        </section>
        <aside className={s.side}>
          {!isMe && (
            <div className={s.widget}>
              <div className={s.widgetHead}><h2 className="display">내 모임</h2><Link to="/meetups/me" className="link-accent">전체 보기 ›</Link></div>
              <ul className={s.mineList}>
                {MINE.map((m) => (
                  <li key={m.id}>
                    <Link to={`/meetups/${m.id}`}>
                      <strong>{m.title}</strong>
                      <span>{dateLabel(m.date)} · {m.area}</span>
                    </Link>
                    <em className={s[`st${m.myStatus === '참여 확정' ? 'Ok' : m.myStatus === '신청 대기' ? 'Wait' : 'Host'}`]}>{m.myStatus}</em>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Upcoming onCalendar={() => setCalOpen(true)} />
          <Link to="/meetups/new" className="btn btn-primary btn-block"><PlusIcon size={18} /> 모임 만들기</Link>
        </aside>
      </div>
      <Footer />
      <CalendarModal open={calOpen} onClose={() => setCalOpen(false)} />
    </div>
  )
}

function Upcoming({ onCalendar }: { onCalendar: () => void }) {
  const list = useMemo(() => [...MINE].sort((a, b) => a.date.localeCompare(b.date)), [])
  return (
    <div className={s.widget}>
      <div className={s.widgetHead}><h2 className="display">다가오는 일정</h2><span className={s.month}>11월</span></div>
      <ul className={s.upcoming}>
        {list.map((m, i) => {
          const { d } = dateParts(m.date)
          return (
            <li key={m.id}>
              <span className={s.dayNum}>{d}</span>
              <span className={s.upBody}>
                <strong>{m.title}{i === 0 && <em className={s.dday}>D-3</em>}</strong>
                <span>{dateParts(m.date).w}요일 {m.start} · {m.area}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <button className={`btn btn-ghost btn-block btn-sm ${s.calBtn}`} onClick={onCalendar}><CalendarIcon size={16} /> 캘린더로 보기</button>
    </div>
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
