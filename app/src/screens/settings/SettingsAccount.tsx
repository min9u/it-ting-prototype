import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ConfirmDialog, Toast } from '../../components/Feedback'
import {
  changePassword, hasPassword, linkGoogle, passwordChecks, passwordOk, unlinkGoogle, useAccount,
} from '../../data/account'
import { GoogleSignInDialog, PageHead, PwInput, useUnsavedGuard } from './SettingsParts'
import s from './Settings.module.css'

/**
 * 설정 – 비밀번호 변경 (F10). 이메일로 가입한 계정(+ Google 연동한 계정)만.
 * 현재 비밀번호: 틀리면 변경할 수 없고 칸 아래에 알림. 새 비밀번호 · 확인: 00 공통 9 규칙, 두 칸이 다르면 알림.
 * 세 칸이 모두 맞아야 "변경하기"가 켜짐 → 완료 토스트 + 칸 비움. 취소는 입력한 내용을 지움.
 */
export function PasswordPage() {
  const acc = useAccount()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [curErr, setCurErr] = useState(false)
  const [toast, setToast] = useState(false)
  const guard = useUnsavedGuard(!!(cur || next || again))
  if (!hasPassword(acc)) return <Navigate to="/settings/google" replace />

  const c = passwordChecks(next)
  const same = !!next && next === acc.password
  const nextValid = passwordOk(next) && !same
  const match = !!again && next === again
  const ready = !!cur && nextValid && match
  const clear = () => { setCur(''); setNext(''); setAgain(''); setCurErr(false) }
  const submit = () => {
    if (!ready) return
    if (cur !== acc.password) { setCurErr(true); return }
    changePassword(next)
    clear()
    setToast(true)
  }
  const rule = (ok: boolean) => (next ? (ok ? s.ruleOk : s.ruleBad) : undefined)

  return (
    <>
      <PageHead title="비밀번호 변경" sub="안전한 비밀번호로 바꿔 주세요." />
      <form className={s.card} onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className={s.formRow}>
          <label htmlFor="pw-cur">현재 비밀번호</label>
          <div>
            <PwInput id="pw-cur" value={cur} onChange={(v) => { setCur(v); setCurErr(false) }} invalid={curErr} autoComplete="current-password" />
            {curErr ? <p className={s.fieldMsg}>현재 비밀번호가 맞지 않아요. 다시 입력해 주세요.</p>
              : <p className={s.fieldHint}>프로토타입: 지금 비밀번호는 {acc.password === 'digul123!' ? 'digul123!' : '마지막으로 바꾼 비밀번호'}예요.</p>}
          </div>
        </div>
        <div className={s.formRow}>
          <label htmlFor="pw-new">새 비밀번호</label>
          <div>
            <PwInput id="pw-new" value={next} onChange={setNext} invalid={!!next && !nextValid} autoComplete="new-password" />
            {next && !c.allowed && <p className={s.fieldMsg}>쓸 수 없는 문자가 있어요. 영문, 숫자, 특수기호(!@#$%)만 쓸 수 있어요.</p>}
            {same && <p className={s.fieldMsg}>지금 쓰는 비밀번호와 같아요. 다른 비밀번호를 입력해 주세요.</p>}
          </div>
        </div>
        <div className={s.formRow}>
          <label htmlFor="pw-again">새 비밀번호 확인</label>
          <div>
            <PwInput id="pw-again" value={again} onChange={setAgain} invalid={!!again && !match} autoComplete="new-password" />
            {again && !match && <p className={s.fieldMsg}>새 비밀번호와 같지 않아요.</p>}
            {again && match && <p className={s.fieldOk}>새 비밀번호와 같아요.</p>}
          </div>
        </div>
        <div className={s.infoBox}>
          <span className={s.infoIcon}>PW</span>
          <div className={s.infoBody}>
            <h3>비밀번호 규칙</h3>
            <ul aria-live="polite">
              <li className={rule(c.length)}>8자 이상이어야 해요.</li>
              <li className={rule(c.letter && c.digit && c.special && c.allowed)}><b>영문, 숫자, 특수기호(!@#$%)를 각각 1개 이상 넣어야 해요.</b></li>
              <li className={next ? (same ? s.ruleBad : s.ruleOk) : undefined}>지금 쓰는 비밀번호와 같으면 안 돼요.</li>
              <li>다른 서비스와 같은 비밀번호는 피하는 게 좋아요.</li>
            </ul>
          </div>
        </div>
        <div className={s.actions}>
          <button type="button" className={s.btnCancel} onClick={clear}>취소</button>
          <button type="submit" className={s.btnMain} disabled={!ready}>변경하기</button>
        </div>
      </form>
      {guard}
      <Toast open={toast} title="비밀번호가 변경되었어요" desc="다음 로그인부터 새 비밀번호를 써 주세요" onClose={() => setToast(false)} />
    </>
  )
}

/**
 * 설정 – Google 연동하기 · 연동 전 / 연동됨 (F10)
 * 연동 전: "연동되지 않음" + Google 계정 연동 → Google 로그인 창 → 연결되면 완료 토스트, 연동됨 화면으로
 * 연동됨: "연동됨" + 연결된 이메일, 연동 해제(확인 팝업, 00 공통 17). Google로만 가입한 계정은 해제 버튼을 끄고 이유를 알림
 */
export function GooglePage() {
  const acc = useAccount()
  const linked = !!acc.googleEmail
  const [signIn, setSignIn] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const googleOnly = !hasPassword(acc)

  return (
    <>
      <PageHead title="Google 연동하기" sub="Google 계정과 연동해서 더 간편하게 로그인해 보세요." />
      <div className={s.card}>
        <div className={s.gStatus}>
          <span className={s.gTile} aria-hidden>G</span>
          <div className={s.gState}>
            <strong>연동 상태</strong>
            <div>
              <span className={linked ? `${s.pill} ${s.pillOn}` : s.pill}>{linked ? '연동됨' : '연동되지 않음'}</span>
              {linked && <span>{acc.googleEmail}</span>}
            </div>
          </div>
        </div>
        <p className={s.gDesc}>Google 계정을 연동하면 더 간편하게 로그인할 수 있고,<br />계정 복구도 쉽게 할 수 있어요.</p>
        {linked ? (
          <>
            <button className={s.btnSoft} disabled={googleOnly} onClick={() => setConfirm(true)}>연동 해제</button>
            {googleOnly && <p className={s.reason}>Google로만 가입한 계정이라 연동을 해제하면 로그인할 방법이 없어져요. 그래서 해제할 수 없어요.</p>}
          </>
        ) : (
          <button className={s.btnMain} style={{ minWidth: 220 }} onClick={() => setSignIn(true)}>Google 계정 연동</button>
        )}
        <div className={s.infoBox} style={{ marginTop: 24 }}>
          <span className={s.infoIcon}>G</span>
          <div className={s.infoBody}>
            <h3>Google 연동 혜택</h3>
            <ul>
              <li>간편 로그인: Google 계정으로 바로 로그인해요.</li>
              <li>빠른 가입: 복잡한 가입 절차 없이 바로 시작해요.</li>
              <li>계정 복구: 문제가 생겨도 Google 계정으로 쉽게 되찾아요.</li>
            </ul>
          </div>
        </div>
      </div>
      <GoogleSignInDialog open={signIn} onClose={() => setSignIn(false)}
        onPick={(email) => { linkGoogle(email); setSignIn(false); setToast('Google 계정이 연동되었어요') }} />
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)}
        onConfirm={() => { unlinkGoogle(); setToast('Google 연동이 해제되었어요') }}
        title="Google 연동을 해제할까요?" desc="해제하면 Google 계정으로 로그인할 수 없어요. 이메일과 비밀번호로 로그인해 주세요." confirmLabel="해제" />
      <Toast open={!!toast} title={toast ?? ''} desc={toast === 'Google 계정이 연동되었어요' ? '이제 Google로도 로그인할 수 있어요' : undefined} onClose={() => setToast(null)} />
    </>
  )
}
