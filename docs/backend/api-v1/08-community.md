# 08 커뮤니티 (게시판) — API v1 맞추기 (2026-11-22)

- 요청: 백엔드 확정 API 명세 v1 과 서비스 명세(`team-spec/spec/08-community.md`, 팀의 단 하나의 기준)에 커뮤니티 영역을 맞춘다. 영역 폴더 `app/src/api/community/` (신고 `POST /reports` · 사진 `POST /images` 포함)
- 기준: [api/08-community.md](../team-spec/api/08-community.md), [spec/08-community.md](../team-spec/spec/08-community.md), [api-convention.md](../team-spec/api-convention.md) "파일 올리기", 작업 규칙 [api-v1-foundation.md](../api-v1-foundation.md) 2장
- 결론: **명세 23개 API 를 모두 `ENDPOINTS` 로 옮기고 `PENDING` 을 비웠다.** 게시판 화면 7개는 이제 `api/community` 의 훅 · 함수로만 읽고 쓴다(`data/boardStore` 는 목 서버의 "DB" 로만 남음)
- 다음 단계: 백엔드가 커뮤니티를 구현하면 `VITE_API_REAL_AREAS` 에 `community` 를 더해 실제 서버로 확인. 아래 "확인할 것" 을 백엔드와 맞춘다

## 1. 만든 API (ENDPOINTS 23 · PENDING 0)

| API | `communityApi.` | 훅 · 쓰는 화면 |
|---|---|---|
| `GET /posts` | `list` | `usePostList` — 커뮤니티 목록 (탭 · 내 관심사만 · 관심사 칩 · 정렬 · 검색 · 페이지) |
| `GET /posts/highlights` | `highlights` | `usePostHighlights` — 이번 주 인기 글 TOP5 · 많이 이야기하는 관심사 (목록 · 내 활동 화면 오른쪽) |
| `POST /posts` | `create` | `useSavePost` — 글쓰기 |
| `GET /posts/{postId}` | `get` | `usePostDetail` — 글 상세 · 글 수정 |
| `PATCH /posts/{postId}` | `update` | `useSavePost({ id })` — 글 수정 (모든 값을 보냄) |
| `DELETE /posts/{postId}` | `remove` | `usePostActions().removePost` (상세) · `useDeletePost` (내가 쓴 글, 목록에 머묾) |
| `POST /posts/{postId}/views` | `view` | `usePostView` — 상세를 열 때 한 번 (글 수정 화면은 안 부름) |
| `GET /posts/{postId}/related-posts` | `related` | `useRelatedPosts` — 다음 읽을 글 3개 |
| `PUT · DELETE /posts/{postId}/like` | `setLike` | `usePostActions().setLike` (낙관적, 응답의 likeCount 로 맞춤) |
| `PUT · DELETE /posts/{postId}/bookmark` | `setBookmark` | `useBookmark` — 목록 카드 · 상세 · 저장한 글 · 댓글 단 글 (낙관적, 저장한 글 목록에서 끄면 바로 빠짐) |
| `GET /posts/{postId}/comments` | `comments` | `useComments` (useInfiniteQuery, 10개씩 커서) |
| `POST /posts/{postId}/comments` | `addComment` | `usePostActions().addComment` — 서버가 만든 댓글을 끝에(답글이면 `parentCommentId` 의 답글 끝에) 붙임 |
| `PATCH /comments/{commentId}` | `editComment` | `usePostActions().editComment` (낙관적) |
| `DELETE /comments/{commentId}` | `deleteComment` | `usePostActions().deleteComment` — 응답의 `commentCount` 로 수 맞춤 |
| `PUT · DELETE /comments/{commentId}/like` | `setCommentLike` | `usePostActions().setCommentLike` (낙관적) |
| `GET /me/posts` | `myPosts` | `useMyPosts` — 내가 쓴 글 · 댓글 단 글 · 저장한 글 (`tab`) |
| `GET /me/posts/summary` | `myPostsSummary` | `useMyPostsSummary` — 내 활동 개수 |
| `GET /me/linkable-meetups` | `linkableMeetups` | `useLinkableMeetups` — 글쓰기 · 글 수정의 모임 연결 |
| `POST /images` | `uploadImage` | `useUploadImage` — "사진 추가" 로 고를 때마다 한 장씩 (FormData `file`) |
| `POST /reports` | `createReport` | `useReport` — 글 · 댓글 신고. 다른 영역도 이 훅이나 `reportBody` + `communityApi.createReport` 를 쓰면 됨 |

- DTO 는 명세 그대로 (`types.ts`): 숫자 id, UTC 시각, enum `PROMOTION · REVIEW · FREE`, `LATEST · POPULAR · MOST_COMMENTED`, `WRITTEN · COMMENTED · BOOKMARKED`, 신고 사유 `SPAM · ABUSE · OBSCENE · ETC`(옛 `SEXUAL` → `OBSCENE`), 대상 `POST · COMMENT · MEMBER · GUESTBOOK`(옛 `MEETUP` 은 명세에 없음)
- 글에 연결한 모임은 07 의 "모임 카드" 를 **이 폴더에 따로**(`PostMeetupCardDto`) 두었다. 모임 영역 DTO 가 바뀌어도 깨지지 않게 (규칙 2)
- 매퍼(`mappers.ts`): 화면 모양 `PostCardVM` · `MyPostCardVM` · `PostDetailVM` · `CommentThreadVM` · `LinkedMeetupVM` · `HighlightsVM` · `MySummaryVM`. 사람은 공통 `toPersonFromDisplay`
- 에러 문구(`errors.ts`): `POST_NOT_FOUND` · `POST_HIDDEN` · `POST_EDIT_NOT_ALLOWED` · `COMMENT_NOT_FOUND` · `COMMENT_EDIT_NOT_ALLOWED` · `MEETUP_NOT_FOUND` · `MEETUP_NOT_LINKABLE` · `FORBIDDEN` · `ALREADY_REPORTED` · `OWN_TARGET_NOT_ALLOWED` · `REPORT_TARGET_NOT_FOUND`. 화면은 `code` 로만 가른다
- 목 서버(`mock.ts`): `data/boardStore` 를 DB 로 써서 명세의 검사 순서 · 에러 코드 · 거르기 · 정렬 · 페이지 · 커서 · 수 세기를 흉내 냄. 사진은 object URL 을 기록하고 id 를 줌(붙이면 다른 글에 못 씀)

## 2. 화면 (screens/board) — 모두 API 로

| 화면 | 바꾼 것 |
|---|---|
| 커뮤니티 `/board` | 목록 · 인기 글 · 관심사 · 내 활동을 각 API 로. 검색은 **입력이 멈춘 뒤 300ms** 에 부름(api 08 "입력이 멈춘 뒤에 부르기"). 검색어 50자 제한 |
| 글 상세 `/board/:id` | 상세 · 조회수 · 댓글(커서) · 다음 읽을 글을 각 API 로. `POST_HIDDEN`(404) 은 "신고로 가려진 글이에요", `POST_NOT_FOUND` 는 "삭제된 글이에요" 안내 화면. 겹치는 관심사는 서버의 `authorSharedInterests`. 수정 메뉴는 `canEdit` 일 때만 |
| 글쓰기 · 글 수정 | 저장은 `POST · PATCH /posts`, 사진은 고를 때 `POST /images`, 모임 후보는 `GET /me/linkable-meetups`. 수정 화면은 `GET /posts/{id}` 로 채움(전에는 저장소를 직접 읽음) |
| 저장한 글 · 내가 쓴 글 · 댓글 단 글 | `GET /me/posts?tab=…` 로 (전에는 저장소 전체를 화면에서 거름). "외 N개" = `myCommentCount - 1`, "11월 9일 저장" = `bookmarkedAt` |
| 신고 팝업 | `POST /reports`. 이미 신고했으면 "이미 신고했어요" 토스트 |

- `data/boardStore.ts` 는 화면이 부르지 않는다 (목 서버만). 화면용 상수(`BOARD_CATS` · `PAGE_SIZE` · `TAG_MAX` · `PHOTO_MAX` · 시간 표기)는 `screens/board/parts.tsx` 로 옮김
- 사람 표시는 응답의 사용자 표시(`Person`)를 그대로 씀 (전에는 `USERS[id]` 를 찾음)

## 3. 명세에 맞춰 더하거나 뺀 기능

더한 것
- **모임 후기 글은 모임 연결 필수**(내가 열었거나 참여가 확정된 지난 모임만). 그런 모임이 없으면 "후기를 쓸 수 있는 모임이 없어요" 안내, 등록 불가 (전에는 홍보만 필수)
- 자유 글의 모임 후보에서 **취소된 모임을 뺌**, 모임 홍보는 **내가 연 모집 중 모임**만 (서버가 줌)
- 글 수정: 연결한 모임이 그사이 모집 완료돼 후보에 없으면, 카테고리를 안 바꿨을 때 그대로 보여 주고 그대로 보냄 (api 08 linkable-meetups "주는 방식")
- 사진: JPEG · PNG · WebP, 한 장 5MB 까지 (고를 때 막고 안내). 올리는 중에는 등록 버튼을 끔
- 조회수: **작성자가 열어도 센다** (전에는 작성자 제외)
- 이번 주 인기 글: **점수(최근 7일 좋아요) 0 인 글은 뺌** → 5개보다 적을 수 있음
- 댓글: 서버 커서로 10개씩 "댓글 10개 더 보기", 댓글 단 글에서 온 `#댓글id` 는 **그 댓글이 나올 때까지 이어 받아** 그 자리로
- 가려진 내 댓글: 본문 없이 "신고로 가려진 댓글이에요" + 삭제만 (수정 없음)
- 검색 결과 없음의 "필터 초기화" 가 검색창 글자도 비움

뺀 것
- 상세 응답의 이전/다음 글(`prevId · nextId`, 옛 초안) — 명세에 없음. 화면은 원래 쓰지 않았음
- 다음 읽을 글을 목록 API(인기순 4개)로 흉내 내던 것 → `related-posts` 로
- 목 데이터 쪽 "모임 연결 후보" 계산(`linkableMeetups` · `meetupWhen` …)을 저장소에서 지움 → 서버(목 서버)가 함

## 4. 애매한 곳 — 이렇게 정함

| 곳 | 정한 것 |
|---|---|
| "댓글 10개 더 보기" 문구 | 서버가 남은 댓글 수를 주지 않아 명세 문구 그대로 "댓글 10개 더 보기" (마지막 쪽에서 10개보다 적을 수 있음) |
| 쓴 댓글을 끝에 붙일 때 아직 안 받은 쪽이 있으면 | 명세대로 받은 목록 끝에 붙이고, 나중에 그 쪽을 받으면 같은 id 는 한 번만 보이게(`flattenComments`) |
| 상세와 조회수를 같이 부를 때의 순서 | 둘 다 부르고, 화면은 `max(상세 viewCount, views 응답)` 을 보여 줌 |
| 관심사 대분류 이름 ↔ id | 화면 · 주소(`?interest=아웃도어`)는 이름. 응답에서 본 `{id, name}` 을 기억해 요청에 id 로 바꿈. 못 본 이름은 앱 대분류 표의 코드로 (목 서버용). **실제 서버에서는 `GET /interest-categories`(온보딩 영역) 로 표를 채워야 함** → 아래 확인할 것 |
| 글쓰기의 관심사 태그 후보 | 지금은 앱의 대분류 12개 표(`data/mock CATEGORIES`) 그대로. 위와 같은 이유로 온보딩 영역의 관심사 목록 훅이 생기면 그것으로 |
| "글쓴이" 표시(댓글) · 공유 링크 복사 | 명세에 없지만 빼라는 말도 없는 표시 · 프론트 동작이라 둠 |
| 신고 대상이 방명록 글일 때(목) | 방명록은 탐색 영역의 목 저장소에 있어 이 영역 목은 "한 번만" 만 셈. 탐색 영역 목이 `registerMockReportTarget('GUESTBOOK', fn)`(`api/community/mock.ts`) 으로 대상 확인 · 가림을 끼울 수 있게 해 둠 |
| `reportBody('MEETUP', …)` | 모임 신고는 명세 범위 밖. 모임 화면이 아직 부르므로 빌드가 깨지지 않게 `'MEETUP'` 도 받아만 둠 (모임 작업자가 지우면 같이 지워도 됨) |
| 사진 형식 검사 | 서버는 내용으로 본다. 프론트는 고를 때 MIME 과 크기로만 막음 |

## 5. 백엔드 · 팀에 확인할 것

1. **관심사 대분류 id**: 글 목록의 `interestCategoryId` · 글쓰기의 `interestCategoryIds` 는 숫자 id 다. 앱은 대분류를 이름(코드)으로 다룬다 → `GET /interest-categories` 의 id 를 쓰는 것이 맞는지, 대분류에 고정 코드(`OUTDOOR` 등) 칸을 둘 수 있는지 (온보딩 영역과 같은 질문)
2. **`POST /images` 실패 코드**: 형식 · 크기 위반이 `INVALID_INPUT` + `fields[{field:'file'}]` 인지 (명세에 field 이름이 없음). 너무 큰 파일을 서버 앞단(프록시)이 413 으로 끊을 수 있는지
3. **`DELETE /posts/{id}/like` · `/bookmark` 를 가려진 · 삭제된 글에 부를 때**: 명세는 "공통 에러만" — 성공(멱등)으로 답하는지 404 인지
4. **댓글 단 글의 "내 댓글 한 줄" 이 가려진 내 댓글이면**: `myLatestComment.content` 가 본문인지 null 인지 (댓글 모양은 가려지면 null)
5. **조회수**: StrictMode · 빠른 새로고침으로 같은 사람이 잇달아 부르면 다 센다 (명세 "열 때마다"). 서버에서 짧은 시간 중복을 거를지
6. 07 모임 카드의 `recruitStatus` 이름: 이 문서는 `PAST`, 모임 영역의 옛 목은 `ENDED` 를 썼음 → 명세 07 기준 `PAST` 로 맞춤
7. 명세 open-issues 61: 커뮤니티 화면의 "땅굴 놀러 가기" · "모임 보기" · 내가 쓴 글 빈 상태 "글쓰기" 의 가는 곳 — 지금은 각각 `/burrow/{작성자}` · `/meetups/{id}` · `/board/write`

## 6. 공통 파일

- 공통 파일은 고치지 않았다. `App.tsx` 라우트도 그대로 (주소 같음)
- 다른 영역이 가져다 쓰는 것: `reportBody`(VisitBurrow · MeetupDetail), `REPORT_REASON_CODE`(admin 목), `ReportReason` · `ReportTargetType`(meetups · explore · admin 의 real/types) — 이름 그대로 둠. `ReportReason` 의 `SEXUAL` 이 `OBSCENE` 으로, `ReportTargetType` 에서 `MEETUP` 이 빠짐 (지금 쓰는 곳은 컴파일 됨)

## 7. 확인한 것

- `npx tsc -b --noEmit` · `npm test`(34 파일, 456 통과 · 84 todo — 커뮤니티 todo 0) · `npm run build` 통과
- 새 시험 `src/tests/community-api.test.ts` (21개): 목록 거르기 · 정렬 · 없는 쪽, 인기 글, 가려진 · 삭제된 글 코드, 가려진 내 글 `canEdit`, 조회수, 다음 읽을 글, 글쓰기 검사 · 모임 연결 · 사진 붙이기 · "수정됨", 댓글 커서 · 답글의 답글(`parentCommentId` · `mentionUser`) · 고치기 · 지우기, 좋아요 · 저장 멱등, 내 활동 3탭 · 개수, 신고 코드 4종
- 개발 서버(5416)에서 `npm run smoke -- --only=board` 16화면 OK (콘솔 에러 · 실패 요청 없음). 목록 · 상세 · 수정 · 댓글 단 글 스크린샷 확인
