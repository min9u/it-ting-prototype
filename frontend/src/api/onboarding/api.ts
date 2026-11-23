/** 03 온보딩 — 실제/목 고르기 (NEXT_PUBLIC_API_REAL_AREAS=onboarding) */
import { selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const onboardingApi = selectArea('onboarding', real, mock)
