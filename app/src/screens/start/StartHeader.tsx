import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logo from '../../assets/logo-clear.png'
import s from './Start.module.css'

/**
 * 시작하기 v2 Top Bar (1440×72): 로고(48, 19, 80×34) + 오른쪽 링크.
 * right 를 주지 않으면 랜딩 기본(로그인 · 시작하기 버튼), null 이면 로고만 (로그인·회원가입 화면).
 */
export default function StartHeader({ tone = 'dark', right, look }: {
  /** 글자 색: dark = 진한 갈색, light = 크림 (어두운 장면 위) */
  tone?: 'dark' | 'light'
  right?: ReactNode | null
  /** 랜딩 01처럼 '둘러보기' 링크도 보여 줄지 */
  look?: boolean
}) {
  return (
    <header className={`${s.header} ${tone === 'light' ? s.headerLight : ''}`}>
      <Link to="/start" aria-label="디굴디굴 처음으로"><img src={logo} alt="디굴디굴" className={s.logo} /></Link>
      {right !== null && (
        <nav className={s.headerNav}>
          {right ?? (
            <>
              {look && <Link to="/look" className={s.headerLink}>둘러보기</Link>}
              <Link to="/login" className={s.headerLink}>로그인</Link>
              <Link to="/signup" className={s.headerCta}>시작하기</Link>
            </>
          )}
        </nav>
      )}
    </header>
  )
}

/** 구경한 방 ●●● (비로그인 둘러보기). pill = 밝은 알약 배경 */
export function GuestCounter({ seen, max, pill }: { seen: number; max: number; pill?: boolean }) {
  return (
    <span className={pill ? s.guestPill : s.guestPlain} aria-label={`구경한 방 ${seen}개 / ${max}개`}>
      구경한 방
      <span className={s.guestDots} aria-hidden>
        {Array.from({ length: max }, (_, i) => <i key={i} className={i < seen ? s.dotOn : ''} />)}
      </span>
    </span>
  )
}

/** 패널 위로 빼꼼 내민 두더지 (Figma "Mole (peek – 3D 캐릭터 자리)" 72×72, 패널 오른쪽에서 48) */
export function PeekMole() {
  return (
    <span className={s.peek} aria-hidden>
      <span className={s.peekBody}><i /><i /><b /></span>
    </span>
  )
}
