import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import Pagination from '../../components/Pagination'
import ProfilePopup from '../../components/ProfilePopup'
import { ConfirmDialog, EmptyMole, ReportDialog, TOAST, Toast, type ToastSpec } from '../../components/Feedback'
import { ErrorState, SkeletonLines } from '../../components/AsyncState'
import { userOf } from '../../data/mock'
import type { GuestbookEntry, User } from '../../data/types'
import s from './Burrow.module.css'
import m from './MyBurrow.module.css'

/**
 * 땅굴 메인 – 내 땅굴 · 방명록 전체 보기 / 방명록 삭제 확인 (02 F4, 2026-11-16 명세 기준)
 * - 제목 "방명록" + 남아 있는 글 수 (글이 지워지면 바로 줄어듦)
 * - 작성자 · 쓴 시각 · 본문, 최신순. 정렬은 바꿀 수 없음. 쓴 지 7일이 지난 글은 자동으로 지워짐(lib/format liveGuestbook). 주인은 고칠 수 없음
 * - 글마다 삭제 · 신고. 삭제 → 삭제 확인(00 공통 17) → 완료 토스트(16). 신고 → 신고 팝업(F8 과 같은 사유)
 * - 한 페이지 5개, 6개 이상이면 페이지 번호
 * - 작성자(두더지·닉네임)를 누르면 프로필 팝업(00 공통 15)
 * 방문자 뷰(VisitBurrow)도 이 모달을 씀: onDelete 가 없으면 삭제 버튼 없이 신고만. compose 를 주면 맨 위에 쓰기 칸(글자 수 제한 · 남기기)이 생겨
 * 한 창에서 쓰기와 읽기를 다 함 (Figma 방문자 뷰 510:13663, 방명록은 사이드바가 아니라 우체통 창 안에)
 */
export const GUESTBOOK_PAGE_SIZE = 5

/** 00 공통 8 시간 표기: 방금 · N분 전 · N시간 전 · 어제 · N일 전, 그보다 오래되면 날짜 */
export function gbTime(iso: string, now = Date.now()) {
  const t = new Date(iso), diff = Math.max(0, now - t.getTime()), min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d === 1) return '어제'
  if (d < 7) return `${d}일 전`
  return `${t.getMonth() + 1}월 ${t.getDate()}일`
}

/** 방명록 쓰기 칸 (값은 부르는 쪽이 들고 있음: 실패하면 입력값을 되돌려야 해서) */
export interface GuestbookCompose { value: string; onChange: (v: string) => void; onSubmit: () => void; max: number; placeholder: string }
/** 목록을 아직 못 받았을 때 (처음 받는 중 · 받기 실패) */
export interface GuestbookLoad { loading?: boolean; error?: unknown; onRetry?: () => void; retrying?: boolean }

export default function GuestbookModal({ open, onClose, entries, onDelete, compose, load }: {
  open: boolean; onClose: () => void; entries: GuestbookEntry[]; onDelete?: (id: string) => void; compose?: GuestbookCompose; load?: GuestbookLoad
}) {
  const [page, setPage] = useState(1)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [toast, setToast] = useState<ToastSpec | null>(null)
  const target = entries.find((g) => g.id === confirmId)
  const total = Math.max(1, Math.ceil(entries.length / GUESTBOOK_PAGE_SIZE))
  useEffect(() => { if (page > total) setPage(total) }, [page, total])
  useEffect(() => { if (open) setPage(1) }, [open])
  const shown = entries.slice((page - 1) * GUESTBOOK_PAGE_SIZE, page * GUESTBOOK_PAGE_SIZE)

  return (
    <>
      <Modal open={open && !profile} onClose={onClose} width={825} labelledBy="gb-all-title">
        <div className={s.gbModal}>
          <h2 id="gb-all-title" className={`display ${s.gbModalTitle}`}>방명록 <span className="count-badge">{entries.length}</span></h2>
          {compose && (
            <div className={s.gbWrite}>
              <textarea value={compose.value} maxLength={compose.max} onChange={(e) => compose.onChange(e.target.value)} aria-label="방명록 남기기" aria-describedby="gb-count"
                placeholder={compose.placeholder}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); compose.onSubmit() } }} />
              <div className={s.gbWriteRow}>
                <span id="gb-count">{compose.value.length} / {compose.max}</span>
                <button className="link-accent" onClick={compose.onSubmit} disabled={!compose.value.trim()}>남기기</button>
              </div>
            </div>
          )}
          {load?.loading ? (
            <div role="status" aria-busy="true" aria-label="방명록을 불러오는 중" style={{ marginTop: 12 }}><SkeletonLines lines={4} /></div>
          ) : load?.error && entries.length === 0 ? (
            <ErrorState compact error={load.error} onRetry={load.onRetry} retrying={load.retrying} title="방명록을 불러오지 못했어요" />
          ) : entries.length === 0 ? (
            <div className={s.gbEmptyBox}><EmptyMole message="아직 아무도 방명록을 남기지 않았어요" /></div>
          ) : (
            <ul className={s.gbModalList}>
              {shown.map((g) => {
                const author = userOf(g.authorId)
                return (
                  <li key={g.id} className={m.gbRow}>
                    <button className={m.gbAvatar} onClick={() => setProfile(author)} aria-label={`${author.nickname} 프로필 보기`}><Avatar size={52} /></button>
                    <div className={m.gbBody}>
                      <p className={m.gbMeta}><button onClick={() => setProfile(author)}>{author.nickname}</button><span>{gbTime(g.createdAt)}</span></p>
                      <p className={m.gbText}>{g.text}</p>
                    </div>
                    <div className={m.gbActions}>
                      {onDelete && <><button onClick={() => setConfirmId(g.id)}>삭제</button><span aria-hidden>|</span></>}
                      <button onClick={() => setReportId(g.id)}>신고</button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {entries.length > GUESTBOOK_PAGE_SIZE && (
            <div className={s.gbPager}><Pagination page={page} total={total} onChange={setPage} /></div>
          )}
          <p className={s.gbNote}>방명록은 7일이 지나면 자동으로 사라져요.</p>
        </div>
        <ConfirmDialog open={!!target} onClose={() => setConfirmId(null)}
          onConfirm={() => { if (target) { onDelete?.(target.id); setToast(TOAST.deleted) } }}
          title={`${target ? userOf(target.authorId).nickname : ''}님의 방명록을 삭제할까요?`}
          desc="내 땅굴에서 사라지고 되돌릴 수 없어요. 작성자에게 따로 알림은 가지 않아요." />
        <ReportDialog open={!!reportId} target="방명록" onClose={() => setReportId(null)} onConfirm={() => { setReportId(null); setToast(TOAST.reported) }} />
      </Modal>
      <ProfilePopup user={profile} onClose={() => setProfile(null)} />
      <Toast open={!!toast} title={toast?.title ?? ''} desc={toast?.desc} onClose={() => setToast(null)} />
    </>
  )
}
