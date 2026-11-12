import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ConfirmDialog, TOAST, Toast, type ToastSpec } from '../../components/Feedback'
import MeetupCard from '../../components/MeetupCard'
import Pagination from '../../components/Pagination'
import { SearchIcon } from '../../components/Icons'
import { ME_ID, MEETUPS, USERS, categoryOf, dday, toneOf } from '../../data/mock'
import type { Meetup } from '../../data/types'
import s from './Meetups.module.css'

/** 2026-11-12 Figma 751:8069 "12개씩 보기" 드롭다운 (Figma 메모 677:10983 '00개씩 보기' 완료) */
const PAGE_SIZES = [12, 24, 36] as const
/** Figma 메모(675:10975): "정렬: 최신등록순, 게시순, 마감임박순?, 인원순?(관련도순 제외)" — ?는 아직 미정. 2026-11-12 화면 이름은 최신등록순 */
const SORTS = ['최신등록순', '마감임박순', '인원순'] as const

/** 정렬 · 개수 보기 드롭다운 (2026-11-12 Figma 751:7849 정렬 열림 · 751:8069 개수 보기 열림): 진한 갈색 목록이 버튼 아래로 펼쳐짐 */
function Dropdown<T extends string | number>({ value, options, label, render, onChange }: { value: T; options: readonly T[]; label: string; render: (v: T) => string; onChange: (v: T) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div className={s.dd} ref={ref}>
      <button type="button" className={s.ddBtn} aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen((v) => !v)}>
        {render(value)}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <ul className={s.ddList} role="listbox" aria-label={label}>
          {options.map((o) => (
            <li key={String(o)}><button type="button" role="option" aria-selected={o === value} className={o === value ? s.ddOn : ''} onClick={() => { onChange(o); setOpen(false) }}>{render(o)}</button></li>
          ))}
        </ul>
      )}
    </div>
  )
}
const FILTER_TAGS = ['독서', '캠핑', '보드게임', '그림', '러닝', '게임', '음악']

/**
 * 모임 (리스트) 494:13691 — 2026-11-11 스크린샷 대조
 * 나무 팻말 제목, 관심사 칩 필터(전체 / 내 관심사 | 관심사별), 검색 + 정렬 드롭다운, 3열 카드, 모집 완료는 맨 뒤
 */
export function MeetupList() {
  const me = USERS[ME_ID]
  const [scope, setScope] = useState<'전체' | '내 관심사'>('내 관심사')
  // 내 관심사 = 내가 고른 세부 관심사의 카테고리 (모임 주제는 더 넓은 말이라 카테고리로 맞춤, 관심사 v2)
  const myCats = useMemo(() => new Set(me.interests.map((i) => categoryOf(i)?.id)), [me.interests])
  const mine = (topic: string) => me.interests.includes(topic) || myCats.has(categoryOf(topic)?.id)
  const [tags, setTags] = useState<string[]>(FILTER_TAGS.filter(mine))
  const [sort, setSort] = useState<(typeof SORTS)[number]>('최신등록순')
  const [PAGE, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(12)
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [page, setPage] = useState(1)

  const list = useMemo(() => {
    let l = [...MEETUPS]
    if (scope === '내 관심사' && tags.length) l = l.filter((m) => tags.includes(m.interest) || mine(m.interest))
    if (scope === '전체' && tags.length) l = l.filter((m) => tags.includes(m.interest))
    if (q) l = l.filter((m) => m.title.includes(q) || m.interest.includes(q))
    if (sort === '마감임박순') l.sort((a, b) => (a.capacity - a.memberIds.length) - (b.capacity - b.memberIds.length))
    else if (sort === '인원순') l.sort((a, b) => b.memberIds.length - a.memberIds.length)
    else l.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))
    const full = (m: Meetup) => m.memberIds.length >= m.capacity || !!m.past
    return [...l.filter((m) => !full(m)), ...l.filter(full)]
  }, [scope, tags, sort, q]) // eslint-disable-line react-hooks/exhaustive-deps
  // "비슷한 ○○ 모임 보기"(?q=)로 왔으면 관심사 필터를 풀고 검색어만으로
  useEffect(() => { if (params.get('q')) { setScope('전체'); setTags([]) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const total = Math.max(1, Math.ceil(list.length / PAGE))
  const toggle = (t: string) => { setTags((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t])); setPage(1) }

  return (
    <>
      <h1 className="page-sign">모임</h1>
      <div className={s.filters}>
        <span className={s.filterLabel}>관심사</span>
        {(['전체', '내 관심사'] as const).map((x) => (
          <button key={x} className={scope === x ? s.fOn : s.f} onClick={() => { setScope(x); if (x === '전체') setTags([]); setPage(1) }}>{scope === x && x !== '전체' && '✓ '}{x}</button>
        ))}
        <span className={s.sep} />
        {FILTER_TAGS.map((t) => {
          const on = tags.includes(t)
          return (
            <button key={t} className={on ? s.tagOn : s.tag} onClick={() => toggle(t)} aria-pressed={on}
              style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }}>
              {on && '✓ '}{t}
            </button>
          )
        })}
      </div>
      <div className={s.tools}>
        <label className={s.search}><SearchIcon size={18} /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="모임, 관심사 검색" /></label>
        <Dropdown label="정렬" value={sort} options={SORTS} render={(v) => v} onChange={(v) => { setSort(v); setPage(1) }} />
        <Dropdown label="한 번에 볼 개수" value={PAGE} options={PAGE_SIZES} render={(v) => `${v}개씩 보기`} onChange={(v) => { setPageSize(v); setPage(1) }} />
      </div>
      <div className={s.grid}>
        {list.slice((page - 1) * PAGE, page * PAGE).map((m) => <MeetupCard key={m.id} m={m} />)}
        {list.length === 0 && <p className={s.none}>조건에 맞는 모임이 없어요. 직접 열어보는 건 어때요?</p>}
      </div>
      <div className={s.pager}><Pagination page={page} total={total} onChange={setPage} /></div>
    </>
  )
}

const TABS = ['다가오는 모임', '지난 모임', '찜한 모임'] as const

/**
 * 내 모임 (카드 + 액션형) 546:7282 — 2026-11-11 스크린샷 대조
 * 탭 3개(다가오는 4 · 지난 4 · 찜한 3), 카드 위 상태 알약(신청 대기 · D-3), 카드 아래 버튼 두 개
 */
export function MyMeetups() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('다가오는 모임')
  const [params] = useSearchParams()
  // 내 모임 – 모임 삭제 확인 팝업 810:9 (2026-11-12). 데모용 ?modal=delete
  const [delOpen, setDelOpen] = useState(params.get('modal') === 'delete')
  const [deleted, setDeleted] = useState<string[]>([])
  const [toast, setToast] = useState<ToastSpec | null>(null)
  const counts: Record<string, number> = { '다가오는 모임': 4, '지난 모임': 4, '찜한 모임': 3 }
  const list = MEETUPS.filter((m) => {
    if (tab === '다가오는 모임') return m.myStatus && m.myStatus !== '찜' && ['m1', 'm2', 'm3', 'm4'].includes(m.id)
    if (tab === '찜한 모임') return m.myStatus === '찜'
    return false
  }).filter((m) => !deleted.includes(m.id)).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <>
      <h1 className="page-sign">내 모임</h1>
      <div className={s.myTabs} role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? s.myTabOn : s.myTab} onClick={() => setTab(t)}>{t} {counts[t]}</button>
        ))}
      </div>
      <div className={s.grid}>
        {list.length === 0 && <p className={s.none}>지난 모임은 아직 목 데이터가 없어요.</p>}
        {list.map((m) => {
          const label = m.myStatus === '신청 대기' ? '신청 대기' : m.myStatus === '내가 주최' ? '내가 연 모임' : m.myStatus === '찜' ? '찜한 모임' : '참여 확정'
          return (
            <MeetupCard key={m.id} m={m}
              badge={{ label: `${label} · ${dday(m.date)}`, tone: m.myStatus === '신청 대기' ? 'wait' : 'open' }}
              actions={
                m.myStatus === '신청 대기' ? <><Link to={`/meetups/${m.id}`} className="btn btn-line">모임 상세</Link><button className="btn btn-line">신청 취소</button></>
                : m.myStatus === '내가 주최' ? <><Link to={`/meetups/${m.id}/edit`} className="btn btn-line">모임 수정</Link><button className="btn btn-line" onClick={() => setDelOpen(true)}>모임 삭제</button><Link to={`/meetups/${m.id}?modal=applicants`} className="btn btn-primary">신청 관리 1</Link></>
                : m.myStatus === '찜' ? <><Link to={`/meetups/${m.id}`} className="btn btn-line">모임 상세</Link><Link to={`/meetups/${m.id}`} className="btn btn-primary">신청하기</Link></>
                : <><Link to={`/meetups/${m.id}`} className="btn btn-line">모임 상세</Link><Link to="/chat/r-book" className="btn btn-primary">모임 채팅</Link></>
              } />
          )
        })}
      </div>
      <div className={s.pager}><Pagination page={1} total={1} onChange={() => {}} /></div>
      <ConfirmDialog open={delOpen} onClose={() => setDelOpen(false)} title="모임을 삭제할까요?" confirmLabel="삭제"
        desc="참여자와 신청자에게 알림이 가고, 모임 채팅도 함께 사라져요. 삭제한 모임은 되돌릴 수 없어요."
        onConfirm={() => { setDeleted((l) => [...l, ...MEETUPS.filter((m) => m.myStatus === '내가 주최').map((m) => m.id)]); setToast(TOAST.deleted) }} />
      <Toast open={!!toast} onClose={() => setToast(null)} {...(toast ?? { title: '' })} />
    </>
  )
}
