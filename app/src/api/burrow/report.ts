/**
 * 이 영역 화면(방명록 전체 보기 · 프로필 팝업)의 "신고" → POST /api/v1/reports (08 커뮤니티 영역이 맡는 API, api/community).
 * 다른 영역 API 를 부르는 곳을 이 파일 하나로 모아 둔다: 커뮤니티 작업자가 신고 본문을 명세 모양(targetId 숫자 · reason OBSCENE)으로
 * 바꾸면 여기만 맞추면 된다.
 * - 방명록 글: targetType GUESTBOOK (04 명세 "방명록 글의 신고는 targetType 을 GUESTBOOK 으로")
 * - 사람(프로필 팝업): targetType MEMBER (08 명세의 이름 그대로)
 */
import { communityApi, reportBody } from '../community'

/** picked = ReportDialog 가 준 사유 문구 ("기타: …" 포함) */
export const reportGuestbookEntry = (entryId: string, picked: string) => communityApi.createReport(reportBody('GUESTBOOK', entryId, picked))
export const reportUser = (userId: string, picked: string) => communityApi.createReport(reportBody('MEMBER', userId, picked))
