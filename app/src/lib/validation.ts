/**
 * 입력 검증 한 곳 (글자 수 제한 · 필수 · 안내 문구 · 서버 에러 자리). docs/frontend-hardening.md "입력 검증"
 *
 * 기준: 백엔드 ERD(docs/backend/erd-2026-11-16.md)의 칼럼 길이 + Figma 02 명세 문구.
 * 둘이 다르거나 한쪽에만 있으면 문서의 "명세 · ERD 대조표"에 적고, 여기에는 **더 짧은 쪽**을 씀 (서버가 거절하지 않게).
 *
 * 글자 수 세는 법: 자바스크립트 문자열 길이(UTF-16 단위) = input maxLength 와 같고 Java String.length()(Spring @Size)와도 같음.
 * 한글은 한 글자 = 1, 이모지는 보통 2. MySQL utf8mb4 VARCHAR(n) 은 코드 포인트로 세서 이모지가 1 → 프론트가 더 엄격하므로 DB 에서 넘칠 일은 없음.
 * 이 규칙은 백엔드와 맞출 것 (@Size 를 쓰면 그대로 맞음).
 */

export interface TextRule {
  /** 화면에 쓰는 이름 (안내 문구에 들어감) */
  label: string
  max: number
  min?: number
  required?: boolean
  /** 근거 (문서 대조표와 같게) */
  db: string
  spec: string
}

/** 입력 칸별 규칙 */
export const RULES = {
  /* 계정 · 프로필 (F3 · F4) */
  nickname: { label: '닉네임', max: 12, required: true, db: 'member_profile.nickname VARCHAR(12)', spec: 'F3 온보딩 1 · F4 내 정보 수정: 필수, 최대 12자, "n / 12", 12자를 넘으면 입력을 막음' },
  intro: { label: '자기소개', max: 150, db: 'member_profile.intro VARCHAR(150) NULL', spec: 'F4: 최대 150자, 선택. 온보딩에서는 받지 않음' },
  answer: { label: '답변', min: 10, max: 50, required: true, db: 'member_answer.answer VARCHAR(50)', spec: 'F3 온보딩 3: 질문 3개 필수, 답변 10~50자, "n / 50", 50자를 넘으면 막음' },
  /* 땅굴 (F5) */
  guestbook: { label: '방명록', max: 50, required: true, db: 'guestbook_entry.content VARCHAR(50)', spec: 'F5 방문자 뷰: 50자 안에서 쓰고 "남기기" (옛 프레임은 100자)' },
  chatRequest: { label: '첫 인사', max: 50, required: true, db: 'chat_request.message VARCHAR(50) NULL', spec: 'F5 대화 요청: 짧은 인사를 50자 안에서' },
  /* 채팅 (F6) */
  chatMessage: { label: '메시지', max: 500, required: true, db: 'chat_message.content TEXT NULL', spec: 'F6: 빈 메시지 불가. 길이 제한 없음 → 500자로 정함 (확인받을 것)' },
  meetupNotice: { label: '공지', max: 100, required: true, db: 'chat_room.notice TEXT NULL', spec: 'F6 모임 대화 공지: 길이 없음 → 100자로 정함 (확인받을 것)' },
  /* 모임 (F7) */
  meetupTitle: { label: '모임 이름', max: 30, required: true, db: 'meetup.title VARCHAR (길이 미정)', spec: 'F7 만들기: 필수. 길이 없음 → 30자 (확인받을 것)' },
  meetupIntro: { label: '소개', max: 300, db: 'meetup.description TEXT NULL', spec: 'F7: 선택. 길이 없음 → 300자' },
  meetupSupplies: { label: '준비물', max: 40, db: 'meetup.supplies VARCHAR NULL (길이 미정)', spec: 'F7: 선택. 길이 없음 → 40자' },
  meetupPlace: { label: '장소', max: 60, db: 'meetup.place VARCHAR NULL (길이 미정)', spec: 'F7: 오프라인이면 필수. 길이 없음 → 60자' },
  meetupPlaceDetail: { label: '상세 주소', max: 40, db: 'meetup.place_detail VARCHAR NULL (길이 미정)', spec: 'F7: 선택 → 40자' },
  meetupPlatform: { label: '플랫폼 이름', max: 20, db: 'meetup.platform VARCHAR NULL (길이 미정)', spec: 'F7: 온라인 "기타"면 필수 → 20자' },
  meetupApplyMessage: { label: '주최자에게 남길 말', max: 100, db: 'meetup_application.message VARCHAR NULL (길이 미정)', spec: 'F7 상세 5: 선택, 100자 이내, "0/100"' },
  /* 커뮤니티 · 신고 (F8 · 공통) */
  postTitle: { label: '제목', max: 50, required: true, db: 'post.title VARCHAR(50)', spec: 'F8 글쓰기 2: 필수, 최대 50자' },
  postBody: { label: '본문', max: 1000, required: true, db: 'post.content VARCHAR(1000)', spec: 'F8 글쓰기 3: 필수, 최대 1000자' },
  comment: { label: '댓글', max: 300, required: true, db: 'comment.content VARCHAR(300)', spec: 'F8 상세 10: 댓글·답글 최대 300자, 빈 입력 불가' },
  reportDetail: { label: '신고 사유', max: 100, required: true, db: 'report.detail VARCHAR(100) NULL', spec: '신고 팝업: "기타"면 입력 필수·최대 100자' },
  /* 관리자 (F11) */
  noticeTitle: { label: '공지 제목', max: 60, required: true, db: 'notice.title VARCHAR (길이 미정)', spec: 'F11: 길이 없음 → 60자' },
} as const satisfies Record<string, TextRule>

export type RuleName = keyof typeof RULES

/* ---------- 예전 이름 (화면·데이터 파일이 쓰던 상수) ---------- */
export const NICKNAME_MAX = RULES.nickname.max
export const INTRO_MAX = RULES.intro.max
export const ANSWER_MIN = RULES.answer.min
export const ANSWER_MAX = RULES.answer.max
export const GUESTBOOK_MAX = RULES.guestbook.max
export const CHAT_REQUEST_MAX = RULES.chatRequest.max
export const CHAT_MESSAGE_MAX = RULES.chatMessage.max
export const MEETUP_NOTICE_MAX = RULES.meetupNotice.max
export const MEETUP_APPLY_MESSAGE_MAX = RULES.meetupApplyMessage.max
export const POST_TITLE_MAX = RULES.postTitle.max
export const POST_BODY_MAX = RULES.postBody.max
export const COMMENT_MAX = RULES.comment.max
export const REPORT_DETAIL_MAX = RULES.reportDetail.max

/* ---------- 검사 ---------- */
/** 글자 수 (input maxLength 와 같은 방식) */
export const lengthOf = (v: string) => v.length

/** 안내 문구 (02 명세 문구가 있으면 그대로, 없으면 같은 말투로 정함) */
export const MSG = {
  required: (label: string) => `${label}${josa(label, '을', '를')} 입력해 주세요`,
  tooLong: (label: string, max: number) => `${label}${josa(label, '은', '는')} ${max}자까지 쓸 수 있어요`,
  /** 명세 F3 "10자 이상 적어 주세요" */
  tooShort: (min: number) => `${min}자 이상 적어 주세요`,
  /** 공백만 */
  blank: '빈칸만으로는 보낼 수 없어요',
  /** 서버가 이유 없이 거절 */
  server: '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요',
} as const

export type CheckResult = { ok: true } | { ok: false; reason: 'required' | 'blank' | 'short' | 'long'; message: string }

/** 규칙대로 검사 (앞뒤 공백은 빼고 셈) */
export function checkText(rule: TextRule | RuleName, value: string): CheckResult {
  const r: TextRule = typeof rule === 'string' ? RULES[rule] : rule
  const t = value.trim()
  if (!value) return r.required ? { ok: false, reason: 'required', message: MSG.required(r.label) } : { ok: true }
  if (!t) return r.required ? { ok: false, reason: 'blank', message: MSG.blank } : { ok: true }
  if (r.min != null && lengthOf(t) < r.min) return { ok: false, reason: 'short', message: MSG.tooShort(r.min) }
  if (lengthOf(value) > r.max) return { ok: false, reason: 'long', message: MSG.tooLong(r.label, r.max) }
  return { ok: true }
}

/** 붙여 넣기 등으로 넘친 값을 자름 (maxLength 가 없는 칸·프로그램으로 넣는 값) */
export const clampText = (value: string, max: number) => (value.length > max ? value.slice(0, max) : value)

/** "n / max" 글자 수 표시 + 다 찼는지 */
export function counter(value: string, max: number) {
  const n = lengthOf(value)
  return { text: `${n} / ${max}`, full: n >= max, n }
}

/* ---------- 서버 에러 자리 ---------- */
/**
 * 서버 에러 형식 (docs/dev-deploy-risks.md 5장 API 규약 초안 + 칸별 오류):
 *   { code: 'VALIDATION_FAILED', message: '…', status: 400, traceId, fieldErrors: [{ field: 'nickname', message: '이미 쓰고 있는 닉네임이에요' }] }
 * API 계층(src/api)이 이 모양의 값을 던지면 화면은 fieldError(err, '칸 이름') 으로 그 칸 밑에 보여 줌
 */
export interface ApiFieldError { field: string; message: string; code?: string }
export interface ApiErrorBody { code?: string; message?: string; status?: number; traceId?: string; fieldErrors?: ApiFieldError[] }

const bodyOf = (err: unknown): ApiErrorBody | null => {
  if (!err || typeof err !== 'object') return null
  const e = err as { body?: ApiErrorBody; data?: ApiErrorBody } & ApiErrorBody
  return e.body ?? e.data ?? e
}

/** 이 칸의 서버 오류 문구 (없으면 null) */
export function fieldError(err: unknown, field: string): string | null {
  return bodyOf(err)?.fieldErrors?.find((f) => f.field === field)?.message ?? null
}

/** 칸에 붙지 않은 오류 문구 (폼 위·토스트에) */
export function formError(err: unknown): string | null {
  if (!err) return null
  const b = bodyOf(err)
  if (b?.fieldErrors?.length && !b.message) return null
  return b?.message ?? MSG.server
}

/* ---------- 받침 ---------- */
function josa(word: string, withBatchim: string, without: string) {
  const c = word.charCodeAt(word.length - 1) - 0xac00
  return c >= 0 && c <= 11171 && c % 28 !== 0 ? withBatchim : without
}
