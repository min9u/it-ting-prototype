import { useState } from 'react'
import { setAuthState } from '../../data/auth'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/Feedback'
import { hasPassword, LEAVE_REASONS, useAccount, withdraw } from '../../data/account'
import { MEETUPS, ME_ID } from '../../data/mock'
import { dateLabel } from '../../lib/format'
import { GoogleSignInDialog, PageHead, PwInput, useUnsavedGuard } from './SettingsParts'
import s from './Settings.module.css'

/**
 * 설정 – 회원 탈퇴 · Google 계정 · 탈퇴 확인 (F10)
 * - 탈퇴 안내: 지워지는 것 / 남는 것("탈퇴한 사용자"로 표시) / 내가 연 예정 모임이 있으면 탈퇴 불가
 * - 탈퇴 사유: 선택. 골라도 안 골라도 됨
 * - 본인 확인: 이메일 계정은 비밀번호, Google로만 가입한 계정은 "Google로 다시 인증"(가입한 계정이어야 함)
 * - 동의 체크 + 본인 확인이 끝나야 "회원 탈퇴" → 확인 팝업 → 탈퇴하기 → 로그아웃되고 랜딩(F1)
 * 데모용 쿼리: ?hosting=0 (내가 연 예정 모임이 없는 경우)
 */
export function LeavePage() {
  const acc = useAccount()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const pwAccount = hasPassword(acc)
  const [reason, setReason] = useState('')
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState(false)
  const [gDone, setGDone] = useState(false)
  const [gErr, setGErr] = useState(false)
  const [gOpen, setGOpen] = useState(false)
  const [agree, setAgree] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const guard = useUnsavedGuard(!leaving && !!(reason || pw || agree || gDone))

  // 내가 연 예정 모임 (지나지 않았고 취소되지 않은 것)
  const hosting = params.get('hosting') === '0' ? [] : MEETUPS.filter((m) => m.hostId === ME_ID && !m.past && !m.cancelled)
  const authed = pwAccount ? !!pw : gDone
  const ready = authed && agree && hosting.length === 0

  const submit = () => {
    if (!ready) return
    if (pwAccount && pw !== acc.password) { setPwErr(true); return }
    setConfirm(true)
  }

  return (
    <>
      <PageHead title="회원 탈퇴" sub="탈퇴하기 전에 아래 내용을 꼭 확인해 주세요." />
      <form className={s.card} onSubmit={(e) => { e.preventDefault(); submit() }}>
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
            </ul>
          </div>
        </div>
        {hosting.length > 0 && (
          <div className={s.hostAlert} role="alert">
            내가 연 예정 모임이 {hosting.length}개 있어서 지금은 탈퇴할 수 없어요:{' '}
            {hosting.map((m, i) => (
              <span key={m.id}>{i > 0 && ', '}<Link to={`/meetups/${m.id}`}>‘{m.title}’</Link> ({dateLabel(m.date)})</span>
            ))}
            . 모임을 삭제하거나 취소한 뒤 다시 와 주세요.
            {/* 프로토타입: 모임 쪽 삭제가 저장되지 않아 흐름을 보려면 건너뛰기 */}
            <button type="button" onClick={() => setParams({ hosting: '0' })}>(프로토타입) 모임이 없는 경우 보기</button>
          </div>
        )}
        <div className={s.divider} />
        <div className={s.formRow}>
          <label htmlFor="leave-reason" className={s.formLabel}>탈퇴 사유<small>(선택)</small></label>
          <select id="leave-reason" className={s.select} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">탈퇴 사유를 골라 주세요.</option>
            {LEAVE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {pwAccount ? (
          <div className={s.formRow}>
            <label htmlFor="leave-pw">비밀번호 확인</label>
            <div>
              <PwInput id="leave-pw" value={pw} onChange={(v) => { setPw(v); setPwErr(false) }} invalid={pwErr} autoComplete="current-password" />
              {pwErr && <p className={s.fieldMsg}>비밀번호가 맞지 않아요. 다시 입력해 주세요.</p>}
            </div>
          </div>
        ) : (
          <div className={s.formRow}>
            <span className={s.formLabel} style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-display)' }}>Google 인증</span>
            <div>
              <div className={s.authRow}>
                <button type="button" className={s.btnCancel} style={{ minWidth: 200, height: 44 }} onClick={() => setGOpen(true)} disabled={gDone}>
                  {gDone ? '인증 완료' : 'Google로 다시 인증'}
                </button>
                {gDone ? <span className={s.authDone}>{acc.googleEmail} 계정으로 인증했어요.</span>
                  : <span className={s.fieldHint} style={{ marginTop: 0 }}>인증을 마치면 “회원 탈퇴” 버튼이 켜져요.</span>}
              </div>
              {gErr && <p className={s.fieldMsg}>가입한 Google 계정({acc.googleEmail})으로 인증해 주세요.</p>}
            </div>
          </div>
        )}
        <div className={s.divider} />
        <label className={s.agree}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          안내 사항을 모두 확인했고 회원 탈퇴에 동의해요.
        </label>
        <div className={s.actions}>
          <button type="button" className={s.btnCancel} onClick={() => navigate(-1)}>취소</button>
          <button type="submit" className={s.btnDanger} disabled={!ready}>회원 탈퇴</button>
        </div>
      </form>
      {guard}
      <GoogleSignInDialog open={gOpen} onClose={() => setGOpen(false)} onPick={(email) => {
        setGOpen(false)
        if (email === acc.googleEmail) { setGDone(true); setGErr(false) } else setGErr(true)
      }} />
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)}
        onConfirm={() => { setLeaving(true); withdraw(reason || null); setAuthState('guest'); setTimeout(() => navigate('/start', { replace: true }), 0) }}
        title="정말 탈퇴할까요?" desc="탈퇴하면 계정을 되돌릴 수 없어요." confirmLabel="탈퇴하기" />
    </>
  )
}
