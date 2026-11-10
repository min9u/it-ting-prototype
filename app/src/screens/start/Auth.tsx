import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import roomCutout from '../../assets/room-cutout.png'
import StartHeader from './StartHeader'
import s from './Start.module.css'

/** 입력이 멈춘 뒤 0.5초 지나서 검사 (메모 408:22172: "비밀번호 즉석에서 0.5초 뒤에 양식 맞는지 확인") */
function useDebounced<T>(v: T, ms = 500) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}

function AuthFrame({ children, step }: { children: ReactNode; step?: string }) {
  return (
    <div className={s.authPage}>
      <StartHeader />
      <div className={s.authBody}>
        <div className={s.authVisual} aria-hidden><img src={roomCutout} alt="" /></div>
        <div className={s.authCard}>
          {step && <p className={s.step}><span className={s.stepBar}><i style={{ width: step === '1/2' ? '50%' : '100%' }} /></span>{step}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}

/** 시작 v2 – 로그인 408:20248 — 메타데이터 기반, 스크린샷 대조 필요 */
export function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  return (
    <AuthFrame>
      <p className={s.backTo}>로그인하면 보던 예린이의 방으로 돌아가요</p>
      <h1 className="display">다시 왔네요</h1>
      <form className={s.form} onSubmit={(e) => { e.preventDefault(); nav('/burrow') }}>
        <div className="field"><label htmlFor="le">이메일</label><input id="le" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yejin@ssafy.com" autoComplete="email" /></div>
        <div className="field"><label htmlFor="lp">비밀번호</label><input id="lp" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" /></div>
        <button className="btn btn-primary btn-block" disabled={!email || !pw}>로그인</button>
      </form>
      <div className={s.authLinks}>
        <Link to="/password-reset">비밀번호 찾기</Link>
        <span>처음이에요 <Link to="/signup" className={s.strong}>회원가입</Link></span>
      </div>
    </AuthFrame>
  )
}

/** 시작 v2 – 회원가입 1 · 이메일 408:20403 */
export function SignupEmail() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [left, setLeft] = useState(292)
  const dEmail = useDebounced(email)
  const emailBad = dEmail.length > 0 && !/^[^@\s]+@ssafy\.com$/.test(dEmail)

  useEffect(() => {
    if (!sent) return
    const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000)
    return () => clearInterval(t)
  }, [sent])

  return (
    <AuthFrame step="1/2">
      <h1 className="display">땅굴 주소를 만들어요</h1>
      <p className={s.lead}>SSAFY 이메일로 인증해요.</p>
      <form className={s.form} onSubmit={(e) => { e.preventDefault(); nav('/signup/password') }}>
        <div className="field">
          <label htmlFor="se">이메일</label>
          <div className={s.inline}>
            <input id="se" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yejin@ssafy.com" />
            <button type="button" className="btn btn-ghost btn-sm" disabled={emailBad || !email} onClick={() => { setSent(true); setLeft(292) }}>{sent ? '재전송' : '인증 코드 받기'}</button>
          </div>
          {emailBad && <span className="error">SSAFY 이메일(@ssafy.com)만 쓸 수 있어요</span>}
        </div>
        <div className="field">
          <label htmlFor="sc">인증 코드</label>
          <div className={s.codeWrap}>
            <input id="sc" className="input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6자리 숫자" disabled={!sent} />
            {sent && <span className={s.timer}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>}
          </div>
          <span className="hint">메일함에 코드가 없으면 스팸함도 확인해 주세요.</span>
        </div>
        <button className="btn btn-primary btn-block" disabled={code.length !== 6}>다음</button>
      </form>
    </AuthFrame>
  )
}

/** 시작 v2 – 회원가입 2 · 비밀번호 408:20564 */
export function SignupPassword() {
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [caps, setCaps] = useState(false)
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const dPw = useDebounced(pw)
  const dPw2 = useDebounced(pw2)
  const pwOk = dPw.length >= 8 && /\d/.test(dPw)
  const mismatch = dPw2.length > 0 && dPw2 !== dPw
  const ready = pw.length >= 8 && /\d/.test(pw) && pw === pw2 && terms && privacy
  const onKey = (e: React.KeyboardEvent) => setCaps(e.getModifierState('CapsLock'))

  return (
    <AuthFrame step="2/2">
      <h1 className="display">비밀번호를 정해요</h1>
      <form className={s.form} onSubmit={(e) => { e.preventDefault(); nav('/onboarding/name') }}>
        <div className="field">
          <label htmlFor="p1">비밀번호</label>
          <input id="p1" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyUp={onKey} placeholder="••••••••••" autoComplete="new-password" />
          <span className={dPw && !pwOk ? 'error' : 'hint'}>8자 이상, 숫자 포함</span>
          {caps && <span className="error">캡스락이 켜져 있어요</span>}
        </div>
        <div className="field">
          <label htmlFor="p2">비밀번호 확인</label>
          <input id="p2" className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyUp={onKey} autoComplete="new-password" />
          {mismatch && <span className="error">비밀번호가 달라요</span>}
        </div>
        <div className={s.terms}>
          <label><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> 이용약관 동의 <em>필수</em> <a href="#terms">전문 보기</a></label>
          <label><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /> 개인정보 수집·이용 동의 <em>필수</em> <a href="#privacy">전문 보기</a></label>
        </div>
        <button className="btn btn-primary btn-block" disabled={!ready}>땅굴 파기</button>
      </form>
    </AuthFrame>
  )
}

/** 시작 v2 – 비밀번호 찾기 504:5382 */
export function PasswordReset() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  return (
    <AuthFrame>
      <h1 className="display">비밀번호를 잊었나요?</h1>
      {sent ? (
        <p className={s.lead}>{email}로 재설정 링크를 보냈어요. 메일함을 확인해 주세요.</p>
      ) : (
        <form className={s.form} onSubmit={(e) => { e.preventDefault(); setSent(true) }}>
          <div className="field">
            <label htmlFor="re">이메일</label>
            <input id="re" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="가입한 이메일을 입력해 주세요" />
            <span className="hint">이 이메일로 비밀번호 재설정 링크를 보내드려요</span>
          </div>
          <button className="btn btn-primary btn-block" disabled={!email}>재설정 링크 보내기</button>
        </form>
      )}
      <div className={s.authLinks}><Link to="/login">← 로그인으로 돌아가기</Link></div>
    </AuthFrame>
  )
}
