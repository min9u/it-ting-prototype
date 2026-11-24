import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import Pagination from '../../components/Pagination'
import ProfilePopup from '../../components/ProfilePopup'
import { ConfirmDialog, EmptyMole, ReportDialog, TOAST, Toast, type ToastSpec } from '../../components/Feedback'
import { ErrorState, SkeletonLines } from '../../components/AsyncState'
import { ME_ID, userOf } from '../../data/mock'
import { GONE_ID } from '../../api/common'
import { GUESTBOOK_PAGE_SIZE } from '../../api/burrow'
import { getMyProfile } from '../../data/myBurrow'
import { SendIcon } from '../../components/Icons'
import type { GuestbookEntry, User } from '../../data/types'
import s from './Burrow.module.css'
import m from './MyBurrow.module.css'

/**
 * 땅굴 메인 – 내 땅굴 · 방명록 전체 보기 / 방명록 삭제 확인 (02 F4, 2026-11-16 명세 기준)
 * - 제목 "방명록" + 남아 있는 글 수 (글이 지워지면 바로 줄어듦)
 * - 작성자 · 쓴 시각 · 본문, 최신순. 정렬은 바꿀 수 없음. 글은 시간이 지나도 자동으로 지워지지 않음(2026-11-21 명세). 서로 다른 3명이 신고하면 가려져 목록·글 수에서 빠짐(lib/format visibleGuestbook, 부르는 쪽이 걸러서 줌). 주인은 고칠 수 없음
 * - 글마다 삭제 · 신고. 삭제 → 삭제 확인(00 공통 17) → 완료 토스트(16). 신고 → 신고 팝업(F8 과 같은 사유)
 * - 한 페이지 5개, 6개 이상이면 페이지 번호
 * - 작성자(두더지·닉네임)를 누르면 프로필 팝업(00 공통 15)
 * 방문자 뷰(VisitBurrow)도 이 모달을 씀: onDelete 가 없으면 삭제 버튼 없이 신고만. compose 를 주면 맨 위에 쓰기 칸(글자 수 제한 · 남기기)이 생겨
 * 한 창에서 쓰기와 읽기를 다 함 (Figma 방문자 뷰 510:13663 · 1243:24838, 방명록은 사이드바가 아니라 우체통 창 안에)
 * - 쓰기 칸은 한 줄 + 오른쪽 갈색 "➤ 남기기", 글자 수는 아래. 글이 하나도 없으면 가운데에 "가장 먼저 방명록을 작성해보세요."
 * - onDeleteOwn(방문자 뷰): 내가 쓴 글은 "신고" 대신 "삭제"(확인 없이 바로, 완료 토스트). 남이 쓴 글은 신고
 * - 내가 쓴 글의 작성자는 저장한 내 닉네임(getMyProfile)으로
 * API v1 (2026-11-22, 명세 04 GET /burrows/{burrowId}/guestbook-entries): 서버가 페이지로 나눠 줄 때는 server 를 준다
 *  → entries 는 지금 페이지의 글만, 글 수는 totalItems, 페이지 번호는 서버 값. 글마다 author(쓴 사람) · canDelete · canReport 가 오면 그 값으로
 *    버튼을 정함 (주인이 볼 때는 둘 다 true). 탈퇴한 사람은 눌러도 프로필 팝업이 열리지 않음 (00 공통 4)
 *  onDelete 가 Promise 를 돌려주면 끝난 뒤(false 가 아니면) 완료 토스트
 */
export { GUESTBOOK_PAGE_SIZE }

/** 방명록 글 (예전 모양 + 서버가 준 쓴 사람 · 할 수 있는 일) */
export type GuestbookRow = GuestbookEntry & { author?: User; canDelete?: boolean; canReport?: boolean }
/** 서버 페이지 (GET /burrows/{burrowId}/guestbook-entries) */
export interface GuestbookServerPage { page: number; totalPages: number; totalItems: number; onPage: (p: number) => void; fetching?: boolean }

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

export default function GuestbookModal({ open, onClose, entries, onDelete, onDeleteOwn, onReport, compose, load, server }: {
  open: boolean; onClose: () => void; entries: GuestbookRow[]; onDelete?: (id: string) => void | Promise<unknown>; onDeleteOwn?: (id: string) => void
  /** 신고 접수 (사유 문구는 ReportDialog 가 준 값). 3명이 되면 부르는 쪽 목록에서 빠짐 */
  onReport?: (id: string, reason: string) => void; compose?: GuestbookCompose; load?: GuestbookLoad
  /** 서버가 나눈 페이지 (주면 entries 는 그 페이지 글만) */
  server?: GuestbookServerPage
}) {
  const [localPage, setPage] = useState(1)
  const page = server ? server.page : localPage
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [toast, setToast] = useState<ToastSpec | null>(null)
  const authorById = (id: string): User => (id === ME_ID ? { ...userOf(id), nickname: getMyProfile().nickname } : userOf(id))
  const authorOf = (g: GuestbookRow): User => g.author ?? authorById(g.authorId)
  const target = entries.find((g) => g.id === confirmId)
  const total = server ? Math.max(1, server.totalPages) : Math.max(1, Math.ceil(entries.length / GUESTBOOK_PAGE_SIZE))
  const count = server ? server.totalItems : entries.length
  useEffect(() => { if (!server && localPage > total) setPage(total) }, [server, localPage, total])
  useEffect(() => { if (open && !server) setPage(1) }, [open, server])
  const shown = server ? entries : entries.slice((page - 1) * GUESTBOOK_PAGE_SIZE, page * GUESTBOOK_PAGE_SIZE)
  const openProfile = (a: User) => { if (a.id !== GONE_ID) setProfile(a) }
  const del = (id: string) => {
    const r = onDelete?.(id)
    if (r instanceof Promise) void r.then((ok) => { if (ok !== false) setToast(TOAST.deleted) })
    else setToast(TOAST.deleted)
  }

  return (
    <>
      <Modal open={open && !profile} onClose={onClose} width={825} labelledBy="gb-all-title">
        <div className={s.gbModal}>
          <h2 id="gb-all-title" className={`display ${s.gbModalTitle}`}>방명록 <span className="count-badge">{count}</span></h2>
          {compose && (
            <div className={s.gbCompose}>
              <div className={s.gbComposeRow}>
                <input type="text" value={compose.value} maxLength={compose.max} onChange={(e) => compose.onChange(e.target.value)} aria-label="방명록 남기기" aria-describedby="gb-count"
                  placeholder={compose.placeholder}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); compose.onSubmit() } }} />
                <button className={`btn btn-primary ${s.gbSend}`} onClick={compose.onSubmit} disabled={!compose.value.trim()}><SendIcon size={15} /> 남기기</button>
              </div>
              <span id="gb-count" className={s.gbCount}>{compose.value.length} / {compose.max}</span>
            </div>
          )}
          {load?.loading ? (
            <div role="status" aria-busy="true" aria-label="방명록을 불러오는 중" style={{ marginTop: 12 }}><SkeletonLines lines={4} /></div>
          ) : load?.error && entries.length === 0 ? (
            <ErrorState compact error={load.error} onRetry={load.onRetry} retrying={load.retrying} title="방명록을 불러오지 못했어요" />
          ) : entries.length === 0 && count === 0 ? (
            <div className={s.gbEmptyBox}><EmptyMole message={compose ? '가장 먼저 방명록을 작성해보세요.' : '아직 아무도 방명록을 남기지 않았어요'} /></div>
          ) : (
            <ul className={s.gbModalList} aria-busy={server?.fetching}>
              {shown.map((g) => {
                const author = authorOf(g)
                const flags = g.canDelete !== undefined || g.canReport !== undefined
                return (
                  <li key={g.id} className={m.gbRow}>
                    <button className={m.gbAvatar} onClick={() => openProfile(author)} aria-label={`${author.nickname} 프로필 보기`}><Avatar size={52} /></button>
                    <div className={m.gbBody}>
                      <p className={m.gbMeta}><button onClick={() => openProfile(author)}>{author.nickname}</button><span>{gbTime(g.createdAt)}</span></p>
                      <p className={m.gbText}>{g.text}</p>
                    </div>
                    <div className={m.gbActions}>
                      {flags && onDelete ? (
                        <>
                          {g.canDelete && <button onClick={() => setConfirmId(g.id)}>삭제</button>}
                          {g.canDelete && g.canReport && <span aria-hidden>|</span>}
                          {g.canReport && <button onClick={() => setReportId(g.id)}>신고</button>}
                        </>
                      ) : onDelete ? (
                        <><button onClick={() => setConfirmId(g.id)}>삭제</button><span aria-hidden>|</span><button onClick={() => setReportId(g.id)}>신고</button></>
                      ) : onDeleteOwn && (flags ? g.canDelete : g.authorId === ME_ID) ? (
                        // 방문자 뷰: 서버가 준 canDelete · canReport 를 따름 (명세 04 API, 자기 글만 canDelete). 목 데이터에 값이 없으면 ME_ID 로
                        <button onClick={() => { onDeleteOwn(g.id); setToast(TOAST.deleted) }}>삭제</button>
                      ) : !flags || g.canReport ? (
                        <button onClick={() => setReportId(g.id)}>신고</button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {(server ? server.totalPages > 1 : entries.length > GUESTBOOK_PAGE_SIZE) && (
            <div className={s.gbPager}><Pagination page={page} total={total} onChange={server ? server.onPage : setPage} /></div>
          )}
        </div>
        <ConfirmDialog open={!!target} onClose={() => setConfirmId(null)}
          onConfirm={() => { if (target) del(target.id) }}
          title={`${target ? authorOf(target).nickname : ''}님의 방명록을 삭제할까요?`}
          desc="내 땅굴에서 사라지고 되돌릴 수 없어요. 작성자에게 따로 알림은 가지 않아요." />
        <ReportDialog open={!!reportId} target="방명록" onClose={() => setReportId(null)} onConfirm={(reason) => { if (reportId) onReport?.(reportId, reason); setReportId(null); setToast(TOAST.reported) }} />
      </Modal>
      <ProfilePopup user={profile} onClose={() => setProfile(null)} />
      <Toast open={!!toast} title={toast?.title ?? ''} desc={toast?.desc} onClose={() => setToast(null)} />
    </>
  )
}
