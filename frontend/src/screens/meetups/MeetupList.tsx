import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from '@/lib/nav'
import { ConfirmDialog, EmptyMole } from '../../components/Feedback'
import MeetupCard from '../../components/MeetupCard'
import Pagination from '../../components/Pagination'
import InterestChip from '../../components/InterestChip'
import { ChevronLeft, SearchIcon } from '../../components/Icons'
import { MEETUP_CATEGORIES, meetupToneOf } from '../../data/meetupCategory'
import { TODAY, ddayOf, hourLabel, placeLine } from '../../data/meetupStore'
import { ActionToast, Dropdown, ManageModal, type MToast, MY_LABEL, RangePicker, dot, fullDate } from './parts'
import { patch, useOptimistic } from '../../api'
import {
  MEETUP_ERRORS, meetupCalls, meetupKeys, useMeetupList, useMyMeetupSummary, useMyMeetups,
  type MeetupPageSize, type MeetupSearchQuery, type MeetupSort, type MyMeetupTab, type MyMeetupVM,
} from '../../api/meetups'
import { ErrorState, SkeletonCards } from '../../components/AsyncState'
import s from './Meetups.module.css'

const PAGE_SIZES: readonly MeetupPageSize[] = [6, 12, 24]
const SORTS = ['가까운 날짜순', '최신등록순', '인기순', '인원순'] as const
const SORT_CODE: Record<(typeof SORTS)[number], MeetupSort> = { '가까운 날짜순': 'STARTS_SOON', 최신등록순: 'NEWEST', 인기순: 'POPULAR', 인원순: 'MOST_JOINED' }
const DATES = ['전체', '오늘', '이번 주', '이번 주말'] as const
const MODES = ['전체', '오프라인', '온라인'] as const

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
 * 3 카테고리 필터: 전체 / 여러 개 골라 좁힘 (명세 07 — 모임 전용 6개, 관심사와 관계없음. M15 는 명세로 뒤집힘)
 * 4 날짜 · 방식 · 정렬: 모두 AND. 모임에는 캠퍼스가 없어 캠퍼스로는 거르지 않음 (명세 07)
 * 5 카드: 상태 배지(모집 중 / 모집 완료), 모집 완료는 흐리게 맨 뒤, 지난·취소된 모임은 안 보임, 인원 = 주최자 포함 확정 / 정원
 * 6 N개씩 보기 6(기본) / 12 / 24 + 페이지 번호
 * API: GET /meetups (검색어는 입력이 멈춘 뒤 0.3초에 부름, 날짜 빠른 선택은 프론트가 dateFrom · dateTo 로 바꿈).
 *      명세의 모임 카드에는 찜 여부가 없어 리스트 카드에는 하트를 두지 않음 (찜은 상세에서)
 * 데모용 쿼리: ?cat=<카테고리 id>
 */
export function MeetupList() {
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [cats, setCats] = useState<string[]>(() => (params.get('cat') ? [params.get('cat')!] : []))
  const [date, setDate] = useState<(typeof DATES)[number]>('전체')
  const [range, setRange] = useState<[string, string] | null>(null)
  const [rangeOpen, setRangeOpen] = useState(params.get('modal') === 'range')
  const [mode, setMode] = useState<(typeof MODES)[number]>('전체')
  const [sort, setSort] = useState<(typeof SORTS)[number]>('가까운 날짜순')
  const [size, setSize] = useState<MeetupPageSize>(6)
  const [page, setPage] = useState(1)
  const reset = () => setPage(1)
  // 입력이 멈춘 뒤에 부름 (명세 "화면마다 부르는 API": 입력이 멈춘 뒤에 부르기)
  const [keyword, setKeyword] = useState('')
  useEffect(() => { const t = setTimeout(() => setKeyword(q.trim()), 300); return () => clearTimeout(t) }, [q])

  // 거르기 · 정렬 · 페이지는 서버가 함 (api/meetups.ts, 목 서버도 같은 규칙). 바꾸면 이전 목록을 보여 주다가 바꿔 낌
  const r = range ?? (date === '오늘' ? [TODAY, TODAY] : date === '이번 주' || date === '이번 주말' ? weekRange(date) : null)
  const query: MeetupSearchQuery = {
    keyword: keyword.slice(0, 50) || undefined,
    categories: cats.length ? cats.map((id) => MEETUP_CATEGORIES.find((c) => c.id === id)!.code) : undefined,
    dateFrom: r?.[0], dateTo: r?.[1], mode: mode === '전체' ? undefined : mode === '온라인' ? 'ONLINE' : 'OFFLINE',
    sort: SORT_CODE[sort], page, size,
  }
  const res = useMeetupList(query)
  const items = res.data?.items ?? []
  const total = res.data?.totalPages ?? 1
  const cur = res.data?.page ?? page
  const toggleCat = (id: string) => { setCats((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])); reset() }

  return (
    <>
      <h1 className="page-sign">모임</h1>
      <div className={s.listTools}>
        <label className={s.search}><SearchIcon size={18} /><input value={q} onChange={(e) => { setQ(e.target.value); reset() }} placeholder="모임 이름, 소개 검색" aria-label="모임 검색" /></label>
        <div className={s.ddRow}>
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
      <div className={s.filters} role="group" aria-label="카테고리 필터">
        <span className={s.filterLabel}>카테고리</span>
        <button className={cats.length === 0 ? s.fOn : s.f} aria-pressed={cats.length === 0} onClick={() => { setCats([]); reset() }}>전체</button>
        <span className={s.sep} />
        {MEETUP_CATEGORIES.map((c) => {
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
          {items.map(({ meetup: m, confirmed, recruit }) => {
            const closed = recruit === 'closed'
            return (
              <MeetupCard key={m.id} m={m} done={closed}
                badge={closed ? { label: '모집 완료', tone: 'done' } : { label: '모집 중', tone: 'open' }}
                people={`${confirmed} / ${m.capacity}명`} place={placeLine(m)} />
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
    </>
  )
}

const TABS = [
  { id: 'upcoming', api: 'UPCOMING', count: 'upcoming', label: '다가오는 모임' }, { id: 'pending', api: 'PENDING', count: 'pending', label: '신청 대기' },
  { id: 'hosting', api: 'HOSTING', count: 'hosting', label: '내가 연 모임' }, { id: 'wish', api: 'LIKED', count: 'liked', label: '찜한 모임' },
  { id: 'past', api: 'PAST', count: 'past', label: '지난 모임' },
] as const
type TabId = (typeof TABS)[number]['id']
const EMPTY: Record<TabId, string> = {
  upcoming: '다가오는 모임이 없어요. 모임을 둘러보세요.', pending: '확인을 기다리는 신청이 없어요.', hosting: '아직 연 모임이 없어요.',
  wish: '찜한 모임이 없어요. 모임 상세의 ♡를 눌러 보세요.', past: '지난 모임 기록이 없어요.',
}

/**
 * 모임 – 내 모임 (1075:11219) · 찜한 모임 (1075:11830)
 * API: 탭 숫자 = GET /me/meetups/summary counts, 목록 = GET /me/meetups?tab= (탭마다 한 번에 모두)
 * 2 상태 탭 5개. 신청 대기 중 주최자가 수락하면 다가오는 모임으로 옮겨짐. 지난 모임은 기록으로만(지울 수 없음), 취소된 모임은 "취소됨"으로 지난 모임에
 * 3 가까운 날짜순 목록(순서는 서버). 승인되지 않은 신청(REJECTED)은 신청 대기 탭에 "승인되지 않음"으로 남음
 * 4 상태별 버튼(myStatus): PENDING = 신청 취소 / CONFIRMED = 모임 채팅 / HOST = 신청 관리(pendingCount) · 모임 수정(canEdit 이 false 면 끔)
 * 5 확인 필요 한 줄: pendingCount(새 참여 신청) · unreadCount(새 메시지) · PENDING(주최자 확인 대기)
 * 찜: 하트 = 찜 해제(토스트 되돌리기: 다시 찜 + 풀기 전 빈자리 알림을 다시 켬), 모집 완료 모임만 빈자리 알림 받기, 남은 자리 1~2면 "N자리 남았어요"
 * 데모용 쿼리: ?tab=upcoming|pending|hosting|wish|past, ?manage=<모임 id> (신청 관리 팝업, F9 알림에서 들어올 때)
 */
export function MyMeetups() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const legacy = params.get('modal') === 'pending' ? 'pending' : null
  const tabParam = (params.get('tab') ?? legacy) as TabId | null
  const tab = TABS.find((t) => t.id === tabParam) ?? TABS[0]
  const setTab = (t: TabId) => setParams((p) => { p.set('tab', t); p.delete('modal'); return p }, { replace: true })
  const sum = useMyMeetupSummary()
  const q = useMyMeetups(tab.api)
  const list = q.data ?? []
  const run = useOptimistic()
  const [cancelAsk, setCancelAsk] = useState<string | null>(null)
  const [toast, setToast] = useState<MToast | null>(() => (params.get('toast') === 'cancelled' ? { title: '모임을 취소했어요', desc: '신청자와 참여자에게 알림이 갔어요' } : params.get('toast') === 'deleted' ? { title: '삭제가 완료되었어요', desc: '삭제한 내용은 되돌릴 수 없어요' } : null))
  const manage = params.get('manage')
  const setManage = (id: string | null) => setParams((p) => { if (id) p.set('manage', id); else p.delete('manage'); return p }, { replace: true })

  /** 이 탭 목록 캐시를 바꿈 */
  const tabPatch = (t: MyMeetupTab, f: (l: MyMeetupVM[]) => MyMeetupVM[]) => patch<MyMeetupVM[]>(meetupKeys.mine(t), f, true)
  const unlike = (c: MyMeetupVM) => run.mutate({
    call: () => meetupCalls.unlike(c.meetup.id), errors: MEETUP_ERRORS, errorTitle: '찜을 해제하지 못했어요', invalidate: [meetupKeys.all],
    patches: [tabPatch('LIKED', (l) => l.filter((x) => x.meetup.id !== c.meetup.id))],
  }, { onSuccess: () => setToast({ title: '찜을 해제했어요', undo: () => relike(c) }) })
  const relike = (c: MyMeetupVM) => run.mutate({
    call: () => meetupCalls.relike(c.meetup.id, c.alert), errors: MEETUP_ERRORS, errorTitle: '찜을 되돌리지 못했어요', invalidate: [meetupKeys.all],
  })
  const setAlert = (c: MyMeetupVM, on: boolean) => run.mutate({
    call: () => meetupCalls.setVacancyAlert(c.meetup.id, on), errors: MEETUP_ERRORS, errorTitle: on ? '빈자리 알림을 켜지 못했어요' : '빈자리 알림을 끄지 못했어요', invalidate: [meetupKeys.all],
    patches: [tabPatch('LIKED', (l) => l.map((x) => (x.meetup.id === c.meetup.id ? { ...x, alert: on } : x)))],
  }, { onSuccess: () => setToast({ title: on ? '빈자리 알림을 켰어요' : '빈자리 알림을 껐어요', desc: on ? '자리가 나면 알림으로 알려드릴게요' : undefined }) })
  const withdraw = (id: string) => run.mutate({
    call: () => meetupCalls.withdrawApplication(id), errors: MEETUP_ERRORS, errorTitle: '신청을 취소하지 못했어요', invalidate: [meetupKeys.all],
    patches: [tabPatch('PENDING', (l) => l.filter((x) => x.meetup.id !== id))],
  }, { onSuccess: () => setToast({ title: '신청을 취소했어요', desc: '마감 전까지 다시 신청할 수 있어요' }) })

  return (
    <>
      <Link to="/meetups" className={s.back}><ChevronLeft size={16} /> 모임</Link>
      <h1 className={`display ${s.myTitle}`}>내 모임</h1>
      <div className={s.tabs} role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab.id === t.id} className={tab.id === t.id ? s.tOn : s.t} onClick={() => setTab(t.id)}>
            {t.label} <span className={s.tCnt}>{sum.data?.counts[t.count] ?? ''}</span>
          </button>
        ))}
      </div>
      {tab.id === 'wish' && <p className={s.tabLead}>모임 상세의 ♡를 누르면 여기에 모여요. 가까운 날짜순으로 보여줘요.</p>}
      {q.isPending ? <SkeletonCards count={3} />
        : q.isError && !q.data ? <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} title="내 모임을 불러오지 못했어요" />
        : (
          <ul className={s.rows} aria-busy={q.isFetching}>
            {list.length === 0 && <li><EmptyMole message={EMPTY[tab.id]}>{tab.id !== 'past' && <Link to="/meetups" className="btn btn-line btn-sm">모임 둘러보기</Link>}</EmptyMole></li>}
            {list.map((c) => <MyRow key={c.meetup.id} c={c} tab={tab.id} busy={run.isPending}
              onUnlike={() => unlike(c)} onAlert={(on) => setAlert(c, on)} onWithdraw={() => setCancelAsk(c.meetup.id)} onManage={() => setManage(c.meetup.id)} onOther={() => nav('/meetups')} />)}
          </ul>
        )}
      <ConfirmDialog open={!!cancelAsk} onClose={() => setCancelAsk(null)} title="신청을 취소할까요?" desc="취소하면 주최자에게 보낸 신청과 남긴 말이 사라져요. 마감 전이면 다시 신청할 수 있어요." confirmLabel="신청 취소"
        onConfirm={() => { if (cancelAsk) withdraw(cancelAsk) }} />
      <ManageModal id={manage} onClose={() => setManage(null)} />
      <ActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}

/** 내 모임 한 줄 (버튼은 myStatus 로) */
function MyRow({ c, tab, busy, onUnlike, onAlert, onWithdraw, onManage, onOther }: {
  c: MyMeetupVM; tab: TabId; busy: boolean
  onUnlike: () => void; onAlert: (on: boolean) => void; onWithdraw: () => void; onManage: () => void; onOther: () => void
}) {
  const m = c.meetup
  const isWish = tab === 'wish'
  const closed = c.recruit === 'closed'
  const cancelled = c.recruit === 'cancelled'
  const left = Math.max(0, m.capacity - c.confirmed)
  const status = isWish
    ? (closed ? { label: '모집 완료', cls: s.stDone } : { label: '모집 중', cls: s.stOk })
    : cancelled ? { label: '취소됨', cls: s.stNo } : tab === 'past' ? { label: '지난 모임', cls: s.stDone }
    : c.my === 'HOST' ? { label: '내가 연 모임', cls: s.stHost } : (MY_LABEL[c.my] ?? MY_LABEL.PENDING!)
  let note: React.ReactNode = null
  if (isWish) note = closed ? (c.alert ? <span className={s.noteMuted}>● 자리가 나면 알려드릴게요</span> : null) : left > 0 && left <= 2 ? <span className={s.noteHot}>● {left}자리 남았어요</span> : null
  else if (tab !== 'past' && c.pendingCount > 0) note = <span className={s.noteHot}>● 새 참여 신청 {c.pendingCount}건</span>
  else if (tab !== 'past' && c.my === 'PENDING') note = <span className={s.noteMuted}>● 주최자 확인을 기다리고 있어요</span>
  else if (c.my === 'REJECTED') note = <span className={s.noteMuted}>아쉽게도 모임 참여가 승인되지 않았어요</span>
  else if (c.unread > 0) note = <span className={s.noteHot}>● 새 메시지 {c.unread}개</span>
  const chat = c.chatRoomId && <Link to={`/chat/${c.chatRoomId}`} className="btn btn-primary btn-sm">모임 채팅</Link>
  return (
    <li className={`${s.row} ${(isWish && closed) || cancelled || c.my === 'REJECTED' ? s.rowDim : ''}`}>
      <Link to={`/meetups/${m.id}`} className={s.rowThumb}><span>{m.sign ?? m.category}</span></Link>
      <div className={s.rowBody}>
        <p className={s.rowBadges}>
          <em className={status.cls}>{isWish && !closed && '● '}{status.label}</em>
          {tab !== 'past' && <em className={s.stDday}>{ddayOf(m.date)}</em>}
          <InterestChip label={m.category} tone={meetupToneOf(m.category)} />
        </p>
        <Link to={`/meetups/${m.id}`} className={s.rowTitle}>{m.title}</Link>
        <p className={s.rowMeta}>
          <span>🗓 {fullDate(m.date)} {hourLabel(m.start)}</span><span>📍 {placeLine(m)}</span><span>👤 {c.confirmed} / {m.capacity}명</span>
        </p>
        {note && <p className={s.rowNote}>{note}</p>}
      </div>
      <div className={s.rowActions}>
        {isWish ? (
          <>
            <button type="button" className={s.heartBtn} aria-label="찜 해제" disabled={busy} onClick={onUnlike}>♥</button>
            {closed
              ? <button type="button" className={`btn btn-line btn-sm ${c.alert ? s.alertOn : ''}`} aria-pressed={c.alert} disabled={busy} onClick={() => onAlert(!c.alert)}>
                  <span aria-hidden>🔔</span> {c.alert ? '빈자리 알림 받는 중' : '빈자리 알림 받기'}
                </button>
              : c.my === 'NONE' ? <Link to={`/meetups/${m.id}`} className="btn btn-cta btn-sm">참여 신청</Link>
              : <Link to={`/meetups/${m.id}`} className="btn btn-line btn-sm">모임 상세</Link>}
          </>
        ) : tab === 'past' ? (
          <>
            <Link to={`/meetups/${m.id}`} className="btn btn-line btn-sm">모임 상세</Link>
            {chat}
          </>
        ) : c.my === 'HOST' ? (
          <>
            {c.canEdit
              ? <Link to={`/meetups/${m.id}/edit`} className="btn btn-line btn-sm">모임 수정</Link>
              : <button type="button" className="btn btn-line btn-sm" disabled title="시작 12시간 전부터는 수정할 수 없어요">모임 수정</button>}
            <button type="button" className="btn btn-primary btn-sm" onClick={onManage}>신청 관리{c.pendingCount > 0 && ` ${c.pendingCount}`}</button>
          </>
        ) : c.my === 'PENDING' ? (
          <>
            <Link to={`/meetups/${m.id}`} className="btn btn-line btn-sm">모임 상세</Link>
            <button type="button" className={`btn btn-line btn-sm ${s.cancelBtn}`} disabled={busy} onClick={onWithdraw}>신청 취소</button>
          </>
        ) : c.my === 'REJECTED' ? (
          <button type="button" className="btn btn-line btn-sm" onClick={onOther}>다른 모임 보기</button>
        ) : (
          <>
            <Link to={`/meetups/${m.id}`} className="btn btn-line btn-sm">모임 상세</Link>
            {chat}
          </>
        )}
      </div>
    </li>
  )
}
