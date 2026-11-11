import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MeetupCard from '../../components/MeetupCard'
import Pagination from '../../components/Pagination'
import { SearchIcon } from '../../components/Icons'
import { ME_ID, MEETUPS, USERS, dday, toneOf } from '../../data/mock'
import type { Meetup } from '../../data/types'
import s from './Meetups.module.css'

const PAGE = 12
/** Figma 메모(675:10975): "정렬: 최신등록순, 게시순, 마감임박순?, 인원순?(관련도순 제외)" — ?는 아직 미정 */
const SORTS = ['최신순', '마감임박순', '인원순'] as const
const FILTER_TAGS = ['독서', '캠핑', '보드게임', '그림', '러닝', '게임', '음악']

/**
 * 모임 (리스트) 494:13691 — 2026-11-11 스크린샷 대조
 * 나무 팻말 제목, 관심사 칩 필터(전체 / 내 관심사 | 관심사별), 검색 + 정렬 드롭다운, 3열 카드, 모집 완료는 맨 뒤
 */
export function MeetupList() {
  const me = USERS[ME_ID]
  const [scope, setScope] = useState<'전체' | '내 관심사'>('내 관심사')
  const [tags, setTags] = useState<string[]>(FILTER_TAGS.filter((t) => me.interests.includes(t)))
  const [sort, setSort] = useState<(typeof SORTS)[number]>('최신순')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const list = useMemo(() => {
    let l = [...MEETUPS]
    if (scope === '내 관심사' && tags.length) l = l.filter((m) => tags.includes(m.interest) || me.interests.includes(m.interest))
    if (scope === '전체' && tags.length) l = l.filter((m) => tags.includes(m.interest))
    if (q) l = l.filter((m) => m.title.includes(q) || m.interest.includes(q))
    if (sort === '마감임박순') l.sort((a, b) => (a.capacity - a.memberIds.length) - (b.capacity - b.memberIds.length))
    else if (sort === '인원순') l.sort((a, b) => b.memberIds.length - a.memberIds.length)
    else l.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))
    const full = (m: Meetup) => m.memberIds.length >= m.capacity || !!m.past
    return [...l.filter((m) => !full(m)), ...l.filter(full)]
  }, [scope, tags, sort, q, me.interests])
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
        <select className={s.sort} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="정렬">
          {SORTS.map((x) => <option key={x}>{x}</option>)}
        </select>
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
  const counts: Record<string, number> = { '다가오는 모임': 4, '지난 모임': 4, '찜한 모임': 3 }
  const list = MEETUPS.filter((m) => {
    if (tab === '다가오는 모임') return m.myStatus && m.myStatus !== '찜' && ['m1', 'm2', 'm3', 'm4'].includes(m.id)
    if (tab === '찜한 모임') return m.myStatus === '찜'
    return false
  }).sort((a, b) => a.date.localeCompare(b.date))

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
                : m.myStatus === '내가 주최' ? <><Link to="/meetups/new" className="btn btn-line">모임 수정</Link><Link to="/chat/requests?tab=meetup" className="btn btn-primary">신청 관리 1</Link></>
                : m.myStatus === '찜' ? <><Link to={`/meetups/${m.id}`} className="btn btn-line">모임 상세</Link><Link to={`/meetups/${m.id}`} className="btn btn-primary">신청하기</Link></>
                : <><Link to={`/meetups/${m.id}`} className="btn btn-line">모임 상세</Link><Link to="/chat/r-book" className="btn btn-primary">모임 채팅</Link></>
              } />
          )
        })}
      </div>
      <div className={s.pager}><Pagination page={1} total={1} onChange={() => {}} /></div>
    </>
  )
}
