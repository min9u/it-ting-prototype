import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { NOTICE_PAGE, type Notice } from '../../data/mock'
import { KIND_STYLE } from '../../components/NotificationPopover'
import mound from '../../assets/mole-mound.png'
import s from './Notifications.module.css'

const TABS = ['전체', '모임', '채팅', '게시판', '공지'] as const
const KIND_OF: Record<(typeof TABS)[number], Notice['kind'] | null> = { 전체: null, 모임: '모임', 채팅: '채팅', 게시판: '커뮤니티', 공지: '공지' }

/**
 * 알림 페이지 + 빈 상태 569:7860 (2026-11-11 Figma 추가, 스크린샷 대조)
 * 팝업의 "전체 보기"로 들어옴. 데모용 쿼리: ?empty=1 (빈 상태)
 */
export default function Notifications() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<(typeof TABS)[number]>('전체')
  const [list, setList] = useState(() => (params.get('empty') ? [] : NOTICE_PAGE))
  const shown = list.filter((n) => !KIND_OF[tab] || n.kind === KIND_OF[tab])
  const unread = list.filter((n) => n.unread).length

  return (
    <main className={s.page}>
      <div className={s.head}>
        <h1 className="page-sign">알림</h1>
        {unread > 0 && <span className={s.unreadPill}>안 읽음 {unread}</span>}
        <button className={s.readAll} onClick={() => setList((l) => l.map((n) => ({ ...n, unread: false })))} disabled={!unread}>모두 읽음</button>
      </div>
      <div className={s.tabs} role="tablist" aria-label="알림 종류">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? s.tabOn : s.tab} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {shown.length === 0 ? (
        <div className={s.empty}>
          <img src={mound} alt="" />
          <p className="display">새 알림이 없어요</p>
        </div>
      ) : (
        <ul className={s.list}>
          {shown.map((n) => (
            <li key={n.id}>
              <Link to={n.to} className={n.unread ? `${s.item} ${s.unread}` : s.item} onClick={() => setList((l) => l.map((x) => (x.id === n.id ? { ...x, unread: false } : x)))}>
                <span className={s.kind} style={{ background: KIND_STYLE[n.kind].bg }} aria-label={n.kind}>{KIND_STYLE[n.kind].label}</span>
                <span className={s.body}><strong>{n.title}</strong><small>{n.sub}</small></span>
                <time>{n.ago}</time>
                <span className={n.unread ? s.dot : s.noDot} aria-label={n.unread ? '읽지 않음' : undefined} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
