import { useState } from 'react'
import { Link } from '@/lib/nav'
import Modal from './Modal'
import Avatar from './Avatar'
import { ReportDialog, Toast } from './Feedback'
import { HomeIcon } from './Icons'
import { ME_ID, toneOf } from '../data/mock'
import { affOf } from '../data/field'
import type { User } from '../data/types'
import { GONE_ID } from '../api/common'
import { isApiError, toastApiError } from '../api'
import { ONBOARDING_ERRORS, useUserProfile } from '../api/onboarding'
import { reportUser } from '../api/burrow'
import { useMe } from '../api/auth'
import s from './ProfilePopup.module.css'

/**
 * 프로필 팝업 (00 공통 15): 두더지, 닉네임, 캠퍼스 · 기수 · 층, 관심사. 내용은 GET /users/{userId}/profile 로 받는다
 * (부르는 쪽이 넘긴 user 는 받는 동안 먼저 보여 주는 값 + id).
 * "땅굴 놀러가기" → 그 사람 땅굴(방문자 뷰). 신고 아이콘 → 신고 팝업(POST /reports, targetType MEMBER).
 * 실명은 쓰지 않음. 탈퇴한 사용자는 열지 않음 (부르는 쪽에서 막고, 열려도 404 USER_NOT_FOUND 안내).
 * 차단 메뉴는 뺐음: 명세 "이번 범위에 없는 것 — 차단 기능" (2026-11-22)
 */
export default function ProfilePopup({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [report, setReport] = useState(false)
  const [done, setDone] = useState(false)
  const target = user && user.id !== GONE_ID ? user : null
  const q = useUserProfile(target?.id)
  // 실제 모드의 내 id 는 GET /me 의 userId (목 모드는 ME_ID)
  const myId = useMe().data?.userId
  const isMe = !!user && (user.id === ME_ID || user.id === myId)
  const gone = isApiError(q.error) && q.error.code === 'USER_NOT_FOUND'
  // 받은 값이 있으면 그것, 받는 동안은 넘겨받은 값
  const shown = q.data?.person ?? user
  const interests = q.data?.interests ?? user?.interests ?? []
  const shared = new Set(q.data?.shared ?? [])
  const send = async (picked: string) => {
    if (!user) return
    setReport(false); onClose()
    try { await reportUser(user.id, picked); setDone(true) } catch (e) { toastApiError(e, '신고하지 못했어요') }
  }
  return (
    <>
      <Modal open={!!user && !report} onClose={onClose} width={380} labelledBy="profile-title">
        {shown && (
          <div className={s.box}>
            {!isMe && !gone && (
              <button className={s.report} onClick={() => setReport(true)} aria-label={`${shown.nickname}님 신고`} title="신고">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
              </button>
            )}
            <span className={s.mole}><Avatar size={96} /></span>
            {gone ? (
              <>
                <h2 id="profile-title" className="display">탈퇴한 사용자</h2>
                <p className={s.aff}>{ONBOARDING_ERRORS.USER_NOT_FOUND}</p>
              </>
            ) : (
              <>
                <h2 id="profile-title" className="display">{shown.nickname}{isMe && <em className={s.me}>나</em>}</h2>
                <p className={s.aff}>{affOf(shown)}</p>
                <p className={s.label}>관심사 <span>{interests.length}</span></p>
                <div className={s.chips} aria-busy={q.isLoading}>
                  {interests.map((i) => {
                    const t = toneOf(i), on = !isMe && shared.has(i)
                    return <span key={i} className={on ? s.shared : undefined} style={{ background: `var(--tone-${t}-bg)`, color: `var(--tone-${t}-fg)` }}>{on && '✓ '}{i}</span>
                  })}
                </div>
                <Link to={isMe ? '/burrow' : `/burrow/${shown.id}`} className={`btn btn-line btn-block ${s.go}`} onClick={onClose}>
                  <HomeIcon size={16} /> {isMe ? '내 땅굴로 가기' : '땅굴 놀러가기'}
                </Link>
              </>
            )}
          </div>
        )}
      </Modal>
      <ReportDialog open={report} target="사용자" onClose={() => setReport(false)} onConfirm={send} />
      <Toast open={done} onClose={() => setDone(false)} title="신고가 접수됐어요" desc="운영진이 확인한 뒤 조치할게요" />
    </>
  )
}
