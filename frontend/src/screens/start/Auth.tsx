import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from '@/lib/nav'
import roomCutout from '../../assets/room-cutout.png'
import Modal from '../../components/Modal'
import { Toast } from '../../components/Feedback'
import { ErrorState } from '../../components/AsyncState'
import { isApiError } from '../../api/client'
import { errorText, fieldErrorText, toDtoId, useCampuses, useGenerations } from '../../api/common'
import {
  AUTH_ERRORS, AUTH_FIELD_OF, AUTH_IS_MOCK, authApi, goGoogle, MOCK_GOOGLE, mockGoogleCallback, mockMailbox, pathAfterLogin, secondsLeft,
  suspendedFromQuery, toMe, toSuspension, useCheckEmailCode, useCompletePasswordReset, useLogin, usePasswordResetLink, useRequestPasswordReset,
  useSendEmailCode, useSendSsafyCode, useSessionReset, useSignup, type GooglePurpose, type SuspendedDetail, type SuspensionVM,
} from '../../api/auth'
import { useAccount } from '../../api/settings'
import { LOGIN_FREE } from '../../data/auth'
import {
  CODE_EXPIRED, CODE_LEN, CODE_LOCKED, CODE_NOT_DIGIT, CODE_WRONG, EMAIL_BAD, MM_ID_BAD, PW_BAD_CHAR, PW_MAX, PW_MISMATCH, PW_RULE_TEXT, PW_TOO_LONG, RESEND_GAP,
  checkMattermostId, checkPassword, confirmMismatch, emailHasBadChar, emailValid,
} from '../../lib/authRules'
import { takeReturnTo } from '../../lib/authFlow'
import { toIso } from '../../lib/time'
import chevronDown from '../../assets/auth/chevron-down.svg'
import iconClock from '../../assets/auth/clock.svg'
import iconMail from '../../assets/auth/mail.svg'
import StartHeader, { LogoMole } from './StartHeader'
import { clearSignupDraft, signupDraft } from './signupDraft'
import s from './Start.module.css'

/*
 * F2 로그인 · 회원가입 · 비밀번호 찾기 (02 명세, API v1 02-auth.md, 디자인은 03 시작 v2 PNG).
 * 공통 (00 공통 11): 로고(누르면 랜딩) · 흐린 땅굴 배경 · 카드 위로 빼꼼 나온 두더지
 * 수치는 Figma 03 시작 v2 그대로 (패널 400 · 안쪽 36/32/28 · 칸 사이 20 · 제목 24 · 라벨 13 · 입력 15), CSS 는 Start.module.css 의 .authPanel 묶음
 * 모든 읽기 · 쓰기는 api/auth (목 서버 시연 계정은 data/auth.ts 맨 위 주석). 실패는 code 로만 나눈다
 */

const codeOf = (e: unknown) => (isApiError(e) ? e.code : '')
/**
 * 인증 코드 칸의 서버 오류 문구. 남은 시간이 있는데 EXPIRED 면 5번 틀려서 서버가 코드를 지운 것 (API 02 "인증 코드")
 */
const codeErrText = (c: string, left: number | null) =>
  c === 'VERIFICATION_CODE_MISMATCH' ? CODE_WRONG : (left ?? 0) > 0 ? CODE_LOCKED : CODE_EXPIRED

/** 흐린 땅굴 방 배경 (Figma: Scene 1520×980 블러 + Dim) */
function BlurRoom() {
  return (
    <div className={s.blurBg} aria-hidden>
      <img src={roomCutout} alt="" className={s.blurRoom} />
    </div>
  )
}

/** 진행 표시: 막대 + "1/3" (이메일 가입 3단계) */
function Steps({ n, total = 3 }: { n: number; total?: number }) {
  return (
    <p className={s.step} aria-label={`${total}단계 중 ${n}단계`}>
      {Array.from({ length: total }, (_, i) => <i key={i} className={i + 1 === n ? s.stepLong : i + 1 < n ? s.stepDone : s.stepShort} />)}
      {n}/{total}
    </p>
  )
}

export function AuthFrame({ children, step, after, wide }: { children: ReactNode; step?: number; after?: ReactNode; wide?: boolean }) {
  return (
    <div className={s.page}>
      <BlurRoom />
      <StartHeader tone="light" right={null} />
      <main className={s.authCenter}>
        <div className={`${s.panelWrap} ${wide ? s.panelWide : ''}`}>
          <LogoMole />
          <section className={s.authPanel}>
            {step && <Steps n={step} />}
            {children}
          </section>
          {after && <div className={s.afterSlot}>{after}</div>}
        </div>
      </main>
    </div>
  )
}

/** 남은 시간 (초). start(초) 또는 until(서버가 준 만료 시각) 으로 다시 시작 */
function useCountdown() {
  const [end, setEnd] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (end == null) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [end])
  const left = end == null ? null : Math.max(0, Math.ceil((end - now) / 1000))
  return {
    left,
    start: (sec: number) => { setNow(Date.now()); setEnd(Date.now() + sec * 1000) },
    /** 코드 만료 시각(UTC "…Z")까지 */
    until: (expiresAt: string) => { setNow(Date.now()); setEnd(Date.now() + secondsLeft(expiresAt) * 1000) },
  }
}
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

/** 이메일 칸: 쓸 수 없는 문자는 치는 즉시, 형식은 칸을 벗어날 때 "이메일 형식을 확인해 주세요" */
function useEmailField(initial = '') {
  const [value, setValue] = useState(initial)
  const [blurred, setBlurred] = useState(false)
  const bad = emailHasBadChar(value) || (blurred && value.length > 0 && !emailValid(value))
  return {
    value, bad, valid: emailValid(value),
    props: {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setValue(e.target.value); setBlurred(false) },
      onBlur: () => setBlurred(true),
    },
    /** 제출할 때 형식 오류도 보이게 */
    touch: () => setBlurred(true),
    set: setValue,
  }
}

/** 인증 코드 칸 상태: 숫자가 아니면 바로 오류. 서버가 틀렸다 · 만료됐다고 하면 serverErr */
function useCodeField() {
  const [code, setCode] = useState('')
  const [serverErr, setServerErr] = useState<string | null>(null)
  const notDigit = /\D/.test(code)
  return {
    code, notDigit, serverErr, complete: code.length === CODE_LEN && !notDigit,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setCode(e.target.value.slice(0, CODE_LEN)); setServerErr(null) },
    setServerErr, reset: () => { setCode(''); setServerErr(null) },
  }
}

function Spinner() { return <span className={s.spinner} aria-hidden /> }

/** 정지된 계정 팝업 (02 로그인 4: 사유와 기간) */
function SuspendedDialog({ v, onClose }: { v: SuspensionVM | null; onClose: () => void }) {
  return (
    <Modal open={!!v} onClose={onClose} width={400} labelledBy="sus-title">
      {v && (
        <div className={s.dialog}>
          <h2 id="sus-title" className={s.dialogTitle}>{v.days ? `신고로 인해 ${v.days}일 동안 로그인할 수 없어요` : '정지된 계정이라 로그인할 수 없어요'}</h2>
          <dl className={s.dialogInfo}>
            <div><dt>정지 사유</dt><dd>{v.reason}</dd></div>
            {v.until && <div><dt>정지 기간</dt><dd>{v.until}까지 ({v.days}일)</dd></div>}
          </dl>
          <button className={s.primary} onClick={onClose}>확인</button>
        </div>
      )}
    </Modal>
  )
}

/* ================================================================ */

/**
 * 시작 v2 – 로그인 (02 F2 · 로그인, POST /sessions)
 * 1 "다시 오셨군요!" · 2 이메일 형식 검사(칸을 벗어날 때) · 3 가려서 표시, Enter 로 제출
 * 4 두 칸이 차면 활성, 요청 중 로딩, LOGIN_FAILED "이메일 또는 비밀번호가 맞지 않아요", ACCOUNT_SUSPENDED 는 사유·기간 팝업
 * 5 Google 로 계속하기(GET /oauth/google 로 이동, 돌아오면 ?error= 또는 /auth/google) · 6 비밀번호 찾기 · 7 회원가입(입력한 이메일을 넘김)
 * 성공 → nextStep (ONBOARDING 온보딩 1, 그 밖 내 땅굴 · 가려던 주소)
 */
export function Login() {
  const nav = useNavigate()
  const login = useLogin()
  const loc = useLocation() as { state?: { email?: string; toast?: string; from?: string } }
  const resetSession = useSessionReset()
  const email = useEmailField(loc.state?.email ?? '')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState<'pw' | 'google' | null>(null)
  const [failed, setFailed] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [suspended, setSuspended] = useState<SuspensionVM | null>(null)
  const [toast, setToast] = useState(loc.state?.toast ?? null)
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    // 시연: ?demo=error · ?demo=suspended
    const d = params.get('demo')
    if (d === 'error') { email.set('wrong@ssafy.com'); setPw('12345678'); setFailed(true) }
    if (d === 'suspended') setSuspended(toSuspension({ reason: '신고 누적', endsAt: toIso(Date.now() + 7 * 86_400_000) }))
    // Google 로그인이 돌아온 주소 (02 콜백: 로그인하지 못함 → error=<code>)
    const err = params.get('error')
    if (err) {
      if (err === 'ACCOUNT_SUSPENDED') {
        const q = suspendedFromQuery(params)
        setSuspended(toSuspension({ reason: q.reason ?? undefined, endsAt: q.endsAt ?? undefined }))
      } else setFormErr(AUTH_ERRORS[err] ?? AUTH_ERRORS.GOOGLE_LOGIN_CANCELED)
      for (const k of ['error', 'reason', 'endsAt']) params.delete(k)
      setParams(params, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!LOGIN_FREE) {
      if (!email.value || !pw) return
      if (!email.valid) { email.touch(); return }
    }
    setFailed(false); setFormErr(null); setBusy('pw')
    try {
      const r = await login.mutateAsync({ email: email.value.trim(), password: pw })
      void resetSession()
      // 로그인이 필요해서 왔으면(RequireLogin · 401, lib/authFlow.ts) 가려던 주소로. 온보딩을 마저 해야 하면 그쪽이 먼저
      nav(pathAfterLogin(r.nextStep, takeReturnTo(loc.state?.from)), { replace: true })
    } catch (err) {
      setBusy(null)
      const code = codeOf(err)
      if (code === 'LOGIN_FAILED') setFailed(true)
      else if (code === 'ACCOUNT_SUSPENDED' && isApiError(err)) setSuspended(toSuspension(err.detail as Partial<SuspendedDetail> | null))
      else setFormErr(errorText(err, AUTH_ERRORS))
    }
  }
  const google = () => {
    if (busy) return
    setFailed(false); setFormErr(null); setBusy('google')
    goGoogle(authApi.googleLoginUrl(), (to) => nav(to))
  }

  return (
    <AuthFrame>
      <h1 className={s.panelTitle}>다시 오셨군요!</h1>
      <form className={s.form} noValidate onSubmit={submit}>
        <div className={s.fields}>
          <div className={s.field}>
            <label htmlFor="li-email">이메일</label>
            <input id="li-email" className={`${s.input} ${email.bad || failed ? s.inputBad : ''}`} type="email" {...email.props}
              onChange={(e) => { email.props.onChange(e); setFailed(false) }}
              placeholder="yejin@ssafy.com" autoComplete="email" aria-invalid={email.bad} aria-describedby="li-email-err" />
            {email.bad && <span id="li-email-err" className={s.err}>{EMAIL_BAD}</span>}
          </div>
          <div className={s.field}>
            <label htmlFor="li-pw">비밀번호</label>
            <input id="li-pw" className={`${s.input} ${failed ? s.inputBad : ''}`} type="password" value={pw}
              onChange={(e) => { setPw(e.target.value); setFailed(false) }} placeholder="••••••••" autoComplete="current-password" />
            {failed && <span className={s.err} role="alert">{AUTH_ERRORS.LOGIN_FAILED}</span>}
          </div>
        </div>
        {formErr && <p className={s.formErr} role="alert">{formErr}</p>}
        <button className={`${s.primary} ${s.aBtn}`} disabled={(!LOGIN_FREE && (!email.value || !pw)) || !!busy} aria-busy={busy === 'pw'}>
          {busy === 'pw' ? <><Spinner />로그인 중</> : '로그인'}
        </button>
      </form>
      <p className={s.orText}>또는</p>
      <button className={`${s.secondary} ${s.gBtn}`} onClick={google} disabled={!!busy} aria-busy={busy === 'google'}>
        {busy === 'google' ? <><Spinner />Google로 이동 중</> : 'Google로 계속하기'}
      </button>
      <div className={s.links}>
        <Link to="/password-reset" state={{ email: email.value }}>비밀번호 찾기</Link>
        <span className={s.linkPair}>처음이에요 <Link to="/signup" state={{ email: email.value }} className={s.accentLink}>회원가입</Link></span>
      </div>

      <SuspendedDialog v={suspended} onClose={() => setSuspended(null)} />
      <Toast open={!!toast} onClose={() => setToast(null)} title={toast ?? ''} />
    </AuthFrame>
  )
}

/**
 * Google 로그인을 마친 뒤 (02 콜백 "로그인됨" → 프론트의 정해진 주소 /auth/google):
 * GET /me 를 불러 nextStep 으로 이동. 로그인이 안 돼 있으면 로그인 화면
 */
export function GoogleReturn() {
  const nav = useNavigate()
  const resetSession = useSessionReset()
  useEffect(() => {
    let alive = true
    void resetSession()
    authApi.me()
      .then((d) => { if (alive) nav(pathAfterLogin(toMe(d).nextStep, takeReturnTo()), { replace: true }) })
      .catch(() => { if (alive) nav('/login', { replace: true }) })
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthFrame>
      <h1 className={s.panelTitle}>로그인하는 중</h1>
      <p className={s.panelLead} role="status"><Spinner /> 잠시만 기다려 주세요.</p>
    </AuthFrame>
  )
}

/**
 * 목 서버 전용: Google 계정 고르기 흉내 (실제 서버에서는 Google 의 화면).
 * 고르면 목 서버의 "콜백"(api/auth mockGoogleCallback)이 정한 프론트 주소로 간다. purpose: LOGIN · LINK · WITHDRAW
 */
export function MockGoogle() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const raw = (params.get('purpose') ?? 'LOGIN').toUpperCase()
  const purpose: GooglePurpose = raw === 'LINK' || raw === 'WITHDRAW' ? raw : 'LOGIN'
  const account = useAccount()
  if (!AUTH_IS_MOCK) return <Navigate to="/login" replace />
  const mine = account.data?.googleEmail ?? MOCK_GOOGLE.member
  const choices: [string, string][] = purpose === 'LOGIN'
    ? [[MOCK_GOOGLE.member, '가입한 계정 → 로그인'], [MOCK_GOOGLE.fresh, '처음 쓰는 계정 → 회원가입 3 (SSAFY 인증)'], [MOCK_GOOGLE.banned, '정지된 계정 → 정지 안내']]
    : purpose === 'LINK'
      ? [[MOCK_GOOGLE.fresh, '연동할 수 있는 계정'], [MOCK_GOOGLE.taken, '다른 계정이 쓰는 계정 → 연동 실패']]
      : [[mine, '가입한 Google 계정 → 인증 완료'], [mine === MOCK_GOOGLE.fresh ? MOCK_GOOGLE.member : MOCK_GOOGLE.fresh, '다른 Google 계정 → 받아들이지 않음']]
  const pick = (email: string | null) => nav(mockGoogleCallback(purpose, email), { replace: true })
  return (
    <AuthFrame>
      <div className={s.head}>
        <h1 className={s.panelTitle}>Google 계정 선택</h1>
        <p className={s.panelLead}>체험용 화면이에요. 실제 서비스에서는 Google 로그인 창이 열려요.</p>
      </div>
      <ul className={s.gList}>
        {choices.map(([email, note]) => (
          <li key={email}>
            <button type="button" onClick={() => pick(email)}>
              <span className={s.gAvatar} aria-hidden>{email[0].toUpperCase()}</span>
              <span>{email}<small>{note}</small></span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={`${s.secondary} ${s.gBtn}`} onClick={() => pick(null)}>취소</button>
    </AuthFrame>
  )
}

/* ================================================================ */

/**
 * 시작 v2 – 회원가입 1 · 이메일 (1/3)
 * 3 쓸 수 없는 문자는 바로 "이메일 형식을 확인해 주세요" · 4 입력란 오른쪽 칩(코드 받기 → 재전송: POST /email-verifications, 60초 간격)
 *   보내지 못하면(503 VERIFICATION_SEND_FAILED) 서버가 코드를 지우고 간격도 세지 않으므로 "코드 받기"로 돌아가 바로 다시 받게 함
 * 5 6자리 숫자 + 남은 시간(서버의 expiresAt), 숫자가 아니면 바로 "숫자 6자리를 입력해 주세요" · 6 스팸함 안내
 * 7 코드를 다 넣으면 다음 → POST /email-verifications/check (가입 진행 시작) → 회원가입 2
 */
export function SignupEmail() {
  const nav = useNavigate()
  const sendCode = useSendEmailCode()
  const checkCode = useCheckEmailCode()
  const loc = useLocation() as { state?: { email?: string } }
  const email = useEmailField(loc.state?.email || signupDraft.email)
  const code = useCodeField()
  const ttl = useCountdown()
  const gap = useCountdown()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState<'send' | 'check' | null>(null)
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  const sent = sentTo != null && sentTo === email.value
  const expired = sent && ttl.left === 0
  const codeRef = useRef<HTMLInputElement>(null)

  const send = async () => {
    if (!email.valid) { email.touch(); return }
    setBusy('send'); setEmailErr(null); setFormErr(null)
    try {
      const r = await sendCode.mutateAsync({ email: email.value })
      setSentTo(email.value); code.reset(); ttl.until(r.expiresAt); gap.start(RESEND_GAP)
      setTimeout(() => codeRef.current?.focus(), 0)
    } catch (e) {
      const c = codeOf(e)
      if (c === 'VERIFICATION_SEND_FAILED') { setSentTo(null); code.reset() }
      if (c === 'EMAIL_DUPLICATED' || c === 'TOO_MANY_REQUESTS' || c === 'VERIFICATION_SEND_FAILED') setEmailErr(errorText(e, AUTH_ERRORS))
      else if (c === 'INVALID_INPUT') setEmailErr(fieldErrorText(e, 'email') ?? EMAIL_BAD)
      else setFormErr(errorText(e, AUTH_ERRORS))
    } finally { setBusy(null) }
  }
  const cooling = sent && (gap.left ?? 0) > 0
  const codeErr = code.notDigit ? CODE_NOT_DIGIT : expired ? CODE_EXPIRED : code.serverErr

  const next = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sent || !code.complete || expired || busy) return
    setBusy('check'); setFormErr(null)
    try {
      await checkCode.mutateAsync({ email: email.value, code: code.code })
      signupDraft.email = email.value
      nav('/signup/password')
    } catch (err) {
      const c = codeOf(err)
      if (AUTH_FIELD_OF[c] === 'code') code.setServerErr(codeErrText(c, ttl.left))
      else if (c === 'INVALID_INPUT') code.setServerErr(fieldErrorText(err, 'code') ?? CODE_NOT_DIGIT)
      else setFormErr(errorText(err, AUTH_ERRORS))
      setBusy(null)
    }
  }

  return (
    <AuthFrame step={1}>
      <div className={s.head}>
        <h1 className={s.panelTitle}>땅굴 주소를 만들어요</h1>
        <p className={s.panelLead}>가입할 이메일을 인증해요.</p>
      </div>
      <form className={s.form} noValidate onSubmit={next}>
        <div className={s.fields}>
          <div className={s.field}>
            <label htmlFor="su-email">이메일</label>
            <div className={s.inputBox}>
              <input id="su-email" className={`${s.input} ${s.inputChip} ${email.bad || emailErr ? s.inputBad : ''}`} type="email" {...email.props}
                onChange={(e) => { email.props.onChange(e); setEmailErr(null) }}
                placeholder="yejin@ssafy.com" autoComplete="email" aria-invalid={email.bad || !!emailErr} />
              <button type="button" className={s.inInputBtn} disabled={!email.valid || cooling || busy === 'send'} onClick={() => void send()}>
                {busy === 'send' ? '보내는 중' : sent ? (cooling ? `재전송 ${gap.left}` : '재전송') : '코드 받기'}
              </button>
            </div>
            {email.bad ? <span className={s.err}>{EMAIL_BAD}</span> : emailErr && <span className={s.err} role="alert">{emailErr}</span>}
          </div>
          <div className={s.field}>
            <label htmlFor="su-code">인증 코드</label>
            <div className={s.inputBox}>
              <input id="su-code" ref={codeRef} className={`${s.input} ${codeErr ? s.inputBad : ''}`} inputMode="numeric" autoComplete="one-time-code"
                value={code.code} onChange={code.onChange} placeholder="6자리 숫자" disabled={!sent} aria-invalid={!!codeErr} />
              {sent && <span className={s.timer}>{mmss(ttl.left ?? 0)}</span>}
            </div>
            {codeErr && <span className={s.err} role="alert">{codeErr}</span>}
            <span className={s.help}>메일함에 코드가 없으면 스팸함도 확인해 주세요.</span>
          </div>
        </div>
        {formErr && <p className={s.formErr} role="alert">{formErr}</p>}
        <button className={`${s.primary} ${s.aBtn}`} disabled={!sent || !code.complete || expired || busy === 'check'} aria-busy={busy === 'check'}>
          {busy === 'check' ? <><Spinner />확인 중</> : '다음'}
        </button>
      </form>
    </AuthFrame>
  )
}

/** 비밀번호 + 확인 칸 (회원가입 2 · 새 비밀번호 설정 공통, 00 공통 9) */
function PasswordPair({ pw, pw2, setPw, setPw2, label = '비밀번호', serverErr }: {
  pw: string; pw2: string; setPw: (v: string) => void; setPw2: (v: string) => void; label?: string; serverErr?: string | null
}) {
  const [caps, setCaps] = useState(false)
  const rule = checkPassword(pw)
  const mismatch = confirmMismatch(pw, pw2)
  const onKey = (e: React.KeyboardEvent) => setCaps(e.getModifierState('CapsLock'))
  return (
    <div className={s.fields}>
      <div className={s.field}>
        <label htmlFor="pw1">{label}</label>
        <input id="pw1" className={`${s.input} ${!rule.allowed || serverErr ? s.inputBad : ''}`} type="password" value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyUp={onKey} placeholder="••••••••••" autoComplete="new-password" aria-invalid={!rule.allowed} aria-describedby="pw1-rule" />
        <span id="pw1-rule" className={`${s.ruleLine} ${rule.ok ? s.ruleLineOk : ''}`}>{rule.ok && <b aria-hidden>✓ </b>}{PW_RULE_TEXT}</span>
        {!rule.allowed && <span className={s.err} role="alert">{PW_BAD_CHAR}</span>}
        {rule.allowed && pw.length > PW_MAX && <span className={s.err} role="alert">{PW_TOO_LONG}</span>}
        {serverErr && <span className={s.err} role="alert">{serverErr}</span>}
        {caps && <span className={s.err}>캡스락이 켜져 있어요</span>}
      </div>
      <div className={s.field}>
        <label htmlFor="pw2">{label} 확인</label>
        <input id="pw2" className={`${s.input} ${mismatch ? s.inputBad : ''}`} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
          onKeyUp={onKey} placeholder="••••••••••" autoComplete="new-password" aria-invalid={mismatch} />
        {mismatch && <span className={s.err} role="alert">{PW_MISMATCH}</span>}
      </div>
    </div>
  )
}

/**
 * 시작 v2 – 회원가입 2 · 비밀번호 (2/3) — API 를 부르지 않는다 (비밀번호는 회원가입 3 의 POST /users 에 담음)
 * 3 점으로 가림, 규칙 충족 여부를 입력하면서 표시, 쓸 수 없는 문자는 바로 오류 · 4 두 값이 다르면 바로 오류
 * 5 조건을 다 채우면 활성 → 회원가입 3. 새로 고침해서 인증한 이메일이 없으면 회원가입 1 부터 (02 "가입 진행")
 */
export function SignupPassword() {
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  if (!signupDraft.email && !LOGIN_FREE) return <Navigate to="/signup" replace />
  const ready = checkPassword(pw).ok && pw === pw2
  return (
    <AuthFrame step={2}>
      <h1 className={s.panelTitle}>비밀번호를 정해요</h1>
      <form className={s.form} noValidate onSubmit={(e) => { e.preventDefault(); if (!ready) return; signupDraft.password = pw; nav('/signup/ssafy') }}>
        <PasswordPair pw={pw} pw2={pw2} setPw={setPw} setPw2={setPw2} />
        <button className={`${s.primary} ${s.aBtn}`} disabled={!ready}>다음</button>
      </form>
    </AuthFrame>
  )
}

/** 목록에서 고르는 칸 (기수 · 캠퍼스 · 층). options: [값, 글] */
function Select({ id, label, value, options, onChange, placeholder, disabled, error }: {
  id: string; label: string; value: string; options: [string, string][]; onChange: (v: string) => void; placeholder: string; disabled?: boolean; error?: string | null
}) {
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label}</label>
      <div className={s.selectBox}>
        <select id={id} className={`${s.input} ${s.select} ${error ? s.inputBad : ''}`} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required aria-invalid={!!error}>
          <option value="" disabled>{placeholder}</option>
          {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <img className={s.selChev} src={chevronDown} alt="" width={16} height={16} />
      </div>
      {error && <span className={s.err} role="alert">{error}</span>}
    </div>
  )
}

/**
 * 시작 v2 – 회원가입 3 · SSAFY 인증 (3/3)
 * 1 진행 표시 (Google 가입이면 이 화면 하나뿐이라 숨김) · 2 "SSAFY 인증을 해요"
 * 3 기수(GET /generations) · 캠퍼스 · 층(GET /campuses) 목록에서 고름 · 4 Mattermost ID + 코드 받기(POST /ssafy-verifications, 다시 누르면 재전송, 60초 간격)
 *   ID 는 서버처럼 정규화(앞뒤 공백 · 앞의 @ 떼고 소문자)해 영문 소문자 · 숫자 · . - _ 3~22자일 때만 보냄. 503 VERIFICATION_SEND_FAILED 면 "코드 받기"로 돌아감
 * 5 6자리 숫자 + 남은 시간 · 6 안내 문구 · 7 약관 동의(필수 2개) · 8 다 마치면 땅굴 파기(POST /users) → 온보딩 1
 * 가입 진행 기록이 없거나 시간이 지나면 409 SIGNUP_EXPIRED → 처음부터 (이메일은 회원가입 1, Google 은 로그인의 "Google로 계속하기")
 */
export function SignupSsafy() {
  const nav = useNavigate()
  const sendCode = useSendSsafyCode()
  const signup = useSignup()
  const [params] = useSearchParams()
  const resetSession = useSessionReset()
  const viaGoogle = params.get('via') === 'google'
  const gens = useGenerations()
  const campuses = useCampuses()
  const [gen, setGen] = useState('')
  const [campusId, setCampusId] = useState('')
  const [floorId, setFloorId] = useState('')
  const [mm, setMm] = useState('')
  const code = useCodeField()
  const ttl = useCountdown()
  const gap = useCountdown()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [busy, setBusy] = useState<'send' | 'submit' | null>(null)
  const [mmErr, setMmErr] = useState<string | null>(null)
  const [floorErr, setFloorErr] = useState<string | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [expiredSignup, setExpiredSignup] = useState(false)
  const mmCheck = checkMattermostId(mm)
  const sent = sentTo != null && sentTo === `${gen}|${mmCheck.value}`
  const expired = sent && ttl.left === 0
  const cooling = sent && (gap.left ?? 0) > 0
  const codeErr = code.notDigit ? CODE_NOT_DIGIT : expired ? CODE_EXPIRED : code.serverErr
  const ready = !!gen && !!campusId && !!floorId && sent && code.complete && !expired && terms && privacy
  const codeRef = useRef<HTMLInputElement>(null)
  const floors = campuses.data?.find((c) => c.id === campusId)?.floors ?? []

  // 이메일 가입인데 비밀번호가 없음 = 새로 고침 · 바로 들어옴 → 회원가입 1 부터 (02 "가입 진행")
  if (!viaGoogle && !signupDraft.password && !LOGIN_FREE) return <Navigate to="/signup" replace />

  /** 공통 실패 처리. 칸에 붙일 것은 칸으로, 가입 시간이 지났으면 처음부터 */
  const fail = (e: unknown) => {
    const c = codeOf(e)
    if (c === 'SIGNUP_EXPIRED') { setExpiredSignup(true); return }
    const field = AUTH_FIELD_OF[c]
    if (field === 'code') code.setServerErr(codeErrText(c, ttl.left))
    else if (c === 'VERIFICATION_SEND_FAILED') { setSentTo(null); code.reset(); setMmErr(errorText(e, AUTH_ERRORS)) }
    else if (field === 'mattermostId' || c === 'TOO_MANY_REQUESTS') setMmErr(errorText(e, AUTH_ERRORS))
    else if (field === 'floor') setFloorErr(errorText(e, AUTH_ERRORS))
    else if (c === 'INVALID_INPUT') {
      const f = (k: string) => fieldErrorText(e, k)
      if (f('code')) code.setServerErr(f('code'))
      if (f('mattermostId')) setMmErr(f('mattermostId'))
      setFormErr(f('password') ?? f('generation') ?? f('hasAgreedTerms') ?? f('hasAgreedPrivacy') ?? (f('code') || f('mattermostId') ? null : errorText(e, AUTH_ERRORS)))
    } else setFormErr(errorText(e, AUTH_ERRORS))
  }

  const send = async () => {
    setBusy('send'); setMmErr(null); setFormErr(null)
    try {
      if (!mmCheck.ok) { setMmErr(MM_ID_BAD); return }
      // 서버와 같은 정규화(앞뒤 공백 · 앞의 @ 떼고 소문자)를 한 값을 보냄
      const r = await sendCode.mutateAsync({ generation: Number(gen), mattermostId: mmCheck.value })
      setSentTo(`${gen}|${mmCheck.value}`); code.reset(); ttl.until(r.expiresAt); gap.start(RESEND_GAP)
      setTimeout(() => codeRef.current?.focus(), 0)
    } catch (e) { fail(e) } finally { setBusy(null) }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready || busy) return
    setBusy('submit'); setFormErr(null); setFloorErr(null)
    try {
      const r = await signup.mutateAsync({
        ...(viaGoogle ? {} : { password: signupDraft.password }),
        code: code.code, campusFloorId: toDtoId(floorId), hasAgreedTerms: terms, hasAgreedPrivacy: privacy,
      })
      clearSignupDraft()
      void resetSession()
      nav(pathAfterLogin(r.nextStep), { replace: true })
    } catch (err) { fail(err); setBusy(null) }
  }

  const restart = () => { clearSignupDraft(); nav(viaGoogle ? '/login' : '/signup', { replace: true }) }

  return (
    <AuthFrame step={viaGoogle ? undefined : 3}>
      <div className={s.head}>
        <h1 className={s.panelTitle}>SSAFY 인증을 해요</h1>
        <p className={s.panelLead}>Mattermost로 인증 코드를 보내요.</p>
      </div>
      {(gens.isError || campuses.isError) ? (
        <ErrorState compact error={gens.error ?? campuses.error} onRetry={() => { void gens.refetch(); void campuses.refetch() }} title="목록을 불러오지 못했어요" />
      ) : (
        <form className={s.form} noValidate onSubmit={submit}>
          <div className={s.fields}>
            <Select id="ss-gen" label="기수" value={gen} options={(gens.data ?? []).map((g) => [String(g), `${g}기`])} onChange={(v) => { setGen(v); setMmErr(null) }}
              placeholder={gens.isPending ? '불러오는 중' : '기수를 골라 주세요'} disabled={gens.isPending} />
            <div className={s.row2}>
              <Select id="ss-campus" label="캠퍼스" value={campusId} options={(campuses.data ?? []).map((c) => [c.id, c.name])}
                onChange={(v) => { setCampusId(v); setFloorId(''); setFloorErr(null) }} placeholder={campuses.isPending ? '불러오는 중' : '캠퍼스'} disabled={campuses.isPending} />
              <Select id="ss-floor" label="층" value={floorId} options={floors.map((f) => [f.id, `${f.floor}층`])} onChange={(v) => { setFloorId(v); setFloorErr(null) }}
                placeholder={campusId ? '층' : '캠퍼스 먼저'} disabled={!campusId} error={floorErr} />
            </div>
            <div className={s.field}>
              <label htmlFor="ss-mm">Mattermost ID</label>
              <div className={s.inputBox}>
                <input id="ss-mm" className={`${s.input} ${s.inputChip} ${mmErr || mmCheck.bad ? s.inputBad : ''}`} value={mm} onChange={(e) => { setMm(e.target.value); setMmErr(null) }}
                  placeholder="yejin.kim" autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={!!mmErr || mmCheck.bad} />
                <button type="button" className={s.inInputBtn} disabled={!mmCheck.ok || !gen || cooling || busy === 'send'} onClick={() => void send()} title={!gen ? '기수를 먼저 골라 주세요' : undefined}>
                  {busy === 'send' ? '보내는 중' : sent ? (cooling ? `재전송 ${gap.left}` : '재전송') : '코드 받기'}
                </button>
              </div>
              {mmErr ? <span className={s.err} role="alert">{mmErr}</span> : mmCheck.bad && <span className={s.err} role="alert">{MM_ID_BAD}</span>}
            </div>
            <div className={s.field}>
              <label htmlFor="ss-code">인증 코드</label>
              <div className={s.inputBox}>
                <input id="ss-code" ref={codeRef} className={`${s.input} ${codeErr ? s.inputBad : ''}`} inputMode="numeric" autoComplete="one-time-code"
                  value={code.code} onChange={code.onChange} placeholder="6자리 숫자" disabled={!sent} aria-invalid={!!codeErr} />
                {sent && <span className={s.timer}>{mmss(ttl.left ?? 0)}</span>}
              </div>
              {codeErr && <span className={s.err} role="alert">{codeErr}</span>}
              <span className={s.help}>Mattermost 메시지가 오지 않으면 ID를 다시 확인해 주세요.</span>
            </div>
          </div>
          <div className={s.terms}>
            <label><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span className={s.box} aria-hidden />이용약관 동의 <em>필수</em></label>
            <label><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /><span className={s.box} aria-hidden />개인정보 수집·이용 동의 <em>필수</em></label>
          </div>
          {formErr && <p className={s.formErr} role="alert">{formErr}</p>}
          <button className={`${s.primary} ${s.aBtn}`} disabled={!ready || busy === 'submit'} aria-busy={busy === 'submit'}>
            {busy === 'submit' ? <><Spinner />땅굴 파는 중</> : '땅굴 파기'}
          </button>
        </form>
      )}

      {/* 409 SIGNUP_EXPIRED: 가입 진행 기록이 없거나 시간이 지남 → 처음부터 */}
      <Modal open={expiredSignup} onClose={restart} width={400} labelledBy="exp-title">
        <div className={s.dialog}>
          <h2 id="exp-title" className={s.dialogTitle}>{AUTH_ERRORS.SIGNUP_EXPIRED}</h2>
          <p className={s.panelLead} style={{ margin: '12px 0 20px' }}>가입 도중 입력한 내용은 저장되지 않아요.</p>
          <button className={s.primary} onClick={restart}>{viaGoogle ? 'Google로 다시 시작하기' : '처음부터 다시 하기'}</button>
        </div>
      </Modal>
    </AuthFrame>
  )
}

/* ================================================================ */

/**
 * 비밀번호 찾기 · 재설정 메일 요청 (POST /password-resets)
 * 1 가입한 이메일, 형식이 틀리면 바로 안내 · 2 가입하지 않은 이메일이어도 "메일을 보냈어요"로 똑같이 이동 · 3 로그인으로 돌아가기
 */
export function PasswordReset() {
  const nav = useNavigate()
  const requestReset = useRequestPasswordReset()
  const loc = useLocation() as { state?: { email?: string } }
  const email = useEmailField(loc.state?.email ?? '')
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.valid) { email.touch(); return }
    if (busy) return
    setBusy(true); setFormErr(null)
    try {
      await requestReset.mutateAsync({ email: email.value })
      nav('/password-reset/sent', { state: { email: email.value } })
    } catch (err) {
      setBusy(false)
      setFormErr(codeOf(err) === 'INVALID_INPUT' ? (fieldErrorText(err, 'email') ?? EMAIL_BAD) : errorText(err, AUTH_ERRORS))
    }
  }
  return (
    <AuthFrame>
      <h1 className={s.panelTitle}>비밀번호를 잊었나요?</h1>
      <form className={s.form} noValidate onSubmit={submit}>
        <div className={s.fields}>
          <div className={s.field}>
            <label htmlFor="re">이메일</label>
            <input id="re" className={`${s.input} ${s.phDark} ${email.bad ? s.inputBad : ''}`} type="email" {...email.props}
              placeholder="가입한 이메일을 입력해 주세요" autoComplete="email" aria-invalid={email.bad} />
            {email.bad
              ? <span className={s.err} role="alert">{EMAIL_BAD}</span>
              : <span className={s.help}>이 이메일로 비밀번호 재설정 링크를 보내드려요</span>}
          </div>
        </div>
        {formErr && <p className={s.formErr} role="alert">{formErr}</p>}
        <button className={`${s.primary} ${s.aBtn}`} disabled={!email.value || busy} aria-busy={busy}>{busy ? <><Spinner />보내는 중</> : '링크 보내기'}</button>
      </form>
      <div className={s.links}><Link to="/login">← 로그인으로 돌아가기</Link></div>
    </AuthFrame>
  )
}

/**
 * 비밀번호 찾기 · 메일 보냄
 * 1 입력한 이메일과 관계없이 같은 문구 · 2 다시 보내기(POST /password-resets 다시, 이전 링크는 무효, 60초 간격: 서버도 같은 이메일로 60초 안이면 메일 없이 성공) · 3 링크는 30분 동안, 한 번만
 * 목 서버: 실제 메일이 없어서 "체험용 · 메일 속 링크 열기"(목 메일함)로 새 비밀번호 화면에 들어감
 */
export function PasswordResetSent() {
  const nav = useNavigate()
  const requestReset = useRequestPasswordReset()
  const loc = useLocation() as { state?: { email?: string } }
  const email = loc.state?.email ?? 'demo@ssafy.com'
  const gap = useCountdown()
  const [toast, setToast] = useState<{ title: string; desc?: string } | null>(null)
  const cooling = (gap.left ?? 0) > 0
  const resend = async () => {
    gap.start(RESEND_GAP)
    try {
      await requestReset.mutateAsync({ email })
      setToast({ title: '재설정 메일을 다시 보냈어요', desc: '이전에 보낸 링크는 더 이상 쓸 수 없어요' })
    } catch (e) { setToast({ title: '메일을 보내지 못했어요', desc: errorText(e, AUTH_ERRORS) }) }
  }
  return (
    <AuthFrame after={AUTH_IS_MOCK
      ? <button className={s.protoLink} onClick={() => nav(mockMailbox.resetLink(email))}>체험용 · 메일 속 링크 열기</button>
      : undefined}>
      <h1 className={s.panelTitle}>메일을 보냈어요</h1>
      <div className={s.fields}>
        <p className={s.lead}>입력한 이메일로 비밀번호 재설정 링크를 보냈어요.<br />메일함과 스팸함을 확인해 주세요.</p>
        <div className={s.sentTo}>
          <img src={iconMail} alt="" width={18} height={18} />
          <span>{email}</span>
        </div>
      </div>
      <button className={`${s.primary} ${s.aBtn}`} onClick={() => nav('/login', { state: { email: loc.state?.email } })}>로그인으로 돌아가기</button>
      <div className={s.links}>
        <span>메일이 안 왔나요?</span>
        <button className={s.linkWarm} disabled={cooling} onClick={() => void resend()}>
          다시 보내기{cooling && ` (${gap.left}초)`}
        </button>
      </div>
      <p className={s.resendNote}>링크는 30분 동안, 한 번만 쓸 수 있어요.</p>
      <Toast open={!!toast} onClose={() => setToast(null)} title={toast?.title ?? ''} desc={toast?.desc} />
    </AuthFrame>
  )
}

/**
 * 비밀번호 찾기 · 새 비밀번호 설정 (재설정 메일의 링크 /password-reset/{token} → app/(pc)/password-reset/[token] 이 /password-reset/new?token=… 로 넘김)
 * 들어올 때 GET /password-resets/{token} 으로 링크 확인 → 404 PASSWORD_RESET_LINK_INVALID 면 링크 만료 화면
 * 1·2 회원가입 2와 같음 · 3 비밀번호 바꾸기(POST …/complete) → 로그인으로 (로그인시키지 않음). ?token=demo 는 목 서버 시연용(늘 유효)
 */
export function PasswordResetNew() {
  const nav = useNavigate()
  const complete = useCompletePasswordReset()
  const [params] = useSearchParams()
  const token = params.get('token')
  const link = usePasswordResetLink(token)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  if (!token || (link.isError && (codeOf(link.error) === 'PASSWORD_RESET_LINK_INVALID' || (isApiError(link.error) && link.error.status === 404)))) {
    return <Navigate to="/password-reset/expired" replace />
  }
  if (link.isError) return <AuthFrame><ErrorState compact error={link.error} onRetry={() => void link.refetch()} retrying={link.isFetching} /></AuthFrame>
  if (link.isPending) return <AuthFrame><h1 className={s.panelTitle}>새 비밀번호를 정해요</h1><p className={s.panelLead} role="status"><Spinner /> 링크를 확인하는 중</p></AuthFrame>
  const ready = checkPassword(pw).ok && pw === pw2
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true); setPwErr(null); setFormErr(null)
    try {
      await complete.mutateAsync({ token, body: { password: pw } })
      nav('/login', { replace: true, state: { toast: '비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요' } })
    } catch (err) {
      setBusy(false)
      const c = codeOf(err)
      if (c === 'PASSWORD_RESET_LINK_INVALID') nav('/password-reset/expired', { replace: true })
      else if (c === 'INVALID_INPUT') setPwErr(fieldErrorText(err, 'password') ?? errorText(err, AUTH_ERRORS))
      else setFormErr(errorText(err, AUTH_ERRORS))
    }
  }
  return (
    <AuthFrame>
      <h1 className={s.panelTitle}>새 비밀번호를 정해요</h1>
      <form className={s.form} noValidate onSubmit={submit}>
        <PasswordPair pw={pw} pw2={pw2} setPw={(v) => { setPw(v); setPwErr(null) }} setPw2={setPw2} label="새 비밀번호" serverErr={pwErr} />
        {formErr && <p className={s.formErr} role="alert">{formErr}</p>}
        <button className={`${s.primary} ${s.aBtn}`} disabled={!ready || busy} aria-busy={busy}>{busy ? <><Spinner />바꾸는 중</> : '비밀번호 바꾸기'}</button>
      </form>
      <div className={s.links}><Link to="/login">← 로그인으로 돌아가기</Link></div>
    </AuthFrame>
  )
}

/** 비밀번호 찾기 · 링크 만료: 1 30분이 지났거나 이미 쓴 링크 · 2 다시 받기 → 재설정 메일 요청 */
export function PasswordResetExpired() {
  const nav = useNavigate()
  return (
    <AuthFrame>
      <h1 className={s.panelTitle}>링크가 만료됐어요</h1>
      <div className={s.expiredBox} role="alert">
        <img src={iconClock} alt="" width={20} height={20} />
        <p>이미 쓴 링크이거나 30분이 지났어요.<br />재설정 링크를 다시 받아 주세요.</p>
      </div>
      <button className={`${s.primary} ${s.aBtn}`} onClick={() => nav('/password-reset')}>재설정 링크 다시 받기</button>
      <div className={s.links}><Link to="/login">← 로그인으로 돌아가기</Link></div>
    </AuthFrame>
  )
}
