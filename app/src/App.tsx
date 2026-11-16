import { createBrowserRouter, createHashRouter, Navigate, Outlet } from 'react-router-dom'

// 공유용 빌드(npm run build:share)는 주소 경로를 바꿀 수 없는 곳에 올라가서 # 라우팅을 씀
const createRouter = import.meta.env.VITE_HASH_ROUTER ? createHashRouter : createBrowserRouter
import AppHeader from './components/AppHeader'
import MyBurrow from './screens/burrow/MyBurrow'
import ExploreDesigns from './screens/burrow/explore-designs/ExploreDesigns'
import VisitBurrow from './screens/burrow/VisitBurrow'
import Chat from './screens/chat/Chat'
import MeetupsShell from './screens/meetups/MeetupsShell'
import { MeetupList, MyMeetups } from './screens/meetups/MeetupList'
import MeetupDetail from './screens/meetups/MeetupDetail'
import MeetupNew from './screens/meetups/MeetupNew'
import { BoardActivity, BoardEdit, BoardList, BoardPost, BoardWrite } from './screens/board/Board'
import Settings, {
  BlockedPage, CreditsPage, GooglePage, LeavePage, NoticeDetailPage, NoticeListPage, NotifSettingsPage, PasswordPage, SettingsHome,
} from './screens/settings/Settings'
import Admin from './screens/admin/Admin'
import NotFound, { GoneRoute, RouteError } from './components/NotFound'
import Notifications from './screens/notifications/Notifications'
import Landing from './screens/start/Landing'
import LookAround from './screens/start/LookAround'
import { Login, PasswordReset, PasswordResetExpired, PasswordResetNew, PasswordResetSent, SignupEmail, SignupPassword, SignupSsafy } from './screens/start/Auth'
import { PcOnly, RequireLogin } from './screens/start/Guards'
import Onboarding from './screens/onboarding/Onboarding'
import ScreenIndex from './screens/ScreenIndex'

/** 로그인 뒤 화면: 헤더(GNB) + 내용 */
function AppLayout() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}

export const router = createRouter([
  // 시작하기 v2. 팀 공유용 빌드도 시작 화면부터 (2026-11-11: 팀원이 랜딩 → 가입 → 온보딩을 체험하도록. 이전에는 /burrow)
  // F1 · F2 (02 명세 2026-11-16): 휴대폰 · 태블릿이면 "PC에서 이용해 주세요" (00 공통 20)
  { path: '/', element: import.meta.env.VITE_HASH_ROUTER ? <Navigate to="/start" replace /> : <PcOnly><Landing /></PcOnly> },
  { path: '/start', element: <PcOnly><Landing /></PcOnly> },
  { path: '/look', element: <PcOnly><LookAround /></PcOnly> },
  { path: '/login', element: <PcOnly><Login /></PcOnly> },
  { path: '/signup', element: <PcOnly><SignupEmail /></PcOnly> },
  { path: '/signup/password', element: <PcOnly><SignupPassword /></PcOnly> },
  { path: '/signup/ssafy', element: <PcOnly><SignupSsafy /></PcOnly> },
  { path: '/password-reset', element: <PcOnly><PasswordReset /></PcOnly> },
  { path: '/password-reset/sent', element: <PcOnly><PasswordResetSent /></PcOnly> },
  { path: '/password-reset/new', element: <PcOnly><PasswordResetNew /></PcOnly> },
  { path: '/password-reset/expired', element: <PcOnly><PasswordResetExpired /></PcOnly> },
  // 온보딩
  { path: '/onboarding', element: <Navigate to="/onboarding/name" replace /> },
  { path: '/onboarding/:step', element: <RequireLogin><Onboarding /></RequireLogin> },
  // 화면 목록 (개발용)
  { path: '/screens', element: <ScreenIndex /> },
  // F11 관리자: 서비스 메뉴에 없는 별도 주소. 역할이 없으면 없는 주소처럼 보임
  { path: '/admin', element: <Admin /> },
  {
    // 비로그인이면 로그인 화면으로 (00 공통 11)
    element: <RequireLogin><AppLayout /></RequireLogin>,
    errorElement: <RouteError />,
    children: [
      { path: '/burrow', element: <MyBurrow /> },
      { path: '/burrow/explore', element: <ExploreDesigns /> }, // 디자인 시안 A(ExploreBurrow)·B·C·D 전환
      { path: '/burrow/:userId', element: <VisitBurrow /> },
      { path: '/board', element: <BoardList /> },
      { path: '/board/write', element: <BoardWrite /> },
      { path: '/board/saved', element: <BoardActivity kind="saved" /> },
      { path: '/board/mine', element: <BoardActivity kind="mine" /> },
      { path: '/board/commented', element: <BoardActivity kind="commented" /> },
      { path: '/board/:postId/edit', element: <BoardEdit /> },
      { path: '/board/:postId', element: <BoardPost /> },
      { path: '/meetups/new', element: <MeetupNew /> },
      {
        path: '/meetups',
        element: <MeetupsShell />,
        children: [
          { index: true, element: <MeetupList /> },
          { path: 'me', element: <MyMeetups /> },
        ],
      },
      { path: '/meetups/:id', element: <MeetupDetail /> },
      { path: '/meetups/:id/edit', element: <MeetupNew /> },
      { path: '/chat', element: <Chat /> },
      { path: '/chat/requests', element: <Chat requests /> },
      { path: '/chat/:roomId', element: <Chat /> },
      // F10 설정 · 계정: 왼쪽 메뉴 + 항목별 화면
      {
        path: '/settings',
        element: <Settings />,
        children: [
          { index: true, element: <SettingsHome /> },
          { path: 'password', element: <PasswordPage /> },
          { path: 'google', element: <GooglePage /> },
          { path: 'notifications', element: <NotifSettingsPage /> },
          { path: 'blocked', element: <BlockedPage /> },
          { path: 'notices', element: <NoticeListPage /> },
          { path: 'notices/:id', element: <NoticeDetailPage /> },
          { path: 'leave', element: <LeavePage /> },
          { path: 'credits', element: <CreditsPage /> },
        ],
      },
      { path: '/notifications', element: <Notifications /> },
      // 00 공통 21 대상 없음: 알림에서 원본이 사라진 경우 /gone/meetup|post|burrow|chat|notice, 없는 주소는 *
      { path: '/gone/:what', element: <GoneRoute /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
