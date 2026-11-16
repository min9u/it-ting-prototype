import { useEffect, useState, type ReactNode } from 'react'
import logo from '../assets/logo.png'
import mound from '../assets/mole-mound.png'
import styles from './DeviceGate.module.css'

/** 이 폭보다 좁은 창도 데스크톱이 아니라고 본다 (휴대폰 · 태블릿은 UA 로 먼저 걸러냄) */
export const MIN_DESKTOP_WIDTH = 768
const BYPASS_KEY = 'digul.device.any'

/** 휴대폰 · 태블릿(아이패드 데스크톱 모드 포함) 이거나 창이 너무 좁으면 true */
export function isUnsupportedDevice() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  const mobile = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  return mobile || window.innerWidth < MIN_DESKTOP_WIDTH
}

function bypassed() {
  try {
    if (/[?&]device=any\b/.test(window.location.href)) sessionStorage.setItem(BYPASS_KEY, '1')
    return sessionStorage.getItem(BYPASS_KEY) === '1'
  } catch { return false }
}

/**
 * 00 공통 20 지원 기기: 이번 범위는 데스크톱 웹만. 휴대폰 · 태블릿으로 열면(비밀번호 재설정 링크, 공유 링크 포함)
 * 서비스 화면 대신 "PC에서 이용해 주세요" 안내만 보여준다.
 * 개발 확인용: 주소에 ?device=any 를 붙이면 이 탭에서는 안내를 건너뜀
 */
export default function DeviceGate({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState(() => !bypassed() && isUnsupportedDevice())
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (bypassed()) return
    const on = () => setBlocked(isUnsupportedDevice())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  if (!blocked) return <>{children}</>
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true) } catch { setCopied(false) }
  }
  return (
    <main className={styles.page}>
      <img className={styles.logo} src={logo} alt="디굴디굴" width={92} height={48} />
      <img className={styles.mole} src={mound} alt="" width={150} height={150} />
      <h1 className="display">PC에서 이용해 주세요</h1>
      <p>디굴디굴은 지금 데스크톱 웹에서만 쓸 수 있어요.<br />컴퓨터 브라우저에서 같은 주소로 들어와 주세요.</p>
      <button className="btn btn-line" onClick={copy}>{copied ? '주소를 복사했어요' : '주소 복사하기'}</button>
    </main>
  )
}
