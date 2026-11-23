import { Link } from '@/lib/nav'
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
    ['1 이름 · 두더지 꾸미기', '/onboarding/name?demo', '408:18310', true],
    ['2 관심사 선택 (A · 좌측 분류 전환)', '/onboarding/interests?demo', '551:7406', true],
    ['3 자기소개', '/onboarding/intro?demo', '408:18828', true],
    ['3a 방 만드는 중', '/onboarding/building?demo', '408:19036', true],
    ['4 땅굴 미리보기 (메인 화면 기준)', '/onboarding/preview?demo', '681:7764', true],
  ] },
  { title: '땅굴', items: [
    ['내 땅굴 (스크린샷 대조 완료)', '/burrow', '454:6900', true],
    ['내 땅굴 – 사이드바 접힘', '/burrow?panel=closed', '454:7053', true],
    ['내 땅굴 – 방명록 0개', '/burrow?modal=guestbook&api=empty', '506:7960', true],
    ['내 땅굴 – 방명록 전체보기 모달', '/burrow?modal=guestbook', '454:7748', true],
    ['탐색하기 (돌아다니기)', '/burrow/explore', '477:12524 · 493:12616'],
    ['탐색 시안 A · 들판 점프 (3D, 지금 디자인) + 미니맵', '/burrow/explore?design=a', '2026-11-16 시안'],
    ['탐색 시안 A · 미니맵 크게 보기 (전체 마을 지도)', '/burrow/explore?design=a&map=big', '2026-11-16 시안'],
    ['탐색 시안 B · 마을 지도 (2D 탑뷰, 길 따라 걷기)', '/burrow/explore?design=b', '2026-11-16 시안'],
    ['탐색 시안 C · 땅속 굴길 (단면도)', '/burrow/explore?design=c', '2026-11-16 시안'],
    ['탐색 시안 D · 이웃 카드 넘기기', '/burrow/explore?design=d', '2026-11-16 시안'],
    ['탐색 시안 · 빈 들판 (지난 학기 부울경-1층)', `/burrow/explore?floor=${encodeURIComponent('2026 상반기|부울경|1')}`, '02 F5 1'],
    ['탐색 – 단골 땅굴 목록', '/burrow/explore?modal=regulars', '05 단골 땅굴 목록'],
    ['탐색 – 오늘의 추천 친구 (받기 전 · 오늘 받은 추천 지움)', '/burrow/explore?modal=recommend&recommend=reset', '05 추천 받기 전'],
    ['탐색 – 캠퍼스-층 고르기 (학기 · 비어 있음)', '/burrow/explore?modal=floor', '05 캠퍼스-층 고르기'],
    ['새 학기 안내 (목 서버 시연: 지난 학기 들판에 남은 계정)', '/burrow/explore?newterm=demo', '05 새 학기 안내'],
    ['방문자 뷰 (예린이의 땅굴)', '/burrow/yerin', '510:13663'],
    ['방문자 뷰 – 대화 요청 팝업', '/burrow/yerin?modal=request', '495:13898'],
    ['방문자 뷰 – 우체통(방명록 쓰기 · 목록)', '/burrow/yerin?modal=guestbook', '510:13663', true],
    ['방문자 뷰 – 대화 요청 완료 토스트', '/burrow/yerin?toast=request', '612:7718', true],
    ['꾸미기 모드 · 사이드바 변신', '/burrow?mode=decor', '682:7764', true],
    ['내 정보 수정 · 사이드바 교체', '/burrow?mode=edit', '683:8058', true],
    ['🧪 땅굴 다양성 실험실 (칠하기·무늬·모양·자동)', '/lab/style', '실험', true],
    ['🧪 땅굴 비교 실험실 (아무 관심사로 방문자 뷰 방)', `/lab/rooms?interests=${encodeURIComponent('사주/타로,곤충/파충류/기타,LP/음반')}&name=${encodeURIComponent('니치형')}`, '실험', true],
  ] },
  { title: '게시판', items: [
    ['게시판 목록 (02 F8)', '/board', 'F8-01', true],
    ['글 상세 · 확정 시안 B', '/board/p1', 'F8-04', true],
    ['글쓰기', '/board/write', 'F8-05', true],
    ['글 수정 (내 글)', '/board/p6/edit', 'F8-06', true],
    ['저장한 글', '/board/saved', 'F8-02', true],
    ['내가 쓴 글 (가려진 글 포함)', '/board/mine', 'F8-09', true],
    ['댓글 단 글', '/board/commented', 'F8-11', true],
    ['삭제된 글 안내', '/board/p28', '00 공통 21', true],
    ['가려진 글 안내', '/board/p27', '00 공통 21', true],
  ] },
  { title: '모임', items: [
    ['모임 리스트', '/meetups', '1071:9749'],
    ['리스트 · 날짜 직접 설정', '/meetups?modal=range', '1074:10147'],
    ['캘린더 팝업', '/meetups?modal=calendar', '1075:12387'],
    ['내 모임', '/meetups/me', '1075:11219'],
    ['내 모임 · 찜한 모임', '/meetups/me?tab=wish', '1075:11830'],
    ['신청 관리 (내가 연 모임)', '/meetups/me?tab=hosting&manage=m3', '740:5113'],
    ['상세 · 미신청', '/meetups/m1?as=open', '740:4453'],
    ['상세 · 신청 대기', '/meetups/m1?as=pending', '740:4555'],
    ['상세 · 미승인', '/meetups/m1?as=rejected', '972:10700'],
    ['상세 · 참여 확정', '/meetups/m1?as=joined', '740:4648'],
    ['상세 · 주최자', '/meetups/m3?as=host', '740:4360'],
    ['상세 · 주최자 확정 0명', '/meetups/m3?as=hostZero', '972:9982'],
    ['상세 · 모집 완료', '/meetups/m1?as=full', '740:4741'],
    ['상세 · 지난 모임', '/meetups/m1?as=past', '740:4834'],
    ['상세 · 취소된 모임', '/meetups/m1?as=cancelled', '740:4927'],
    ['상세 · 참여 신청 완료 토스트', '/meetups/m4?toast=applied', '1087:11346'],
    ['모임 만들기', '/meetups/new', '1073:10314', true],
    ['모임 수정 · 취소', '/meetups/m3/edit', '740:5020'],
    ['삭제된 모임 안내', '/meetups/nope', '00 공통 21'],
  ] },
  { title: '채팅', items: [
    ['대화 선택 전', '/chat', '1016:9039'],
    ['1:1 대화', '/chat/r-yerin', '1014:8920'],
    ['모임 대화 (공지·주최)', '/chat/g-m1', '1017:9267'],
    ['모임 대화 · 모임 정보 팝업', '/chat/g-m1?info=1', '1017:9902'],
    ['모임 대화 (내가 주최, 공지 쓰기)', '/chat/g-m3', '1017:9267'],
    ['끝난 모임 대화 (대화방에서만 나가기)', '/chat/g-p1', '1017:9267', true],
    ['상대가 나간 대화 (읽기 전용)', '/chat/r-seoyeon', '1014:8920 ③'],
    ['상대가 탈퇴한 대화', '/chat/r-gone', '1014:8920 ③'],
    ['요청 · 받은 요청', '/chat/requests', '1018:9513', true],
    ['요청 · 보낸 요청', '/chat/requests?dir=sent', '1018:10007'],
  ] },
  { title: '알림 · 설정 (02 F9 · F10 명세 2026-11-16)', items: [
    ['알림 팝업 (요청 고정 + 최근 알림 5개)', '/burrow?notice=open', 'F9 알림 – 팝업', true],
    ['알림 팝업 · 요청 없음 (채팅 요청을 처리해 0건 만들기)', '/chat/requests', 'F9 팝업 · 요청 없음'],
    ['알림 (탭 6개 · 20개씩 더 보기)', '/notifications', 'F9 알림', true],
    ['알림 – 빈 상태', '/notifications?empty=1', 'F9 알림 6', true],
    ['설정 – 비밀번호 변경', '/settings/password', 'F10', true],
    ['설정 – Google 연동하기 (연동 전 · 연동됨)', '/settings/google', 'F10', true],
    ['설정 – Google로만 가입한 계정으로 보기', '/settings?account=google', 'F10'],
    ['설정 – 이메일 계정으로 되돌리기', '/settings?account=email', 'F10'],
    ['설정 – 알림 설정', '/settings/notifications', 'F10', true],
    ['설정 – 공지사항 · 상세', '/settings/notices', 'F10', true],
    ['설정 – 회원 탈퇴 (내가 연 모임 있음)', '/settings/leave', 'F10', true],
    ['설정 – 회원 탈퇴 (모임 없음 → 탈퇴 확인)', '/settings/leave?hosting=0', 'F10', true],
    ['설정 – 로그아웃 확인', '/settings/password?modal=logout', 'F10', true],
  ] },
  { title: '운영 · 공통 (02 F11 · 00 공통)', items: [
    ['관리자 – 기능 목록 (역할 켜기)', '/admin?as=admin', 'F11 저충실도', true],
    ['관리자 – 역할 없는 계정 (없는 주소처럼)', '/admin?as=user', 'F11'],
    ['대상 없음 – 삭제된 모임 (알림에서)', '/gone/meetup', '00 공통 21'],
    ['대상 없음 – 없는 주소', '/no-such-page', '00 공통 21'],
  ] },
]

export default function ScreenIndex() {
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 20px 80px' }}>
      <img src={logo} alt="디굴디굴" width={92} height={48} />
      <h1 className="display" style={{ fontSize: 30, marginTop: 12 }}>화면 목록</h1>
      <p style={{ color: 'var(--ink-500)', marginTop: 6 }}>Figma &quot;03. Screens&quot; 기준. ✅ 는 스크린샷과 대조한 화면, 나머지는 메타데이터 기반이라 스크린샷 대조가 필요해요.</p>
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
