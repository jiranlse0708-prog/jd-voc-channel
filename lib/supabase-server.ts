import { createClient } from '@supabase/supabase-js'

/**
 * 서버 전용 Supabase admin 클라이언트 (service_role 키 사용)
 * - RLS 우회 가능 → API Route 내부에서만 사용
 * - 클라이언트 컴포넌트에서 절대 import 금지
 */
export function createAdminClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.'
    )
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
