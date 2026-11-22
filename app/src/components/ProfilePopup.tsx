import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from './Modal'
import Avatar from './Avatar'
import { ReportDialog, Toast } from './Feedback'
import { HomeIcon } from './Icons'
import { ME_ID, USERS, toneOf } from '../data/mock'
import { affOf } from '../data/field'
import { getMyInterests } from '../data/interests'
import type { User } from '../data/types'
import s from './ProfilePopup.module.css'

/**
 * 프로필 팝업 (Figma 02 · 00 공통 15): 두더지, 닉네임, 캠퍼스 · 기수 · 층, 관심사.
 * "땅굴 놀러가기" → 그 사람 땅굴(방문자 뷰). 신고 아이콘 → 신고 팝업(F8 과 같은 사유).
 * 실명·사진은 쓰지 않음. 탈퇴한 사용자는 열지 않음 (부르는 쪽에서 막음)
 */
export default function ProfilePopup({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [report, setReport] = useState(false)
  const [menu, setMenu] = useState(false)
  const [done, setDone] = useState(false)
  const mine = getMyInterests(USERS[ME_ID].interests)
  const isMe = user?.id === ME_ID
  return (
    <>
      <Modal open={!!user && !report} onClose={() => { setMenu(false); onClose() }} width={380} labelledBy="profile-title">
        {user && (
          <div className={s.box}>
            {!isMe && (
              <span className={s.moreWrap}>
                <button className={s.report} onClick={() => setMenu((v) => !v)} aria-label={`${user.nickname}님 신고`} aria-expanded={menu} title="신고">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
                </button>
                {menu && (
                  <span className={s.menu} role="menu">
                    <button role="menuitem" onClick={() => { setMenu(false); setReport(true) }}>신고하기</button>
                  </span>
                )}
              </span>
            )}
            <span className={s.mole}><Avatar size={96} /></span>
            <h2 id="profile-title" className="display">{user.nickname}{isMe && <em className={s.me}>나</em>}</h2>
            <p className={s.aff}>{affOf(user)}</p>
            <p className={s.label}>관심사 <span>{user.interests.length}</span></p>
            <div className={s.chips}>
              {user.interests.map((i) => {
                const t = toneOf(i), shared = !isMe && mine.includes(i)
                return <span key={i} className={shared ? s.shared : undefined} style={{ background: `var(--tone-${t}-bg)`, color: `var(--tone-${t}-fg)` }}>{shared && '✓ '}{i}</span>
              })}
            </div>
            <Link to={isMe ? '/burrow' : `/burrow/${user.id}`} className={`btn btn-line btn-block ${s.go}`} onClick={onClose}>
              <HomeIcon size={16} /> {isMe ? '내 땅굴로 가기' : '땅굴 놀러가기'}
            </Link>
          </div>
        )}
      </Modal>
      <ReportDialog open={report} target="사용자" onClose={() => setReport(false)} onConfirm={() => { setReport(false); onClose(); setDone(true) }} />
      <Toast open={done} onClose={() => setDone(false)} title="신고가 접수됐어요" desc="운영진이 확인한 뒤 조치할게요" />
    </>
  )
}
