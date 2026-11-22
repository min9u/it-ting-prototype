/**
 * 흙더미(굴 입구)에서 고개를 내민 두더지 — 벡터 그림이라 어떤 크기에서도 선명하고 배경이 투명함
 * (예전 mole-mound.png 는 흰 배경에서 잘라 낸 작은 그림이라 키우면 흐리고 어두운 배경에서 흰 테두리가 보였음).
 * 로딩 그림(RoomView)과 방문자 뷰 대화 요청 팝업(Figma 495:13898 "Mole (cute)")이 같이 씀.
 * headClass: 머리·손 묶음에 붙일 클래스 (로딩 그림이 머리만 통통 움직일 때)
 */
export default function MoundMole({ width = 120, height = 96, headClass, className }: { width?: number; height?: number; headClass?: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 96" width={width} height={height} aria-hidden className={className} style={{ display: 'block' }}>
      <g className={headClass}>
        <path d="M34 66 C34 30 44 14 60 14 C76 14 86 30 86 66 Z" fill="#7d5644" />
        <path d="M42 34 C45 24 51 19 57 18" stroke="#a07a64" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".7" />
        <path d="M57 14 L55 8 M60 13 L60 6 M63 14 L66 8" stroke="#4e3428" strokeWidth="2.2" strokeLinecap="round" />
        <ellipse cx="44" cy="44" rx="5" ry="3" fill="#e9967a" opacity=".55" />
        <ellipse cx="76" cy="44" rx="5" ry="3" fill="#e9967a" opacity=".55" />
        <circle cx="50" cy="36" r="3.4" fill="#2a1a12" />
        <circle cx="70" cy="36" r="3.4" fill="#2a1a12" />
        <circle cx="51.2" cy="34.8" r="1.1" fill="#fff" />
        <circle cx="71.2" cy="34.8" r="1.1" fill="#fff" />
        <ellipse cx="60" cy="44" rx="4.6" ry="3.4" fill="#f08f86" />
      </g>
      <path d="M6 94 C8 70 30 58 60 58 C90 58 112 70 114 94 Z" fill="#c8643a" />
      <path d="M6 94 C8 84 20 78 30 80 C44 83 52 90 60 94 Z" fill="#b5552f" opacity=".55" />
      <path d="M78 66 C92 68 104 76 110 88" stroke="#e08a5e" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".6" />
      <circle cx="40" cy="78" r="2.4" fill="#9c4526" />
      <circle cx="84" cy="82" r="2" fill="#9c4526" />
      <circle cx="66" cy="86" r="1.6" fill="#9c4526" />
      <g className={headClass}>
        <ellipse cx="46" cy="60" rx="7.5" ry="5" fill="#f2c0a6" />
        <ellipse cx="74" cy="60" rx="7.5" ry="5" fill="#f2c0a6" />
        <path d="M42 58 v4 M46 57.5 v4.5 M50 58 v4 M70 58 v4 M74 57.5 v4.5 M78 58 v4" stroke="#d99a80" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  )
}
