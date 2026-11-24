import { useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from '@/lib/nav'
import { EmptyMole } from '../../components/Feedback'
import { ErrorState, SkeletonRows, DetailSkeleton } from '../../components/AsyncState'
import { ChevronLeft, ChevronRight } from '../../components/Icons'
import NotFound from '../../components/NotFound'
import Pagination from '../../components/Pagination'
import pg from '../../components/Pagination.module.css'
import { isNotFound } from '../../api/client'
import { errorText } from '../../api/common'
import {
  NOTIF_KINDS, SETTINGS_ERRORS, useNotice, useNotices, useNotificationSettings, useUpdateNotificationSettings, type NotifKey,
} from '../../api/settings'
import { disablePush, enablePush, pushIsOn, pushPermission, pushSupported } from '../../lib/browserPush'
import { PageHead } from './SettingsParts'
import s from './Settings.module.css'

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={on ? s.switchOn : s.switch} onClick={() => onChange(!on)} disabled={disabled}>
      <span />
    </button>
  )
}

/** "브라우저 알림 받기" 스위치 상태 (이 브라우저의 권한 + 등록 id). 켜고 끌 때 다시 읽게 */
let pushVersion = 0
const pushSubs = new Set<() => void>()
const bumpPush = () => { pushVersion++; pushSubs.forEach((f) => f()) }
function usePushOn() {
  useSyncExternalStore((f) => { pushSubs.add(f); return () => { pushSubs.delete(f) } }, () => pushVersion)
  return pushIsOn()
}

/**
 * 설정 – 알림 설정 (10): 알림 화면 탭과 같은 다섯 갈래, 갈래별 스위치. 기본은 모두 켜짐 (GET /me/notification-settings).
 * 누르는 즉시 저장 (PATCH 에 다섯 값을 모두). 끈 갈래는 새 알림과 GNB 빨간 점에 나타나지 않는다. 방해 금지 시간은 없다.
 * "브라우저 알림 받기"는 브라우저마다 따로 (서버가 상태를 주지 않음): 켜면 알림 권한 요청 → 구독 → POST /me/push-subscriptions,
 * 끄면 DELETE /me/push-subscriptions/{id} (lib/browserPush.ts)
 */
export function NotifSettingsPage() {
  const q = useNotificationSettings()
  const update = useUpdateNotificationSettings()
  const pushOn = usePushOn()
  const [pushBusy, setPushBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const supported = pushSupported()

  const toggle = (key: NotifKey, on: boolean) => {
    if (!q.data) return
    setMsg(null)
    update.mutate({ ...q.data.values, [key]: on }, { onError: (e) => setMsg(`저장하지 못했어요. ${errorText(e, SETTINGS_ERRORS)}`) })
  }
  const togglePush = async (on: boolean) => {
    if (!q.data || pushBusy) return
    setMsg(null); setPushBusy(true)
    try {
      if (!on) await disablePush()
      else if (!q.data.pushPublicKey) {
        // 서버에 푸시 공개 키가 아직 없음 (명세 10 API: null, KAN-59 전까지)
        setMsg('브라우저 알림은 아직 준비 중이에요. 다음에 다시 켜 주세요.')
      } else {
        const r = await enablePush(q.data.pushPublicKey)
        if (r === 'unsupported') setMsg('이 브라우저는 알림을 지원하지 않아요.')
        if (r === 'denied') setMsg('브라우저에서 알림을 막아 두었어요. 주소창 왼쪽 자물쇠 아이콘에서 알림을 허용한 뒤 다시 켜 주세요.')
      }
    } catch (e) {
      setMsg(`${on ? '켜지' : '끄지'} 못했어요. ${errorText(e, SETTINGS_ERRORS)}`)
    } finally { setPushBusy(false); bumpPush() }
  }

  return (
    <>
      <PageHead title="알림 설정" sub="받고 싶은 알림만 골라서 켤 수 있어요." />
      {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} /> : (
        <>
          <ul className={`${s.card} ${s.cardFlush} ${s.rowList}`} aria-busy={q.isPending}>
            {NOTIF_KINDS.map((k) => (
              <li key={k.key} className={s.setRow}>
                <span className={s.letter} aria-hidden>{k.letter}</span>
                <span className={s.setText}><strong>{k.label} 알림</strong><small>{k.desc}</small></span>
                <Switch on={!!q.data?.values[k.key]} onChange={(v) => toggle(k.key, v)} label={`${k.label} 알림`} disabled={!q.data} />
              </li>
            ))}
          </ul>
          <ul className={`${s.card} ${s.cardFlush} ${s.rowList}`} style={{ marginTop: 16 }}>
            <li className={s.setRow}>
              <span className={s.letter} aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 21h8" /></svg>
              </span>
              <span className={s.setText}>
                <strong>브라우저 알림 받기</strong>
                <small>디굴디굴 창을 보고 있지 않을 때도, 위에서 켠 종류의 알림을 이 브라우저로 알려드려요. 다른 브라우저에서도 받으려면 그 브라우저에서 켜 주세요.</small>
              </span>
              <Switch on={supported && pushOn} onChange={(v) => void togglePush(v)} label="브라우저 알림 받기" disabled={!q.data || pushBusy} />
            </li>
          </ul>
          {!supported && <p className={s.note}>이 브라우저는 알림을 지원하지 않아요.</p>}
          {supported && pushPermission() === 'denied' && !msg && <p className={s.note}>브라우저에서 알림이 막혀 있어요. 켜려면 주소창 왼쪽 자물쇠 아이콘에서 알림을 허용해 주세요.</p>}
        </>
      )}
      {msg && <p className={s.noteWarn} role="status">{msg}</p>}
      <p className={s.note}>바꾸면 바로 저장돼요.</p>
    </>
  )
}

const chip = (cat: string) => `${s.chip} ${s[`chip${cat}`] ?? ''}`

/** 설정 – 공지사항 (10, GET /notices): 분류 · 제목 · 올린 날짜, 최신순, 누르면 상세. 전체 건수 + 페이지 (한 페이지 10개) */
export function NoticeListPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const q = useNotices(page)
  const d = q.data
  return (
    <>
      <PageHead title="공지사항" sub="서비스 소식을 확인해 보세요." />
      <div className={`${s.card} ${s.cardFlush}`}>
        {q.isError ? <div style={{ padding: 24 }}><ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} /></div>
          : !d ? <div style={{ padding: 24 }}><SkeletonRows count={5} avatar={false} label="공지를 불러오는 중" /></div>
            : d.rows.length === 0 ? (
              <div style={{ padding: 24 }}><EmptyMole message="아직 올라온 공지가 없어요" /></div>
            ) : (
              <ul className={s.noticeList} aria-busy={q.isFetching}>
                {d.rows.map((n) => (
                  <li key={n.id}>
                    <button className={s.noticeRow} onClick={() => navigate(`/settings/notices/${n.id}`)}>
                      <span className={chip(n.cat)}>{n.cat}</span>
                      <span className={s.noticeText}><strong>{n.title}</strong><small>{n.date}</small></span>
                      <ChevronRight size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
        <div className={s.pager}>
          <span>전체 {d?.totalItems ?? 0}건</span>
          <Pagination page={d?.page ?? page} total={d?.totalPages ?? 1} onChange={(p) => setParams({ page: String(p) })} />
          {(d?.totalPages ?? 1) <= 1 && (
            <nav className={pg.pager} aria-label="페이지">
              <button className={pg.arrow} disabled aria-label="이전 페이지"><ChevronLeft size={16} /></button>
              <button className={`${pg.num} ${pg.on}`} aria-current="page">1</button>
              <button className={pg.arrow} disabled aria-label="다음 페이지"><ChevronRight size={16} /></button>
            </nav>
          )}
        </div>
      </div>
    </>
  )
}

/** 설정 – 공지사항 상세 (10, GET /notices/{noticeId}): 목록으로 · 분류 · 제목 · 날짜 · 본문(줄바꿈만). 없거나 삭제한 공지는 안내 화면 */
export function NoticeDetailPage() {
  const { id = '' } = useParams()
  const q = useNotice(id)
  const n = q.data
  return (
    <>
      <PageHead title="공지사항" sub="서비스 소식을 확인해 보세요." />
      {q.isError ? (isNotFound(q.error) ? <NotFound what="notice" inline /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />)
        : !n ? <div className={s.card}><DetailSkeleton label="공지를 불러오는 중" /></div> : (
          <article className={s.card}>
            <Link to="/settings/notices" className={s.back}><ChevronLeft size={14} />목록으로</Link>
            <div className={s.detailHead}>
              <span className={chip(n.cat)}>{n.cat}</span>
              <h3>{n.title}</h3>
            </div>
            <p className={s.detailDate}>{n.date}</p>
            <div className={s.detailBody}>{n.body.map((p, i) => <p key={i}>{p}</p>)}</div>
          </article>
        )}
    </>
  )
}
