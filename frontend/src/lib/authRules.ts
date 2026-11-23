/**
 * 로그인 · 가입 · 설정 화면이 입력하는 동안 쓰는 규칙과 문구 (순수 함수). 서버도 같은 규칙으로 다시 검사한다.
 * - 00 공통 9 비밀번호 규칙 (회원가입 2 · 새 비밀번호 설정 · 설정 비밀번호 변경)
 * - 02 이메일 형식 · 인증 코드 6자리
 * 옛 위치(data/auth.ts · data/account.ts)는 이 파일을 다시 내보낸다 (tests/rules.test.ts)
 */

/* ===== 00 공통 9 비밀번호 규칙 ===== */
/** 8자 이상 20자 이하(명세 dev 9ea6698). 쓸 수 있는 문자는 영문 대소문자, 숫자, 특수기호 !@#$% 뿐. 영문 · 숫자 · 특수기호를 각각 1개 이상 */
export const PW_MIN = 8
export const PW_MAX = 20
export const PW_RULE_TEXT = `${PW_MIN}~${PW_MAX}자 · 영문, 숫자, 특수기호(!@#$%) 각 1개 이상`
export const PW_ALLOWED = /^[A-Za-z0-9!@#$%]*$/
/** 칸마다의 충족 여부 (설정의 규칙 목록이 줄마다 표시) */
export function passwordChecks(pw: string) {
  return {
    length: pw.length >= PW_MIN && pw.length <= PW_MAX,
    letter: /[a-zA-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[!@#$%]/.test(pw),
    allowed: PW_ALLOWED.test(pw),
  }
}
export const passwordOk = (pw: string) => Object.values(passwordChecks(pw)).every(Boolean)
/**
 * 서버(목)의 입력 오류: 어긋난 규칙마다 한 줄씩 (API 02 POST /users 1 "fields 에 어긋난 규칙마다 한 줄씩")
 */
export function passwordFieldErrors(field: string, pw: string): { field: string; message: string }[] {
  const c = passwordChecks(pw)
  const out: string[] = []
  if (!c.length) out.push(`비밀번호는 ${PW_MIN}자 이상 ${PW_MAX}자 이하여야 합니다.`)
  if (!c.allowed) out.push('비밀번호에는 영문 · 숫자 · 특수기호 !@#$% 만 쓸 수 있습니다.')
  if (!c.letter) out.push('비밀번호에 영문을 1개 이상 넣어야 합니다.')
  if (!c.digit) out.push('비밀번호에 숫자를 1개 이상 넣어야 합니다.')
  if (!c.special) out.push('비밀번호에 특수기호를 1개 이상 넣어야 합니다.')
  return out.map((message) => ({ field, message }))
}
export function checkPassword(pw: string) {
  const c = passwordChecks(pw)
  return { allowed: c.allowed, ok: passwordOk(pw) }
}
/** 규칙에 어긋나는 문자(공백 등)를 넣었을 때 바로 띄우는 문구 (명세에 문구가 없어 정함) */
export const PW_BAD_CHAR = '영문 · 숫자 · 특수기호(!@#$%)만 쓸 수 있어요'
/** 20자를 넘겼을 때 바로 띄우는 문구 (명세에 문구가 없어 정함) */
export const PW_TOO_LONG = `${PW_MAX}자 이하로 정해 주세요`
/** 02 회원가입 2 · 4, 새 비밀번호 설정 2 문구 (명세 dev 9ea6698 에서 "달라요"로 돌아옴) */
export const PW_MISMATCH = '비밀번호가 달라요'
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

/* ===== Mattermost ID (회원가입 3 · 4, API 02 POST /ssafy-verifications) ===== */
/**
 * 서버와 같은 정규화: 앞뒤 공백과 앞의 @ 를 떼고 소문자로. 이 값을 보낸다 (서버도 같은 일을 다시 함)
 */
export const normalizeMattermostId = (v: string) => v.trim().replace(/^@+/, '').toLowerCase()
export const MM_ID_MIN = 3
export const MM_ID_MAX = 22
/** 정규화한 값이 영문 소문자 · 숫자 · . - _ 3 ~ 22자 (Mattermost 아이디 규칙) */
export const MM_ID_RE = /^[a-z0-9._-]{3,22}$/
export const MM_ID_BAD = '영문 · 숫자 · . - _ 로 3~22자를 입력해 주세요'
/**
 * 입력하는 동안의 판단. ok 면 "코드 받기"를 켬. bad 면 바로 칸 밑에 MM_ID_BAD (쓸 수 없는 문자 · 22자 넘음).
 * 3자보다 짧은 동안은 오류를 띄우지 않고 버튼만 꺼 둠
 */
export function checkMattermostId(raw: string) {
  const value = normalizeMattermostId(raw)
  const ok = MM_ID_RE.test(value)
  const bad = value.length > 0 && !ok && (/[^a-z0-9._-]/.test(value) || value.length > MM_ID_MAX)
  return { value, ok, bad }
}

/* ===== 인증 코드 (회원가입 1 · 3) ===== */
export const CODE_LEN = 6
/** 재전송 버튼을 다시 켜기까지 = 서버 재전송 간격 60초 (API 02 "인증 코드"). 서버가 429 를 주면 그 문구 */
export const RESEND_GAP = 60
export const CODE_NOT_DIGIT = '숫자 6자리를 입력해 주세요'
export const CODE_WRONG = '인증 코드가 맞지 않아요'
export const CODE_EXPIRED = '인증 시간이 지났어요. 코드를 다시 받아 주세요'
/** 서버가 VERIFICATION_CODE_EXPIRED 인데 남은 시간이 있으면 = 5번 틀려서 서버가 코드를 지움 (API 02 "인증 코드") */
export const CODE_LOCKED = '코드를 여러 번 틀렸어요. 코드를 다시 받아 주세요'
/** 서버가 틀린 횟수를 세는 한도 (이 횟수만큼 틀리면 코드를 지움) */
export const CODE_MAX_FAILS = 5
