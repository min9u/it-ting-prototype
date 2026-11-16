import Modal from '../../components/Modal'
import fb from '../../components/Feedback.module.css'

/**
 * 00 공통 18 저장 전 취소: 수정하던 내용이 있는데 취소·닫기를 누르면 띄움.
 * "나가기" = 버리고 이전 화면, "계속 수정" = 모달만 닫음 (×·바깥·ESC 도 계속 수정)
 */
export default function UnsavedDialog({ open, onStay, onLeave }: { open: boolean; onStay: () => void; onLeave: () => void }) {
  return (
    <Modal open={open} onClose={onStay} width={400} labelledBy="unsaved-title" hideClose>
      <div className={fb.confirm}>
        <h2 id="unsaved-title" className="display">아직 저장되지 않았습니다</h2>
        <p>지금 나가면 수정한 내용이 사라져요.</p>
        <div className={fb.actions}>
          <button className="btn btn-line" onClick={onStay}>계속 수정</button>
          <button className="btn btn-cta" onClick={onLeave}>나가기</button>
        </div>
      </div>
    </Modal>
  )
}
