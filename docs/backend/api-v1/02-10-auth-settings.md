# 인증 (02) · 설정 · 계정 (10) — API v1 맞추기 (2026-11-22)

- 요청: 백엔드 확정 API 명세 v1 과 서비스 명세(`team-spec/spec/`, 팀의 단 하나의 기준)에 프론트 `app/` 의 인증 · 설정 영역을 맞춘다 ([계획](../api-v1-alignment.md), [공통 계층 · 작업 규칙](../api-v1-foundation.md))
- 결론: 02 의 12개 · 10 의 13개, **25개 API 를 모두 `ENDPOINTS` 로** 옮겼다 (`PENDING` 비움). 로그인 · 가입 · 비밀번호 찾기 · 설정 화면과 로그인 가드는 이제 `api/auth` · `api/settings` 만 부른다. 명세에 있고 화면에 없던 기능(Google 로그인 · 연동 · 해제, 브라우저 푸시 구독, 탈퇴 미리 확인, 탈퇴용 Google 인증, 공지 페이지 API)을 만들고, 명세에서 뺀 차단 관리 화면과 차단 API 초안을 지웠다
- 다음: 백엔드에 아래 "백엔드 · 팀에 물을 것" 확인. 공통 담당이 `queryClient.ts` 에 403 `ONBOARDING_INCOMPLETE` 연결, 다른 영역(채팅 · 프로필 팝업 · 온보딩)이 "다른 영역에 넘길 것"을 처리

---

## 1. 만든 API

### 02 로그인 · 회원가입 (`app/src/api/auth/`)

| API | 함수 (`authApi.`) | 부르는 화면 |
|---|---|---|
| `POST /email-verifications` | `sendEmailCode` | 회원가입 1 "코드 받기 · 재전송" (만료 시각 `expiresAt` 으로 남은 시간) |
| `POST /email-verifications/check` | `checkEmailCode` | 회원가입 1 "다음" (가입 진행 시작) |
| `POST /ssafy-verifications` | `sendSsafyCode` | 회원가입 3 "코드 받기" |
| `POST /users` | `signup` | 회원가입 3 "땅굴 파기" (이메일 가입은 비밀번호를 담고, Google 가입은 빼고) |
| `POST /sessions` | `login` | 로그인 |
| `DELETE /sessions/current` | `logout` | 설정 – 로그아웃 확인 (`lib/signOut.ts`) |
| `GET /me` | `me` · `useMe()` | 로그인 가드(`screens/start/Guards.tsx`), Google 로그인 뒤(`/auth/google`) |
| `GET /oauth/google` | `googleLoginUrl()` | 로그인 "Google로 계속하기" (브라우저 이동, `goGoogle`) |
| `GET /oauth/google/callback` | — (프론트가 부르지 않음) | 서버가 보내는 프론트 주소는 `api/auth/google.ts` `GOOGLE_RETURN` |
| `POST /password-resets` | `requestPasswordReset` | 재설정 메일 요청 · 메일 보냄 "다시 보내기" |
| `GET /password-resets/{token}` | `checkPasswordReset` · `usePasswordResetLink` | 새 비밀번호 설정을 열 때 (404 → 링크 만료 화면) |
| `POST /password-resets/{token}/complete` | `completePasswordReset` | "비밀번호 바꾸기" → 로그인 화면 |

### 10 설정 · 계정 (`app/src/api/settings/`)

| API | 함수 (`settingsApi.`) · 훅 | 부르는 화면 |
|---|---|---|
| `GET /me/account` | `account` · `useAccount()` | 설정 메뉴("비밀번호 변경"을 보일지) · 첫 화면 · Google 연동하기 · 회원 탈퇴(본인 확인 방법) |
| `PATCH /me/password` | `changePassword` · `useChangePassword()` | 비밀번호 변경 |
| `GET /oauth/google/verify?purpose=` | `googleVerifyUrl(purpose)` | Google 연동(LINK) · 탈퇴 전 Google 인증(WITHDRAW) — 브라우저 이동 |
| `PUT /me/google-link` | `linkGoogle` · `useGoogleLink().link` | Google 에서 `?verified=true` 로 돌아왔을 때 |
| `DELETE /me/google-link` | `unlinkGoogle` · `useGoogleLink().unlink` | 연동 해제 확인 |
| `GET /me/notification-settings` | `notificationSettings` · `useNotificationSettings()` | 알림 설정 |
| `PATCH /me/notification-settings` | `updateNotificationSettings` · `useUpdateNotificationSettings()` | 스위치마다 다섯 값을 모두 (낙관적, 실패하면 되돌림, 알림 캐시도 새로) |
| `POST /me/push-subscriptions` | `registerPush` | "브라우저 알림 받기" 켜기 (`lib/browserPush.ts`) |
| `DELETE /me/push-subscriptions/{pushSubscriptionId}` | `deletePush` | 끄기 · 로그아웃 직전 |
| `GET /notices` | `notices` · `useNotices(page)` | 공지사항 (한 페이지 10개) |
| `GET /notices/{noticeId}` | `notice` · `useNotice(id)` | 공지사항 상세 (404 → 안내 화면) |
| `GET /me/withdrawal-check` | `withdrawalCheck` · `useWithdrawalCheck()` | 회원 탈퇴 (열 때 · Google 에서 돌아왔을 때) |
| `POST /me/withdraw` | `withdraw` · `useWithdraw()` | 회원 탈퇴 확인 "탈퇴하기" |

- DTO 는 명세 그대로 (`types.ts`): 숫자 id, UTC 시각, enum 대문자. 앱 모양은 `mappers.ts` (`toMe` · `pathAfterLogin` · `toSuspension` · `toAccount` · `toNoticePage` · `toWithdrawalCheck` …)
- 에러 문구는 `errors.ts` (`AUTH_ERRORS` · `SETTINGS_ERRORS`). 화면은 `code` 로만 나눈다 (칸 밑 문구는 `AUTH_FIELD_OF` 표 · `fieldErrorText`)
- 목 서버(`mock.ts`)는 명세 code 로 실패한다. "DB" 는 `data/auth.ts`(세션 · 시연 계정 · 재설정 링크) · `data/account.ts`(계정 · 푸시 등록 표 · 탈퇴 사유) · `data/notifications.ts`(알림 설정, 알림 영역과 같이) · `data/serviceNotices.ts`(공지) · `data/meetupStore.ts`(탈퇴를 막는 모임, 읽기만)

## 2. 화면 연결

| 화면 | 바뀐 것 |
|---|---|
| 로그인 `/login` | `POST /sessions` → `nextStep` 으로 이동 (`ONBOARDING` 온보딩 1, `HOME` 가려던 주소 · 내 땅굴, `NEW_TERM` 내 땅굴). `LOGIN_FAILED` 는 칸 밑, `ACCOUNT_SUSPENDED` 는 `detail.endsAt` 으로 남은 날을 계산해 팝업. Google 은 브라우저 이동, 돌아온 `?error=` 처리 |
| `/auth/google` (새) | Google 로그인이 된 뒤 서버가 보내는 곳. `GET /me` → `nextStep` 으로 이동 |
| `/oauth/mock-google` (새, 목 서버 전용) | 흉내 Google 계정 고르기. 고른 계정에 따라 목 서버 "콜백"이 정한 주소로 (로그인 · 처음 쓰는 계정 → 회원가입 3 · 정지 · 연동 · 다른 계정이 쓰는 계정 · 탈퇴 인증 · 다른 계정) |
| 회원가입 1 | 코드 받기 · 재전송 · 다음이 API. 남은 시간은 서버의 `expiresAt`. `EMAIL_DUPLICATED` · `TOO_MANY_REQUESTS` 는 이메일 칸, 코드 오류는 코드 칸 |
| 회원가입 2 | API 없음. 비밀번호를 메모리(`screens/start/signupDraft.ts`)에 두었다가 회원가입 3 에서 보냄. 새로 고침해 인증한 이메일이 없으면 회원가입 1 로 |
| 회원가입 3 | 기수 · 캠퍼스 · 층을 `GET /generations` · `GET /campuses` 로 (전에는 `data/*` 표). 코드 받기 · 땅굴 파기가 API. `SIGNUP_EXPIRED` 면 "처음부터" 팝업 (이메일 → 회원가입 1, Google → 로그인) |
| 비밀번호 찾기 4화면 | 요청 · 다시 보내기 · 링크 확인 · 바꾸기가 API. "체험용 · 메일 속 링크 열기"는 목 서버일 때만 |
| 로그인 가드 | `GET /me` (`useMe`, 401 이면 `null`). 비로그인 → 로그인(가려던 주소 기억), `ONBOARDING` → 온보딩 1. 온보딩 라우트는 `<RequireLogin onboarding>` |
| 설정 셸 · 첫 화면 | 메뉴의 "비밀번호 변경"과 첫 화면을 `hasPassword` 로. 차단 메뉴 · 화면 삭제. 로그아웃 = 푸시 등록 지우기 → `DELETE /sessions/current` → 랜딩 → `afterSignOut()`(SSE 끊기 · 채팅 끊기 · 캐시 비우기) |
| 비밀번호 변경 | `PATCH /me/password`. "지금 비밀번호와 같음"은 프론트가 모르므로 서버의 `PASSWORD_UNCHANGED` 로 |
| Google 연동하기 | 연동 = Google 확인(LINK)으로 이동 → `?verified=true` 면 `PUT`, `?error=` 면 안내. 해제 = 확인 팝업 → `DELETE`. `canUnlinkGoogle` 이 false 면 버튼 끔 |
| 알림 설정 | 서버 값 · 낙관적 저장. "브라우저 알림 받기"는 이 브라우저의 권한 + 등록 id 로 (서버가 상태를 주지 않음) |
| 공지사항 · 상세 | 페이지 API · 상세 API · 404 안내 |
| 회원 탈퇴 | `withdrawal-check` 로 막는 모임 · Google 인증 여부, 사유는 코드로, 비밀번호 확인은 "탈퇴하기"에서 서버가. Google 로 다녀오기 전 사유 · 동의를 이 탭에 잠깐 저장했다가 되살림. 성공 → 랜딩 → `afterWithdraw()` |

## 3. 기능: 더한 것 · 뺀 것

| | 전 | 지금 (명세 기준) |
|---|---|---|
| Google 로그인 | 버튼을 누르면 바로 내 땅굴(목) | `GET /oauth/google` 로 이동 → 콜백 → `/auth/google`(로그인) · 회원가입 3(처음) · `/login?error=`(정지 · 취소). 목은 흉내 Google 화면 |
| Google 연동 · 해제 | 화면 안의 가짜 계정 고르기 창 | Google 확인(LINK) 두 걸음 → `PUT /me/google-link`, 해제 `DELETE` |
| 탈퇴 본인 확인 (Google 전용 계정) | 화면 안의 가짜 창 | Google 확인(WITHDRAW) → `isGoogleVerified`(10분) |
| 탈퇴 미리 확인 | `data/mock` 의 모임을 화면이 직접 거름 | `GET /me/withdrawal-check` |
| 브라우저 푸시 | 알림 권한만 묻고 저장소에 켜짐 기록 | 권한 → 구독(실제: 서비스 워커 `public/push-sw.js` + `PushManager`, 목: 구독 모양 흉내) → `POST /me/push-subscriptions`, 받은 id 를 이 브라우저에. 끄기 · 로그아웃 때 `DELETE` |
| 비밀번호 재설정 링크 | 화면이 저장소를 바로 확인 | `GET /password-resets/{token}` 으로 확인 후 화면 |
| 공지 | 저장소 목록을 화면이 잘라 페이지 | `GET /notices?page&size=10` |
| 로그아웃 · 탈퇴 정리 | `stopChatRealtime()` 만 | + `stopEventStream()` · 캐시 비우기 · 푸시 정리 |
| 비밀번호 확인 칸 문구 | "비밀번호가 달라요"(Figma) | "비밀번호가 일치하지 않아요"(명세 02 회원가입 2 · 4) |
| **차단 관리 화면 · 차단 API 초안** | 설정 › 차단 관리 (`/settings/blocked`) | **삭제** (spec/README "이번 범위에 없는 것") |

그대로 둔 것: 3D 모델 크레딧 메뉴(명세 메뉴에는 없지만 CC-BY 표기 의무), `LOGIN_FREE`(팀 공유 빌드, 지금 `true`), 시연 손잡이(`?demo=error|suspended`, `?account=google|email`, `?hosting=0`, `?modal=logout`, `?token=demo`).

## 4. 애매해서 정한 것

1. **Google 콜백 뒤 프론트 주소** (02 "구현 단계로 넘기는 것"): 로그인됨 `/auth/google`, 처음 쓰는 계정 `/signup/ssafy?via=google`, 로그인 못 함 `/login?error=<code>`, 연동 확인됨 `/settings/google?verified=true`, 탈퇴 인증됨 `/settings/leave`, 확인 못 함 `<시작한 화면>?error=<code>`, 로그인 풀림 `/login` (`api/auth/google.ts` `GOOGLE_RETURN`)
2. **Google 로그인 취소의 code**: 명세가 이름을 정하지 않아 목은 `GOOGLE_LOGIN_CANCELED`. 화면은 모르는 code 면 "Google 로그인을 마치지 못했어요"
3. **정지 계정의 Google 로그인**: 사유 · 기간을 `/login?error=ACCOUNT_SUSPENDED&reason=…&endsAt=…` 쿼리로 받는다고 가정. 없으면 "정지된 계정이라 로그인할 수 없어요"만
4. **재설정 메일 속 링크**: `/password-reset/new?token=<token>` (메일 본문을 만드는 백엔드가 이 주소를 써야 함)
5. **재전송 간격 · 코드 유효 시간**: 버튼은 30초 뒤 다시 켬. 남은 시간은 서버의 `expiresAt`. 서버가 429 를 주면 칸 밑에 문구. 목은 코드 5분 · 간격 25초
6. **로그인 뒤 가려던 주소**: `nextStep` 이 `HOME` 일 때만 되돌아감. `ONBOARDING` 이면 온보딩 1, `NEW_TERM` 이면 내 땅굴(새 학기 안내가 먼저)
7. **NEW_TERM**: 가드는 그대로 들여보냄. 새 학기 안내 팝업은 05 탐색 영역
8. **푸시 내용 모양** (10 "구현 단계로 넘기는 것"): 서비스 워커는 `{ title, body, url }` JSON 으로 가정, 글이면 본문
9. **푸시 등록 id 보관**: `localStorage` `digul.push.v1` (`{ id, endpoint }`). 명세: "프론트엔드가 이 브라우저에 보관"
10. **탈퇴 비밀번호 칸**: 규칙 표시 없이 입력만 (명세 "아직 정하지 않은 것": 00 공통 9 가 가리키는 대상이 아님)
11. **비밀번호 변경 "취소"**: 칸만 비움 (확인 없음). 입력 중 다른 메뉴로 나가면 00 공통 18 확인 (전과 같음)
12. **가입 도중 새로 고침**: 이메일 가입은 비밀번호가 메모리에만 있어 회원가입 1 로 (명세 02 "가입 진행"). `LOGIN_FREE` 일 때는 막지 않음 (공유 빌드에서 화면을 바로 열 수 있게, 목 서버가 가입 진행 기록을 만들어 줌)
13. **목 세션의 nextStep**: `data/auth.ts` `mockNextStep()` · `setMockNextStep()` (`sessionStorage`). 가입하면 `ONBOARDING`, `new@ssafy.com` 로그인도 `ONBOARDING`

## 5. 백엔드 · 팀에 물을 것

- 위 4장 1 · 2 · 3 · 4 · 8 을 백엔드 설정 · 구현과 맞출 것 (특히 콜백 뒤 주소와 메일 링크 주소)
- `GET /oauth/google/verify` 는 로그인이 필요한데 이동(302)으로 답한다. 세션이 없을 때 `/login` 으로 보내면 프론트는 돌아갈 곳을 모른다 → 로그인 뒤 설정으로 돌려보낼지
- 서비스 워커 파일(`/push-sw.js`)을 배포 경로 맨 위에 두어도 되는지 (Nginx 에서 `Service-Worker-Allowed` 없이 범위 `/`)
- 공지 알림을 누르면 `/settings/notices/{noticeId}` 로 가는데, 알림 API 가 `noticeId` 를 그 숫자로 주는지 (09 알림 작업자와 함께)
- 회원가입 3 을 Google 가입으로 열었는데 가입 진행 기록이 없으면(`SIGNUP_EXPIRED`) 로그인 화면으로 보낸다. 맞는지

## 6. 다른 영역 · 공통에 넘길 것 (이 작업에서 고치지 않음)

- **공통 (`api/queryClient.ts`)**: 어느 API 든 403 `ONBOARDING_INCOMPLETE` 면 `lib/authFlow.ts` 의 `handleOnboardingIncomplete()` 를 부르게 (QueryCache · MutationCache `onError`). `NEW_TERM_INCOMPLETE` 는 탐색 작업자의 새 학기 안내로
- **공통 (`api/queryClient.ts`)**: `MutationCache` 가 401 이면 무조건 "다시 로그인"으로 보내서, 로그인 실패 `LOGIN_FAILED`(401) 를 `useMutation` 으로 부르면 로그인 화면이 다시 열린다. 그래서 인증 화면은 `useMutation` 없이 `authApi` 를 바로 부른다. `meta.quiet401` 같은 표시를 보게 하면 인증도 훅으로 바꿀 수 있음
- **온보딩 작업자**: 온보딩 확정 목 API 가 `data/auth.ts` 의 `setMockNextStep('HOME')` 을 불러야 `LOGIN_FREE = false` 에서 온보딩을 마친 뒤 가드가 내 땅굴로 들여보낸다 (안 하면 온보딩 1 로 되돌아감)
- **채팅 작업자**: `api/chat/mock.ts` 가 차단 목록(`accountStore.blocked`)으로 대화 · 요청을 거른다. 차단은 명세 범위 밖이라 빼 주면 `data/account.ts` 의 `blocked` · `blockUser` · `isBlocked` · `useBlocked` 를 지운다. `screens/chat/Chat.tsx` 의 `useBlocked` 도. 채팅이 STOMP 를 지우면 `lib/signOut.ts` 의 `stopChatRealtime()` 한 줄도 지울 것
- **프로필 팝업(`components/ProfilePopup.tsx`, 00 공통 15)**: "차단하기" 메뉴가 남아 있다. 명세 15 는 신고 아이콘만
- **알림 작업자**: 알림 설정의 다섯 값은 목 서버에서 `data/notifications.ts` 의 `noticePrefs.kinds` 를 같이 쓴다 (`setNoticeKind`). 설정을 바꾸면 `notificationKeys.all` 을 새로 받게 했다. 목 "서버 푸시"는 `noticePrefs.browserPush` 를 켜서 기존 `pushNotice` 가 브라우저 알림을 띄우게 함

## 7. 확인한 것

- `npx tsc -b --noEmit` · `npm run build` 통과
- `npm test`: 34 파일 · 454 통과 · 85 todo (전 107 todo 에서 02 · 10 의 22개가 빠짐). 새 시험 `src/tests/auth-settings-api.test.ts` 18개(매퍼 · 목 서버 명세 code, `LOGIN_FREE = false` 로 바꿔서). 다른 작업자들과 동시에 돌 때 `field-fence.test.ts` 가 한 번 5초 시간 초과로 실패했지만 다시 돌리면 통과 (느려서, 이 작업과 관계없음)
- 개발 서버(5411) 스모크: `/settings` 12화면 · `/login` · `/signup` 3화면 · `/password-reset` 4화면 · `/auth/google` · `/oauth/mock-google` 모두 OK (콘솔 에러 · 실패 요청 없음). 스크린샷으로 회원가입 3 · 알림 설정 · Google 연동(Google 전용 계정) · 회원 탈퇴 · 흉내 Google 화면 확인
