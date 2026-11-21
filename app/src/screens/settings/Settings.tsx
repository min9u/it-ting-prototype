import { useEffect, useState } from 'react'
import { setAuthState } from '../../data/auth'
import { stopChatRealtime } from '../../data/chat'
import { Navigate, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight } from '../../components/Icons'
import { ConfirmDialog } from '../../components/Feedback'
import { PageHead } from './SettingsParts'
import { accountStore, isGoogleOnly, setSignupMethod, useAccount } from '../../data/account'
import s from './Settings.module.css'

export { PasswordPage, GooglePage } from './SettingsAccount'
export { NotifSettingsPage, BlockedPage, NoticeListPage, NoticeDetailPage } from './SettingsInfo'
export { LeavePage } from './SettingsLeave'

/**
 * 설정 (Desktop) — Figma 02 F10 (2026-11-16 명세 스크린샷)
 * 왼쪽 메뉴: 계정(비밀번호 변경 · Google 연동하기) / 알림(알림 설정) / 정보(공지사항 · 버전 정보 · 3D 모델 크레딧)
 * 차단 기능은 팀 명세에 없어(2026-11-20, README "이번 범위에 없는 것") 메뉴에서 뺌. 차단 화면 · 프로필 팝업의 차단은 아직 남아 있음(docs/f6-f10-gaps F10-B1)
 * 맨 아래 로그아웃(확인 팝업) · 회원 탈퇴. 지금 보는 항목 강조. 버전 정보는 숫자만, 누를 수 없음.
 * "비밀번호 변경"은 이메일로 가입한 계정에만. Google로만 가입한 계정은 "Google 연동하기"가 첫 화면.
 * 언어 설정 · 다크 모드는 이번 범위에 없음.
 * 데모용 쿼리: ?account=google (Google로만 가입한 계정으로 보기) · ?account=email, ?modal=logout
 */
export default function Settings() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const acc = useAccount()
  const googleOnly = isGoogleOnly(acc)
  const [logout, setLogout] = useState(params.get('modal') === 'logout')

  useEffect(() => {
    const a = params.get('account')
    if (a === 'google' || a === 'email') {
      setSignupMethod(a)
      params.delete('account'); setParams(params, { replace: true })
      if (a === 'google') navigate('/settings/google', { replace: true })
    }
  }, [params, setParams, navigate])

  const item = (to: string, label: string, end = true) => (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? s.menuItemOn : s.menuItem)}>
      {label}<ChevronRight size={16} />
    </NavLink>
  )

  return (
    <main className={s.page}>
      <h1 className={`page-sign ${s.sign}`}>설정</h1>
      <div className={s.wrap}>
        <nav className={s.menu} aria-label="설정 메뉴">
          <div className={s.menuGroup}>
            <h2>계정</h2>
            {!googleOnly && item('/settings/password', '비밀번호 변경')}
            {item('/settings/google', 'Google 연동하기')}
          </div>
          <div className={s.menuGroup}>
            <h2>알림</h2>
            {item('/settings/notifications', '알림 설정')}
          </div>
          <div className={s.menuGroup}>
            <h2>정보</h2>
            {item('/settings/notices', '공지사항', false)}
            <div className={s.menuStatic}>버전 정보<span>1.0.0</span></div>
            {item('/settings/credits', '3D 모델 크레딧')}
          </div>
          <div className={s.menuBottom}>
            <button className={`${s.menuItem} ${s.logout}`} onClick={() => setLogout(true)}>로그아웃</button>
            <NavLink to="/settings/leave" className={({ isActive }) => `${isActive ? s.menuItemOn : s.menuItem} ${s.leave}`}>
              {({ isActive }) => <>회원 탈퇴{isActive && <ChevronRight size={16} />}</>}
            </NavLink>
          </div>
        </nav>
        <section className={s.main}>
          <Outlet />
        </section>
      </div>

      <ConfirmDialog open={logout} onClose={() => setLogout(false)} onConfirm={() => { setAuthState('guest'); stopChatRealtime(); navigate('/start') }}
        title="로그아웃할까요?" desc="다시 들어오려면 로그인해야 해요." confirmLabel="로그아웃" tone="primary" />
    </main>
  )
}

/** /settings: 설정의 첫 화면 (이메일 계정 → 비밀번호 변경, Google로만 가입 → Google 연동하기) */
export function SettingsHome() {
  return <Navigate to={isGoogleOnly(accountStore.get()) ? '/settings/google' : '/settings/password'} replace />
}

/** 3D 모델 작가 표기 (CC-BY 3.0 의무, 3D 핸드오프 v3.2 docs/credits_app.md). 설정 › 정보 아래로 옮김 */
export function CreditsPage() {
  return (
    <>
      <PageHead title="3D 모델 크레딧" sub="디굴디굴에 쓴 3D 모델의 작가 표기예요." />
      <div className={s.card}>
        <div className={s.credits}>
          <ul>
            {CREDITS.map((c) => (
              <li key={c.url}>
                "{c.title}" by {c.author} (<a href={c.url} target="_blank" rel="noreferrer">{c.url}</a>), CC BY 3.0 — 색을 바꿔 사용
              </li>
            ))}
          </ul>
          <p>라이선스: <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">https://creativecommons.org/licenses/by/3.0/</a></p>
          <p>일부 3D 모델: Poly Pizza (CC0) — Kenney, Quaternius, Kay Lousberg, Isa Lousberg, CreativeTrio 외. 나머지 두더지·방·가구는 디굴디굴 3D 팀 제작</p>
        </div>
      </div>
    </>
  )
}

const CREDITS = [
  { title: 'Acoustic guitar', author: 'jeremy', url: 'https://poly.pizza/m/afr6GCpce_I' },
  { title: 'Arcade Machine', author: 'J-Toastie', url: 'https://poly.pizza/m/GLDkMhiynM' },
  { title: 'Bean Bag', author: 'J-Toastie', url: 'https://poly.pizza/m/nMZz79A5ru' },
]

