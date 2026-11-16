import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { ConfirmDialog } from '../../components/Feedback'
import fb from '../../components/Feedback.module.css'
import Modal from '../../components/Modal'
import ProfilePopup from '../../components/ProfilePopup'
import { ChevronLeft, ChevronRight } from '../../components/Icons'
import { ME_ID, TODAY, USERS, toneOf } from '../../data/mock'
import { groupRoomId } from '../../data/chat'
import type { User } from '../../data/types'
import {
  type MeetupX, accept, applicantsOf, confirmedOf, ddayOf, findMeetup, hourLabel, kick, membersOf, mineGroups, myOf,
  placeLine, reject, startMs, useMeetups,
} from '../../data/meetupStore'
import { dateParts } from '../../lib/format'
import s from './Meetups.module.css'

/* ===== 드롭다운 (리스트 날짜·방식·정렬·캠퍼스·N개씩 보기) — 누르면 열리고 바깥을 누르면 닫힘 ===== */
export function Dropdown<T extends string | number>({ value, options, label, prefix, render = (v) => String(v), onChange, extra, up, wide }: {
  value: T; options: readonly T[]; label: string; prefix?: string; render?: (v: T) => string; onChange: (v: T) => void
  /** 목록 끝에 붙는 항목 (날짜 "직접 설정 ›") */
  extra?: { label: string; onClick: () => void; on?: boolean }
  /** 위로 펼침 (N개씩 보기) */
  up?: boolean
  wide?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, open, () => setOpen(false))
  return (
    <div className={s.dd} ref={ref}>
      <button type="button" className={s.ddBtn} aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen((v) => !v)}>
        {prefix && <span className={s.ddPrefix}>{prefix}</span>}{extra?.on ? extra.label.replace(' ›', '') : render(value)}<Chevron />
      </button>
      {open && (
        <ul className={`${s.ddList} ${up ? s.ddUp : ''} ${wide ? s.ddWide : ''}`} role="listbox" aria-label={label}>
          {options.map((o) => {
            const on = o === value && !extra?.on
            return <li key={String(o)}><button type="button" role="option" aria-selected={on} className={on ? s.ddOn : ''} onClick={() => { onChange(o); setOpen(false) }}>{render(o)}{on && <span aria-hidden>✓</span>}</button></li>
          })}
          {extra && <li className={s.ddExtra}><button type="button" className={extra.on ? s.ddOn : ''} onClick={() => { setOpen(false); extra.onClick() }}>{extra.label.replace(' ›', '')}<span aria-hidden>›</span></button></li>}
        </ul>
      )}
    </div>
  )
}
export const Chevron = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>

export function useOutside(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open, close, ref])
}

/* ===== 날짜 ===== */
export const ymdOf = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
export const TODAY_PARTS = (() => { const [y, m, d] = TODAY.split('-').map(Number); return { y, m, d } })()
export function shiftMonth(y: number, m: number, by: number) { const t = new Date(y, m - 1 + by, 1); return { y: t.getFullYear(), m: t.getMonth() + 1 } }
export function monthCells(y: number, m: number) {
  const first = new Date(y, m - 1, 1).getDay()
  const days = new Date(y, m, 0).getDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  return cells
}
export const WEEK = ['일', '월', '화', '수', '목', '금', '토']
/** '2026-11-14' → '11.14' */
export const dot = (ymd: string) => { const { m, d } = dateParts(ymd); return `${m}.${d}` }
export const fullDate = (ymd: string) => { const { m, d, w } = dateParts(ymd); return `${m}월 ${d}일 (${w})` }

/* ===== 날짜 직접 설정 (리스트 · 1074:10147): 처음 누른 날 = 시작, 다음 누른 날 = 끝, 하루면 같은 날 두 번 ===== */
export function RangePicker({ value, onApply, onReset, onClose }: {
  value: [string, string] | null; onApply: (r: [string, string]) => void; onReset: () => void; onClose: () => void
}) {
  const [ym, setYm] = useState(() => { const [y, m] = (value?.[0] ?? TODAY).split('-').map(Number); return { y, m } })
  const [a, setA] = useState<string | null>(value?.[0] ?? null)
  const [b, setB] = useState<string | null>(value?.[1] ?? null)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, true, onClose)
  const pick = (ymd: string) => {
    if (!a || b) { setA(ymd); setB(null); return }
    if (ymd < a) { setB(a); setA(ymd) } else setB(ymd)
  }
  const isPrevBlocked = ym.y === TODAY_PARTS.y && ym.m <= TODAY_PARTS.m
  return (
    <div className={s.range} ref={ref} role="dialog" aria-label="날짜 직접 설정">
      <div className={s.rangeHead}>
        <strong>{ym.y}년 {ym.m}월</strong>
        <span>
          <button type="button" className={s.navBtn} disabled={isPrevBlocked} onClick={() => setYm(shiftMonth(ym.y, ym.m, -1))} aria-label="이전 달"><ChevronLeft size={14} /></button>
          <button type="button" className={s.navBtn} onClick={() => setYm(shiftMonth(ym.y, ym.m, 1))} aria-label="다음 달"><ChevronRight size={14} /></button>
        </span>
      </div>
      <div className={s.rangeGrid}>
        {WEEK.map((w, i) => <span key={w} className={`${s.rgWeek} ${i === 0 ? s.sun : ''}`}>{w}</span>)}
        {monthCells(ym.y, ym.m).map((d, i) => {
          if (d === null) return <span key={`e${i}`} />
          const ymd = ymdOf(ym.y, ym.m, d)
          const end = b ?? a
          const inRange = a && end && ymd >= a && ymd <= end
          const edge = ymd === a || ymd === b
          return (
            <button key={d} type="button" disabled={ymd < TODAY} onClick={() => pick(ymd)}
              className={`${s.rgDay} ${inRange ? s.rgIn : ''} ${edge ? s.rgEdge : ''} ${ymd === TODAY ? s.rgToday : ''} ${i % 7 === 0 ? s.sun : ''}`}
              aria-pressed={!!edge}>{d}</button>
          )
        })}
      </div>
      <p className={s.rangeText}>{a ? `${fullDate(a)} ~ ${fullDate(b ?? a)}` : '시작 날짜를 눌러 주세요'}</p>
      <div className={s.rangeActions}>
        <button type="button" className="btn btn-line btn-sm" onClick={() => { setA(null); setB(null); onReset() }}>초기화</button>
        <button type="button" className="btn btn-cta btn-sm" disabled={!a} onClick={() => a && onApply([a, b ?? a])}>적용</button>
      </div>
    </div>
  )
}

/* ===== 상태 배지 ===== */
export const MY_LABEL: Record<string, { label: string; cls: string }> = {
  joined: { label: '참여 확정', cls: s.stOk }, pending: { label: '신청 대기', cls: s.stWait }, host: { label: '내가 주최', cls: s.stHost },
  rejected: { label: '승인되지 않음', cls: s.stNo },
}

/* ===== 모임 캘린더 팝업 (1075:12387 · 내 모임 1075:13394): 월 이동, 내 모임 / 전체 모임, 월간 달력, 고른 날의 모임, 이번 달 요약 ===== */
export function CalendarModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const st = useMeetups()
  const g = mineGroups(st)
  const [view, setView] = useState<'mine' | 'all'>('mine')
  const [ym, setYm] = useState({ y: TODAY_PARTS.y, m: TODAY_PARTS.m })
  const [day, setDay] = useState<string>(() => g.active[0]?.date ?? TODAY)
  useEffect(() => { if (open) { setView('mine'); setYm({ y: TODAY_PARTS.y, m: TODAY_PARTS.m }); setDay(mineGroups().active[0]?.date ?? TODAY) } }, [open])
  const mineIds = new Set([...g.active, ...g.past].map((m) => m.id))
  const pool = st.list.filter((m) => !m.cancelled && (view === 'mine' ? mineIds.has(m.id) : true))
  const inMonth = pool.filter((m) => m.date.startsWith(ymdOf(ym.y, ym.m, 1).slice(0, 8)))
  const picked = pool.filter((m) => m.date === day).sort((a, b) => startMs(a) - startMs(b))
  const monthMine = st.list.filter((m) => mineIds.has(m.id) && !m.cancelled && m.date.startsWith(ymdOf(ym.y, ym.m, 1).slice(0, 8)))
  const count = (k: string) => monthMine.filter((m) => myOf(m.id, st)?.st === k).length
  return (
    <Modal open={open} onClose={onClose} width={960} labelledBy="cal-title" hideClose>
      <div className={s.calPop}>
        <header className={s.calHead}>
          <h2 id="cal-title" className="display">모임 캘린더</h2>
          <button type="button" className={s.navBtn} onClick={() => setYm(shiftMonth(ym.y, ym.m, -1))} aria-label="이전 달"><ChevronLeft size={16} /></button>
          <strong className={s.calYm}>{ym.y}년 {ym.m}월</strong>
          <button type="button" className={s.navBtn} onClick={() => setYm(shiftMonth(ym.y, ym.m, 1))} aria-label="다음 달"><ChevronRight size={16} /></button>
          <div className={s.seg} style={{ marginLeft: 'auto' }} role="tablist" aria-label="보기 전환">
            {(['mine', 'all'] as const).map((v) => <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? s.segOn : s.segBtn} onClick={() => setView(v)}>{v === 'mine' ? '내 모임' : '전체 모임'}</button>)}
          </div>
          <button type="button" className={s.closeSq} onClick={onClose} aria-label="닫기">✕</button>
        </header>
        <div className={s.calBody}>
          <div className={s.bigCal}>
            {WEEK.map((w, i) => <span key={w} className={`${s.bcWeek} ${i === 0 ? s.sun : ''}`}>{w}</span>)}
            {monthCells(ym.y, ym.m).map((d, i) => {
              if (d === null) return <span key={`e${i}`} className={s.bcEmpty} />
              const ymd = ymdOf(ym.y, ym.m, d)
              const items = inMonth.filter((m) => m.date === ymd)
              return (
                <button key={d} type="button" onClick={() => setDay(ymd)} aria-pressed={ymd === day}
                  className={`${s.bcDay} ${ymd === day ? s.bcOn : ''} ${ymd < TODAY ? s.bcPast : ''} ${i % 7 === 0 ? s.sun : ''}`}>
                  <span className={ymd === TODAY ? s.bcToday : s.bcNum}>{d}</span>
                  {items.slice(0, 2).map((m) => <em key={m.id} style={{ background: `var(--tone-${toneOf(m.interest)}-bg)`, color: `var(--tone-${toneOf(m.interest)}-fg)` }}>{m.sign ?? m.title}</em>)}
                  {items.length > 2 && <small>+{items.length - 2}</small>}
                </button>
              )
            })}
          </div>
          <aside className={s.calSide}>
            <h3 className="display">{fullDate(day)}</h3>
            <p className={s.calSub}>{ddayOf(day)} · 모임 {picked.length}개</p>
            {picked.length === 0 && <p className={s.calEmpty}>이 날은 {view === 'mine' ? '내 ' : ''}모임이 없어요.</p>}
            <div className={s.calItems}>
              {picked.map((m) => {
                const r = myOf(m.id, st)
                const lab = r && MY_LABEL[r.st]
                const chat = r?.st === 'joined' || r?.st === 'host'
                return (
                  <div key={m.id} className={s.calItem}>
                    {lab && <em className={lab.cls}>{lab.label}</em>}
                    <strong>{m.title}</strong>
                    <span>🕑 {m.start} – {m.end}</span>
                    <span>📍 {placeLine(m)}</span>
                    <span>👥 {confirmedOf(m, st)} / {m.capacity}명</span>
                    <div className={s.calActions}>
                      <Link to={`/meetups/${m.id}`} className="btn btn-line btn-sm" onClick={onClose}>모임 상세</Link>
                      {chat && <Link to={`/chat/${groupRoomId(m.id)}`} className="btn btn-primary btn-sm" onClick={onClose}>모임 채팅</Link>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className={s.calSum}>
              <strong>이번 달 내 모임 {monthMine.length}개</strong>
              <span><i className={s.dotOk} />참여 확정 {count('joined')}</span>
              <span><i className={s.dotWait} />신청 대기 {count('pending')}</span>
              <span><i className={s.dotHost} />내가 연 모임 {count('host')}</span>
            </div>
          </aside>
        </div>
      </div>
    </Modal>
  )
}

/* ===== 신청 관리 팝업 (740:5113): 내 모임 › 내가 연 모임 카드에서만 연다. 거절·내보내기 확인 팝업 (972:9020 · 972:9522) ===== */
export function ManageModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const st = useMeetups()
  const m = id ? findMeetup(id, st) : undefined
  const [ask, setAsk] = useState<null | { kind: 'reject' | 'kick'; userId: string }>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const me = USERS[ME_ID]
  if (!m) return null
  const apps = applicantsOf(m.id, st)
  const mem = membersOf(m.id, st)
  const full = confirmedOf(m, st) >= m.capacity
  const overlap = (u: string) => (USERS[u]?.interests ?? []).filter((i) => me.interests.includes(i)).length
  const row = (u: string, sub: ReactNode, actions: ReactNode) => (
    <li key={u} className={s.mgRow}>
      <button type="button" className={s.mgWho} onClick={() => setProfile(USERS[u] ?? null)} aria-label={`${USERS[u]?.nickname}님 프로필`}>
        <span className={s.mgAva} style={{ background: `var(--tone-${toneOf(USERS[u]?.interests[0] ?? '')}-bg)` }}>{USERS[u]?.nickname.slice(0, 1)}</span>
      </button>
      <div className={s.mgBody}>
        <p><button type="button" className={s.mgName} onClick={() => setProfile(USERS[u] ?? null)}>{USERS[u]?.nickname}</button><em>겹치는 관심사 {overlap(u)}개</em></p>
        <span>{sub}</span>
      </div>
      <div className={s.mgActions}>{actions}</div>
    </li>
  )
  const askName = ask ? USERS[ask.userId]?.nickname : ''
  return (
    <>
      <Modal open={!!id && !profile} onClose={onClose} width={600} labelledBy="manage-title">
        <div className={s.manage}>
          <h2 id="manage-title" className="display">신청 관리</h2>
          <p className={s.manageSub}>{m.title} · 확정 {confirmedOf(m, st)} / {m.capacity}명 · 대기 {apps.length}명</p>
          <h3 className={s.mgSection}>신청 대기 {apps.length}</h3>
          <ul className={s.mgList}>
            {apps.length === 0 && <li className={s.manageEmpty}>확인을 기다리는 신청이 없어요.</li>}
            {apps.map((a) => row(a.userId, a.msg || '(남긴 말 없음)', <>
              <button type="button" className={`btn btn-line btn-sm ${s.cancelBtn}`} onClick={() => setAsk({ kind: 'reject', userId: a.userId })}>거절</button>
              <button type="button" className="btn btn-cta btn-sm" disabled={full} title={full ? '정원이 다 찼어요' : undefined} onClick={() => accept(m.id, a.userId)}>수락</button>
            </>))}
          </ul>
          {full && apps.length > 0 && <p className={s.capWarn}>정원(주최자 포함)이 다 차서 수락할 수 없어요. 자리가 나면 수락할 수 있어요.</p>}
          <h3 className={s.mgSection}>참여 확정 {mem.length}</h3>
          <ul className={s.mgList}>
            {mem.length === 0 && <li className={s.manageEmpty}>아직 확정된 참여자가 없어요.</li>}
            {mem.map((u) => row(u, '참여 확정', <button type="button" className={`btn btn-line btn-sm ${s.cancelBtn}`} onClick={() => setAsk({ kind: 'kick', userId: u })}>내보내기</button>))}
          </ul>
          <p className={s.manageNote}>거절하면 결과가 안내되고, 수락하면 참여가 확정돼요. 확정자를 내보내면 자리가 다시 열려요.</p>
        </div>
      </Modal>
      <ConfirmDialog open={ask?.kind === 'reject'} onClose={() => setAsk(null)} title="거절하시겠습니까?" desc="거절하시면 신청자에게 미승인 알림이 갑니다." confirmLabel="거절"
        onConfirm={() => ask && reject(m.id, ask.userId)} />
      <ConfirmDialog open={ask?.kind === 'kick'} onClose={() => setAsk(null)} title={`${askName}님을 내보낼까요?`} desc="내보내면 되돌릴 수 없고 상대에게 알림이 가요." confirmLabel="내보내기"
        onConfirm={() => ask && kick(m.id, ask.userId)} />
      <ProfilePopup user={profile} onClose={() => setProfile(null)} />
    </>
  )
}

/* ===== 완료 토스트 + 버튼 동작 (00 공통 16 모양. "되돌리기"처럼 페이지 이동이 아닌 버튼이 필요해서 Feedback 의 모양을 그대로 씀) ===== */
export interface MToast { title: string; desc?: string; link?: { label: string; to: string }; undo?: () => void }
export function ActionToast({ toast, onClose, duration = 4000 }: { toast: MToast | null; onClose: () => void; duration?: number }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [toast, duration, onClose])
  if (!toast) return null
  return createPortal(
    <div className={fb.toast} role="status">
      <span className={fb.check} aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <span className={fb.text}><strong>{toast.title}</strong>{toast.desc && <small>{toast.desc}</small>}</span>
      {toast.link && <Link to={toast.link.to} className={fb.action} onClick={onClose}>{toast.link.label}</Link>}
      {toast.undo && <button type="button" className={fb.action} onClick={() => { toast.undo!(); onClose() }}>되돌리기</button>}
    </div>,
    document.body,
  )
}

/* ===== 대표 이미지: 모임 이름 · 일시 · 장소가 적힌 표지판 (상세 3 · 만들기 미리보기) ===== */
export function SignHero({ m, small }: { m: Pick<MeetupX, 'title' | 'date' | 'area' | 'mode'>; small?: boolean }) {
  const { m: mm, d, w } = dateParts(m.date)
  return (
    <div className={small ? `${s.hero} ${s.heroSmall}` : s.hero} aria-hidden>
      <div className={s.heroSign}><strong>{m.title || '모임 이름'}</strong>{!small && <span>{mm}/{d} {w} · {m.mode === '온라인' ? '온라인' : m.area}</span>}</div>
      <span className={s.heroPost} />
      {!small && <><span className={`${s.heroMole} ${s.heroMoleA}`} /><span className={`${s.heroMole} ${s.heroMoleB}`} /><span className={s.heroHole}><span className={s.heroMole} /></span></>}
    </div>
  )
}

/** 상세 등에서 쓰는 짧은 일시: "11월 8일 (일) 오후 2시" */
export const whenLine = (m: MeetupX) => `${fullDate(m.date)} ${hourLabel(m.start)}`
export { Avatar }
