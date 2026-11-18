import type { ReactNode } from 'react'
import SceneCanvas from './SceneCanvas'
import { mountRoomScene } from './roomScene'
import { quality, type SceneHandle } from './engine'
import { mountRoomWorker, workerRenderSupported } from './worker/roomWorkerHost'
import type { FurnChoice } from '../data/myBurrow'
import type { RoomStyle } from '../data/roomStyle'

/** D 시험판: 저사양 + 실험실 D 면 Worker 에서 그림 (안 되면 원래대로) */
const useWorker = () => { const q = quality(); return q.level === 'low' && !!q.lab?.D && workerRenderSupported() }

/** 땅굴 방 3D (RoomView 가 React.lazy 로 불러옴 → three.js 는 별도 청크) */
export default function RoomCanvas({ ownerId, interests, wallpaper, still, hostName, hostWorn, worn, mailbox, onMailbox, focusX, className, label, onReady, overlay, furniture, paused, fx, getStyle }: {
  /** 처음 고른 가구 (그 뒤 바뀌는 건 handle.setFurniture) */
  furniture?: FurnChoice
  /** 장면을 만들 때 입힐 꾸미기 값 (data/roomLook.ts style, 그 뒤 바뀌는 건 handle.setStyle). 만드는 순간의 값을 읽으려고 함수로 받음 */
  getStyle?: () => RoomStyle | null
  ownerId: string
  /** 남의 땅굴이면 집주인 닉네임 (집주인 두더지가 나옴) */
  hostName?: string
  hostWorn?: string[]
  /** 처음 착용 (그 뒤 바뀌는 건 handle.setWorn) */
  worn?: string[]
  interests?: string[]
  /** 벽지 id (data/wallpapers.ts). 없으면 관심사로 정함 */
  wallpaper?: string
  /** 연출 없이 다 차려진 방 (roomScene still) */
  still?: boolean
  /** 우체통 처음 상태: 새 방명록 있음 (그 뒤 바뀌는 건 handle.setMailbox) */
  mailbox?: boolean
  /** 우체통을 누름 */
  onMailbox?: () => void
  focusX: number
  className?: string
  label?: string
  onReady?: (handle: SceneHandle) => void
  /** 장면 위 UI (SceneCanvas overlay) */
  overlay?: ReactNode
  /** 안 보이는 동안 그리기 멈춤 (SceneCanvas paused) */
  paused?: boolean
  /** 관심사 이펙트 (roomScene fx, docs/interest-effects.md) */
  fx?: { viewer?: string[]; talk?: 'open' | 'slow' | null }
}) {
  return (
    <SceneCanvas
      deps={`${ownerId}|${hostName ?? ''}|${(interests ?? []).join(',')}|${wallpaper ?? ''}|${still ? 1 : 0}`}
      mount={(el, fx0) => {
        const o = { ownerId, interests, wallpaper, hostName, hostWorn, worn, still, mailbox, onMailbox, focusX: fx0, furniture, fx, style: getStyle?.() ?? undefined }
        return useWorker() ? mountRoomWorker(el, o, () => mountRoomScene(el, o)) : mountRoomScene(el, o)
      }}
      focusX={focusX}
      className={className}
      label={label}
      onReady={onReady}
      overlay={overlay}
      paused={paused}
    />
  )
}
