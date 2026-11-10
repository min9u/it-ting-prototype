import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Modal from '../../components/Modal'
import RoomView from '../../components/RoomView'
import StartHeader from './StartHeader'
import s from './Start.module.css'

const BURROWS = [
  { id: 'yerin', name: '예린굴', tags: '요리 · 캠핑 · 그림', x: 18, y: 38 },
  { id: 'ha', name: '하늘굴', tags: '캠핑 · 사진', x: 42, y: 62 },
  { id: 'seoyeon', name: '서연굴', tags: '독서 · 에세이', x: 66, y: 34 },
  { id: 'mingu', name: '민구굴', tags: '독서 · 게임 · 캠핑', x: 80, y: 66 },
  { id: 'yejin', name: '예진굴', tags: '홈카페 · 독서', x: 30, y: 82 },
]
const FREE = 3

/**
 * 시작 v2 – 둘러보기 · 땅 (비로그인) 408:19989 · 4번째 방 · 로그인 필요 408:20104
 * 비로그인은 방 3개까지 구경할 수 있다. 메타데이터 기반 — 스크린샷 대조 필요
 */
export default function LookAround() {
  const nav = useNavigate()
  const [seen, setSeen] = useState<string[]>([])
  const [inside, setInside] = useState<string | null>(null)
  const [gate, setGate] = useState(false)

  const enter = (id: string) => {
    if (!seen.includes(id) && seen.length >= FREE) { setGate(true); return }
    if (!seen.includes(id)) setSeen((l) => [...l, id])
    setInside(id)
  }
  const b = BURROWS.find((x) => x.id === inside)

  return (
    <div className={s.lookPage}>
      <StartHeader look={false} extra={<span className={s.seenPill}>구경한 방 {seen.length} / {FREE}</span>} />
      {b ? (
        <div className={s.lookRoom}>
          <RoomView ownerId={b.id} label={`${b.name}`}>
            <span className={s.lookTag}>{b.name} · {b.tags}</span>
            <button className={`btn btn-primary ${s.lookUp}`} onClick={() => setInside(null)}>땅 위로 돌아가기</button>
          </RoomView>
        </div>
      ) : (
        <div className={s.field}>
          {BURROWS.map((x) => (
            <div key={x.id} className={s.fieldBurrow} style={{ left: `${x.x}%`, top: `${x.y}%` }}>
              <div className={s.fieldCard}>
                <strong className="display">{x.name}</strong>
                <span>{x.tags}</span>
                <button className={s.enterBtn} onClick={() => enter(x.id)}>{seen.includes(x.id) ? '다시 보기' : '들어가기'}</button>
              </div>
              <span className={s.fieldHole} />
            </div>
          ))}
          <p className={s.fieldHint}>흙더미를 눌러 땅굴에 들어가 보세요. 로그인 없이 {FREE}개까지 구경할 수 있어요.</p>
        </div>
      )}

      <Modal open={gate} onClose={() => setGate(false)} width={420} labelledBy="gate-title">
        <div className={s.gate}>
          <span className={s.seenPill}>구경한 방 {seen.length} / {FREE}</span>
          <h2 id="gate-title" className="display">방 3개를 다 구경했어요</h2>
          <p>로그인하면 계속 둘러보고<br />방명록도 남길 수 있어요.</p>
          <div className={s.gateActions}>
            <button className="btn btn-primary" onClick={() => nav('/login')}>로그인</button>
            <button className="btn btn-ghost" onClick={() => nav('/signup')}>회원가입</button>
          </div>
          <button className={s.gateBack} onClick={() => setGate(false)}>땅 위로 돌아가기</button>
        </div>
      </Modal>
      <Link to="/" className={s.srOnly}>처음으로</Link>
    </div>
  )
}
