/**
 * 로그인 · 가입 · 설정 화면이 입력하는 동안 쓰는 규칙과 문구 (순수 함수). 서버도 같은 규칙으로 다시 검사한다.
 * - 00 공통 9 비밀번호 규칙 (회원가입 2 · 새 비밀번호 설정 · 설정 비밀번호 변경)
 * - 02 이메일 형식 · 인증 코드 6자리
 * 옛 위치(data/auth.ts · data/account.ts)는 이 파일을 다시 내보낸다 (tests/rules.test.ts)
 */

/* ===== 00 공통 9 비밀번호 규칙 ===== */
/** 8자 이상. 쓸 수 있는 문자는 영문 대소문자, 숫자, 특수기호 !@#$% 뿐. 영문 · 숫자 · 특수기호를 각각 1개 이상 */
export const PW_RULE_TEXT = '8자 이상 · 영문, 숫자, 특수기호(!@#$%) 각 1개 이상'
export const PW_ALLOWED = /^[A-Za-z0-9!@#$%]*$/
/** 칸마다의 충족 여부 (설정의 규칙 목록이 줄마다 표시) */
export function passwordChecks(pw: string) {
  return {
    length: pw.length >= 8,
    letter: /[a-zA-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[!@#$%]/.test(pw),
    allowed: PW_ALLOWED.test(pw),
  }
}
export const passwordOk = (pw: string) => Object.values(passwordChecks(pw)).every(Boolean)
export function checkPassword(pw: string) {
  const c = passwordChecks(pw)
  return { allowed: c.allowed, ok: passwordOk(pw) }
}
/** 규칙에 어긋나는 문자(공백 등)를 넣었을 때 바로 띄우는 문구 (명세에 문구가 없어 정함) */
export const PW_BAD_CHAR = '영문 · 숫자 · 특수기호(!@#$%)만 쓸 수 있어요'
/** 02 회원가입 2 · 4 문구. Figma 03 은 "달라요"였지만 명세가 기준이라 명세 문구로 (2026-11-22) */
export const PW_MISMATCH = '비밀번호가 일치하지 않아요'
/**
 * 비밀번호 확인 칸: "입력하는 동안 두 값이 다르면 바로" 띄움.
 * 아직 덜 친 경우(앞부분이 같음)는 기다리고, 갈라지거나 길이가 같아졌는데 다르면 오류
 */
export const confirmMismatch = (pw: string, pw2: string) => pw2.length > 0 && (pw2.length >= pw.length ? pw2 !== pw : !pw.startsWith(pw2))

/* ===== 이메일 ===== */
export const EMAIL_BAD = '이메일 형식을 확인해 주세요'
/** 이메일에 쓸 수 없는 문자(공백, 허용되지 않는 특수문자) → 치는 즉시 오류 */
export const emailHasBadChar = (v: string) => /[^A-Za-z0-9._%+\-@]/.test(v) || (v.match(/@/g)?.length ?? 0) > 1
/** 형식 검사 (칸을 벗어날 때) */
export const emailValid = (v: string) => /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(v)

/* ===== 인증 코드 (회원가입 1 · 3) ===== */
export const CODE_LEN = 6
/** 재전송 버튼을 다시 켜기까지 (명세 "제안", 서버 간격은 구현 단계에서 정함. 서버가 429 를 주면 그 문구) */
export const RESEND_GAP = 30
export const CODE_NOT_DIGIT = '숫자 6자리를 입력해 주세요'
export const CODE_WRONG = '인증 코드가 맞지 않아요'
export const CODE_EXPIRED = '인증 시간이 지났어요. 코드를 다시 받아 주세요'
