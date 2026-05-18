import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendStatusChanged, sendCommentAdded } from '@/lib/mail'

/* ─── ADF → 평문 텍스트 ─── */
function adfToText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as Record<string, unknown>
  if (n.type === 'text')       return (n.text as string) ?? ''
  if (n.type === 'hardBreak')  return '\n'
  if (Array.isArray(n.content)) return (n.content as unknown[]).map(adfToText).join('')
  return ''
}

export async function POST(req: NextRequest) {
  /* ── 시크릿 검증 ── */
  const secret = req.nextUrl.searchParams.get('secret')
  if (process.env.JIRA_WEBHOOK_SECRET && secret !== process.env.JIRA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event    = payload.webhookEvent as string | undefined
  const issue    = payload.issue    as Record<string, unknown> | undefined
  const issueKey = issue?.key as string | undefined

  if (!issueKey) {
    return NextResponse.json({ ok: true, skipped: 'no issue key' })
  }

  const supabase = createAdminClient()

  /* ── VOC 조회 ── */
  const { data: row } = await supabase
    .from('voc_submission')
    .select('id, view_token, requester_email, summary, current_status')
    .eq('jira_issue_key', issueKey)
    .single()

  if (!row) {
    return NextResponse.json({ ok: true, skipped: 'voc not found' })
  }

  /* ── 상태 변경 이벤트 ── */
  if (event === 'jira:issue_updated') {
    const changelog = payload.changelog as Record<string, unknown> | undefined
    const items     = (changelog?.items as Record<string, unknown>[] | undefined) ?? []
    const statusItem = items.find(i => i.field === 'status')

    if (statusItem) {
      const newStatus = (statusItem.toString as string) ?? ''
      const oldStatus = (statusItem.fromString as string) ?? ''
      const changedBy = ((payload.user as Record<string, unknown>)?.displayName as string) ?? '담당자'

      /* DB 업데이트 */
      await supabase
        .from('voc_submission')
        .update({ current_status: newStatus })
        .eq('id', row.id)

      /* 이메일 발송 */
      if (row.requester_email) {
        await sendStatusChanged({
          to:        row.requester_email,
          vocId:     row.id,
          token:     row.view_token,
          summary:   row.summary,
          oldStatus,
          newStatus,
          changedBy,
        }).catch(e => console.error('[mail sendStatusChanged]', e))
      }
    }
  }

  /* ── 댓글 이벤트 ── */
  if (event === 'comment_created' || event === 'comment_updated') {
    const comment    = payload.comment as Record<string, unknown> | undefined
    const author     = ((comment?.author as Record<string, unknown>)?.displayName as string) ?? '담당자'
    const bodyRaw    = comment?.body
    const bodyText   = typeof bodyRaw === 'string' ? bodyRaw : adfToText(bodyRaw)
    const createdAt  = (comment?.created as string) ?? new Date().toISOString()

    /* DB comments 배열에 추가 */
    await supabase.rpc('append_voc_comment', {
      p_id:        row.id,
      p_author:    author,
      p_body:      bodyText,
      p_created_at: createdAt,
    }).catch(async () => {
      /* RPC 없으면 select → update fallback */
      const { data: cur } = await supabase
        .from('voc_submission')
        .select('comments')
        .eq('id', row.id)
        .single()
      const existing = (cur?.comments as unknown[]) ?? []
      await supabase
        .from('voc_submission')
        .update({ comments: [...existing, { author, body: bodyText, created_at: createdAt }] })
        .eq('id', row.id)
    })

    /* 이메일 발송 */
    if (row.requester_email) {
      await sendCommentAdded({
        to:          row.requester_email,
        vocId:       row.id,
        token:       row.view_token,
        summary:     row.summary,
        author,
        commentText: bodyText,
      }).catch(e => console.error('[mail sendCommentAdded]', e))
    }
  }

  return NextResponse.json({ ok: true })
}
