import { useEffect, useRef } from 'react'
import { mountChatRoom, type ChatMember, type ChatRoomHandle, type ChatRoomUi } from './chatRoomScene'

/**
 * 채팅 찻방 3D (docs/chat-room-3d.md). 3D 방 전체가 이 상자를 채움 (이름표도 이 안에 그림).
 * - 방(roomKey)이 바뀌면 새로 만듦. 같은 방에서 참여자·꾸민 것이 바뀌면 setMembers 로 (두더지 퐁/쏙 · 카메라 이동)
 * - speak = {id, n}: n 이 바뀔 때마다 그 사람이 말함 (메시지 보냄 · 받음)
 */
export default function ChatRoomCanvas({ roomKey, members, spoke, speak, ui, className, onPick, onOverflow, onReady }: {
  roomKey: string
  members: ChatMember[]
  spoke: Record<string, number>
  speak?: { id: string; n: number }
  ui: ChatRoomUi
  className?: string
  onPick(id: string): void
  onOverflow(n: number): void
  onReady(): void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const h = useRef<ChatRoomHandle | null>(null)
  const latest = useRef({ members, spoke, ui, onPick, onOverflow, onReady })
  latest.current = { members, spoke, ui, onPick, onOverflow, onReady }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let handle: ChatRoomHandle
    try {
      handle = mountChatRoom(el, {
        members: latest.current.members, spoke: latest.current.spoke, ui: latest.current.ui,
        onPick: (id) => latest.current.onPick(id), onOverflow: (n) => latest.current.onOverflow(n), onReady: () => latest.current.onReady(),
      })
    } catch (err) {
      console.warn('[3D] 채팅방을 만들지 못했어요', err) // WebGL 없음 → 2D 찻방 그림 그대로
      return
    }
    h.current = handle
    return () => { handle.dispose(); h.current = null }
  }, [roomKey])
  // 참여자 · 꾸민 것 · 말한 시각이 바뀜 (같은 방 안에서)
  const memberKey = members.map((m) => `${m.id}:${m.name}:${m.worn.join('+')}:${m.me ? 1 : 0}${m.gone ? 1 : 0}`).join('|')
  useEffect(() => { h.current?.setMembers(latest.current.members, latest.current.spoke) }, [memberKey])
  useEffect(() => { if (speak && speak.n > 0) h.current?.speak(speak.id) }, [speak?.id, speak?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} className={className} />
}
