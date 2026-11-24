import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useSearchParams } from '@/lib/nav'
import Footer from '../../components/Footer'
import { CalendarIcon, ChevronLeft, ChevronRight, PlusIcon } from '../../components/Icons'
import { meetupToneOf } from '../../data/meetupCategory'
import { TODAY, daysLeft, ddayOf, hourLabel } from '../../data/meetupStore'
import { useMeetupCalendar, useMyMeetupSummary, useMyMeetups, type MeetupCardVM, type MeetupMyStatus } from '../../api/meetups'
import { dateLabel, dateParts } from '../../lib/format'
import { CalendarModal, MY_LABEL, TODAY_PARTS, WEEK, monthCells, shiftMonth, ymdOf } from './parts'
import s from './Meetups.module.css'

/**
 * 모임 ↔ 내 모임 공용 틀 (Motion 408:11786): 왼쪽 박스만 24px 밀리며 바뀐다
 * 2026-11-16 F7 명세: 리스트 사이드 = 내 모임 위젯(7) + 다가오는 일정(8) + 모임 만들기(1)
 *                    내 모임 사이드 = 다음 모임 카드(6) + 미니 캘린더 · 캘린더로 보기(7) + 모임 만들기(8)
 * 캘린더로 보기 = 캘린더 팝업(기본 보기: 내 모임, M13). 데모용 ?modal=calendar
 * API: 리스트 사이드 = GET /me/meetups/summary(upcomingItems), 다음 모임 카드 = GET /me/meetups?tab=UPCOMING 첫 모임,
 *      미니 캘린더 = GET /meetup-calendar?scope=MINE
 */
export default function MeetupsShell() {
  const loc = useLocation()
  const [params] = useSearchParams()
  const isMe = loc.pathname.startsWith('/meetups/me')
  const prev = useRef(isMe)
  const dir = isMe === prev.current ? 'none' : isMe ? 'forward' : 'back'
  useEffect(() => { prev.current = isMe }, [isMe])
  const [calOpen, setCalOpen] = useState(params.get('modal') === 'calendar')
  const sum = useMyMeetupSummary()
  const active = sum.data?.upcoming ?? []

  return (
    <div className={s.shellWrap}>
      <div className={s.shell}>
        <section key={loc.pathname} className={`${s.mainBox} ${dir === 'forward' ? s.inFromRight : dir === 'back' ? s.inFromLeft : ''}`}>
          <Outlet />
        </section>
        <aside className={s.side}>
          {!isMe && (
            <div className={s.widget}>
              <div className={s.widgetHead}><h2 className="display">내 모임 <span className={s.cnt}>{active.length}</span></h2><Link to="/meetups/me" className={s.allLink}>전체 보기</Link></div>
              <ul className={s.mineList}>
                {sum.isSuccess && active.length === 0 && <li className={s.sideEmpty}>참여하거나 신청한 모임이 없어요.</li>}
                {sum.isError && !sum.data && <li className={s.sideEmpty}>내 모임을 불러오지 못했어요.</li>}
                {active.slice(0, 3).map((c) => <MiniRow key={c.meetup.id} c={c} />)}
              </ul>
            </div>
          )}
          {!isMe && <Upcoming list={active} onCalendar={() => setCalOpen(true)} />}
          {isMe && <NextCard />}
          {isMe && <MiniCalendar onCalendar={() => setCalOpen(true)} />}
          <Link to="/meetups/new" className={`btn btn-cta btn-block ${s.makeBtn}`}><PlusIcon size={18} /> 모임 만들기</Link>
        </aside>
      </div>
      <Footer />
      <CalendarModal open={calOpen} onClose={() => setCalOpen(false)} />
    </div>
  )
}

type Mine = MeetupCardVM & { my: MeetupMyStatus }
/** 내 모임 위젯 한 줄: 팻말 아이콘 + 제목 + 날짜·동네 + 상태 배지 (참여 확정 / 신청 대기 / 내가 주최) */
function MiniRow({ c }: { c: Mine }) {
  const m = c.meetup
  const lab = MY_LABEL[c.my] ?? MY_LABEL.PENDING!
  return (
    <li>
      <span className={s.miniSign} style={{ background: `var(--tone-${meetupToneOf(m.category)}-bg)` }} aria-hidden><i /></span>
      <Link to={`/meetups/${m.id}`}>
        <strong>{m.title}</strong>
        <span>{dateLabel(m.date)} · {m.area}</span>
      </Link>
      <em className={lab.cls}>{lab.label}</em>
    </li>
  )
}

/** 다가오는 일정: 내 모임 중 가까운 일정 (날짜, 제목, 시간·장소, D-day). 누르면 모임 상세 */
function Upcoming({ list, onCalendar }: { list: Mine[]; onCalendar: () => void }) {
  return (
    <div className={s.widget}>
      <div className={s.widgetHead}><h2 className="display">다가오는 일정</h2></div>
      <ul className={s.upcoming}>
        {list.length === 0 && <li className={s.sideEmpty}>다가오는 일정이 없어요.</li>}
        {list.slice(0, 3).map(({ meetup: m }, i) => {
          const { m: mm, d, w } = dateParts(m.date)
          return (
            <li key={m.id}>
              <Link to={`/meetups/${m.id}`} className={s.upRow}>
                <span className={i === 0 ? `${s.dayNum} ${s.dayNumOn}` : s.dayNum}><small>{mm}월</small>{d}</span>
                <span className={s.upBody}>
                  <strong>{m.title}{i === 0 && <em className={s.dday}>{ddayOf(m.date)}</em>}</strong>
                  <span>{w}요일 {hourLabel(m.start)} · {m.area}</span>
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

/** 다음 모임 카드: 다가오는 모임(tab=UPCOMING)의 첫 모임까지 남은 날 + 일시 · 장소 */
function NextCard() {
  const q = useMyMeetups('UPCOMING')
  const m = q.data?.[0]?.meetup
  if (!m) return <div className={s.nextCard}><small>다음 모임까지</small><p className={s.nextEmpty}>{q.isPending ? '불러오는 중…' : q.isError ? '불러오지 못했어요' : '다가오는 모임이 없어요'}</p></div>
  const n = daysLeft(m.date)
  return (
    <Link to={`/meetups/${m.id}`} className={s.nextCard}>
      <small>다음 모임까지</small>
      <p><strong className="display">{n === 0 ? '오늘' : `${n}일`}</strong><span>{dateLabel(m.date)} {hourLabel(m.start)}</span></p>
      <span className={s.nextTitle}>{m.title} · {m.area}</span>
    </Link>
  )
}

/** 미니 캘린더: 모임이 있는 날을 카테고리 색으로, 오늘은 진한 원 */
function MiniCalendar({ onCalendar }: { onCalendar: () => void }) {
  const [ym, setYm] = useState({ y: TODAY_PARTS.y, m: TODAY_PARTS.m })
  const cal = useMeetupCalendar({ year: ym.y, month: ym.m, scope: 'MINE' })
  const marks = (cal.data?.items ?? []).map((x) => x.meetup)
  return (
    <div className={s.widget}>
      <div className={s.widgetHead}>
        <h2 className="display">{ym.y}년 {ym.m}월</h2>
        <span className={s.navPair}>
          <button type="button" className={s.navBtn} onClick={() => setYm(shiftMonth(ym.y, ym.m, -1))} aria-label="이전 달"><ChevronLeft size={14} /></button>
          <button type="button" className={s.navBtn} onClick={() => setYm(shiftMonth(ym.y, ym.m, 1))} aria-label="다음 달"><ChevronRight size={14} /></button>
        </span>
      </div>
      <div className={s.miniCal}>
        {WEEK.map((w, i) => <span key={w} className={`${s.mcWeek} ${i === 0 ? s.sun : ''}`}>{w}</span>)}
        {monthCells(ym.y, ym.m).map((d, i) => {
          if (d === null) return <span key={`e${i}`} />
          const ymd = ymdOf(ym.y, ym.m, d)
          const hit = marks.find((m) => m.date === ymd)
          const t = hit && meetupToneOf(hit.category)
          return (
            <span key={d} title={hit?.title} className={`${s.mcDay} ${ymd === TODAY ? s.mcToday : ''} ${ymd < TODAY ? s.mcPast : ''} ${i % 7 === 0 ? s.sun : ''}`}
              style={hit && ymd !== TODAY ? { background: `var(--tone-${t}-bg)`, color: `var(--tone-${t}-fg)` } : undefined}>{d}</span>
          )
        })}
      </div>
      <button className={`btn btn-block btn-sm ${s.calBtn}`} onClick={onCalendar}><CalendarIcon size={16} /> 캘린더로 보기</button>
    </div>
  )
}
