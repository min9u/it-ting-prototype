import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import roomCutout from '../../assets/room-cutout.png'
import Modal from '../../components/Modal'
import { Toast } from '../../components/Feedback'
import {
  CAMPUSES, CAMPUS_FLOORS, CODE_EXPIRED, CODE_LEN, CODE_NOT_DIGIT, CODE_TTL, CODE_WRONG, EMAIL_BAD, GENERATIONS,
  PW_BAD_CHAR, PW_MISMATCH, PW_RULE_TEXT, RESEND_GAP, checkPassword, confirmMismatch, consumeResetToken, emailHasBadChar,
  emailValid, googleLogin, lastResetToken, login, registerAccount, requestReset, resetTokenValid, setAuthState, signupDraft,
  verifyCode, type LoginResult,
} from '../../data/auth'
import StartHeader, { PeekMole } from './StartHeader'
import s from './Start.module.css'

/*
 * F2 로그인 · 회원가입 · 비밀번호 찾기 (02 명세 2026-11-16 기준, 디자인은 03 시작 v2 PNG).
 * 공통 (00 공통 11): 로고(누르면 랜딩) · 흐린 땅굴 배경 · 카드 위로 빼꼼 나온 두더지(눈 깜빡임)
 * 목 동작·시연 계정은 data/auth.ts 맨 위 주석
 */

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
      {Array.from({ length: total }, (_, i) => <i key={i} className={i + 1 === n ? s.stepLong : s.stepShort} />)}
      {n}/{total}
    </p>
  )
}

export function AuthFrame({ children, step, after, wide }: { children: ReactNode; step?: number; after?: ReactNode; wide?: boolean }) {
  return (
    <div className={s.page}>
      <BlurRoom />
      <StartHeader tone="light" right={null} />
      <main className={s.center}>
        <div className={`${s.panelWrap} ${wide ? s.panelWide : ''}`}>
          <PeekMole />
          <section className={s.panel}>
            {step && <Steps n={step} />}
            {children}
          </section>
        </div>
        {after}
      </main>
    </div>
  )
}

/** 남은 시간 (초). start() 로 다시 시작 */
function useCountdown() {
  const [end, setEnd] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (end == null) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [end])
  const left = end == null ? null : Math.max(0, Math.ceil((end - now) / 1000))
  return { left, start: (sec: number) => { setNow(Date.now()); setEnd(Date.now() + sec * 1000) } }
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

/** 인증 코드 칸 상태: 숫자가 아니면 바로 오류 */
function useCodeField() {
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(false)
  const notDigit = /\D/.test(code)
  return {
    code, notDigit, wrong, complete: code.length === CODE_LEN && !notDigit,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setCode(e.target.value.slice(0, CODE_LEN)); setWrong(false) },
    setWrong, reset: () => { setCode(''); setWrong(false) },
  }
}

function Spinner() { return <span className={s.spinner} aria-hidden /> }

/* ================================================================ */

/**
 * 시작 v2 – 로그인 (02 F2 · 로그인)
 * 1 "다시 오셨군요!" · 2 이메일 형식 검사(칸을 벗어날 때) · 3 가려서 표시, Enter 로 제출
 * 4 두 칸이 차면 활성, 요청 중 로딩, 실패 "이메일 또는 비밀번호가 맞지 않아요", 정지 계정은 사유·기간 팝업
 * 5 Google 로 계속하기 · 6 비밀번호 찾기 · 7 회원가입(입력한 이메일을 넘김)
 * 성공 → 내 땅굴 (SSAFY 인증 전이면 회원가입 3, 온보딩 전이면 온보딩 1)
 */
export function Login() {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { email?: string; toast?: string } }
  const email = useEmailField(loc.state?.email ?? '')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState<'pw' | 'google' | null>(null)
  const [failed, setFailed] = useState(false)
  const [suspended, setSuspended] = useState<Extract<LoginResult, { kind: 'suspended' }> | null>(null)
  const [toast, setToast] = useState(loc.state?.toast ?? null)
  const [params] = useSearchParams()
  // 시연: ?demo=error · ?demo=suspended
  useEffect(() => {
    const d = params.get('demo')
    if (d === 'error') { email.set('wrong@ssafy.com'); setPw('12345678'); setFailed(true) }
    if (d === 'suspended') setSuspended({ ok: false, kind: 'suspended', reason: '신고 누적', days: 7, until: '2026.11.23' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const done = (r: LoginResult) => {
    setBusy(null)
    if (r.ok) { nav(r.next); return }
    if (r.kind === 'mismatch') setFailed(true)
    else setSuspended(r)
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.value || !pw || busy) return
    if (!email.valid) { email.touch(); return }
    setFailed(false); setBusy('pw')
    done(await login(email.value, pw))
  }
  const google = async () => { if (busy) return; setFailed(false); setBusy('google'); done(await googleLogin()) }

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
            {failed && <span className={s.err} role="alert">이메일 또는 비밀번호가 맞지 않아요</span>}
          </div>
        </div>
        <button className={s.primary} disabled={!email.value || !pw || !!busy} aria-busy={busy === 'pw'}>
          {busy === 'pw' ? <><Spinner />로그인 중</> : '로그인'}
        </button>
      </form>
      <p className={s.or}><span>또는</span></p>
      <button className={s.secondary} onClick={google} disabled={!!busy} aria-busy={busy === 'google'}>
        {busy === 'google' ? <><Spinner />Google 계정 확인 중</> : 'Google로 계속하기'}
      </button>
      <div className={s.links}>
        <Link to="/password-reset" state={{ email: email.value }}>비밀번호 찾기</Link>
        <span>처음이에요 <Link to="/signup" state={{ email: email.value }} className={s.accentLink}>회원가입</Link></span>
      </div>

      {/* 정지된 계정: 사유와 기간 */}
      <Modal open={!!suspended} onClose={() => setSuspended(null)} width={400} labelledBy="sus-title">
        {suspended && (
          <div className={s.dialog}>
            <h2 id="sus-title" className={s.dialogTitle}>신고로 인해 {suspended.days}일 동안 로그인할 수 없어요</h2>
            <dl className={s.dialogInfo}>
              <div><dt>정지 사유</dt><dd>{suspended.reason}</dd></div>
              <div><dt>정지 기간</dt><dd>{suspended.until}까지 ({suspended.days}일)</dd></div>
            </dl>
            <button className={s.primary} onClick={() => setSuspended(null)}>확인</button>
          </div>
        )}
      </Modal>
      <Toast open={!!toast} onClose={() => setToast(null)} title={toast ?? ''} />
    </AuthFrame>
  )
}

/* ================================================================ */

/**
 * 시작 v2 – 회원가입 1 · 이메일 (1/3)
 * 3 쓸 수 없는 문자는 바로 "이메일 형식을 확인해 주세요" · 4 입력란 오른쪽 칩(코드 받기 → 재전송, 30초 간격)
 * 5 6자리 숫자 + 남은 시간, 숫자가 아니면 바로 "숫자 6자리를 입력해 주세요" · 6 스팸함 안내 · 7 코드를 다 넣으면 다음
 */
export function SignupEmail() {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { email?: string } }
  const email = useEmailField(loc.state?.email || signupDraft.email)
  const code = useCodeField()
  const ttl = useCountdown()
  const gap = useCountdown()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const sent = sentTo != null && sentTo === email.value
  const expired = sent && ttl.left === 0
  const codeRef = useRef<HTMLInputElement>(null)

  const send = () => {
    if (!email.valid) { email.touch(); return }
    setSentTo(email.value); code.reset(); ttl.start(CODE_TTL); gap.start(RESEND_GAP)
    setTimeout(() => codeRef.current?.focus(), 0)
  }
  const cooling = sent && (gap.left ?? 0) > 0
  const codeErr = code.notDigit ? CODE_NOT_DIGIT : expired ? CODE_EXPIRED : code.wrong ? CODE_WRONG : null

  return (
    <AuthFrame step={1}>
      <h1 className={s.panelTitle}>땅굴 주소를 만들어요</h1>
      <p className={s.panelLead}>가입할 이메일을 인증해요.</p>
      <form className={s.form} noValidate onSubmit={(e) => {
        e.preventDefault()
        if (!sent || !code.complete || expired) return
        if (!verifyCode(code.code)) { code.setWrong(true); return }
        signupDraft.email = email.value
        nav('/signup/password')
      }}>
        <div className={s.fields}>
          <div className={s.field}>
            <label htmlFor="su-email">이메일</label>
            <div className={s.inputBox}>
              <input id="su-email" className={`${s.input} ${email.bad ? s.inputBad : ''}`} type="email" {...email.props}
                placeholder="yejin@ssafy.com" autoComplete="email" aria-invalid={email.bad} />
              <button type="button" className={s.inInputBtn} disabled={!email.valid || cooling} onClick={send}>
                {sent ? (cooling ? `재전송 ${gap.left}` : '재전송') : '코드 받기'}
              </button>
            </div>
            {email.bad && <span className={s.err}>{EMAIL_BAD}</span>}
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
        <button className={s.primary} disabled={!sent || !code.complete || expired}>다음</button>
      </form>
    </AuthFrame>
  )
}

/** 비밀번호 + 확인 칸 (회원가입 2 · 새 비밀번호 설정 공통, 00 공통 9) */
function PasswordPair({ pw, pw2, setPw, setPw2, label = '비밀번호' }: { pw: string; pw2: string; setPw: (v: string) => void; setPw2: (v: string) => void; label?: string }) {
  const [caps, setCaps] = useState(false)
  const rule = checkPassword(pw)
  const mismatch = confirmMismatch(pw, pw2)
  const onKey = (e: React.KeyboardEvent) => setCaps(e.getModifierState('CapsLock'))
  return (
    <div className={s.fields}>
      <div className={s.field}>
        <label htmlFor="pw1">{label}</label>
        <input id="pw1" className={`${s.input} ${!rule.allowed ? s.inputBad : ''}`} type="password" value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyUp={onKey} placeholder="••••••••••" autoComplete="new-password" aria-invalid={!rule.allowed} aria-describedby="pw1-rule" />
        <span id="pw1-rule" className={`${s.rule} ${rule.ok ? s.ruleOk : ''}`}>{rule.ok && <b aria-hidden>✓ </b>}{PW_RULE_TEXT}</span>
        {!rule.allowed && <span className={s.err} role="alert">{PW_BAD_CHAR}</span>}
        {caps && <span className={s.err}>Caps Lock이 켜져 있어요</span>}
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
 * 시작 v2 – 회원가입 2 · 비밀번호 (2/3)
 * 3 점으로 가림, 규칙 충족 여부를 입력하면서 표시, 쓸 수 없는 문자는 바로 오류 · 4 두 값이 다르면 바로 "비밀번호가 일치하지 않아요"
 * 5 조건을 다 채우면 활성 → 회원가입 3
 */
export function SignupPassword() {
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const ready = checkPassword(pw).ok && pw === pw2
  return (
    <AuthFrame step={2}>
      <h1 className={s.panelTitle}>비밀번호를 정해요</h1>
      <form className={s.form} noValidate onSubmit={(e) => { e.preventDefault(); if (!ready) return; signupDraft.pw = pw; nav('/signup/ssafy') }}>
        <PasswordPair pw={pw} pw2={pw2} setPw={setPw} setPw2={setPw2} />
        <button className={s.primary} disabled={!ready}>다음</button>
      </form>
    </AuthFrame>
  )
}

/** 목록에서 고르는 칸 (기수 · 캠퍼스 · 층) */
function Select({ id, label, value, options, onChange, placeholder, disabled }: { id: string; label: string; value: string; options: string[]; onChange: (v: string) => void; placeholder: string; disabled?: boolean }) {
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label}</label>
      <div className={s.selectBox}>
        <select id={id} className={`${s.input} ${s.select}`} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required>
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className={s.selectArrow} aria-hidden>▾</span>
      </div>
    </div>
  )
}

/**
 * 시작 v2 – 회원가입 3 · SSAFY 인증 (3/3)
 * 1 진행 표시 (Google 가입·로그인했는데 인증 전이면 이 화면 하나뿐이라 숨김) · 2 "SSAFY 인증을 해요"
 * 3 기수 · 캠퍼스 · 층 목록에서 고름(캠퍼스를 고르면 그 캠퍼스의 층) · 4 Mattermost ID + 코드 받기(다시 누르면 재전송, 30초 간격)
 * 5 6자리 숫자 + 남은 시간 · 6 안내 문구 · 7 약관 동의(필수 2개) · 8 다 마치면 땅굴 파기 → 온보딩 1
 */
export function SignupSsafy() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const single = params.get('via') === 'google' || params.get('resume') === '1'
  const [gen, setGen] = useState('')
  const [campus, setCampus] = useState('')
  const [floor, setFloor] = useState('')
  const [mm, setMm] = useState('')
  const code = useCodeField()
  const ttl = useCountdown()
  const gap = useCountdown()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const sent = sentTo != null && sentTo === `${gen}|${mm}`
  const expired = sent && ttl.left === 0
  const cooling = sent && (gap.left ?? 0) > 0
  const codeErr = code.notDigit ? CODE_NOT_DIGIT : expired ? CODE_EXPIRED : code.wrong ? CODE_WRONG : null
  const ready = !!gen && !!campus && !!floor && sent && code.complete && !expired && terms && privacy
  const codeRef = useRef<HTMLInputElement>(null)

  const send = () => {
    setSentTo(`${gen}|${mm}`); code.reset(); ttl.start(CODE_TTL); gap.start(RESEND_GAP)
    setTimeout(() => codeRef.current?.focus(), 0)
  }

  return (
    <AuthFrame step={single ? undefined : 3}>
      <h1 className={s.panelTitle}>SSAFY 인증을 해요</h1>
      <p className={s.panelLead}>Mattermost로 인증 코드를 보내요.</p>
      <form className={s.form} noValidate onSubmit={(e) => {
        e.preventDefault()
        if (!ready) return
        if (!verifyCode(code.code)) { code.setWrong(true); return }
        registerAccount(signupDraft.email, signupDraft.pw)
        setAuthState('member')
        nav('/onboarding/name')
      }}>
        <div className={s.fields}>
          <Select id="ss-gen" label="기수" value={gen} options={GENERATIONS} onChange={setGen} placeholder="기수를 골라 주세요" />
          <div className={s.row2}>
            <Select id="ss-campus" label="캠퍼스" value={campus} options={CAMPUSES} onChange={(v) => { setCampus(v); setFloor('') }} placeholder="캠퍼스" />
            <Select id="ss-floor" label="층" value={floor} options={campus ? CAMPUS_FLOORS[campus] : []} onChange={setFloor} placeholder={campus ? '층' : '캠퍼스 먼저'} disabled={!campus} />
          </div>
          <div className={s.field}>
            <label htmlFor="ss-mm">Mattermost ID</label>
            <div className={s.inputBox}>
              <input id="ss-mm" className={s.input} value={mm} onChange={(e) => setMm(e.target.value.trim())} placeholder="yejin.kim" autoComplete="off" />
              <button type="button" className={s.inInputBtn} disabled={!mm || !gen || cooling} onClick={send} title={!gen ? '기수를 먼저 골라 주세요' : undefined}>
                {sent ? (cooling ? `재전송 ${gap.left}` : '재전송') : '코드 받기'}
              </button>
            </div>
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
        <button className={s.primary} disabled={!ready}>땅굴 파기</button>
      </form>
    </AuthFrame>
  )
}

/* ================================================================ */

/**
 * 비밀번호 찾기 · 재설정 메일 요청
 * 1 가입한 이메일, 형식이 틀리면 바로 안내 · 2 가입하지 않은 이메일이어도 "메일을 보냈어요"로 똑같이 이동 · 3 로그인으로 돌아가기
 */
export function PasswordReset() {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { email?: string } }
  const email = useEmailField(loc.state?.email ?? '')
  return (
    <AuthFrame>
      <h1 className={s.panelTitle}>비밀번호를 잊었나요?</h1>
      <form className={s.form} noValidate onSubmit={(e) => {
        e.preventDefault()
        if (!email.valid) { email.touch(); return }
        requestReset(email.value)
        nav('/password-reset/sent', { state: { email: email.value } })
      }}>
        <div className={s.fields}>
          <div className={s.field}>
            <label htmlFor="re">이메일</label>
            <input id="re" className={`${s.input} ${email.bad ? s.inputBad : ''}`} type="email" {...email.props}
              placeholder="가입한 이메일을 입력해 주세요" autoComplete="email" aria-invalid={email.bad} />
            {email.bad && <span className={s.err} role="alert">{EMAIL_BAD}</span>}
          </div>
        </div>
        <button className={s.primary} disabled={!email.value}>재설정 링크 보내기</button>
      </form>
      <div className={s.links}><Link to="/login">로그인으로 돌아가기</Link></div>
    </AuthFrame>
  )
}

/**
 * 비밀번호 찾기 · 메일 보냄
 * 1 입력한 이메일과 관계없이 같은 문구 · 2 다시 보내기(이전 링크는 무효, 30초 간격) · 3 링크는 30분 동안, 한 번만
 * 프로토타입: 실제 메일이 없어서 "체험용 · 메일 속 링크 열기"로 새 비밀번호 화면에 들어감
 */
export function PasswordResetSent() {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { email?: string } }
  const email = loc.state?.email ?? 'demo@ssafy.com'
  const gap = useCountdown()
  const [toast, setToast] = useState(false)
  // 주소로 바로 들어온 경우(?demo)에도 링크가 있게
  useEffect(() => { if (!lastResetToken(email)) requestReset(email) }, [email])
  const cooling = (gap.left ?? 0) > 0
  return (
    <AuthFrame after={<>
      <p className={s.returnHint}>링크는 30분 동안, 한 번만 쓸 수 있어요</p>
      <button className={s.protoLink} onClick={() => nav(`/password-reset/new?token=${lastResetToken(email) ?? ''}`)}>체험용 · 메일 속 링크 열기</button>
    </>}>
      <h1 className={s.panelTitle}>메일을 보냈어요</h1>
      <p className={s.panelText}>입력한 이메일로 비밀번호 재설정 링크를 보냈어요.<br />메일함과 스팸함을 확인해 주세요.</p>
      <button className={`${s.primary} ${s.mt24}`} onClick={() => nav('/login', { state: { email: loc.state?.email } })}>로그인으로 돌아가기</button>
      <p className={s.links}>
        <button className={s.linkBtn} disabled={cooling} onClick={() => { requestReset(email); gap.start(RESEND_GAP); setToast(true) }}>
          메일이 안 왔나요? 다시 보내기{cooling && ` (${gap.left}초)`}
        </button>
      </p>
      <Toast open={toast} onClose={() => setToast(false)} title="재설정 메일을 다시 보냈어요" desc="이전에 보낸 링크는 더 이상 쓸 수 없어요" />
    </AuthFrame>
  )
}

/**
 * 비밀번호 찾기 · 새 비밀번호 설정 (재설정 메일의 링크가 유효할 때)
 * 1·2 회원가입 2와 같음 · 3 성공하면 링크를 만료시키고 로그인으로
 * 링크가 30분이 지났거나 이미 썼거나 다시 보내서 무효면 링크 만료 화면으로. ?token=demo 는 시연용(항상 유효)
 */
export function PasswordResetNew() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [valid] = useState(() => token === 'demo' || resetTokenValid(token))
  if (!valid) return <Navigate to="/password-reset/expired" replace />
  const ready = checkPassword(pw).ok && pw === pw2
  return (
    <AuthFrame>
      <h1 className={s.panelTitle}>새 비밀번호를 정해요</h1>
      <form className={s.form} noValidate onSubmit={(e) => {
        e.preventDefault()
        if (!ready) return
        if (token && token !== 'demo') consumeResetToken(token, pw)
        nav('/login', { replace: true, state: { toast: '비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요' } })
      }}>
        <PasswordPair pw={pw} pw2={pw2} setPw={setPw} setPw2={setPw2} />
        <button className={s.primary} disabled={!ready}>비밀번호 바꾸기</button>
      </form>
      <div className={s.links}><Link to="/login">로그인으로 돌아가기</Link></div>
    </AuthFrame>
  )
}

/** 비밀번호 찾기 · 링크 만료: 1 30분이 지났거나 이미 쓴 링크 · 2 다시 받기 → 재설정 메일 요청 */
export function PasswordResetExpired() {
  const nav = useNavigate()
  return (
    <AuthFrame after={<p className={s.returnHint}>링크는 30분 동안, 한 번만 쓸 수 있어요</p>}>
      <h1 className={s.panelTitle}>링크가 만료됐어요</h1>
      <p className={`${s.panelText} ${s.panelErr}`}>이미 쓴 링크이거나 30분이 지났어요.<br />재설정 링크를 다시 받아 주세요.</p>
      <button className={`${s.primary} ${s.mt24}`} onClick={() => nav('/password-reset')}>재설정 링크 다시 받기</button>
      <div className={s.links}><Link to="/login">로그인으로 돌아가기</Link></div>
    </AuthFrame>
  )
}
