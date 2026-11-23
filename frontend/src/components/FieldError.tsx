import { fieldError, formError } from '../lib/validation'

/**
 * 서버 에러 문구 자리 (lib/validation.ts "서버 에러 자리").
 * - field 를 주면 그 칸의 오류(fieldErrors[].field === field)만, 없으면 칸에 붙지 않은 오류(폼 전체)
 * - 오류가 없으면 아무것도 그리지 않음. 생기면 role="alert" 로 읽어 줌
 * 입력칸에는 aria-describedby={id} 와 aria-invalid 를 같이 달 것
 *
 *   const [err, setErr] = useState<unknown>(null)
 *   try { await createPost(d) } catch (e) { setErr(e) }
 *   <input aria-describedby="w-title-err" aria-invalid={!!fieldError(err, 'title')} … />
 *   <FieldError id="w-title-err" error={err} field="title" />
 */
export default function FieldError({ id, error, field, className = 'error' }: { id?: string; error: unknown; field?: string; className?: string }) {
  const msg = field ? fieldError(error, field) : formError(error)
  if (!msg) return null
  return <p id={id} className={className} role="alert">{msg}</p>
}
