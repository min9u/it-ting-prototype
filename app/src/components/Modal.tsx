import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './Icons'
import styles from './Modal.module.css'

interface Props {
  open: boolean
  onClose: () => void
  width?: number
  labelledBy?: string
  children: ReactNode
  hideClose?: boolean
}

/** 공용 팝업. 배경 클릭·Esc로 닫힌다 */
export default function Modal({ open, onClose, width = 480, labelledBy, children, hideClose }: Props) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    box.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={box} className={styles.box} style={{ width }} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        {!hideClose && (
          <button className={styles.close} onClick={onClose} aria-label="닫기"><CloseIcon size={20} /></button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
