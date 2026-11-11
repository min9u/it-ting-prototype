import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import GuestbookItem from '../../components/GuestbookItem'
import Pagination from '../../components/Pagination'
import { ConfirmDialog, EmptyMole } from '../../components/Feedback'
import { userOf } from '../../data/mock'
import type { GuestbookEntry } from '../../data/types'
import s from './Burrow.module.css'

/**
 * 방명록이 6개일 때부터 페이징, 한 페이지 최대 5개 (주석 454:7052)
 * 2026-11-11: 삭제 전 확인 팝업 610:12456, 0개일 때 빈 상태 573:8008
 */
export const GUESTBOOK_PAGE_SIZE = 5

export default function GuestbookModal({ open, onClose, entries, onDelete }: {
  open: boolean; onClose: () => void; entries: GuestbookEntry[]; onDelete?: (id: string) => void
}) {
  const [page, setPage] = useState(1)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const target = entries.find((g) => g.id === confirmId)
  const total = Math.max(1, Math.ceil(entries.length / GUESTBOOK_PAGE_SIZE))
  useEffect(() => { if (page > total) setPage(total) }, [page, total])
  useEffect(() => { if (open) setPage(1) }, [open])
  const shown = entries.slice((page - 1) * GUESTBOOK_PAGE_SIZE, page * GUESTBOOK_PAGE_SIZE)

  return (
    <Modal open={open} onClose={onClose} width={825} labelledBy="gb-all-title">
      <div className={s.gbModal}>
        <h2 id="gb-all-title" className={`display ${s.gbModalTitle}`}>방명록 <span className="count-badge">{entries.length}</span></h2>
        {entries.length === 0 ? (
          <div className={s.gbEmptyBox}><EmptyMole message="아직 아무도 방명록을 남기지 않았어요" /></div>
        ) : (
          <ul className={s.gbModalList}>
            {shown.map((g) => <GuestbookItem key={g.id} entry={g} variant="full" onDelete={onDelete ? setConfirmId : undefined} />)}
          </ul>
        )}
        {entries.length > GUESTBOOK_PAGE_SIZE && (
          <div className={s.gbPager}><Pagination page={page} total={total} onChange={setPage} /></div>
        )}
        <p className={s.gbNote}>방명록은 7일이 지나면 자동으로 사라져요.</p>
      </div>
      <ConfirmDialog open={!!target} onClose={() => setConfirmId(null)} onConfirm={() => target && onDelete?.(target.id)}
        title={`${target ? userOf(target.authorId).nickname : ''}님의 방명록을 삭제할까요?`}
        desc="내 땅굴에서 사라지고 되돌릴 수 없어요. 작성자에게 따로 알림은 가지 않아요." />
    </Modal>
  )
}
