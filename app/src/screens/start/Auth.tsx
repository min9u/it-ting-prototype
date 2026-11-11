import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import roomCutout from '../../assets/room-cutout.png'
import StartHeader, { PeekMole } from './StartHeader'
import s from './Start.module.css'

/** 입력이 멈춘 뒤 0.5초 지나서 검사 (메모 408:22172: "비밀번호 즉석에서 0.5초 뒤에 양식 맞는지 확인") */
function useDebounced<T>(v: T, ms = 500) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}

/** 흐린 땅굴 방 배경 + 가운데 패널 (Figma: Scene 1520×980 블러 + Dim + Panel 400) */
function BlurRoom() {
  return (
    <div className={s.blurBg} aria-hidden>
      <img src={roomCutout} alt="" className={s.blurRoom} />
    </div>
  )
}

function AuthFrame({ children, step, after }: { children: ReactNode; step?: 1 | 2; after?: ReactNode }) {
  return (
    <div className={s.page}>
      <BlurRoom />
      <StartHeader tone="light" right={null} />
      <main className={s.center}>
        <div className={s.panelWrap}>
          <PeekMole />
          <section className={s.panel}>
            {step && (
              <p className={s.step} aria-label={`${step}단계 / 2단계`}>
                <i className={step === 1 ? s.stepLong : s.stepShort} />
                <i className={step === 2 ? s.stepLong : s.stepShort} />
                {step}/2
              </p>
            )}
            {children}
          </section>
        </div>
        {after}
      </main>
    </div>
  )
}

/** 시작 v2 – 로그인 408:20248 */
export function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  return (
    <AuthFrame after={<p className={s.returnHint}>로그인하면 보던 예린이의 방으로 돌아가요</p>}>
      <h1 className={s.panelTitle}>다시 왔네요</h1>
      {/* 프로토타입: 입력 확인 없이 바로 온보딩으로 (온보딩 확인용, 2026-11-11) */}
      <form className={s.form} noValidate onSubmit={(e) => { e.preventDefault(); nav('/onboarding/name') }}>
        <div className={s.fields}>
          <label className={s.field}>
            <span>이메일</span>
            <input className={s.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yejin@ssafy.com" autoComplete="email" />
          </label>
          <label className={s.field}>
            <span>비밀번호</span>
            <input className={s.input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </label>
        </div>
        <button className={s.primary}>로그인</button>
      </form>
      <div className={s.links}>
        <Link to="/password-reset">비밀번호 찾기</Link>
        <span>처음이에요 <Link to="/signup" className={s.accentLink}>회원가입</Link></span>
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
    <AuthFrame step={1}>
      <h1 className={s.panelTitle}>땅굴 주소를 만들어요</h1>
      <p className={s.panelLead}>SSAFY 이메일로 인증해요.</p>
      {/* 프로토타입: 체험용이라 입력이 없어도 다음 단계로 (2026-11-11) */}
      <form className={s.form} noValidate onSubmit={(e) => { e.preventDefault(); nav('/signup/password') }}>
        <div className={s.fields}>
          <div className={s.field}>
            <label htmlFor="se">이메일</label>
            <div className={s.inputBox}>
              <input id="se" className={`${s.input} ${emailBad ? s.inputBad : ''}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yejin@ssafy.com" />
              <button type="button" className={s.inInputBtn} disabled={emailBad || !email} onClick={() => { setSent(true); setLeft(292) }}>{sent ? '재전송' : '코드 받기'}</button>
            </div>
            {emailBad && <span className={s.err}>SSAFY 이메일(@ssafy.com)만 쓸 수 있어요</span>}
          </div>
          <div className={s.field}>
            <label htmlFor="sc">인증 코드</label>
            <div className={s.inputBox}>
              <input id="sc" className={s.input} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6자리 숫자" disabled={!sent} />
              {sent && <span className={s.timer}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>}
            </div>
            <span className={s.help}>메일함에 코드가 없으면 스팸함도 확인해 주세요.</span>
          </div>
        </div>
        <button className={s.primary}>다음</button>
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
  const pwBad = dPw.length > 0 && !(dPw.length >= 8 && /\d/.test(dPw))
  const mismatch = dPw2.length > 0 && dPw2 !== dPw
  const ready = pw.length >= 8 && /\d/.test(pw) && pw === pw2 && terms && privacy
  const onKey = (e: React.KeyboardEvent) => setCaps(e.getModifierState('CapsLock'))

  return (
    <AuthFrame step={2}>
      <h1 className={s.panelTitle}>비밀번호를 정해요</h1>
      {/* 프로토타입: 체험용이라 조건을 안 채워도 온보딩으로 (2026-11-11) */}
      <form className={s.form} noValidate onSubmit={(e) => { e.preventDefault(); nav('/onboarding/name') }}>
        <div className={s.fields}>
          <div className={s.field}>
            <label htmlFor="p1">비밀번호</label>
            <input id="p1" className={`${s.input} ${pwBad ? s.inputBad : ''}`} type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyUp={onKey} placeholder="••••••••••" autoComplete="new-password" />
            <span className={pwBad ? s.err : s.help}>8자 이상, 숫자 포함</span>
            {caps && <span className={s.err}>캡스락이 켜져 있어요</span>}
          </div>
          <div className={s.field}>
            <label htmlFor="p2">비밀번호 확인</label>
            <input id="p2" className={`${s.input} ${mismatch ? s.inputBad : ''}`} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyUp={onKey} autoComplete="new-password" />
            {mismatch && <span className={s.err}>비밀번호가 달라요</span>}
          </div>
        </div>
        <div className={s.terms}>
          <label><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span className={s.box} aria-hidden />이용약관 동의 <em>필수</em></label>
          <label><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /><span className={s.box} aria-hidden />개인정보 수집·이용 동의 <em>필수</em></label>
        </div>
        <button className={s.primary} data-ready={ready}>땅굴 파기</button>
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
      <h1 className={s.panelTitle}>비밀번호를 잊었나요?</h1>
      {sent ? (
        <p className={s.panelLead}>{email}로 재설정 링크를 보냈어요. 메일함을 확인해 주세요.</p>
      ) : (
        <form className={s.form} onSubmit={(e) => { e.preventDefault(); setSent(true) }}>
          <div className={s.fields}>
            <div className={s.field}>
              <label htmlFor="re">이메일</label>
              <input id="re" className={s.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="가입한 이메일을 입력해 주세요" />
              <span className={s.help}>이 이메일로 비밀번호 재설정 링크를 보내드려요</span>
            </div>
          </div>
          <button className={s.primary} disabled={!email}>재설정 링크 보내기</button>
        </form>
      )}
      <div className={s.links}><Link to="/login">← 로그인으로 돌아가기</Link></div>
    </AuthFrame>
  )
}
