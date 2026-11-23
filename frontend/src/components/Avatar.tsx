import moleAvatar from '../assets/mole-avatar.png'
import moleFace from '../assets/mole-face.png'

/** 두더지 프로필 사진. 지금은 모두 같은 그림 (스크린샷에서 잘라 씀) */
export default function Avatar({ size = 40, empty, label, circle, bg = '#e7c9ae' }: {
  size?: number
  empty?: boolean
  label?: string
  /** 동그란 베이지 원 안에 두더지 (Figma 방노트 Profile: Avatar 64 원 + Mole 40). 두더지는 mole-face.png = mole-avatar.png 에서 하늘색 배경만 걷어 낸 그림 */
  circle?: boolean
  /** circle 일 때 원 배경색 (기본 베이지. 추천 친구 카드는 파스텔 색을 돌려 씀) */
  bg?: string
}) {
  if (circle) {
    const mole = Math.round(size * 0.625) // 64 원 안에 40
    return (
      <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
        style={{ display: 'grid', placeItems: 'center', width: size, height: size, borderRadius: '50%', background: bg, flex: 'none' }}>
        <img src={moleFace} alt="" width={mole} height={mole} draggable={false} style={{ display: 'block', width: mole, height: mole }} />
      </span>
    )
  }
  if (empty) {
    return <span aria-hidden style={{ display: 'block', width: size, height: size, borderRadius: '50%', background: '#e7c9ae', flex: 'none' }} />
  }
  return (
    <img src={moleAvatar} alt={label ?? ''} width={size} height={size}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.18), flex: 'none', objectFit: 'cover' }} />
  )
}
