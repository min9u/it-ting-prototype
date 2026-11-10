import moleAvatar from '../assets/mole-avatar.png'

/** 두더지 프로필 사진. 지금은 모두 같은 그림 (스크린샷에서 잘라 씀) */
export default function Avatar({ size = 40, empty, label }: { size?: number; empty?: boolean; label?: string }) {
  if (empty) {
    return <span aria-hidden style={{ display: 'block', width: size, height: size, borderRadius: '50%', background: '#e7c9ae', flex: 'none' }} />
  }
  return (
    <img src={moleAvatar} alt={label ?? ''} width={size} height={size}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.18), flex: 'none', objectFit: 'cover' }} />
  )
}
