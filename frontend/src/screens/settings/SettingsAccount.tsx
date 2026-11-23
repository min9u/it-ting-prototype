import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from '@/lib/nav'
import { ConfirmDialog, Toast } from '../../components/Feedback'
import { ErrorState } from '../../components/AsyncState'
import { isApiError } from '../../api/client'
import { errorText, fieldErrorText } from '../../api/common'
import { goGoogle } from '../../api/auth'
import { SETTINGS_ERRORS, SETTINGS_IS_MOCK, settingsApi, settingsMockDemo, useAccount, useChangePassword, useGoogleLink } from '../../api/settings'
import { passwordChecks, passwordOk } from '../../lib/authRules'
import { PageHead, PwInput, useUnsavedGuard } from './SettingsParts'
import s from './Settings.module.css'

const codeOf = (e: unknown) => (isApiError(e) ? e.code : '')

/**
 * 설정 – 비밀번호 변경 (10, PATCH /me/password). 비밀번호가 있는 계정만 (GET /me/account 의 hasPassword).
 * 현재 비밀번호: 틀리면(CURRENT_PASSWORD_MISMATCH) 칸 아래에 알림. 새 비밀번호 · 확인: 00 공통 9 규칙, 두 칸이 다르면 알림.
 * 지금 비밀번호와 같으면 서버가 PASSWORD_UNCHANGED 로 알림 (프론트는 지금 비밀번호를 모름).
 * 세 칸이 모두 차고 규칙에 맞아야 "변경하기" → 완료 토스트 + 칸 비움 (다른 기기는 로그아웃, 이 기기는 그대로). 취소는 입력한 내용을 지움.
 */
export function PasswordPage() {
  const account = useAccount()
  const change = useChangePassword()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [curErr, setCurErr] = useState<string | null>(null)
  const [nextErr, setNextErr] = useState<string | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [toast, setToast] = useState(false)
  const guard = useUnsavedGuard(!!(cur || next || again))
  if (account.data && !account.data.hasPassword) return <Navigate to="/settings/google" replace />

  const c = passwordChecks(next)
  const nextValid = passwordOk(next)
  const match = !!again && next === again
  const ready = !!cur && nextValid && match && !change.isPending
  const clear = () => { setCur(''); setNext(''); setAgain(''); setCurErr(null); setNextErr(null); setFormErr(null) }
  const submit = () => {
    if (!ready) return
    setCurErr(null); setNextErr(null); setFormErr(null)
    change.mutate({ currentPassword: cur, newPassword: next }, {
      onSuccess: () => { clear(); setToast(true) },
      onError: (e) => {
        const code = codeOf(e)
        if (code === 'CURRENT_PASSWORD_MISMATCH') setCurErr(SETTINGS_ERRORS.CURRENT_PASSWORD_MISMATCH)
        else if (code === 'PASSWORD_UNCHANGED') setNextErr(SETTINGS_ERRORS.PASSWORD_UNCHANGED)
        else if (code === 'PASSWORD_NOT_SET') void account.refetch()
        else if (code === 'INVALID_INPUT') {
          setCurErr(fieldErrorText(e, 'currentPassword')); setNextErr(fieldErrorText(e, 'newPassword'))
          if (!fieldErrorText(e, 'currentPassword') && !fieldErrorText(e, 'newPassword')) setFormErr(errorText(e, SETTINGS_ERRORS))
        } else setFormErr(errorText(e, SETTINGS_ERRORS))
      },
    })
  }
  const rule = (ok: boolean) => (next ? (ok ? s.ruleOk : s.ruleBad) : undefined)

  return (
    <>
      <PageHead title="비밀번호 변경" sub="안전한 비밀번호로 바꿔 주세요." />
      <form className={s.card} onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className={s.formRow}>
          <label htmlFor="pw-cur">현재 비밀번호</label>
          <div>
            <PwInput id="pw-cur" value={cur} onChange={(v) => { setCur(v); setCurErr(null) }} invalid={!!curErr} autoComplete="current-password" />
            {curErr ? <p className={s.fieldMsg}>{curErr}</p>
              : SETTINGS_IS_MOCK && <p className={s.fieldHint}>체험용: 처음 비밀번호는 {settingsMockDemo.initialPassword} 예요.</p>}
          </div>
        </div>
        <div className={s.formRow}>
          <label htmlFor="pw-new">새 비밀번호</label>
          <div>
            <PwInput id="pw-new" value={next} onChange={(v) => { setNext(v); setNextErr(null) }} invalid={(!!next && !nextValid) || !!nextErr} autoComplete="new-password" />
            {next && !c.allowed && <p className={s.fieldMsg}>쓸 수 없는 문자가 있어요. 영문, 숫자, 특수기호(!@#$%)만 쓸 수 있어요.</p>}
            {nextErr && <p className={s.fieldMsg}>{nextErr}</p>}
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
              <li className={rule(c.length)}>8자 이상 20자 이하여야 해요.</li>
              <li className={rule(c.letter && c.digit && c.special && c.allowed)}><b>영문, 숫자, 특수기호(!@#$%)를 각각 1개 이상 넣어야 해요.</b></li>
              <li className={nextErr === SETTINGS_ERRORS.PASSWORD_UNCHANGED ? s.ruleBad : undefined}>지금 쓰는 비밀번호와 같으면 안 돼요.</li>
              <li>다른 서비스와 같은 비밀번호는 피하는 게 좋아요.</li>
            </ul>
          </div>
        </div>
        {formErr && <p className={s.noteWarn} role="alert">{formErr}</p>}
        <div className={s.actions}>
          <button type="button" className={s.btnCancel} onClick={clear}>취소</button>
          <button type="submit" className={s.btnMain} disabled={!ready} aria-busy={change.isPending}>{change.isPending ? '변경하는 중' : '변경하기'}</button>
        </div>
      </form>
      {guard}
      <Toast open={toast} title="비밀번호가 변경되었어요" desc="다른 기기에서는 로그아웃돼요. 이 기기는 그대로 로그인돼 있어요" onClose={() => setToast(false)} />
    </>
  )
}

/**
 * 설정 – Google 연동하기 · 연동 전 / 연동됨 (10)
 * 연동 전: "연동되지 않음" + Google 계정 연동 → 브라우저가 GET /oauth/google/verify?purpose=LINK 로 이동 → Google →
 *   돌아온 주소 ?verified=true 면 PUT /me/google-link → 완료 토스트 · 연동됨 화면. ?error=<code> 면 그 안내
 * 연동됨: "연동됨" + 연결된 이메일, 연동 해제(확인 팝업, 00 공통 17 → DELETE /me/google-link).
 *   canUnlinkGoogle 이 false(Google로만 가입)면 버튼을 끄고 이유를 알림
 */
export function GooglePage() {
  const nav = useNavigate()
  const account = useAccount()
  const { link, unlink } = useGoogleLink()
  const [params, setParams] = useSearchParams()
  const [confirm, setConfirm] = useState(false)
  const [going, setGoing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [toast, setToast] = useState<{ title: string; desc?: string } | null>(null)
  const handled = useRef(false)

  // Google 에서 돌아왔을 때 (10 "Google 확인": LINK 확인됨 → verified=true, 못 함 → error=<code>)
  useEffect(() => {
    if (handled.current) return
    const verified = params.get('verified') === 'true'
    const code = params.get('error')
    if (!verified && !code) return
    handled.current = true
    params.delete('verified'); params.delete('error'); setParams(params, { replace: true })
    if (code) { setErr(SETTINGS_ERRORS[code] ?? SETTINGS_ERRORS.GOOGLE_VERIFICATION_FAILED); return }
    link.mutate(undefined, {
      onSuccess: () => setToast({ title: 'Google 계정이 연동되었어요', desc: '이제 Google로도 로그인할 수 있어요' }),
      onError: (e) => setErr(errorText(e, SETTINGS_ERRORS)),
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (account.isError) return <><PageHead title="Google 연동하기" sub="Google 계정과 연동해서 더 간편하게 로그인해 보세요." /><ErrorState error={account.error} onRetry={() => void account.refetch()} /></>
  const a = account.data
  const linked = !!a?.googleLinked
  const start = () => { setErr(null); setGoing(true); goGoogle(settingsApi.googleVerifyUrl('LINK'), (to) => nav(to)) }

  return (
    <>
      <PageHead title="Google 연동하기" sub="Google 계정과 연동해서 더 간편하게 로그인해 보세요." />
      <div className={s.card} aria-busy={account.isPending || link.isPending}>
        <div className={s.gStatus}>
          <span className={s.gTile} aria-hidden>G</span>
          <div className={s.gState}>
            <strong>연동 상태</strong>
            <div>
              {a && <span className={linked ? `${s.pill} ${s.pillOn}` : s.pill}>{linked ? '연동됨' : '연동되지 않음'}</span>}
              {linked && <span>{a?.googleEmail}</span>}
            </div>
          </div>
        </div>
        <p className={s.gDesc}>Google 계정을 연동하면 더 간편하게 로그인할 수 있고,<br />계정 복구도 쉽게 할 수 있어요.</p>
        {a && (linked ? (
          <>
            <button className={s.btnSoft} disabled={!a.canUnlinkGoogle || unlink.isPending} onClick={() => setConfirm(true)}>연동 해제</button>
            {!a.canUnlinkGoogle && <p className={s.reason}>Google로만 가입한 계정이라 연동을 해제하면 로그인할 방법이 없어져요. 그래서 해제할 수 없어요.</p>}
          </>
        ) : (
          <button className={s.btnMain} style={{ minWidth: 220 }} onClick={start} disabled={going || link.isPending}>
            {link.isPending ? '연동하는 중' : going ? 'Google로 이동 중' : 'Google 계정 연동'}
          </button>
        ))}
        {err && <p className={s.noteWarn} role="alert">{err}</p>}
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
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)}
        onConfirm={() => unlink.mutate(undefined, {
          onSuccess: () => setToast({ title: 'Google 연동이 해제되었어요' }),
          onError: (e) => setErr(errorText(e, SETTINGS_ERRORS)),
        })}
        title="Google 연동을 해제할까요?" desc="해제하면 Google 계정으로 로그인할 수 없어요. 이메일과 비밀번호로 로그인해 주세요." confirmLabel="해제" />
      <Toast open={!!toast} title={toast?.title ?? ''} desc={toast?.desc} onClose={() => setToast(null)} />
    </>
  )
}
