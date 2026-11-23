import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from '@/lib/nav'
import { ConfirmDialog } from '../../components/Feedback'
import { ErrorState } from '../../components/AsyncState'
import { isApiError } from '../../api/client'
import { errorText, fieldErrorText } from '../../api/common'
import { goGoogle } from '../../api/auth'
import {
  SETTINGS_ERRORS, SETTINGS_IS_MOCK, WITHDRAW_REASONS, settingsApi, useAccount, useWithdraw, useWithdrawalCheck, type WithdrawReason,
} from '../../api/settings'
import { afterWithdraw } from '../../lib/signOut'
import { dateLabel } from '../../lib/format'
import { seoulYmd } from '../../lib/time'
import { PageHead, PwInput, useUnsavedGuard } from './SettingsParts'
import s from './Settings.module.css'

const codeOf = (e: unknown) => (isApiError(e) ? e.code : '')

/** Google 에 다녀오면 화면이 새로 열리므로, 고른 사유 · 동의를 이 탭에 잠깐 둔다 (10 "Google 확인": 프론트가 다시 보여 줌) */
const DRAFT_KEY = 'digul.leaveDraft'
type Draft = { reason: WithdrawReason | ''; agree: boolean }
function readDraft(): Draft | null {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') } catch { return null }
}
function clearDraft() { try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* 무시 */ } }
function saveDraft(d: Draft) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* 저장소가 막힌 곳 */ } }

/**
 * 설정 – 회원 탈퇴 · Google 계정 · 탈퇴 확인 (10)
 * - 열 때 GET /me/account(본인 확인 방법 = hasPassword) · GET /me/withdrawal-check(탈퇴를 막는 내 예정 모임 · Google 인증 여부)
 * - 탈퇴 안내 (글은 프론트가 가짐) · 내가 연 예정 모임이 있으면 이름을 보여 주고(누르면 모임 상세) 버튼을 끔
 * - 탈퇴 사유: 선택, 여섯 가지 (서버에는 코드)
 * - 본인 확인: 비밀번호 계정은 비밀번호(맞는지는 "탈퇴하기"에서), Google로만 가입한 계정은 "Google로 다시 인증"
 *   → GET /oauth/google/verify?purpose=WITHDRAW 로 이동 → 돌아오면 withdrawal-check 의 isGoogleVerified 로 "인증 완료" (10분)
 * - 동의 체크 + 본인 확인이 끝나야 "회원 탈퇴" → 확인 팝업 → 탈퇴하기(POST /me/withdraw) → 로그아웃된 상태로 랜딩(F1)
 * 데모용 쿼리 (목 서버): ?hosting=0 (내가 연 예정 모임이 없는 경우)
 */
export function LeavePage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const account = useAccount()
  const check = useWithdrawalCheck()
  const withdraw = useWithdraw()
  const [draft] = useState(readDraft) // 지우기는 효과에서 (개발 모드 StrictMode 가 초기값 함수를 두 번 부름)
  const [reason, setReason] = useState<WithdrawReason | ''>(draft?.reason ?? '')
  const [agree, setAgree] = useState(draft?.agree ?? false)
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [gErr, setGErr] = useState<string | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  /** 화면을 떠나는 중 (Google 로 · 탈퇴 뒤 랜딩으로). 저장 전 취소 확인을 끄고 다음 렌더에서 이동 */
  const [leaveTo, setLeaveTo] = useState<{ kind: 'google' | 'done'; to: string } | null>(null)
  const guard = useUnsavedGuard(!leaveTo && !!(reason || pw || agree))
  const handled = useRef(false)

  // Google 에서 돌아온 주소의 error (GOOGLE_ACCOUNT_MISMATCH · GOOGLE_VERIFICATION_FAILED)
  useEffect(() => {
    if (handled.current) return
    handled.current = true
    clearDraft()
    const code = params.get('error')
    if (!code) return
    setGErr(SETTINGS_ERRORS[code] ?? SETTINGS_ERRORS.GOOGLE_VERIFICATION_FAILED)
    params.delete('error'); setParams(params, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!leaveTo) return
    if (leaveTo.kind === 'google') goGoogle(leaveTo.to, (to) => navigate(to))
    else { navigate(leaveTo.to, { replace: true }); void afterWithdraw() }
  }, [leaveTo, navigate])

  if (account.isError || check.isError) {
    return (
      <>
        <PageHead title="회원 탈퇴" sub="탈퇴하기 전에 아래 내용을 꼭 확인해 주세요." />
        <ErrorState error={account.error ?? check.error} onRetry={() => { void account.refetch(); void check.refetch() }} />
      </>
    )
  }
  const pwAccount = account.data?.hasPassword ?? true
  const hosting = check.data?.hosting ?? []
  const googleVerified = !!check.data?.googleVerified
  const authed = pwAccount ? !!pw : googleVerified
  const ready = !!account.data && !!check.data && check.data.canWithdraw && authed && agree && !withdraw.isPending

  const startGoogle = () => {
    setGErr(null)
    saveDraft({ reason, agree })
    setLeaveTo({ kind: 'google', to: settingsApi.googleVerifyUrl('WITHDRAW') })
  }
  const doWithdraw = () => {
    setFormErr(null)
    withdraw.mutate({ ...(pwAccount ? { password: pw } : {}), reason: reason || null }, {
      onSuccess: () => setLeaveTo({ kind: 'done', to: '/start' }),
      onError: (e) => {
        const code = codeOf(e)
        if (code === 'CURRENT_PASSWORD_MISMATCH') setPwErr('비밀번호가 맞지 않아요. 다시 입력해 주세요.')
        else if (code === 'GOOGLE_VERIFICATION_REQUIRED') { setGErr(SETTINGS_ERRORS.GOOGLE_VERIFICATION_REQUIRED); void check.refetch() }
        else if (code === 'HOSTING_MEETUP_EXISTS') { setFormErr(SETTINGS_ERRORS.HOSTING_MEETUP_EXISTS); void check.refetch() }
        else if (code === 'INVALID_INPUT' && fieldErrorText(e, 'password')) setPwErr(fieldErrorText(e, 'password'))
        else setFormErr(errorText(e, SETTINGS_ERRORS))
      },
    })
  }

  return (
    <>
      <PageHead title="회원 탈퇴" sub="탈퇴하기 전에 아래 내용을 꼭 확인해 주세요." />
      <form className={s.card} onSubmit={(e) => { e.preventDefault(); if (ready) setConfirm(true) }} aria-busy={account.isPending || check.isPending}>
        <div className={`${s.infoBox} ${s.warn}`} style={{ marginTop: 0 }}>
          <span className={s.infoIcon} aria-hidden>!</span>
          <div className={s.infoBody}>
            <h3>회원 탈퇴 전에 꼭 확인해 주세요</h3>
            <ul>
              <li>계정, 프로필, 내 땅굴, 단골, 대화 요청은 지워지고 되돌릴 수 없어요.</li>
              <li>커뮤니티 글 · 댓글, 방명록 글, 채팅 메시지는 남고 “탈퇴한 사용자”로 표시돼요.</li>
              <li>내가 연 예정 모임이 있으면 먼저 삭제하거나 취소해야 탈퇴할 수 있어요.</li>
              <li>참여 확정 · 신청 대기 중인 예정 모임은 탈퇴와 함께 참여 취소 · 신청 취소로 처리돼요.</li>
              <li>찜 · 좋아요 · 저장은 지워지고, 지난 모임 기록에는 “탈퇴한 사용자”로 남아요.</li>
              <li>들어 있던 대화방에는 “탈퇴했습니다” 안내가 남고, 내가 받은 알림은 지워져요.</li>
              <li>탈퇴한 뒤 같은 Mattermost 계정으로 다시 가입할 수 있지만, 새 계정으로 시작해요.</li>
            </ul>
          </div>
        </div>
        {hosting.length > 0 && (
          <div className={s.hostAlert} role="alert">
            내가 연 예정 모임이 {hosting.length}개 있어서 지금은 탈퇴할 수 없어요:{' '}
            {hosting.map((m, i) => (
              <span key={m.id}>{i > 0 && ', '}<Link to={`/meetups/${m.id}`}>‘{m.title}’</Link> ({dateLabel(seoulYmd(m.startsAt))})</span>
            ))}
            . 먼저 모임을 삭제하거나 취소해 주세요.
            {/* 목 서버: 모임 쪽 삭제가 저장되지 않아 흐름을 보려면 건너뛰기 */}
            {SETTINGS_IS_MOCK && <button type="button" onClick={() => { setParams({ hosting: '0' }); setTimeout(() => void check.refetch(), 0) }}>(체험용) 모임이 없는 경우 보기</button>}
          </div>
        )}
        <div className={s.divider} />
        <div className={s.formRow}>
          <label htmlFor="leave-reason" className={s.formLabel}>탈퇴 사유<small>(선택)</small></label>
          <select id="leave-reason" className={s.select} value={reason} onChange={(e) => setReason(e.target.value as WithdrawReason | '')}>
            <option value="">탈퇴 사유를 골라 주세요.</option>
            {WITHDRAW_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>
        {pwAccount ? (
          <div className={s.formRow}>
            <label htmlFor="leave-pw">비밀번호 확인</label>
            <div>
              <PwInput id="leave-pw" value={pw} onChange={(v) => { setPw(v); setPwErr(null) }} invalid={!!pwErr} autoComplete="current-password" />
              {pwErr && <p className={s.fieldMsg}>{pwErr}</p>}
            </div>
          </div>
        ) : (
          <div className={s.formRow}>
            <span className={s.formLabel} style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-display)' }}>Google 인증</span>
            <div>
              <div className={s.authRow}>
                <button type="button" className={s.btnCancel} style={{ minWidth: 200, height: 44 }} onClick={startGoogle} disabled={googleVerified || !!leaveTo}>
                  {googleVerified ? '인증 완료' : 'Google로 다시 인증'}
                </button>
                {googleVerified ? <span className={s.authDone}>{account.data?.googleEmail} 계정으로 인증했어요. 10분 안에 탈퇴를 마쳐 주세요.</span>
                  : <span className={s.fieldHint} style={{ marginTop: 0 }}>가입한 Google 계정으로 인증을 마치면 “회원 탈퇴” 버튼이 켜져요.</span>}
              </div>
              {gErr && <p className={s.fieldMsg}>{gErr}</p>}
            </div>
          </div>
        )}
        <div className={s.divider} />
        <label className={s.agree}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          안내 사항을 모두 확인했고 회원 탈퇴에 동의해요.
        </label>
        {formErr && <p className={s.noteWarn} role="alert">{formErr}</p>}
        <div className={s.actions}>
          <button type="button" className={s.btnCancel} onClick={() => navigate(-1)}>취소</button>
          <button type="submit" className={s.btnDanger} disabled={!ready} aria-busy={withdraw.isPending}>{withdraw.isPending ? '탈퇴하는 중' : '회원 탈퇴'}</button>
        </div>
      </form>
      {guard}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={doWithdraw}
        title="정말 탈퇴할까요?" desc="탈퇴하면 로그아웃되고 계정을 되돌릴 수 없어요." confirmLabel="탈퇴하기" />
    </>
  )
}
