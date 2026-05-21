import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

/* ── 이메일 형식 (간단 검증) ── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* ── Rate Limit: IP당 1분 30회 (이메일 열거 공격 방어) ───────────
 * 모듈 스코프 Map. 서버 인스턴스 단위로 유지되며, 인스턴스 간 공유는 안 됨.
 * 기본적인 남용 방어 수준이며, 정교한 보안이 필요하면 외부 스토리지(Redis 등)로 교체.
 */
const LIMIT = 30
const WINDOW_MS = 60 * 1000
const rateLimit = new Map<string, { count: number; resetAt: number }>()

function getIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

function allowRequest(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimit.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= LIMIT) return false
  entry.count++
  return true
}

/* ── GET /api/voc/my?email={email} ────────────────────────────── */
export async function GET(req: NextRequest) {
  /* 1) Rate Limit */
  const ip = getIp(req)
  if (!allowRequest(ip)) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429 }
    )
  }

  /* 2) 입력 검증 */
  const rawEmail = req.nextUrl.searchParams.get('email') ?? ''
  const email = rawEmail.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: '이메일이 필요합니다.' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  /* 3) 조회 — 본인 접수만, '삭제' 제외, 최신순 50건 */
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('voc_submission')
    .select('id, view_token, product, voc_type, summary, current_status, jira_issue_key, comments, created_at')
    .eq('requester_email', email)
    .neq('current_status', '삭제')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[GET /api/voc/my]', error)
    return NextResponse.json(
      { error: '조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }

  /* 4) 응답 변환 — comments 본문은 제외하고 개수만 노출 + JIRA URL 조립 */
  const jiraHost = (process.env.JIRA_HOST ?? '').replace(/\/$/, '')
  const items = (data ?? []).map(row => ({
    id:               row.id,
    view_token:       row.view_token,
    product:          row.product,
    voc_type:         row.voc_type,
    summary:          row.summary,
    current_status:   row.current_status,
    jira_issue_key:   row.jira_issue_key,
    jira_url:         row.jira_issue_key && jiraHost ? `${jiraHost}/browse/${row.jira_issue_key}` : null,
    comments_count:   Array.isArray(row.comments) ? row.comments.length : 0,
    created_at:       row.created_at,
  }))

  return NextResponse.json({ items, count: items.length })
}
