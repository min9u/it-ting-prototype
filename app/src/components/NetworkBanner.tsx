import { useEffect, useState } from 'react'
import { reportServerUp, useNetwork } from '../lib/network'
import styles from './NetworkBanner.module.css'

/**
 * 화면 맨 위 연결 안내 (모든 화면). docs/frontend-hardening.md "오프라인 · 서버 연결 끊김"
 * - 오프라인: "인터넷 연결이 끊겼어요" (브라우저 online/offline)
 * - 서버에 닿지 못함: API 계층이 lib/network.ts reportServerDown() 을 부르면 "서버와 연결이 고르지 않아요"
 * - 다시 연결되면 "다시 연결됐어요" 2초
 * 채팅 실시간 연결 상태는 채팅 화면 안 띠(ConnectionStrip)가 따로 보여 줌 (채팅 밖에서는 알림이 조금 늦을 뿐이라 여기선 안 띄움)
 */
export default function NetworkBanner() {
  const net = useNetwork()
  const bad = !net.online || net.serverDown
  const [back, setBack] = useState(false)
  const [wasBad, setWasBad] = useState(false)
  useEffect(() => {
    if (bad) { setWasBad(true); setBack(false); return }
    if (!wasBad) return
    setWasBad(false)
    setBack(true)
    const t = setTimeout(() => setBack(false), 2000)
    return () => clearTimeout(t)
  }, [bad]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.wrap} data-show={bad || back ? '' : undefined} data-tone={bad ? 'warn' : 'ok'}>
      <p className={styles.bar} role="status" aria-live="polite">
        {!net.online
          ? <><strong>인터넷 연결이 끊겼어요.</strong> 연결되면 하던 일을 이어서 할 수 있어요. 쓰던 글은 지우지 말고 기다려 주세요.</>
          : net.serverDown
            ? <><strong>서버와 연결이 고르지 않아요.</strong> 잠시 뒤 저절로 다시 시도해요.</>
            : back ? <strong>다시 연결됐어요.</strong> : null}
        {net.online && net.serverDown && (
          <button type="button" className={styles.retry} onClick={() => { reportServerUp(); window.dispatchEvent(new Event('digul:retry')) }}>다시 시도</button>
        )}
      </p>
    </div>
  )
}
