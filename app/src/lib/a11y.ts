/**
 * 접근성 도우미 (docs/frontend-hardening.md "접근성").
 * - 전역 키 단축키(탐색 방향키·두더지 WASD·Enter 들어가기)는 글을 쓰는 중이거나 팝업이 열려 있으면 쉬어야 함
 * - 움직임 줄이기(prefers-reduced-motion) 설정을 JS 쪽(3D·스크롤 애니메이션)에서도 읽을 수 있게
 */

/**
 * 키를 그 요소가 직접 쓰는 대상인지: 글 입력(input·textarea·select·contenteditable·role=textbox 등)과
 * 화살표를 쓰는 위젯(role=tab·radio·option·menuitem·slider 등, input 의 라디오·범위 포함)
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  // input 은 종류와 관계없이 (글자 칸은 글을, 라디오·범위는 화살표를, 체크박스는 스페이스를 씀)
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  const role = el.getAttribute('role')
  if (role && /^(textbox|searchbox|combobox|spinbutton|slider|listbox|option|menu|menuitem|menuitemradio|menuitemcheckbox|radio|radiogroup|tab|tablist|tree|treeitem|grid|gridcell)$/.test(role)) return true
  // 탭 목록·라디오 묶음·메뉴 안의 버튼에 초점이 있으면 화살표는 그 묶음이 씀
  return typeof el.closest === 'function' && !!el.closest('[role="tablist"],[role="radiogroup"],[role="listbox"],[role="menu"],[role="menubar"],[role="slider"],[role="grid"],[role="tree"]')
}

/** 화면을 덮는 팝업(aria-modal)이 열려 있는지 */
export function modalOpen(): boolean {
  return typeof document !== 'undefined' && !!document.querySelector('[aria-modal="true"]')
}

/**
 * 전역 단축키를 받아도 되는지. 아래면 false:
 * 입력 중 · IME 조합 중(한글) · Alt/Ctrl/Meta 조합 · 팝업 열림(allowInModal 이 아니면) · 이미 다른 곳이 처리함(defaultPrevented)
 */
export function shortcutAllowed(e: KeyboardEvent, o: { allowInModal?: boolean } = {}): boolean {
  if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return false
  if (isTypingTarget(e.target)) return false
  if (!o.allowInModal && modalOpen()) return false
  return true
}

/** Enter·Space 가 그 요소 자체의 동작(버튼 누르기·링크 열기)인지 → 전역 Enter 단축키는 쉬어야 함 */
export function isActivatable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  return /^(BUTTON|A|SUMMARY)$/.test(el.tagName) || !!el.getAttribute('role')?.match(/^(button|link|tab|option|switch|checkbox)$/)
}

/* ---------- 움직임 줄이기 ---------- */
const QUERY = '(prefers-reduced-motion: reduce)'
const mql = () => (typeof matchMedia === 'function' ? matchMedia(QUERY) : null)

/** 지금 움직임 줄이기 설정인지 (한 번 읽기. 3D 장면을 만들 때 등) */
export function prefersReducedMotion(): boolean {
  return !!mql()?.matches
}

/** 설정이 바뀌면 알림 (React 훅은 lib/useReducedMotion.ts. 이 파일은 Worker 의 three/keys.ts 도 쓰므로 React 를 들이지 않음) */
export function subscribeReducedMotion(cb: () => void) {
  const m = mql()
  if (!m) return () => {}
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

/* ---------- 포커스 ---------- */
const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])',
  'textarea:not([disabled])', 'iframe', 'audio[controls]', 'video[controls]', '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** 상자 안에서 Tab 으로 갈 수 있는 요소들 (보이는 것만) */
export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute('inert') || el.closest('[inert]')) return false
    if (el.getAttribute('aria-hidden') === 'true') return false
    // display:none · visibility:hidden 은 빼기 (getClientRects 가 비면 안 보임)
    return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
  })
}
