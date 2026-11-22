import { useEffect } from 'react'
import { createBrowserRouter, createHashRouter, Navigate, Outlet } from 'react-router-dom'
import { ENV } from './lib/env'
import { startChatRealtime } from './data/chat'

// 공유용 빌드(npm run build:share)는 주소 경로를 바꿀 수 없는 곳에 올라가서 # 라우팅을 씀 (VITE_HASH_ROUTER=1, "0" 은 끔: lib/env.ts)
const createRouter = ENV.hashRouter ? createHashRouter : createBrowserRouter
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
  CreditsPage, GooglePage, LeavePage, NoticeDetailPage, NoticeListPage, NotifSettingsPage, PasswordPage, SettingsHome,
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
import { ApiKnobBadge, ApiToaster } from './components/AsyncState'
import { MockServerSync } from './api/queries'

/** 로그인 뒤 화면: 헤더(GNB) + 내용 + 쓰기 실패 토스트 · 목 서버 손잡이 배지. 채팅·알림 실시간 연결은 여기 들어올 때 시작 (src/realtime, 로그아웃 때 stopChatRealtime) */
function AppLayout() {
  useEffect(() => { startChatRealtime() }, [])
  return (
    <>
      <AppHeader />
      <Outlet />
      <ApiToaster />
      <ApiKnobBadge />
      <MockServerSync />
    </>
  )
}

/** 개발 서버 전용: 화면 에러 경계 확인 (/dev/crash → 헤더는 남고 안쪽만 안내) */
function DevCrash(): never { throw new Error('개발용: 화면 에러 경계 확인 (/dev/crash)') }

/**
 * 에러 경계 (docs/frontend-hardening.md "에러 경계"): 세 겹
 * 1. 맨 바깥: 시작 화면·온보딩·관리자까지 모든 화면의 마지막 그물 (react-router 기본 "Unexpected Application Error!" 대신)
 * 2. 로그인 영역 틀(AppLayout): 헤더 자체가 깨질 때
 * 3. 화면 하나: 헤더(GNB)는 두고 안쪽만 안내 (inline). 모임·설정은 탭·왼쪽 메뉴도 남김
 * 재배포 뒤 옛 파일(청크 404)이면 RouteError 가 한 번만 새로고침
 */
export const router = createRouter([{ errorElement: <RouteError />, children: [
  // 시작하기 v2. 팀 공유용 빌드도 시작 화면부터 (2026-11-11: 팀원이 랜딩 → 가입 → 온보딩을 체험하도록. 이전에는 /burrow)
  // F1 · F2 (02 명세 2026-11-16): 휴대폰 · 태블릿이면 "PC에서 이용해 주세요" (00 공통 20)
  { path: '/', element: ENV.hashRouter ? <Navigate to="/start" replace /> : <PcOnly><Landing /></PcOnly> },
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
  // 땅굴 다양성 실험실 (2026-11-16, docs/burrow-diversity.md). three.js 를 쓰는 화면이라 따로 불러옴
  { path: '/lab/style', lazy: () => import('./screens/lab/StyleLab').then((m) => ({ Component: m.default })) },
  {
    // 비로그인이면 로그인 화면으로 (00 공통 11)
    element: <RequireLogin><AppLayout /></RequireLogin>,
    errorElement: <RouteError />,
    children: [{ errorElement: <RouteError inline />, children: [
      { path: '/burrow', element: <MyBurrow /> },
      { path: '/burrow/explore', element: <ExploreDesigns /> }, // 디자인 시안 A(ExploreBurrow)·B·C·D 전환
      { path: '/burrow/:userId', element: <VisitBurrow /> },
      // 땅굴 비교 실험실 (2026-11-18, docs/room-diversity-2026-11-18.md): 방문자 뷰와 같은 방을 아무 관심사로. 헤더 아래 크기가 같게 이 묶음 안에
      { path: '/lab/rooms', lazy: () => import('./screens/lab/RoomsLab').then((m) => ({ Component: m.default })) },
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
        children: [{ errorElement: <RouteError inline />, children: [
          { index: true, element: <MeetupList /> },
          { path: 'me', element: <MyMeetups /> },
        ] }],
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
        children: [{ errorElement: <RouteError inline />, children: [
          { index: true, element: <SettingsHome /> },
          { path: 'password', element: <PasswordPage /> },
          { path: 'google', element: <GooglePage /> },
          { path: 'notifications', element: <NotifSettingsPage /> },
          { path: 'notices', element: <NoticeListPage /> },
          { path: 'notices/:id', element: <NoticeDetailPage /> },
          { path: 'leave', element: <LeavePage /> },
          { path: 'credits', element: <CreditsPage /> },
        ] }],
      },
      { path: '/notifications', element: <Notifications /> },
      // 00 공통 21 대상 없음: 알림에서 원본이 사라진 경우 /gone/meetup|post|burrow|chat|notice, 없는 주소는 *
      { path: '/gone/:what', element: <GoneRoute /> },
      ...(ENV.dev ? [{ path: '/dev/crash', element: <DevCrash /> }] : []),
      { path: '*', element: <NotFound /> },
    ] }],
  },
] }])
