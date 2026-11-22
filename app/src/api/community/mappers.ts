/**
 * 08 커뮤니티 DTO → 앱 모양 (data/boardStore 의 BoardPost · BoardComment). 화면은 이 결과만 쓴다.
 */
import { toAppId, toPerson } from '../common'
import { toMeetupCard, type MeetupCardVM } from '../meetups/mappers'
import type { BoardComment, BoardPhoto, BoardPost, Visibility } from '../../data/boardStore'
import type { PostCategory, Tone } from '../../data/types'
import { parseIso } from '../../lib/time'
import type { CommentDto, ContentStatus, PostCategoryCode, PostDetailDto, PostListItemDto } from './types'

const ms = (iso: string | null | undefined) => (iso ? parseIso(iso) : undefined)

export const POST_CATEGORY: Record<PostCategoryCode, PostCategory> = { MEETUP_PROMO: '모임 홍보', MEETUP_REVIEW: '모임 후기', FREE: '자유' }
export const POST_CATEGORY_CODE = Object.fromEntries(Object.entries(POST_CATEGORY).map(([k, v]) => [v, k])) as Record<PostCategory, PostCategoryCode>
const VIS: Record<ContentStatus, Visibility> = { PUBLIC: 'public', HIDDEN: 'hidden', DELETED: 'deleted' }
const TONES: Tone[] = ['sage', 'clay', 'butter', 'sky', 'lilac', 'rose', 'mint', 'sand']
/** 이미지 주소 → 사진 칸. 목 서버의 "tone:<색>" 은 색 칸으로 */
export function toPhoto(url: string): BoardPhoto {
  const m = /^tone:(\w+)$/.exec(url)
  if (m && (TONES as string[]).includes(m[1])) return { tone: m[1] as Tone }
  return { tone: 'sand', url }
}

export interface BoardPostVM extends BoardPost {
  /** 상세에만: 글에 나온 모임 */
  meetupCard?: MeetupCardVM
  prevId?: string | null
  nextId?: string | null
}
export function toBoardPost(d: PostListItemDto | PostDetailDto, comments: CommentDto[] = []): BoardPostVM {
  const detail = 'content' in d ? d : null
  const author = toPerson(d.author)
  const photos = detail ? detail.images.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => toPhoto(i.url)) : d.thumbnailUrl ? [toPhoto(d.thumbnailUrl), ...Array(Math.max(0, d.imageCount - 1)).fill({ tone: 'sand' })] : []
  return {
    id: toAppId(d.id), category: POST_CATEGORY[d.category], interests: d.interests, title: d.title,
    body: detail ? detail.content : d.excerpt, authorId: author.id, at: parseIso(d.createdAt), editedAt: ms(d.editedAt),
    // 앱 저장소는 "나 빼고 센 수 + 내 것" 으로 셈 (likesOf · savesOf)
    views: d.viewCount, likes: d.likeCount - (d.liked ? 1 : 0), liked: d.liked,
    saves: d.bookmarkCount - (d.bookmarkedAt ? 1 : 0), savedAt: ms(d.bookmarkedAt),
    photos, meetupId: detail?.meetup ? toAppId(detail.meetup.id) : undefined,
    status: VIS[d.status], reports: d.status === 'HIDDEN' ? 3 : 0, reportedByMe: d.reportedByMe,
    comments: comments.map(toBoardComment), commentTotal: d.commentCount,
    ...(detail ? { meetupCard: detail.meetup ? toMeetupCard(detail.meetup) : undefined, prevId: detail.prevId, nextId: detail.nextId } : {}),
  }
}
export function toBoardComment(c: CommentDto): BoardComment {
  return {
    id: toAppId(c.id), authorId: toPerson(c.author).id, text: c.content, mention: c.mention?.nickname ?? undefined,
    at: parseIso(c.createdAt), editedAt: ms(c.editedAt), likes: c.likeCount - (c.liked ? 1 : 0), liked: c.liked,
    status: VIS[c.status], reports: c.status === 'HIDDEN' ? 3 : 0, reportedByMe: c.reportedByMe,
    replies: c.replies.map(toBoardComment),
  }
}
