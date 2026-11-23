/**
 * 이메일 가입 단계 사이에 넘기는 화면 상태 (02 "가입 진행"): 인증한 이메일(보여 주기용)과 회원가입 2 의 비밀번호.
 * 비밀번호는 서버의 가입 진행 기록에 두지 않고, 프론트가 들고 있다가 회원가입 3 "땅굴 파기"의 POST /users 에 담는다.
 * 메모리에만 둔다 (새로 고침하면 사라짐 → 명세대로 회원가입 1 부터 다시)
 */
export const signupDraft: { email: string; password: string } = { email: '', password: '' }
export function clearSignupDraft() { signupDraft.email = ''; signupDraft.password = '' }
