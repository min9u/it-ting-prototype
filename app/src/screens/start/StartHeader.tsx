import { Link } from 'react-router-dom'
import logo from '../../assets/logo-clear.png'
import s from './Start.module.css'

/** 시작하기 v2 헤더: 로고 + (둘러보기) 로그인 · 시작하기 */
export default function StartHeader({ dark, look = true, extra }: { dark?: boolean; look?: boolean; extra?: React.ReactNode }) {
  return (
    <header className={`${s.header} ${dark ? s.headerDark : ''}`}>
      <Link to="/" aria-label="디굴디굴 처음으로"><img src={logo} alt="디굴디굴" className={s.logo} /></Link>
      <nav className={s.headerNav}>
        {extra}
        {look && <Link to="/look" className={s.headerLink}>둘러보기</Link>}
        <Link to="/login" className={s.headerLink}>로그인</Link>
        <Link to="/signup" className={s.headerCta}>시작하기</Link>
      </nav>
    </header>
  )
}
