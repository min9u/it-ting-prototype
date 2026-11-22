/** 10 설정 · 계정 — TanStack Query 훅과 캐시 키 (화면 연결은 인증 · 설정 작업자가) */
export const settingsKeys = {
  all: ['settings'] as const,
  notificationSettings: ['settings', 'notification-settings'] as const,
  notices: ['settings', 'notices'] as const,
  notice: (id: string) => ['settings', 'notices', id] as const,
}

/** 목 모드: 이 영역 저장소가 바뀌면 캐시를 새로 받는 훅 (api/mockSync.tsx 가 부름). 필요하면 useMockStoreSync(…) 를 여기에 */
export function useSettingsMockSync() { /* 아직 지켜볼 저장소 없음 */ }
