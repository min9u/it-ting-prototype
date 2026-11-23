import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './Icons'
import { focusablesIn } from '../lib/a11y'
import styles from './Modal.module.css'

interface Props {
  open: boolean
  onClose: () => void
  width?: number
  labelledBy?: string
  children: ReactNode
  hideClose?: boolean
}

/**
 * 열린 팝업 쌓임 (팝업 위에 확인 팝업이 또 뜨는 경우). 맨 위 것만 Esc·Tab 을 받음.
 * 하나라도 열려 있으면 앱 바탕(#root)에 inert → 뒤 화면은 Tab·클릭·화면 읽기 프로그램에서 빠짐
 */
const stack: HTMLElement[] = []
function setBackgroundInert(on: boolean) {
  const root = document.getElementById('root')
  if (!root) return
  if (on) root.setAttribute('inert', '')
  else root.removeAttribute('inert')
}

/**
 * 공용 팝업. 배경 클릭·Esc로 닫힌다. 접근성 (docs/frontend-hardening.md "접근성"):
 * - 열면 팝업 상자에 초점 (안에 autoFocus 칸이 있으면 그 칸). 제목(labelledBy)을 읽어 줌
 * - Tab · Shift+Tab 은 팝업 안에서만 돎 (포커스 가두기), 뒤 화면은 inert
 * - 닫으면 열기 전에 초점이 있던 버튼으로 돌아감
 * - 팝업 위에 팝업이 뜨면 맨 위 것만 Esc 로 닫힘
 */
export default function Modal({ open, onClose, width = 480, labelledBy, children, hideClose }: Props) {
  const box = useRef<HTMLDivElement>(null)
  // onClose 는 부를 때마다 새 함수일 수 있음 → ref 로 (예전에는 effect 가 다시 돌면서 상자에 초점을 다시 줘서 안의 입력칸 초점을 뺏었음)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const el = box.current
    if (!el) return
    const returnTo = document.activeElement as HTMLElement | null
    stack.push(el)
    setBackgroundInert(true)
    // autoFocus 칸이 이미 초점을 받았으면 그대로, 아니면 상자
    if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>('[data-autofocus]') ?? el).focus()

    const top = () => stack[stack.length - 1] === el
    const onKey = (e: KeyboardEvent) => {
      if (!top()) return
      if (e.key === 'Escape') {
        // 입력 중 한글 조합을 끝내는 Esc 는 넘김
        if (e.isComposing) return
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusablesIn(el)
      if (items.length === 0) { e.preventDefault(); el.focus(); return }
      const first = items[0], last = items[items.length - 1]
      const at = document.activeElement
      if (e.shiftKey && (at === first || at === el || !el.contains(at))) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (at === last || !el.contains(at))) { e.preventDefault(); first.focus() }
    }
    // 초점이 어떻게든 밖으로 나가면(스크립트·브라우저 UI) 다시 안으로
    const onFocusIn = (e: FocusEvent) => {
      if (!top()) return
      const t = e.target as Node | null
      if (t && !el.contains(t) && !(t as HTMLElement).closest?.('[role="dialog"]')) el.focus()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('focusin', onFocusIn)
      const i = stack.lastIndexOf(el)
      if (i >= 0) stack.splice(i, 1)
      if (stack.length === 0) setBackgroundInert(false)
      // 연 버튼으로 초점 돌려주기 (그 버튼이 아직 화면에 있고, 초점이 다른 데로 옮겨지지 않았을 때)
      const now = document.activeElement
      const lost = !now || now === document.body || el.contains(now)
      if (lost && returnTo && returnTo.isConnected && typeof returnTo.focus === 'function') {
        // inert 가 풀린 다음 틱에 (풀리기 전에는 초점을 못 받음)
        setTimeout(() => { if (returnTo.isConnected && !returnTo.closest('[inert]')) returnTo.focus({ preventScroll: true }) }, 0)
      }
    }
  }, [open])

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
