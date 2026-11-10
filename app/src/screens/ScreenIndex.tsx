import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

/** 개발용: Figma 03. Screens 화면 ↔ 경로 목록 (docs/frontend-plan.md 와 같은 내용) */
const GROUPS: { title: string; items: [string, string, string, boolean?][] }[] = [
  { title: '시작하기 v2', items: [
    ['랜딩 01–04 (스크롤)', '/start', '408:19697 · 19721 · 19384 · 19542'],
    ['둘러보기 · 땅 (비로그인) / 4번째 방 로그인 필요', '/look', '408:19989 · 408:20104'],
    ['로그인', '/login', '408:20248'],
    ['회원가입 1 · 이메일', '/signup', '408:20403'],
    ['회원가입 2 · 비밀번호', '/signup/password', '408:20564'],
    ['비밀번호 찾기', '/password-reset', '504:5382'],
  ] },
  { title: '온보딩', items: [
    ['1 나를 부르는 이름', '/onboarding/name', '408:18310'],
    ['2 관심 분야 고르기 (+ 분야 팝업)', '/onboarding/interests', '408:18482 · 408:18656'],
    ['3 자기소개', '/onboarding/intro', '408:18828'],
    ['3a 방 만드는 중 → 3b 가구 매칭 완료', '/onboarding/building', '408:19036 · 408:21319'],
    ['3c 땅굴 미리보기', '/onboarding/preview', '408:19306'],
  ] },
  { title: '땅굴', items: [
    ['내 땅굴 (스크린샷 대조 완료)', '/burrow', '454:6900', true],
    ['내 땅굴 – 사이드바 접힘', '/burrow?panel=closed', '454:7053', true],
    ['내 땅굴 – 방명록 0개', '/burrow?guestbook=0', '506:7960', true],
    ['내 땅굴 – 방명록 전체보기 모달', '/burrow?modal=guestbook', '454:7748', true],
    ['탐색하기 (돌아다니기)', '/burrow/explore', '477:12524 · 493:12616'],
    ['방문자 뷰 (예린이의 땅굴)', '/burrow/yerin', '510:13663'],
    ['방문자 뷰 – 대화 요청 팝업', '/burrow/yerin?modal=request', '495:13898'],
  ] },
  { title: '커뮤니티', items: [
    ['게시판', '/board', '494:12708'],
    ['글 상세 A안', '/board/p1', '494:13028'],
    ['글 상세 B안', '/board/p1?v=b', '494:13242'],
  ] },
  { title: '모임', items: [
    ['모임 리스트', '/meetups', '494:13691'],
    ['모임 – 캘린더 팝업', '/meetups?modal=calendar', '544:6128'],
    ['내 모임', '/meetups/me', '546:7282 · 500:15371'],
    ['모임 상세', '/meetups/m1', '494:13857 · 408:13129'],
    ['모임 상세 – 참여 신청 팝업', '/meetups/m4?modal=apply', '544:7521'],
    ['모임 만들기', '/meetups/new', '408:13607'],
    ['모임 생성 완료 팝업', '/meetups/new?modal=done', '408:14074'],
  ] },
  { title: '채팅', items: [
    ['대화 선택 전', '/chat', '408:16219'],
    ['1대1 대화', '/chat/r-yerin', '408:16412'],
    ['모임 대화', '/chat/r-book', '408:16752'],
    ['대화 요청 대기 중', '/chat/r-seoyeon', '408:15921'],
    ['받은 요청 · 보낸 요청', '/chat/requests', '408:17145'],
  ] },
]

export default function ScreenIndex() {
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 20px 80px' }}>
      <img src={logo} alt="디굴디굴" width={92} height={48} />
      <h1 className="display" style={{ fontSize: 30, marginTop: 12 }}>화면 목록</h1>
      <p style={{ color: 'var(--ink-500)', marginTop: 6 }}>Figma "03. Screens" 기준. ✅ 는 스크린샷과 대조한 화면, 나머지는 메타데이터 기반이라 스크린샷 대조가 필요해요.</p>
      {GROUPS.map((g) => (
        <section key={g.title} style={{ marginTop: 28 }}>
          <h2 className="display" style={{ fontSize: 20, marginBottom: 8 }}>{g.title}</h2>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {g.items.map(([label, to, node, ok]) => (
              <li key={to} style={{ display: 'flex', gap: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--surface)' }}>
                <span style={{ width: 20 }}>{ok ? '✅' : '🟡'}</span>
                <Link to={to} style={{ flex: 1, fontWeight: 600 }}>{label}</Link>
                <code style={{ fontSize: 12, color: 'var(--ink-400)' }}>{to}</code>
                <span style={{ fontSize: 12, color: 'var(--ink-400)', width: 150, textAlign: 'right' }}>{node}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
