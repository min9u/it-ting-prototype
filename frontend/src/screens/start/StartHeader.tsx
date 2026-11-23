import type { ReactNode } from 'react'
import { Link } from '@/lib/nav'
import logo from '../../assets/logo-clear.png'
import logoMole from '../../assets/auth/logo-mole.svg'
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

/**
 * 빼꼼 두더지 (Figma "Mole (로고 두더지)" 72×72 프레임 안에 Logo Mole 66.24×61.23). 패널 오른쪽에서 48, 위로 50 (아래 22는 패널 뒤).
 * 로그인·회원가입·비밀번호 찾기 · 둘러보기 문 · "PC에서 이용해 주세요" 모두 이 한 곳 (2026-11-21 통일).
 * svg 는 ?no-inline 으로 data URL 이 되지 않게 함 (공개 공유 검토가 svg data URL 을 거절).
 * 눈 깜빡임 (02 명세 00 공통 11): svg 는 그대로 두고 눈 자리에 몸 색 눈꺼풀 둘을 덮어 4초마다 감았다 뜸 (움직임 줄이기면 멈춤)
 */
export function LogoMole() {
  return (
    <span className={s.logoMole} aria-hidden>
      <span className={s.logoMoleBody}>
        <img src={logoMole} alt="" width={66.24} height={61.2306} />
        <i className={s.lidL} />
        <i className={s.lidR} />
      </span>
    </span>
  )
}

/** 예전 이름. 지금은 LogoMole 과 같음 (LookAround · Guards 가 아직 이 이름으로 부름) */
export const PeekMole = LogoMole
