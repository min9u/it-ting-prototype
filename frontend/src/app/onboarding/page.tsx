import { redirect } from 'next/navigation'

/** /onboarding → 온보딩 1 (Vite 앱의 <Navigate to="/onboarding/name" replace />) */
export default function OnboardingIndex() {
  redirect('/onboarding/name')
}
