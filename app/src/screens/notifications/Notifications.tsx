import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  NOTICE_KINDS, markAllNoticesRead, useNoticePrefs, useNotices, visibleNotices, type NoticeKind,
} from '../../data/notifications'
import { NoticeRow, openNotice } from '../../components/NotificationPopover'
import Footer from '../../components/Footer'
import mound from '../../assets/mole-mound.png'
import s from './Notifications.module.css'

type Tab = '전체' | NoticeKind
const TABS: Tab[] = ['전체', ...NOTICE_KINDS]
const PAGE = 20

/**
 * 알림 (Desktop) — Figma 02 F9 2026-11-16 명세
 * - 제목 "알림" + "안 읽음 N"(0이면 숨김), 모두 읽음
 * - 탭: 전체 / 모임 / 채팅 / 커뮤니티 / 땅굴 / 공지 (설정 › 알림 설정과 같은 순서)
 * - 목록: 안 읽은 알림 맨 위, 그 아래 최신순. 최근 30일, 20개씩 "더 보기"
 * - 팝업과 달리 요청 알림(참여 신청 받음 · 대화 요청)도 목록에 나온다
 * - 빈 상태: 두더지 + "새 알림이 없어요" (고른 탭에 알림이 없을 때도)
 * 데모용 쿼리: ?empty=1 (빈 상태), ?tab=모임
 */
export default function Notifications() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>(() => (TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : '전체'))
  const [shownCount, setShownCount] = useState(PAGE)
  const all = useNotices()
  const { kinds } = useNoticePrefs()
  const list = params.get('empty') ? [] : visibleNotices(all, kinds)
  const inTab = list.filter((n) => tab === '전체' || n.kind === tab)
  const shown = inTab.slice(0, shownCount)
  const unread = list.filter((n) => n.unread).length

  return (
    <>
      <main className={s.page}>
        <div className={s.head}>
          <h1 className={`display ${s.title}`}>알림</h1>
          {unread > 0 && <span className={s.unreadPill}>안 읽음 {unread}</span>}
          <button className={s.readAll} onClick={markAllNoticesRead} disabled={!unread}>모두 읽음</button>
        </div>
        <div className={s.tabs} role="tablist" aria-label="알림 종류">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? s.tabOn : s.tab}
              onClick={() => { setTab(t); setShownCount(PAGE) }}>{t}</button>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className={s.empty}>
            <img src={mound} alt="" />
            <p className="display">새 알림이 없어요</p>
          </div>
        ) : (
          <>
            <ul className={s.list}>
              {shown.map((n) => <li key={n.id}><NoticeRow n={n} wide onOpen={(x) => openNotice(x, navigate)} /></li>)}
            </ul>
            {inTab.length > shownCount && (
              <button className={s.more} onClick={() => setShownCount((c) => c + PAGE)}>더 보기</button>
            )}
            <p className={s.caption}>안 읽은 알림이 맨 위에 보여요 · 최근 30일 알림만 보관해요</p>
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
