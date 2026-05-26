import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { addJiraComment, JiraAuthError } from '@/lib/jira'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      vocId:      number
      viewToken:  string
      authorName: string
      body:       string
    }

    const { vocId, viewToken, authorName, body: commentBody } = body

    /* ── 1. 입력 검증 ── */
    if (!vocId || !viewToken || !authorName?.trim() || !commentBody?.trim()) {
      return NextResponse.json(
        { error: '필수 항목이 누락되었습니다.' },
        { status: 400 },
      )
    }
    if (commentBody.length > 5000) {
      return NextResponse.json(
        { error: '댓글은 5,000자 이내로 작성해 주세요.' },
        { status: 400 },
      )
    }

    /* ── 2. VOC 조회 + view_token 검증 ── */
    const supabase = createAdminClient()
    const { data: row, error: dbErr } = await supabase
      .from('voc_submission')
      .select('id, view_token, jira_issue_key, comments')
      .eq('id', vocId)
      .single()

    if (dbErr || !row) {
      return NextResponse.json({ error: '접수 건을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (row.view_token !== viewToken) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }
    if (!row.jira_issue_key) {
      return NextResponse.json(
        { error: 'JIRA 이슈가 연결되지 않은 접수입니다.' },
        { status: 400 },
      )
    }

    /* ── 3. JIRA 댓글 등록 ── */
    let jiraCommentId: string
    try {
      const result = await addJiraComment(row.jira_issue_key, authorName.trim(), commentBody.trim())
      jiraCommentId = result.id
    } catch (err) {
      if (err instanceof JiraAuthError) {
        return NextResponse.json(
          { error: 'JIRA 인증 오류가 발생했습니다.', detail: '관리자에게 문의해 주세요.' },
          { status: 500 },
        )
      }
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[comment] JIRA 댓글 등록 실패', errMsg)
      return NextResponse.json(
        { error: 'JIRA 댓글 등록에 실패했습니다.', detail: errMsg },
        { status: 500 },
      )
    }

    /* ── 4. DB comments 배열에 추가 ── */
    const existing = (row.comments as Record<string, unknown>[]) ?? []
    const newComment = {
      jira_comment_id: jiraCommentId,
      author:          authorName.trim(),
      body:            `[${authorName.trim()}] ${commentBody.trim()}`,
      created_at:      new Date().toISOString(),
    }
    const updated = [...existing, newComment]

    await supabase
      .from('voc_submission')
      .update({ comments: updated })
      .eq('id', row.id)

    return NextResponse.json({ ok: true, comment: newComment }, { status: 201 })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/voc/comment]', errMsg)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', detail: errMsg },
      { status: 500 },
    )
  }
}
