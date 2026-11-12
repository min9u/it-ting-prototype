import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import Modal from './Modal'
import styles from './Feedback.module.css'
import mound from '../assets/mole-mound.png'   // Figma 빈 상태 그림 (알림 페이지 569:7860 에서 잘라 씀)

/**
 * 확인 팝업 621:3238 (Type=기본 400×183 · Type=신고 400×361)
 * 쓰는 곳: 방명록 삭제 610:12456 · 게시물 삭제 610:12231 · 게시물 신고 610:12558
 */
export function ConfirmDialog({ open, title, desc, confirmLabel = '삭제', tone = 'danger', onConfirm, onClose }: {
  open: boolean
  title: string
  desc: string
  confirmLabel?: string
  tone?: 'danger' | 'accent'
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} width={400} labelledBy="confirm-title" hideClose>
      <div className={styles.confirm}>
        <h2 id="confirm-title" className="display">{title}</h2>
        <p>{desc}</p>
        <div className={styles.actions}>
          <button className="btn btn-line" onClick={onClose}>취소</button>
          <button className={`btn ${tone === 'danger' ? 'btn-danger' : styles.report}`} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  )
}

export const REPORT_REASONS = ['스팸·홍보', '욕설·비하·괴롭힘', '음란물', '기타'] as const

/** 확인 팝업 Type=신고: 사유를 골라야 버튼이 켜진다 */
export function ReportDialog({ open, target = '게시물', onConfirm, onClose }: {
  open: boolean; target?: string; onConfirm: (reason: string) => void; onClose: () => void
}) {
  const [reason, setReason] = useState<string | null>(null)
  useEffect(() => { if (open) setReason(null) }, [open])
  return (
    <Modal open={open} onClose={onClose} width={400} labelledBy="report-title" hideClose>
      <div className={styles.confirm}>
        <h2 id="report-title" className="display">이 {target}을 신고할까요?</h2>
        <p>신고 사유를 골라 주세요. 신고한 사람은 상대에게 알려지지 않아요.</p>
        <div className={styles.reasons} role="radiogroup" aria-label="신고 사유">
          {REPORT_REASONS.map((r) => (
            <label key={r} className={reason === r ? styles.reasonOn : styles.reason}>
              <input type="radio" name="report" checked={reason === r} onChange={() => setReason(r)} />
              <span className={styles.radio} aria-hidden />
              {r}
            </label>
          ))}
        </div>
        <div className={styles.actions}>
          <button className="btn btn-line" onClick={onClose}>취소</button>
          <button className={`btn ${styles.report}`} disabled={!reason} onClick={() => { if (reason) { onConfirm(reason); onClose() } }}>신고하기</button>
        </div>
      </div>
    </Modal>
  )
}

/** 토스트 내용 (title·desc·action) */
export interface ToastSpec { title: string; desc?: string; action?: { label: string; to: string } }

/**
 * Toast 컴포넌트 6종 (2026-11-12 Figma 754:13592): 대화 요청 · 참여 신청 · 게시글 등록 · 수정 · 삭제 · 신고
 * 문구는 여기 한 곳에서 씀. 대화 요청은 상대 닉네임이 들어가서 함수
 */
export const TOAST = {
  chatRequest: (nick: string): ToastSpec => ({ title: '대화 요청이 완료되었어요', desc: `${nick}님이 수락하면 채팅에서 알려드릴게요`, action: { label: '채팅 보기', to: '/chat/requests?dir=sent' } }),
  applied: { title: '참여 신청이 완료되었어요', desc: '주최자가 확인하면 알림으로 알려드릴게요', action: { label: '신청 내역 보기', to: '/meetups/me?modal=pending' } } as ToastSpec,
  posted: (to: string): ToastSpec => ({ title: '게시글이 등록되었어요', desc: '게시판에서 바로 확인할 수 있어요', action: { label: '글 보기', to } }),
  edited: { title: '수정이 완료되었어요', desc: '변경한 내용이 저장되었어요' } as ToastSpec,
  deleted: { title: '삭제가 완료되었어요', desc: '삭제한 내용은 되돌릴 수 없어요' } as ToastSpec,
  reported: { title: '신고가 접수되었어요', desc: '검토 후 결과를 알림으로 알려드릴게요' } as ToastSpec,
}

/**
 * 완료 토스트 621:3239 (227×47 기본형) — 대화 요청 완료 612:7718 · 참여 신청 완료 642:7955
 * 제목 + 설명 + 오른쪽 이동 버튼. 4초 뒤 사라진다.
 */
export function Toast({ open, title, desc, action, onClose, duration = 4000, placement = 'bottom' }: {
  open: boolean
  title: string
  desc?: string
  action?: { label: string; to: string }
  onClose: () => void
  duration?: number
  placement?: 'bottom' | 'top'
}) {
  useEffect(() => {
    if (!open) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [open, duration, onClose])
  if (!open) return null
  return createPortal(
    <div className={`${styles.toast} ${placement === 'top' ? styles.top : ''}`} role="status">
      <span className={styles.check} aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <span className={styles.text}>
        <strong>{title}</strong>
        {desc && <small>{desc}</small>}
      </span>
      {action && <Link to={action.to} className={styles.action} onClick={onClose}>{action.label}</Link>}
    </div>,
    document.body,
  )
}

/** 빈 상태 일러스트: 흙더미 속 두더지 (Illustration / 두더지 64×60) */
export function EmptyMole({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <img src={mound} alt="" width={72} height={72} />
      <p>{message}</p>
      {children}
    </div>
  )
}
