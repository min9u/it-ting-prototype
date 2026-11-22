import { useEffect, type ReactElement } from 'react'
import { createBrowserRouter, createHashRouter, Navigate, Outlet } from 'react-router-dom'
import { ENV } from './lib/env'
import { startChatRealtime } from './data/chat'

// 공유용 빌드(npm run build:share)는 주소 경로를 바꿀 수 없는 곳에 올라가서 # 라우팅을 씀 (VITE_HASH_ROUTER=1, "0" 은 끔: lib/env.ts)
const createRouter = ENV.hashRouter ? createHashRouter : createBrowserRouter
import AppHeader from './components/AppHeader'
import NotFound, { GoneRoute, RouteError } from './components/NotFound'
import { PcOnly, RequireLogin } from './screens/start/Guards'
import { ApiKnobBadge, ApiToaster } from './components/AsyncState'
import { MockServerSync } from './api/queries'
import { NewTermGate } from './screens/burrow/NewTermNotice'

/**
 * 화면 코드는 그 화면에 들어갈 때 따로 불러옴 (route lazy): 첫 화면 JS 가 화면 전체 코드를 안 품게.
 * 이동은 청크가 도착한 뒤에 일어나고(그동안 이전 화면이 그대로), 청크가 없으면(재배포) 오류 경계가 한 번 새로고침한다(lib/chunkReload).
 * 처음 열 때는 HydrateFallback 이 잠깐 빈 바탕을 보여줌. 화면 모양·동작은 그대로
 */
const lz = <M,>(load: () => Promise<M>, render: (m: M) => ReactElement) => ({ lazy: async () => ({ element: render(await load()) }) })
const auth = (render: (m: typeof import('./screens/start/Auth')) => ReactElement) => lz(() => import('./screens/start/Auth'), (m) => <PcOnly>{render(m)}</PcOnly>)
const board = (render: (m: typeof import('./screens/board/Board')) => ReactElement) => lz(() => import('./screens/board/Board'), render)
const settings = (render: (m: typeof import('./screens/settings/Settings')) => ReactElement) => lz(() => import('./screens/settings/Settings'), render)
/** 처음 열 때 화면 코드를 기다리는 동안 (바탕색만. 깜빡임 없이 다음 화면이 그려짐) */
function Booting() { return <div aria-busy="true" style={{ minHeight: '100vh', background: 'var(--bg, #fbf3e8)' }} /> }

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
      <NewTermGate />
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
export const router = createRouter([{ errorElement: <RouteError />, HydrateFallback: Booting, children: [
  // 시작하기 v2. 팀 공유용 빌드도 시작 화면부터 (2026-11-11: 팀원이 랜딩 → 가입 → 온보딩을 체험하도록. 이전에는 /burrow)
  // F1 · F2 (02 명세 2026-11-16): 휴대폰 · 태블릿이면 "PC에서 이용해 주세요" (00 공통 20)
  ENV.hashRouter ? { path: '/', element: <Navigate to="/start" replace /> } : { path: '/', ...lz(() => import('./screens/start/Landing'), (m) => <PcOnly><m.default /></PcOnly>) },
  { path: '/start', ...lz(() => import('./screens/start/Landing'), (m) => <PcOnly><m.default /></PcOnly>) },
  { path: '/look', ...lz(() => import('./screens/start/LookAround'), (m) => <PcOnly><m.default /></PcOnly>) },
  { path: '/login', ...auth((m) => <m.Login />) },
  { path: '/signup', ...auth((m) => <m.SignupEmail />) },
  { path: '/signup/password', ...auth((m) => <m.SignupPassword />) },
  { path: '/signup/ssafy', ...auth((m) => <m.SignupSsafy />) },
  { path: '/password-reset', ...auth((m) => <m.PasswordReset />) },
  { path: '/password-reset/sent', ...auth((m) => <m.PasswordResetSent />) },
  { path: '/password-reset/new', ...auth((m) => <m.PasswordResetNew />) },
  { path: '/password-reset/expired', ...auth((m) => <m.PasswordResetExpired />) },
  // 온보딩
  { path: '/onboarding', element: <Navigate to="/onboarding/name" replace /> },
  { path: '/onboarding/:step', ...lz(() => import('./screens/onboarding/Onboarding'), (m) => <RequireLogin><m.default /></RequireLogin>) },
  // 화면 목록 (개발용)
  { path: '/screens', ...lz(() => import('./screens/ScreenIndex'), (m) => <m.default />) },
  // F11 관리자: 서비스 메뉴에 없는 별도 주소. 역할이 없으면 없는 주소처럼 보임
  { path: '/admin', ...lz(() => import('./screens/admin/Admin'), (m) => <m.default />) },
  // 땅굴 다양성 실험실 (2026-11-16, docs/burrow-diversity.md). three.js 를 쓰는 화면이라 따로 불러옴
  { path: '/lab/style', lazy: () => import('./screens/lab/StyleLab').then((m) => ({ Component: m.default })) },
  {
    // 비로그인이면 로그인 화면으로 (00 공통 11)
    element: <RequireLogin><AppLayout /></RequireLogin>,
    errorElement: <RouteError />,
    children: [{ errorElement: <RouteError inline />, children: [
      { path: '/burrow', ...lz(() => import('./screens/burrow/MyBurrow'), (m) => <m.default />) },
      { path: '/burrow/explore', ...lz(() => import('./screens/burrow/explore-designs/ExploreDesigns'), (m) => <m.default />) }, // 디자인 시안 A(ExploreBurrow)·B·C·D 전환
      { path: '/burrow/:userId', ...lz(() => import('./screens/burrow/VisitBurrow'), (m) => <m.default />) },
      // 땅굴 비교 실험실 (2026-11-18, docs/room-diversity-2026-11-18.md): 방문자 뷰와 같은 방을 아무 관심사로. 헤더 아래 크기가 같게 이 묶음 안에
      { path: '/lab/rooms', lazy: () => import('./screens/lab/RoomsLab').then((m) => ({ Component: m.default })) },
      { path: '/board', ...board((m) => <m.BoardList />) },
      { path: '/board/write', ...board((m) => <m.BoardWrite />) },
      { path: '/board/saved', ...board((m) => <m.BoardActivity kind="saved" />) },
      { path: '/board/mine', ...board((m) => <m.BoardActivity kind="mine" />) },
      { path: '/board/commented', ...board((m) => <m.BoardActivity kind="commented" />) },
      { path: '/board/:postId/edit', ...board((m) => <m.BoardEdit />) },
      { path: '/board/:postId', ...board((m) => <m.BoardPost />) },
      { path: '/meetups/new', ...lz(() => import('./screens/meetups/MeetupNew'), (m) => <m.default />) },
      {
        path: '/meetups',
        ...lz(() => import('./screens/meetups/MeetupsShell'), (m) => <m.default />),
        children: [{ errorElement: <RouteError inline />, children: [
          { index: true, ...lz(() => import('./screens/meetups/MeetupList'), (m) => <m.MeetupList />) },
          { path: 'me', ...lz(() => import('./screens/meetups/MeetupList'), (m) => <m.MyMeetups />) },
        ] }],
      },
      { path: '/meetups/:id', ...lz(() => import('./screens/meetups/MeetupDetail'), (m) => <m.default />) },
      { path: '/meetups/:id/edit', ...lz(() => import('./screens/meetups/MeetupNew'), (m) => <m.default />) },
      { path: '/chat', ...lz(() => import('./screens/chat/Chat'), (m) => <m.default />) },
      { path: '/chat/requests', ...lz(() => import('./screens/chat/Chat'), (m) => <m.default requests />) },
      { path: '/chat/:roomId', ...lz(() => import('./screens/chat/Chat'), (m) => <m.default />) },
      // F10 설정 · 계정: 왼쪽 메뉴 + 항목별 화면
      {
        path: '/settings',
        ...lz(() => import('./screens/settings/Settings'), (m) => <m.default />),
        children: [{ errorElement: <RouteError inline />, children: [
          { index: true, ...settings((m) => <m.SettingsHome />) },
          { path: 'password', ...settings((m) => <m.PasswordPage />) },
          { path: 'google', ...settings((m) => <m.GooglePage />) },
          { path: 'notifications', ...settings((m) => <m.NotifSettingsPage />) },
          { path: 'notices', ...settings((m) => <m.NoticeListPage />) },
          { path: 'notices/:id', ...settings((m) => <m.NoticeDetailPage />) },
          { path: 'leave', ...settings((m) => <m.LeavePage />) },
          { path: 'credits', ...settings((m) => <m.CreditsPage />) },
        ] }],
      },
      { path: '/notifications', ...lz(() => import('./screens/notifications/Notifications'), (m) => <m.default />) },
      // 00 공통 21 대상 없음: 알림에서 원본이 사라진 경우 /gone/meetup|post|burrow|chat|notice, 없는 주소는 *
      { path: '/gone/:what', element: <GoneRoute /> },
      ...(ENV.dev ? [{ path: '/dev/crash', element: <DevCrash /> }] : []),
      { path: '*', element: <NotFound /> },
    ] }],
  },
] }])
