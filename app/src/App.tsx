import { createBrowserRouter, createHashRouter, Navigate, Outlet } from 'react-router-dom'

// 공유용 빌드(npm run build:share)는 주소 경로를 바꿀 수 없는 곳에 올라가서 # 라우팅을 씀
const createRouter = import.meta.env.VITE_HASH_ROUTER ? createHashRouter : createBrowserRouter
import AppHeader from './components/AppHeader'
import MyBurrow from './screens/burrow/MyBurrow'
import ExploreBurrow from './screens/burrow/ExploreBurrow'
import VisitBurrow from './screens/burrow/VisitBurrow'
import Chat from './screens/chat/Chat'
import MeetupsShell from './screens/meetups/MeetupsShell'
import { MeetupList, MyMeetups } from './screens/meetups/MeetupList'
import MeetupDetail from './screens/meetups/MeetupDetail'
import MeetupNew from './screens/meetups/MeetupNew'
import { BoardList, BoardPost, BoardSaved, BoardWrite } from './screens/board/Board'
import Settings, {
  BlockedPage, CreditsPage, GooglePage, LeavePage, NoticeDetailPage, NoticeListPage, NotifSettingsPage, PasswordPage, SettingsHome,
} from './screens/settings/Settings'
import Admin from './screens/admin/Admin'
import NotFound, { GoneRoute, RouteError } from './components/NotFound'
import Notifications from './screens/notifications/Notifications'
import Landing from './screens/start/Landing'
import LookAround from './screens/start/LookAround'
import { Login, PasswordReset, SignupEmail, SignupPassword } from './screens/start/Auth'
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
  { path: '/', element: import.meta.env.VITE_HASH_ROUTER ? <Navigate to="/start" replace /> : <Landing /> },
  { path: '/start', element: <Landing /> },
  { path: '/look', element: <LookAround /> },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <SignupEmail /> },
  { path: '/signup/password', element: <SignupPassword /> },
  { path: '/password-reset', element: <PasswordReset /> },
  // 온보딩
  { path: '/onboarding', element: <Navigate to="/onboarding/name" replace /> },
  { path: '/onboarding/:step', element: <Onboarding /> },
  // 화면 목록 (개발용)
  { path: '/screens', element: <ScreenIndex /> },
  // F11 관리자: 서비스 메뉴에 없는 별도 주소. 역할이 없으면 없는 주소처럼 보임
  { path: '/admin', element: <Admin /> },
  {
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/burrow', element: <MyBurrow /> },
      { path: '/burrow/explore', element: <ExploreBurrow /> },
      { path: '/burrow/:userId', element: <VisitBurrow /> },
      { path: '/board', element: <BoardList /> },
      { path: '/board/write', element: <BoardWrite /> },
      { path: '/board/saved', element: <BoardSaved /> },
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
