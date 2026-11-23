import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { startEventStream, stopEventStream } from '../realtime/events'
import { useEventStreamStatus } from '../realtime/useEventStream'
import { useNetwork } from '../lib/network'
import { chatKeys } from '../api/chat'
import styles from './ConnectionStrip.module.css'

/**
 * 실시간 소식 연결(SSE, 명세 v1 GET /me/event-stream) 상태 띠 (채팅 대화 창 위). docs/backend/api-v1/06-chat.md
 * - 끊겨서 다시 붙는 중: "연결이 끊겼어요. 다시 연결하는 중…" + "지금 다시 연결"
 * - 오프라인: "인터넷 연결이 끊겼어요"
 * - 다시 붙으면 "다시 연결됐어요"를 2초 (놓친 메시지는 조회 API 로 받아 옴: useChatEvents 의 useRefetchOnReconnect)
 * 메시지 보내기는 REST 라 연결이 끊겨도 보낼 수 있다 (실패하면 메시지 옆 "다시 보내기")
 * 잠깐 끊겼다 붙는 경우(0.8초 안)는 깜빡이지 않게 띄우지 않음
 */
const GRACE_MS = 800
const BACK_MS = 2000

export default function ConnectionStrip() {
  const qc = useQueryClient()
  const st = useEventStreamStatus()
  const { online } = useNetwork()
  const bad = !online || st === 'reconnecting' || st === 'connecting'
  const [show, setShow] = useState(false)
  const [back, setBack] = useState(false)
  const wasShown = useRef(false)

  // 끊김이 GRACE_MS 넘게 이어질 때만 띄움
  useEffect(() => {
    if (!bad) return
    const t = setTimeout(() => setShow(true), GRACE_MS)
    return () => clearTimeout(t)
  }, [bad])
  useEffect(() => {
    if (bad) return
    setShow(false)
    if (st === 'open' && wasShown.current) {
      setBack(true)
      const t = setTimeout(() => setBack(false), BACK_MS)
      return () => clearTimeout(t)
    }
  }, [bad, st])
  useEffect(() => { if (show) wasShown.current = true; else if (!bad) wasShown.current = false }, [show, bad])

  /** 기다리지 않고 바로 다시 연결. 새로 연 연결은 "다시 붙음"으로 치지 않으므로 채팅 캐시를 직접 새로 받음 */
  const retryNow = () => {
    stopEventStream()
    startEventStream()
    void qc.invalidateQueries({ queryKey: chatKeys.all })
  }

  const tone = show && bad ? 'warn' : back ? 'ok' : null
  // 읽어 주는 영역(role=status)은 늘 그려 두고 글만 바꿈 (새로 생긴 영역은 화면 읽기 프로그램이 놓칠 수 있음)
  return (
    <div className={tone ? styles.strip : styles.empty} data-tone={tone ?? undefined}>
      {tone && <span className={styles.dot} aria-hidden />}
      <span className={styles.text} role="status" aria-live="polite">
        {tone === 'warn' && (!online
          ? <><strong>인터넷 연결이 끊겼어요.</strong> 연결되면 새 메시지를 다시 받아 와요.</>
          : <><strong>{st === 'connecting' ? '채팅 서버에 연결하지 못했어요.' : '연결이 끊겼어요.'}</strong> 다시 연결하는 중… 새 메시지가 늦게 보일 수 있어요.</>)}
        {tone === 'ok' && <><strong>다시 연결됐어요.</strong> 놓친 메시지를 받아 왔어요.</>}
      </span>
      {tone === 'warn' && online && <button type="button" className={styles.retry} onClick={retryNow}>지금 다시 연결</button>}
    </div>
  )
}
