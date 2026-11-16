import { useEffect, useRef, useState } from 'react'
import { realtime, useRealtimeStatus } from '../realtime'
import styles from './ConnectionStrip.module.css'

/**
 * 실시간 연결 상태 띠 (채팅 대화 창 위). docs/frontend-hardening.md "실시간"
 * - 다시 연결하는 중: "연결이 끊겼어요. 다시 연결하는 중…" + 다음 시도까지 초 + "지금 다시 연결"
 * - 오프라인: "인터넷 연결이 끊겼어요" (연결되면 저절로 이어 붙음)
 * - 다시 붙으면 "다시 연결됐어요"를 2초 보여 주고 사라짐
 * 잠깐 끊겼다 붙는 경우(0.8초 안)는 깜빡이지 않게 띄우지 않음. 탭이 오래 숨겨져 일부러 끊은 것(paused)은 안 띄움
 */
const GRACE_MS = 800
const BACK_MS = 2000

export default function ConnectionStrip() {
  const st = useRealtimeStatus()
  const bad = st.state === 'reconnecting' || st.state === 'offline'
  const [show, setShow] = useState(false)
  const [back, setBack] = useState(false)
  const wasShown = useRef(false)
  const [, tick] = useState(0)

  // 끊김이 GRACE_MS 넘게 이어질 때만 띄움
  useEffect(() => {
    if (!bad) return
    const t = setTimeout(() => setShow(true), GRACE_MS)
    return () => clearTimeout(t)
  }, [bad])
  useEffect(() => {
    if (bad) return
    setShow(false)
    if (st.state === 'open' && wasShown.current) {
      setBack(true)
      const t = setTimeout(() => setBack(false), BACK_MS)
      return () => clearTimeout(t)
    }
  }, [bad, st.state])
  useEffect(() => { if (show) wasShown.current = true; else if (!bad) wasShown.current = false }, [show, bad])
  // 남은 초 다시 그리기
  useEffect(() => {
    if (!show || st.state !== 'reconnecting') return
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [show, st.state])

  const tone = show && bad ? 'warn' : back ? 'ok' : null
  const left = tone === 'warn' && st.state === 'reconnecting' && st.nextRetryAt ? Math.max(0, Math.ceil((st.nextRetryAt - Date.now()) / 1000)) : 0
  // 읽어 주는 영역(role=status)은 늘 그려 두고 글만 바꿈 (새로 생긴 영역은 화면 읽기 프로그램이 놓칠 수 있음). 남은 초는 읽지 않음
  return (
    <div className={tone ? styles.strip : styles.empty} data-tone={tone ?? undefined}>
      {tone && <span className={styles.dot} aria-hidden />}
      <span className={styles.text} role="status" aria-live="polite">
        {tone === 'warn' && (st.state === 'offline'
          ? <><strong>인터넷 연결이 끊겼어요.</strong> 연결되면 저절로 다시 이어지고, 보낸 메시지도 그때 보내요.</>
          : <><strong>{st.everOpened ? '연결이 끊겼어요.' : '채팅 서버에 연결하지 못했어요.'}</strong> 다시 연결하는 중…</>)}
        {tone === 'ok' && <><strong>다시 연결됐어요.</strong> 놓친 메시지를 받아 왔어요.</>}
      </span>
      {left > 0 && <small className={styles.left} aria-hidden>{left}초 뒤 다시 시도</small>}
      {tone === 'warn' && <button type="button" className={styles.retry} onClick={() => realtime().retryNow()}>지금 다시 연결</button>}
    </div>
  )
}
