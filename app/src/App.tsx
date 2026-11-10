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
import { BoardList, BoardPost } from './screens/board/Board'
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
  // 시작하기 v2. 팀 공유용 빌드는 로그인된 상태로 보이게 첫 화면을 내 땅굴로 (시작 화면은 /start)
  { path: '/', element: import.meta.env.VITE_HASH_ROUTER ? <Navigate to="/burrow" replace /> : <Landing /> },
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
  {
    element: <AppLayout />,
    children: [
      { path: '/burrow', element: <MyBurrow /> },
      { path: '/burrow/explore', element: <ExploreBurrow /> },
      { path: '/burrow/:userId', element: <VisitBurrow /> },
      { path: '/board', element: <BoardList /> },
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
      { path: '/chat', element: <Chat /> },
      { path: '/chat/requests', element: <Chat requests /> },
      { path: '/chat/:roomId', element: <Chat /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
