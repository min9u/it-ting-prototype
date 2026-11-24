import { useEffect, useRef, useState, type ReactNode } from 'react'
import Avatar from '../../components/Avatar'
import InterestChip from '../../components/InterestChip'
import { FlagIcon } from '../../components/Icons'
import { affOf } from '../../data/field'
import type { User } from '../../data/types'
import s from './Burrow.module.css'

/*
 * 방노트 (오른쪽 사이드바) — 탐색(ExploreBurrow)과 방문자 뷰(VisitBurrow)가 같이 씀
 * Figma 탐색 477:12524 · 방문자 뷰 495:13840(접힘) · 510:13152(펼침)
 * 들어오면 접힌 채 시작, 오른쪽 위 "방노트" 버튼으로 펼치고 "접기 ›" 로 접음
 */

/** 접고 펼치기. 키보드로 눌렀을 때만 서로 맞은편 버튼으로 초점을 옮김 (마우스로 눌렀을 땐 그대로 둬서 탐색에서 Enter 가 곧바로 땅굴 들어가기로 감) */
export function useNotePanel(initialOpen: boolean) {
  const [open, setOpen] = useState(initialOpen)
  const noteFocus = useRef<'fold' | 'open' | null>(null)
  const foldBtn = useRef<HTMLButtonElement | null>(null)
  const openBtn = useRef<HTMLButtonElement | null>(null)
  const toggle = (next: boolean, e: React.MouseEvent) => {
    noteFocus.current = e.detail === 0 ? (next ? 'fold' : 'open') : null // 키보드로 누른 클릭은 detail 0
    setOpen(next)
  }
  useEffect(() => {
    const want = noteFocus.current
    noteFocus.current = null
    if (want === 'fold') foldBtn.current?.focus()
    else if (want === 'open') openBtn.current?.focus()
  }, [open])
  return { open, toggle, foldBtn, openBtn }
}
export type NotePanelState = ReturnType<typeof useNotePanel>

/** 펼친 사이드바(머리글 + 안쪽만 스크롤) 또는 접힌 "방노트" 버튼 */
export function NotePanel({ panel, title, children }: { panel: NotePanelState; title: string; children: ReactNode }) {
  return panel.open ? (
    <aside className={`${s.roomInfo} ${s.noteAside}`} aria-label="방노트">
      <div className={s.panelHead}>
        <h2 className="display">{title}</h2>
        <button ref={panel.foldBtn} className="link-accent" onClick={(e) => panel.toggle(false, e)} aria-expanded="true">접기 ›</button>
      </div>
      <div className={s.noteBody}>{children}</div>
    </aside>
  ) : (
    <button ref={panel.openBtn} className={s.reopen} onClick={(e) => panel.toggle(true, e)} aria-expanded="false">
      <span className="display">방노트</span>
      <Avatar size={22} />
    </button>
  )
}

/**
 * 방노트 내용: 프로필(64px 원) · 자기소개 · 관심사(칩 + 나와 같은 관심사 범례) · [children] · Q&A 3개
 * children 은 관심사 바로 아래·Q&A 위 (탐색은 "땅굴 놀러가기" 버튼, 방문자 뷰는 없음)
 * mine 이면 겹침이 없어 범례를 뺌. "접속 중" 표시는 없음 (명세 README "이번 범위에 없는 것")
 * onReport 를 주면(방문자 뷰) 프로필 오른쪽 위에 신고 깃발 버튼 (Figma 510:13152)
 * intro={false} 면 자기소개 칸을 뺌. 탐색의 가까운 주인 정보도 이제 자기소개를 보임(들판 API 입구 항목 intro, 명세 05 dev 2862f69 KAN-46)
 */
export function RoomNoteBody({ owner, shared, mine = false, onReport, intro = true, children }: { owner: User; shared: string[]; mine?: boolean; onReport?: () => void; intro?: boolean; children?: ReactNode }) {
  return (
    <>
      <div className={s.profile}>
        <Avatar size={64} circle />
        <div>
          <p className={`display ${s.nick}`}>{owner.nickname}</p>
          <p className={s.aff}>{affOf(owner)}</p>
        </div>
        {onReport && (
          <button className={s.flagBtn} onClick={onReport} aria-label={`${owner.nickname}님 신고`} title="신고"><FlagIcon size={18} /></button>
        )}
      </div>
      {intro && (
        <div className={`${s.introBox} ${s.introRead}`}>
          <span className={s.introHead}><strong>자기소개</strong></span>
          <p className={s.introP}>{owner.intro || '아직 작성한 자기소개가 없어요.'}</p>
        </div>
      )}
      {/* 제목 줄(관심사 N · 가는 선 · 범례) + 전부 색 칩. 나와 겹치는 건 칩 테두리 + ✓ (00 공통 5) */}
      <section className={s.noteInterests} aria-label="관심사">
        <div className={s.noteInterestsHead}>
          <span className={s.noteInterestsTitle}>관심사</span>
          <span className={s.noteInterestsCount}>{owner.interests.length}</span>
          <span className={s.noteRule} aria-hidden />
          {!mine && <span className={s.noteLegend}>나와 같은 관심사</span>}
        </div>
        <div className={s.chipWrap}>
          {owner.interests.map((i) => <InterestChip key={i} label={i} shared={shared.includes(i)} check />)}
        </div>
      </section>
      {children}
      {owner.qna?.length ? (
        <>
          <h3 className={`display ${s.qnaTitle}`}>Q&amp;A</h3>
          <dl className={`${s.qna} ${s.noteQna}`}>{owner.qna.slice(0, 3).map((q) => <div key={q.q}><dt>{q.q}</dt><dd>{q.a}</dd></div>)}</dl>
        </>
      ) : null}
    </>
  )
}
