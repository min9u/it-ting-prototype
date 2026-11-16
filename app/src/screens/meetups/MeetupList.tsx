import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ConfirmDialog, EmptyMole } from '../../components/Feedback'
import MeetupCard from '../../components/MeetupCard'
import Pagination from '../../components/Pagination'
import InterestChip from '../../components/InterestChip'
import { ChevronLeft, SearchIcon } from '../../components/Icons'
import { CATEGORIES, TODAY } from '../../data/mock'
import { groupRoomId, roomOf, useChat } from '../../data/chat'
import {
  CAMPUSES, type MeetupX, applicantsOf, canReapply, confirmedOf, ddayOf, hourLabel, leftOf, mineGroups, myOf, placeLine,
  recruitOf, toggleAlert, toggleWish, useMeetups, withdraw,
} from '../../data/meetupStore'
import { ActionToast, Dropdown, ManageModal, type MToast, MY_LABEL, RangePicker, dot, fullDate } from './parts'
import { api } from '../../api'
import type { MeetupCardVM } from '../../api/mappers'
import { patch, useMeetupList, useOptimistic } from '../../api/queries'
import { qk } from '../../api/queryClient'
import type { MeetupListQuery } from '../../api/types'
import { ErrorState, SkeletonCards } from '../../components/AsyncState'
import s from './Meetups.module.css'

const PAGE_SIZES = [6, 12, 24] as const
const SORTS = ['가까운 날짜순', '최신등록순', '인기순', '인원순'] as const
const SORT_CODE: Record<(typeof SORTS)[number], NonNullable<MeetupListQuery['sort']>> = { '가까운 날짜순': 'STARTS_AT', 최신등록순: 'NEWEST', 인기순: 'POPULAR', 인원순: 'MEMBERS' }
const DATES = ['전체', '오늘', '이번 주', '이번 주말'] as const
const MODES = ['전체', '오프라인', '온라인'] as const
const CAMPUS_OPTS = ['전체', ...CAMPUSES] as const

/** 이번 주 = 오늘부터 이번 주 일요일까지, 이번 주말 = 이번 주 토요일과 일요일 */
function weekRange(kind: '이번 주' | '이번 주말'): [string, string] {
  const [y, m, d] = TODAY.split('-').map(Number)
  const t = new Date(y, m - 1, d)
  const toSun = (7 - t.getDay()) % 7
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const sun = new Date(y, m - 1, d + toSun)
  const sat = new Date(y, m - 1, d + toSun - 1)
  return kind === '이번 주' ? [TODAY, iso(sun)] : [iso(sat < t ? t : sat), iso(sun)]
}

/**
 * 모임 – 리스트 (Figma 02 F7 1071:9749 · 날짜 필터 1074:9747 · 직접 설정 1074:10147 · 정렬 열림 · 개수 보기 열림)
 * 2 검색: 모임 이름·소개 글에서만, 입력하면 바로 (M12)
 * 3 관심사 필터: 전체 / 여러 개 골라 좁힘 (M15: 대표 관심사의 분야로 거름)
 * 4 캠퍼스 · 날짜 · 방식 · 정렬: 모두 AND. 캠퍼스를 고르면 그 캠퍼스의 오프라인 + 모든 온라인 모임
 * 5 카드: 상태 배지(모집 중 / 모집 완료), 모집 완료는 흐리게 맨 뒤, 지난·취소된 모임은 안 보임, 인원 = 주최자 포함 확정 / 정원
 * 6 N개씩 보기 6(기본) / 12 / 24 + 페이지 번호
 * 데모용 쿼리: ?cat=<분야 id>
 */
export function MeetupList() {
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [cats, setCats] = useState<string[]>(() => (params.get('cat') ? [params.get('cat')!] : []))
  const [campus, setCampus] = useState<(typeof CAMPUS_OPTS)[number]>('전체')
  const [date, setDate] = useState<(typeof DATES)[number]>('전체')
  const [range, setRange] = useState<[string, string] | null>(null)
  const [rangeOpen, setRangeOpen] = useState(params.get('modal') === 'range')
  const [mode, setMode] = useState<(typeof MODES)[number]>('전체')
  const [sort, setSort] = useState<(typeof SORTS)[number]>('가까운 날짜순')
  const [size, setSize] = useState<(typeof PAGE_SIZES)[number]>(6)
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<MToast | null>(null)
  const reset = () => setPage(1)

  // 거르기 · 정렬 · 페이지는 서버가 함 (api/meetups.ts, 목 서버도 같은 규칙). 바꾸면 이전 목록을 보여 주다가 바꿔 낌
  const r = range ?? (date === '오늘' ? [TODAY, TODAY] : date === '이번 주' || date === '이번 주말' ? weekRange(date) : null)
  const query: MeetupListQuery = {
    q: q.trim() || undefined, categoryIds: cats.length ? cats : undefined, campus: campus === '전체' ? undefined : campus,
    from: r?.[0], to: r?.[1], mode: mode === '전체' ? undefined : mode === '온라인' ? 'ONLINE' : 'OFFLINE',
    sort: SORT_CODE[sort], page, size,
  }
  const res = useMeetupList(query)
  const items = res.data?.items ?? []
  const total = res.data?.totalPages ?? 1
  const cur = res.data?.page ?? page
  const run = useOptimistic()
  const toggleCat = (id: string) => { setCats((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])); reset() }
  const setLike = (id: string, on: boolean) => run.mutate({
    call: () => api.meetups.setLike(id, on), errorTitle: on ? '찜하지 못했어요' : '찜을 해제하지 못했어요', invalidate: [qk.meetups],
    patches: [patch<{ items: MeetupCardVM[] }>(['meetups', 'list'], (o) => ({ ...o, items: o.items.map((c) => (c.meetup.id === id ? { ...c, liked: on } : c)) }))],
  }, { onError: () => setToast(null) })
  const wish = (c: MeetupCardVM) => {
    const on = c.liked
    setLike(c.meetup.id, !on)
    setToast(on ? { title: '찜을 해제했어요', undo: () => setLike(c.meetup.id, true) } : { title: '찜한 모임에 담았어요', link: { label: '찜한 모임 보기', to: '/meetups/me?tab=wish' } })
  }

  return (
    <>
      <h1 className="page-sign">모임</h1>
      <div className={s.listTools}>
        <label className={s.search}><SearchIcon size={18} /><input value={q} onChange={(e) => { setQ(e.target.value); reset() }} placeholder="모임 이름, 소개 검색" aria-label="모임 검색" /></label>
        <div className={s.ddRow}>
          <Dropdown label="캠퍼스" prefix="캠퍼스" value={campus} options={CAMPUS_OPTS} onChange={(v) => { setCampus(v); reset() }} />
          <div className={s.ddWrap}>
            <Dropdown label="날짜" prefix="날짜" value={date} options={DATES} onChange={(v) => { setDate(v); setRange(null); reset() }}
              extra={{ label: range ? `${dot(range[0])} ~ ${dot(range[1])}` : '직접 설정 ›', on: !!range, onClick: () => setRangeOpen(true) }} />
            {rangeOpen && (
              <RangePicker value={range} onClose={() => setRangeOpen(false)}
                onReset={() => { setRange(null); setDate('전체'); reset() }}
                onApply={(r) => { setRange(r); setRangeOpen(false); reset() }} />
            )}
          </div>
          <Dropdown label="방식" prefix="방식" value={mode} options={MODES} onChange={(v) => { setMode(v); reset() }} />
          <Dropdown label="정렬" prefix="정렬" value={sort} options={SORTS} onChange={(v) => { setSort(v); reset() }} />
        </div>
      </div>
      <div className={s.filters} role="group" aria-label="관심사 필터">
        <span className={s.filterLabel}>관심사</span>
        <button className={cats.length === 0 ? s.fOn : s.f} aria-pressed={cats.length === 0} onClick={() => { setCats([]); reset() }}>전체</button>
        <span className={s.sep} />
        {CATEGORIES.map((c) => {
          const on = cats.includes(c.id)
          return (
            <button key={c.id} className={on ? s.tagOn : s.tag} onClick={() => toggleCat(c.id)} aria-pressed={on}
              style={{ background: `var(--tone-${c.tone}-bg)`, color: `var(--tone-${c.tone}-fg)` }}>
              {on && '✓ '}{c.name}
            </button>
          )
        })}
      </div>
      {res.isPending ? (
        <SkeletonCards count={size} />
      ) : res.isError && !res.data ? (
        <ErrorState error={res.error} onRetry={() => void res.refetch()} retrying={res.isFetching} title="모임을 불러오지 못했어요" />
      ) : (
        <div className={s.grid} aria-busy={res.isFetching}>
          {items.map(({ meetup: m, confirmed, recruit, liked }) => {
            const closed = recruit === 'closed'
            return (
              <MeetupCard key={m.id} m={m} done={closed}
                badge={closed ? { label: '모집 완료', tone: 'done' } : { label: '모집 중', tone: 'open' }}
                people={`${confirmed} / ${m.capacity}명`} place={placeLine(m)}
                wish={{ on: liked, onToggle: () => wish({ meetup: m, confirmed, recruit, liked }) }} />
            )
          })}
          {items.length === 0 && (
            <div className={s.none}><EmptyMole message="조건에 맞는 모임이 없어요. 직접 열어 보는 건 어때요?"><Link to="/meetups/new" className="btn btn-cta btn-sm">모임 만들기</Link></EmptyMole></div>
          )}
        </div>
      )}
      <div className={s.pagerRow}>
        <span />
        <Pagination page={cur} total={total} onChange={setPage} />
        <Dropdown label="한 페이지에 볼 개수" value={size} options={PAGE_SIZES} up render={(v) => `${v}개씩 보기`} onChange={(v) => { setSize(v); setPage(1) }} />
      </div>
      <ActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}

const TABS = [
  { id: 'upcoming', label: '다가오는 모임' }, { id: 'pending', label: '신청 대기' }, { id: 'hosting', label: '내가 연 모임' },
  { id: 'wish', label: '찜한 모임' }, { id: 'past', label: '지난 모임' },
] as const
type TabId = (typeof TABS)[number]['id']
const EMPTY: Record<TabId, string> = {
  upcoming: '다가오는 모임이 없어요. 모임을 둘러보세요.', pending: '확인을 기다리는 신청이 없어요.', hosting: '아직 연 모임이 없어요.',
  wish: '찜한 모임이 없어요. 모임 카드나 상세의 ♡를 눌러 보세요.', past: '지난 모임 기록이 없어요.',
}

/**
 * 모임 – 내 모임 (1075:11219) · 찜한 모임 (1075:11830)
 * 2 상태 탭 5개 (숫자 = 개수). 신청 대기 중 주최자가 수락하면 다가오는 모임으로 옮겨짐. 지난 모임은 기록으로만(지울 수 없음)
 * 3 가까운 날짜순 목록. 승인되지 않은 신청(거절·자동 미승인)은 신청 대기 탭에 "승인되지 않음"으로 남고, 모임이 시작되면 빠짐
 * 4 상태별 버튼: 신청 대기 = 신청 취소 / 참여 확정 = 모임 채팅 / 내가 연 모임 = 신청 관리(신청 수), 모임 수정
 * 5 확인 필요 알림 한 줄: 새 메시지 · 새 참여 신청 · 주최자 확인 대기
 * 찜: 하트 = 찜 해제(토스트 되돌리기), 참여 신청 = 상세로, 모집 완료 모임은 빈자리 알림 받기 (F9 "빈자리 생김")
 * 데모용 쿼리: ?tab=upcoming|pending|hosting|wish|past, ?manage=<모임 id> (신청 관리 팝업, F9 알림에서 들어올 때)
 */
export function MyMeetups() {
  const st = useMeetups()
  const chat = useChat()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const legacy = params.get('modal') === 'pending' ? 'pending' : null
  const tab = ((params.get('tab') ?? legacy) as TabId | null) ?? 'upcoming'
  const setTab = (t: TabId) => setParams((p) => { p.set('tab', t); p.delete('modal'); return p }, { replace: true })
  const g = mineGroups(st)
  const lists: Record<TabId, MeetupX[]> = { upcoming: g.upcoming, pending: g.pending, hosting: g.hosting, wish: g.wished, past: g.past }
  const list = lists[tab] ?? g.upcoming
  const [cancelAsk, setCancelAsk] = useState<string | null>(null)
  const [toast, setToast] = useState<MToast | null>(() => (params.get('toast') === 'cancelled' ? { title: '모임을 취소했어요', desc: '신청자와 참여자에게 알림이 갔어요' } : params.get('toast') === 'deleted' ? { title: '삭제가 완료되었어요', desc: '삭제한 내용은 되돌릴 수 없어요' } : null))
  const manage = params.get('manage')
  const setManage = (id: string | null) => setParams((p) => { if (id) p.set('manage', id); else p.delete('manage'); return p }, { replace: true })

  return (
    <>
      <Link to="/meetups" className={s.back}><ChevronLeft size={16} /> 모임</Link>
      <h1 className={`display ${s.myTitle}`}>내 모임</h1>
      <div className={s.tabs} role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? s.tOn : s.t} onClick={() => setTab(t.id)}>
            {t.label} <span className={s.tCnt}>{lists[t.id].length}</span>
          </button>
        ))}
      </div>
      {tab === 'wish' && <p className={s.tabLead}>모임 카드나 상세의 ♡를 누르면 여기에 모여요. 가까운 날짜순으로 보여줘요.</p>}
      <ul className={s.rows}>
        {list.length === 0 && <li><EmptyMole message={EMPTY[tab]}>{tab !== 'past' && <Link to="/meetups" className="btn btn-line btn-sm">모임 둘러보기</Link>}</EmptyMole></li>}
        {list.map((m) => {
          const r = myOf(m.id, st)
          const rec = recruitOf(m, st)
          const left = leftOf(m, st)
          const apps = applicantsOf(m.id, st).length
          const unread = roomOf(groupRoomId(m.id), chat)?.unread ?? 0
          const isWish = tab === 'wish'
          const status = isWish
            ? (rec === 'closed' ? { label: '모집 완료', cls: s.stDone } : { label: '모집 중', cls: s.stOk })
            : m.cancelled ? { label: '취소됨', cls: s.stNo } : tab === 'past' ? { label: '지난 모임', cls: s.stDone }
            : r?.st === 'host' ? { label: '내가 연 모임', cls: s.stHost } : (MY_LABEL[r?.st ?? ''] ?? MY_LABEL.pending)
          let note: React.ReactNode = null
          if (isWish) note = rec === 'closed' ? (st.alerts.includes(m.id) ? <span className={s.noteMuted}>● 자리가 나면 알려드릴게요</span> : null) : left <= 2 ? <span className={s.noteHot}>● {left}자리 남았어요</span> : null
          else if (tab !== 'past' && r?.st === 'host' && apps > 0) note = <span className={s.noteHot}>● 새 참여 신청 {apps}건</span>
          else if (tab !== 'past' && r?.st === 'pending') note = <span className={s.noteMuted}>● 주최자 확인을 기다리고 있어요</span>
          else if (r?.st === 'rejected') note = <span className={s.noteMuted}>아쉽게도 모임 참여가 승인되지 않았어요</span>
          else if (unread > 0) note = <span className={s.noteHot}>● 새 메시지 {unread}개</span>
          const closed = isWish && rec === 'closed'
          return (
            <li key={m.id} className={`${s.row} ${closed || m.cancelled || r?.st === 'rejected' ? s.rowDim : ''}`}>
              <Link to={`/meetups/${m.id}`} className={s.rowThumb}><span>{m.sign ?? m.interest}</span></Link>
              <div className={s.rowBody}>
                <p className={s.rowBadges}>
                  <em className={status.cls}>{isWish && rec !== 'closed' && '● '}{status.label}</em>
                  {tab !== 'past' && <em className={s.stDday}>{ddayOf(m.date)}</em>}
                  <InterestChip label={m.interest} />
                </p>
                <Link to={`/meetups/${m.id}`} className={s.rowTitle}>{m.title}</Link>
                <p className={s.rowMeta}>
                  <span>🗓 {fullDate(m.date)} {hourLabel(m.start)}</span><span>📍 {placeLine(m)}</span><span>👤 {confirmedOf(m, st)} / {m.capacity}명</span>
                </p>
                {note && <p className={s.rowNote}>{note}</p>}
              </div>
              <div className={s.rowActions}>
                {isWish ? (
                  <>
                    <button type="button" className={s.heartBtn} aria-label="찜 해제" onClick={() => { toggleWish(m.id); setToast({ title: '찜을 해제했어요', undo: () => toggleWish(m.id) }) }}>♥</button>
                    {rec === 'closed'
                      ? <button type="button" className={`btn btn-line btn-sm ${st.alerts.includes(m.id) ? s.alertOn : ''}`} aria-pressed={st.alerts.includes(m.id)}
                          onClick={() => { const on = st.alerts.includes(m.id); toggleAlert(m.id); setToast({ title: on ? '빈자리 알림을 껐어요' : '빈자리 알림을 켰어요', desc: on ? undefined : '자리가 나면 알림으로 알려드릴게요' }) }}>
                          🔔 {st.alerts.includes(m.id) ? '빈자리 알림 받는 중' : '빈자리 알림 받기'}
                        </button>
                      : canReapply(r) ? <Link to={`/meetups/${m.id}`} className="btn btn-cta btn-sm">참여 신청</Link>
                      : <Link to={`/meetups/${m.id}`} className="btn btn-line btn-sm">모임 상세</Link>}
                  </>
                ) : tab === 'past' ? (
                  <>
                    <Link to={`/meetups/${m.id}`} className="btn btn-line btn-sm">모임 상세</Link>
                    <Link to={`/chat/${groupRoomId(m.id)}`} className="btn btn-primary btn-sm">모임 채팅</Link>
                  </>
                ) : r?.st === 'host' ? (
                  <>
                    <Link to={`/meetups/${m.id}/edit`} className="btn btn-line btn-sm">모임 수정</Link>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setManage(m.id)}>신청 관리{apps > 0 && ` ${apps}`}</button>
                  </>
                ) : r?.st === 'pending' ? (
                  <>
                    <Link to={`/meetups/${m.id}`} className="btn btn-line btn-sm">모임 상세</Link>
                    <button type="button" className={`btn btn-line btn-sm ${s.cancelBtn}`} onClick={() => setCancelAsk(m.id)}>신청 취소</button>
                  </>
                ) : r?.st === 'rejected' ? (
                  <button type="button" className="btn btn-line btn-sm" onClick={() => nav('/meetups')}>다른 모임 보기</button>
                ) : (
                  <>
                    <Link to={`/meetups/${m.id}`} className="btn btn-line btn-sm">모임 상세</Link>
                    <Link to={`/chat/${groupRoomId(m.id)}`} className="btn btn-primary btn-sm">모임 채팅</Link>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog open={!!cancelAsk} onClose={() => setCancelAsk(null)} title="신청을 취소할까요?" desc="취소하면 주최자에게 보낸 신청과 남긴 말이 사라져요. 마감 전이면 다시 신청할 수 있어요." confirmLabel="신청 취소"
        onConfirm={() => { if (cancelAsk) { withdraw(cancelAsk); setToast({ title: '신청을 취소했어요', desc: '마감 전까지 다시 신청할 수 있어요' }) } }} />
      <ManageModal id={manage} onClose={() => setManage(null)} />
      <ActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}
