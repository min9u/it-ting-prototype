import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import RoomView from '../../components/RoomView'
import RoomModeToggle from '../../components/RoomModeToggle'
import InterestChip from '../../components/InterestChip'
import GuestbookItem from '../../components/GuestbookItem'
import Avatar from '../../components/Avatar'
import Modal from '../../components/Modal'
import { GUESTBOOK, ME_ID, USERS, overlapCount } from '../../data/mock'
import type { GuestbookEntry } from '../../data/types'
import { liveGuestbook } from '../../lib/format'
import GuestbookModal from './GuestbookModal'
import s from './Burrow.module.css'

const GB_MAX = 100
const QUICK = ['땅굴 구경 잘했어요!', '같이 게임 한 판 해요', '그림 이야기 나눠요']

/**
 * 땅굴 – 방문자 뷰 (예린이의 땅굴) 510:13663 외 3변형 · 대화 요청 팝업 495:13898
 * 메타데이터 기반 — 스크린샷 대조 필요
 * 데모용 쿼리: ?modal=request
 */
export default function VisitBurrow() {
  const { userId = 'yerin' } = useParams()
  const [params] = useSearchParams()
  const owner = USERS[userId] ?? USERS.yerin
  const me = USERS[ME_ID]
  const [panelOpen, setPanelOpen] = useState(true)
  const [entries, setEntries] = useState<GuestbookEntry[]>(() => liveGuestbook(GUESTBOOK))
  const [draft, setDraft] = useState('')
  const [allOpen, setAllOpen] = useState(false)
  const [reqOpen, setReqOpen] = useState(params.get('modal') === 'request')
  const [reqMsg, setReqMsg] = useState('')
  const [sent, setSent] = useState(false)

  if (userId === ME_ID) return <Navigate to="/burrow" replace />
  const shared = owner.interests.filter((i) => me.interests.includes(i))

  const submitGb = () => {
    if (!draft.trim()) return
    setEntries((l) => [{ id: `new${Date.now()}`, authorId: ME_ID, text: draft.trim(), createdAt: new Date().toISOString() }, ...l])
    setDraft('')
  }

  return (
    <main className={s.page}>
      <RoomView ownerId={owner.id} interests={owner.interests} focusX={panelOpen ? 0.403 : 0.5} label={`${owner.nickname}의 땅굴`}>
        <span className={s.ownerTag}>🏠 {owner.nickname}이의 땅굴</span>
        <button className={s.speech} style={{ left: `${(panelOpen ? 0.392 : 0.49) * 100}%`, top: '52%' }} onClick={() => { setSent(false); setReqOpen(true) }}>
          💬 대화 요청하기
        </button>
        <RoomModeToggle style={{ left: `${(panelOpen ? 0.408 : 0.515) * 100}%` }} />
      </RoomView>

      {panelOpen ? (
        <aside className={s.roomInfo} aria-label="방 정보">
          <div className={s.panelHead}>
            <h2 className="display">{owner.nickname}이의 땅굴</h2>
            <button className="link-accent" onClick={() => setPanelOpen(false)}>접기 ›</button>
          </div>
          <div className={s.profile}>
            <Avatar size={64} />
            <div>
              <p className={`display ${s.nick}`}>
                {owner.nickname} {owner.online && <small className={s.online}>● 접속 중</small>}
              </p>
              <p className={s.aff}>{owner.affiliation}</p>
            </div>
          </div>
          <div className={`${s.introBox} ${s.introRead}`}>
            <span className={s.introHead}><strong>자기소개</strong></span>
            <p className={s.introP}>{owner.intro || '아직 작성한 자기소개가 없어요.'}</p>
          </div>
          <section className={s.interests}>
            <p className={s.sectionLabel}>
              관심사 <span>{owner.interests.length}</span>
              <span className={s.sharedLegend}>나와 같은 관심사 {shared.length}</span>
            </p>
            <div className={s.chipWrap}>
              {owner.interests.map((i) => <InterestChip key={i} label={i} shared={shared.includes(i)} />)}
            </div>
          </section>
          <section className={s.guestbook}>
            <h3 className={`display ${s.gbTitle}`}>방명록 <span className="count-badge">{entries.length}</span></h3>
            <div className={s.gbWrite}>
              <textarea value={draft} maxLength={GB_MAX} onChange={(e) => setDraft(e.target.value)}
                placeholder={`${owner.nickname}님의 땅굴에 다녀간 흔적을 남겨주세요`}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitGb() } }} />
              <div className={s.gbWriteRow}>
                <span>{draft.length} / {GB_MAX}</span>
                <button className="link-accent" onClick={submitGb} disabled={!draft.trim()}>남기기</button>
              </div>
            </div>
            <ul className={s.gbList}>{entries.slice(0, 2).map((g) => <GuestbookItem key={g.id} entry={g} />)}</ul>
            {entries.length > 0 && <button className={`link-accent ${s.more}`} onClick={() => setAllOpen(true)}>전체 보기</button>}
          </section>
        </aside>
      ) : (
        <button className={s.reopen} onClick={() => setPanelOpen(true)}><span className="display">방 정보</span><Avatar size={22} /></button>
      )}

      <GuestbookModal open={allOpen} onClose={() => setAllOpen(false)} entries={entries} />

      <Modal open={reqOpen} onClose={() => setReqOpen(false)} width={460} labelledBy="req-title">
        <div className={s.requestModal}>
          <Avatar size={56} />
          <h2 id="req-title" className="display">{sent ? '요청을 보냈어요' : '인사를 남겨볼까요?'}</h2>
          {sent ? (
            <>
              <p className={s.reqSent}>{owner.nickname}님이 수락하면 채팅에서 대화를 시작할 수 있어요.</p>
              <Link to="/chat/requests" className="btn btn-primary btn-block">보낸 요청 보기</Link>
            </>
          ) : (
            <>
              <div className={`field ${s.reqField}`}>
                <textarea className="textarea" value={reqMsg} maxLength={100} onChange={(e) => setReqMsg(e.target.value)}
                  placeholder={`${owner.nickname}님에게 보낼 첫 인사를 적어주세요. 땅굴에서 본 소품 이야기로 시작하면 쉬워요.`} />
                <span className="hint">{reqMsg.length} / 100 · 겹치는 관심사 {overlapCount(owner.interests, me.interests)}개</span>
              </div>
              <p className={s.quickLabel}>빠른 멘트</p>
              <div className={s.phrases}>
                {QUICK.map((q) => <button key={q} className={s.phrase} onClick={() => setReqMsg(q)}>{q}</button>)}
              </div>
              <button className={`btn btn-primary btn-block ${s.reqSend}`} disabled={!reqMsg.trim()} onClick={() => setSent(true)}>요청 보내기</button>
            </>
          )}
        </div>
      </Modal>
    </main>
  )
}
