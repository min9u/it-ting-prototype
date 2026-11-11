import { useEffect, useState } from 'react'
import { router } from '../App'
import { browserSettings, detectGraphics } from '../lib/graphicsTier'
import s from './GpuNotice.module.css'

/*
 * 그래픽 가속이 꺼진 PC에서만 화면 아래에 뜨는 안내 띠 (docs/gpu-fallback-research.md 4번).
 * - 웹페이지는 chrome://settings 를 열 수 없음(실측) → 주소 복사 + 붙여넣기 안내
 * - 3D가 있는 화면(땅굴·탐색하기·온보딩 미리 보기)에서만, 글쓰기 화면에서는 띄우지 않음
 * - "이대로 볼게요"를 누르면 기억. 다음에 가속이 켜져 있으면 "선명해졌어요" 한 번
 */

const KEY_DISMISS = 'digul.gpuNotice.dismissed'
const KEY_SEEN_SOFT = 'digul.gpuNotice.wasSoftware'

const store = {
  get(k: string) { try { return localStorage.getItem(k) } catch { return null } },
  set(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* 무시 */ } },
  del(k: string) { try { localStorage.removeItem(k) } catch { /* 무시 */ } },
}

const is3dPath = (p: string) => p.startsWith('/burrow') || p === '/onboarding/preview' || p === '/onboarding/building'

export default function GpuNotice() {
  const [path, setPath] = useState(router.state.location.pathname)
  const [dismissed, setDismissed] = useState(() => store.get(KEY_DISMISS) === '1')
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const [fixed, setFixed] = useState(false)
  const { tier } = detectGraphics()
  const cfg = browserSettings()

  useEffect(() => router.subscribe((st) => setPath(st.location.pathname)), [])

  useEffect(() => {
    if (tier === 'software') store.set(KEY_SEEN_SOFT, '1')
    else if (store.get(KEY_SEEN_SOFT) === '1') {
      // 지난번엔 꺼져 있었는데 지금은 켜짐 → 한 번만 축하
      store.del(KEY_SEEN_SOFT)
      store.del(KEY_DISMISS)
      setFixed(true)
      const t = setTimeout(() => setFixed(false), 4000)
      return () => clearTimeout(t)
    }
  }, [tier])

  if (fixed) {
    return <div className={s.toast} role="status">그래픽 가속이 켜졌어요. 이제 땅굴이 선명하고 부드럽게 움직여요!</div>
  }
  if (tier !== 'software' || dismissed || !is3dPath(path)) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cfg.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setOpen(true) // 복사가 막히면 주소를 직접 보여 줌 (아래 code 를 선택해서 복사)
    }
  }
  const dismiss = () => { store.set(KEY_DISMISS, '1'); setDismissed(true) }

  return (
    <aside className={s.bar} role="region" aria-label="그래픽 가속 안내">
      <div className={s.head}>
        <span className={s.icon} aria-hidden>🐢</span>
        <div className={s.text}>
          <strong>땅굴이 느리게 움직이나요?</strong>
          <span>지금 브라우저가 그래픽카드를 쓰지 않고 있어서 화질을 낮춰 보여 주고 있어요. 설정 하나만 켜면 선명하고 부드러워져요.</span>
        </div>
        <div className={s.actions}>
          <button type="button" className={s.primary} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? '접기' : '켜는 방법'}
          </button>
          <button type="button" className={s.ghost} onClick={dismiss}>이대로 볼게요</button>
        </div>
      </div>
      {open && (
        <ol className={s.steps}>
          <li>
            <span>아래 주소를 복사해서 <b>새 탭 주소창</b>에 붙여넣고 Enter</span>
            <span className={s.copyRow}>
              <code className={s.url}>{cfg.url}</code>
              <button type="button" className={s.copy} onClick={copy}>{copied ? '복사했어요' : '주소 복사'}</button>
            </span>
          </li>
          <li><span><b>{cfg.toggle}</b>을 켜기 ({cfg.menu})</span></li>
          <li><span>옆에 나오는 <b>다시 시작</b> 누르기. 열려 있던 탭은 그대로 돌아와요</span></li>
          <li className={s.note}>토글이 회색으로 잠겨 있으면 관리자가 막아 둔 PC예요. 이때는 지금 화질로 계속 볼 수 있어요.</li>
        </ol>
      )}
    </aside>
  )
}
