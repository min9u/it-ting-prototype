import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MeetupCard from '../../components/MeetupCard'
import Pagination from '../../components/Pagination'
import { ChevronLeft, SearchIcon } from '../../components/Icons'
import { ME_ID, MEETUPS, USERS } from '../../data/mock'
import { dateLabel, dateParts } from '../../lib/format'
import s from './Meetups.module.css'

const PAGE = 6
const SORTS = ['날짜순', '최신순', '자리 많은 순'] as const

/** 모임 (리스트) 494:13691 — 메타데이터 기반, 스크린샷 대조 필요 */
export function MeetupList() {
  const me = USERS[ME_ID]
  const [scope, setScope] = useState<'전체' | '내 관심사'>('전체')
  const [mode, setMode] = useState<'전체' | '오프라인' | '온라인'>('전체')
  const [sort, setSort] = useState<(typeof SORTS)[number]>('날짜순')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const list = useMemo(() => {
    let l = MEETUPS.filter((m) => !m.past)
    if (scope === '내 관심사') l = l.filter((m) => me.interests.includes(m.interest))
    if (mode !== '전체') l = l.filter((m) => m.mode === mode)
    if (q) l = l.filter((m) => m.title.includes(q) || m.interest.includes(q))
    if (sort === '날짜순') l = [...l].sort((a, b) => a.date.localeCompare(b.date))
    if (sort === '자리 많은 순') l = [...l].sort((a, b) => (b.capacity - b.memberIds.length) - (a.capacity - a.memberIds.length))
    return l
  }, [scope, mode, sort, q, me.interests])
  const total = Math.max(1, Math.ceil(list.length / PAGE))

  return (
    <>
      <div className={s.boxHead}>
        <h1 className="display">모임</h1>
        <label className={s.search}><SearchIcon size={18} /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="모임, 관심사 검색" /></label>
      </div>
      <div className={s.filters}>
        <span className={s.filterLabel}>관심사</span>
        {(['전체', '내 관심사'] as const).map((x) => (
          <button key={x} className={scope === x ? s.fOn : s.f} onClick={() => { setScope(x); setPage(1) }}>{x}</button>
        ))}
        <span className={s.sep} />
        {(['전체', '오프라인', '온라인'] as const).map((x) => (
          <button key={x} className={mode === x ? s.fOn : s.f} onClick={() => { setMode(x); setPage(1) }}>{x === '전체' ? '모든 방식' : x}</button>
        ))}
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

const TABS = ['다가오는 모임', '참여 확정', '신청 대기', '내가 연 모임', '찜한 모임', '지난 모임'] as const

/** 내 모임 (카드 + 액션형) 546:7282 · (다가오는 모임) 500:15371 — 첫 탭은 "다가오는 모임" */
export function MyMeetups() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('다가오는 모임')
  const counts: Record<string, number> = { '다가오는 모임': 4, '참여 확정': 2, '신청 대기': 1, '내가 연 모임': 1, '찜한 모임': 3, '지난 모임': 4 }
  const list = MEETUPS.filter((m) => {
    if (tab === '다가오는 모임') return !!m.myStatus
    if (tab === '참여 확정') return m.myStatus === '참여 확정'
    if (tab === '신청 대기') return m.myStatus === '신청 대기'
    if (tab === '내가 연 모임') return m.myStatus === '내가 주최'
    if (tab === '찜한 모임') return m.myStatus === '찜'
    return false
  }).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <>
      <div className={s.boxHead}>
        <Link to="/meetups" className={s.back}><ChevronLeft size={18} /> 모임</Link>
        <h1 className="display">내 모임</h1>
      </div>
      <div className={s.tabs} role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? s.tOn : s.t} onClick={() => setTab(t)}>{t} {counts[t]}</button>
        ))}
      </div>
      <ul className={s.myList}>
        {list.length === 0 && <li className={s.none}>아직 지난 모임이 없어요.</li>}
        {list.map((m) => {
          const { m: mm, d, w } = dateParts(m.date)
          return (
            <li key={m.id} className={s.myCard}>
              <div className={s.dateBox}><span>{mm}월</span><strong>{d}</strong><span>{w}</span></div>
              <div className={s.myBody}>
                <em className={m.myStatus === '참여 확정' ? s.stOk : m.myStatus === '신청 대기' ? s.stWait : m.myStatus === '내가 주최' ? s.stHost : s.stLike}>{m.myStatus}</em>
                <strong>{m.title}</strong>
                <span>{dateLabel(m.date)} {m.start} · {m.place} · {m.memberIds.length} / {m.capacity}명</span>
                {m.myStatus === '신청 대기' && <p className={s.myNote}>주최자 확인을 기다리고 있어요</p>}
                {m.myStatus === '참여 확정' && <p className={s.myNote}>새 메시지 3개</p>}
                {m.myStatus === '내가 주최' && <p className={s.myNote}>새 참여 신청 1건</p>}
              </div>
              <div className={s.myActions}>
                {m.myStatus === '신청 대기' && <><Link to={`/meetups/${m.id}`} className="btn btn-ghost btn-sm">모임 상세</Link><button className="btn btn-soft btn-sm">신청 취소</button></>}
                {m.myStatus === '참여 확정' && <><Link to={`/meetups/${m.id}`} className="btn btn-ghost btn-sm">모임 상세</Link><Link to="/chat/r-book" className="btn btn-primary btn-sm">모임 채팅</Link></>}
                {m.myStatus === '내가 주최' && <><Link to="/meetups/new" className="btn btn-ghost btn-sm">모임 수정</Link><Link to="/chat/requests" className="btn btn-primary btn-sm">신청 관리 1</Link></>}
                {m.myStatus === '찜' && <Link to={`/meetups/${m.id}`} className="btn btn-primary btn-sm">신청하러 가기</Link>}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
