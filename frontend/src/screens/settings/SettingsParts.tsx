import { useState, type ReactNode } from 'react'
import { useBlocker } from '@/lib/nav'
import Modal from '../../components/Modal'
import s from './Settings.module.css'

/* 설정 화면들이 같이 쓰는 조각 */

/** 본문 제목 + 부제 */
export function PageHead({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <h2 className={s.title}>{title}</h2>
      <p className={s.subtitle}>{sub}</p>
    </>
  )
}

/**
 * 00 공통 18 저장 전 취소: 입력하던 내용이 있는데 다른 메뉴로 나가려 하면
 * "아직 저장되지 않았습니다" → 나가기(버리고 이동) / 계속 수정(× · 바깥 · ESC 도 같음)
 */
export function useUnsavedGuard(dirty: boolean): ReactNode {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  const open = blocker.state === 'blocked'
  const stay = () => blocker.reset?.()
  return (
    <Modal open={open} onClose={stay} width={400} labelledBy="unsaved-title" hideClose>
      <div style={{ padding: '26px 24px 24px', background: '#fffaf5', borderRadius: 16 }}>
        <h2 id="unsaved-title" className="display" style={{ fontSize: 21 }}>아직 저장되지 않았습니다</h2>
        <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: 'var(--ink-700)' }}>지금 나가면 입력한 내용이 사라져요.</p>
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn btn-line" style={{ height: 46 }} onClick={() => blocker.proceed?.()}>나가기</button>
          <button className="btn btn-primary" style={{ height: 46 }} onClick={stay}>계속 수정</button>
        </div>
      </div>
    </Modal>
  )
}

/** 눈 아이콘 (비밀번호 보기 / 숨기기) */
export function PwInput({ id, value, onChange, invalid, placeholder, autoComplete }: {
  id: string; value: string; onChange: (v: string) => void; invalid?: boolean; placeholder?: string; autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className={s.inputWrap}>
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined} placeholder={placeholder} autoComplete={autoComplete} />
      <button type="button" className={s.eye} onClick={() => setShow((v) => !v)} aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
          {!show && <path d="M4 20L20 4" />}
        </svg>
      </button>
    </div>
  )
}
