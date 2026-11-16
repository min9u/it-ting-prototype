import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { ConfirmDialog, EmptyMole, Toast } from '../../components/Feedback'
import { ChevronLeft, ChevronRight } from '../../components/Icons'
import NotFound from '../../components/NotFound'
import Pagination from '../../components/Pagination'
import pg from '../../components/Pagination.module.css'
import { unblockUser, useBlocked, type BlockedUser } from '../../data/account'
import { KIND_META, NOTICE_KINDS, setBrowserPush, setNoticeKind, useNoticePrefs } from '../../data/notifications'
import { serviceNoticeOf, useServiceNotices } from '../../data/serviceNotices'
import { PageHead } from './SettingsParts'
import s from './Settings.module.css'

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={on ? s.switchOn : s.switch} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

/**
 * 설정 – 알림 설정 (F10): 알림 화면 탭과 같은 다섯 종류, 종류별 스위치. 기본은 모두 켜짐.
 * 누르는 즉시 저장(저장 버튼 없음). 끈 종류는 새 알림과 GNB 빨간 점에 나타나지 않는다. 방해 금지 시간은 없다.
 * "브라우저 알림 받기"를 켜면 브라우저 알림 권한을 요청하고, 허용하면 켜 둔 종류를 브라우저 푸시로도 받는다(00 공통 2).
 */
export function NotifSettingsPage() {
  const { kinds, browserPush } = useNoticePrefs()
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const supported = typeof Notification !== 'undefined'

  const togglePush = async (on: boolean) => {
    setPushMsg(null)
    if (!on) { setBrowserPush(false); return }
    if (!supported) { setPushMsg('이 브라우저는 알림을 지원하지 않아요.'); return }
    let perm = Notification.permission
    if (perm === 'default') { try { perm = await Notification.requestPermission() } catch { perm = 'denied' } }
    if (perm === 'granted') setBrowserPush(true)
    else setPushMsg('브라우저에서 알림을 막아 두었어요. 주소창 왼쪽 자물쇠 아이콘에서 알림을 허용한 뒤 다시 켜 주세요.')
  }

  return (
    <>
      <PageHead title="알림 설정" sub="받고 싶은 알림만 골라서 켤 수 있어요." />
      <ul className={`${s.card} ${s.cardFlush} ${s.rowList}`}>
        {NOTICE_KINDS.map((k) => (
          <li key={k} className={s.setRow}>
            <span className={s.letter} aria-hidden>{KIND_META[k].label}</span>
            <span className={s.setText}><strong>{k} 알림</strong><small>{KIND_META[k].desc}</small></span>
            <Switch on={kinds[k]} onChange={(v) => setNoticeKind(k, v)} label={`${k} 알림`} />
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
            <small>디굴디굴 창을 보고 있지 않을 때도, 위에서 켠 종류의 알림을 브라우저로 알려드려요.</small>
          </span>
          <Switch on={browserPush && supported && Notification.permission === 'granted'} onChange={togglePush} label="브라우저 알림 받기" />
        </li>
      </ul>
      {pushMsg && <p className={s.noteWarn} role="status">{pushMsg}</p>}
      <p className={s.note}>바꾸면 바로 저장돼요.</p>
    </>
  )
}

/**
 * 설정 – 차단 관리 · 차단 해제 확인 (F10, 11-13 메타데이터 기준)
 * 차단한 사람: 두더지 · 닉네임 · 차단일 · 차단 해제. 해제는 확인 팝업 "OO님의 차단을 해제할까요?"
 * 차단은 프로필 팝업 · 글/댓글 "더 보기 › 차단"에서 한다 (data/account.ts blockUser)
 */
export function BlockedPage() {
  const list = useBlocked()
  const [target, setTarget] = useState<BlockedUser | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  return (
    <>
      <PageHead title="차단 관리" sub="차단한 사람을 확인하고 해제할 수 있어요." />
      {list.length === 0 ? (
        <div className={s.card}><EmptyMole message="차단한 사람이 없어요" /></div>
      ) : (
        <ul className={`${s.card} ${s.cardFlush} ${s.rowList}`}>
          {list.map((b) => (
            <li key={b.id} className={s.blockRow}>
              <Avatar size={44} label={`${b.nickname}의 두더지`} />
              <span className={s.setText}><strong>{b.nickname}</strong><small>차단일 {b.blockedAt}</small></span>
              <button className={s.btnLine} style={{ width: 100 }} onClick={() => setTarget(b)}>차단 해제</button>
            </li>
          ))}
        </ul>
      )}
      <p className={s.note}>차단한 사람은 내게 대화 요청을 보낼 수 없고, 그 사람의 글 · 댓글은 가려져요. 차단 목록은 언제든 바꿀 수 있어요.</p>
      <ConfirmDialog open={!!target} onClose={() => setTarget(null)}
        onConfirm={() => { if (target) { unblockUser(target.id); setToast(`${target.nickname}님의 차단을 해제했어요`) } }}
        title={`${target?.nickname ?? ''}님의 차단을 해제할까요?`} desc="해제하면 서로 다시 대화 요청을 보낼 수 있어요." confirmLabel="해제" tone="primary" />
      <Toast open={!!toast} title={toast ?? ''} onClose={() => setToast(null)} />
    </>
  )
}

const PER_PAGE = 10
const chip = (cat: string) => `${s.chip} ${s[`chip${cat}`] ?? ''}`

/** 설정 – 공지사항 (F10): 분류 · 제목 · 올린 날짜, 최신순, 누르면 상세. 전체 건수 + 페이지 */
export function NoticeListPage() {
  const list = useServiceNotices()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const total = Math.max(1, Math.ceil(list.length / PER_PAGE))
  const page = Math.min(total, Math.max(1, Number(params.get('page')) || 1))
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  return (
    <>
      <PageHead title="공지사항" sub="서비스 소식을 확인해 보세요." />
      <div className={`${s.card} ${s.cardFlush}`}>
        {list.length === 0 ? (
          <div style={{ padding: 24 }}><EmptyMole message="아직 올라온 공지가 없어요" /></div>
        ) : (
          <ul className={s.noticeList}>
            {shown.map((n) => (
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
          <span>전체 {list.length}건</span>
          <Pagination page={page} total={total} onChange={(p) => setParams({ page: String(p) })} />
          {total <= 1 && (
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

/** 설정 – 공지사항 상세 (F10): 목록으로 · 분류 · 제목 · 날짜 · 본문. 읽기만 (댓글 · 좋아요 없음) */
export function NoticeDetailPage() {
  const { id = '' } = useParams()
  const n = serviceNoticeOf(id)
  useServiceNotices()
  return (
    <>
      <PageHead title="공지사항" sub="서비스 소식을 확인해 보세요." />
      {!n ? <NotFound what="notice" inline /> : (
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
