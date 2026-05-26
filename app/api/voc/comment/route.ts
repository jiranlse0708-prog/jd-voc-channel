import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { addJiraComment, updateJiraComment, deleteJiraComment, JiraAuthError } from '@/lib/jira'

export const maxDuration = 30

/* ── 공통: VOC 조회 + view_token 검증 ── */
async function loadVoc(vocId: number, viewToken: string) {
  const supabase = createAdminClient()
  const { data: row, error: dbErr } = await supabase
    .from('voc_submission')
    .select('id, view_token, jira_issue_key, comments')
    .eq('id', vocId)
    .single()

  if (dbErr || !row) return { err: NextResponse.json({ error: '접수 건을 찾을 수 없습니다.' }, { status: 404 }) }
  if (row.view_token !== viewToken) return { err: NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 }) }
  if (!row.jira_issue_key) return { err: NextResponse.json({ error: 'JIRA 이슈가 연결되지 않은 접수입니다.' }, { status: 400 }) }

  return { row, supabase }
}

function jiraErrResponse(err: unknown) {
  if (err instanceof JiraAuthError) {
    return NextResponse.json({ error: 'JIRA 인증 오류가 발생했습니다.', detail: '관리자에게 문의해 주세요.' }, { status: 500 })
  }
  const errMsg = err instanceof Error ? err.message : String(err)
  return NextResponse.json({ error: 'JIRA 요청에 실패했습니다.', detail: errMsg }, { status: 500 })
}

/* ── POST: 댓글 등록 ── */
export async function POST(req: NextRequest) {
  try {
    const { vocId, viewToken, authorName, body: commentBody } = await req.json() as {
      vocId: number; viewToken: string; authorName: string; body: string
    }

    if (!vocId || !viewToken || !authorName?.trim() || !commentBody?.trim()) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
    }
    if (commentBody.length > 5000) {
      return NextResponse.json({ error: '댓글은 5,000자 이내로 작성해 주세요.' }, { status: 400 })
    }

    const loaded = await loadVoc(vocId, viewToken)
    if (loaded.err) return loaded.err
    const { row, supabase } = loaded

    let jiraCommentId: string
    try {
      const result = await addJiraComment(row.jira_issue_key, authorName.trim(), commentBody.trim())
      jiraCommentId = result.id
    } catch (err) {
      console.error('[comment POST] JIRA 실패', err)
      return jiraErrResponse(err)
    }

    const existing = (row.comments as Record<string, unknown>[]) ?? []
    const newComment = {
      jira_comment_id: jiraCommentId,
      author:          authorName.trim(),
      body:            `[${authorName.trim()}] ${commentBody.trim()}`,
      created_at:      new Date().toISOString(),
    }

    await supabase
      .from('voc_submission')
      .update({ comments: [...existing, newComment] })
      .eq('id', row.id)

    return NextResponse.json({ ok: true, comment: newComment }, { status: 201 })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/voc/comment]', errMsg)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.', detail: errMsg }, { status: 500 })
  }
}

/* ── PUT: 댓글 수정 ── */
export async function PUT(req: NextRequest) {
  try {
    const { vocId, viewToken, jiraCommentId, authorName, body: commentBody } = await req.json() as {
      vocId: number; viewToken: string; jiraCommentId: string; authorName: string; body: string
    }

    if (!vocId || !viewToken || !jiraCommentId || !authorName?.trim() || !commentBody?.trim()) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
    }

    const loaded = await loadVoc(vocId, viewToken)
    if (loaded.err) return loaded.err
    const { row, supabase } = loaded

    try {
      await updateJiraComment(row.jira_issue_key, jiraCommentId, authorName.trim(), commentBody.trim())
    } catch (err) {
      console.error('[comment PUT] JIRA 실패', err)
      return jiraErrResponse(err)
    }

    const existing = (row.comments as Record<string, unknown>[]) ?? []
    const updated = existing.map(c =>
      String((c as Record<string, unknown>).jira_comment_id ?? '') === jiraCommentId
        ? { ...c, body: `[${authorName.trim()}] ${commentBody.trim()}` }
        : c
    )

    await supabase
      .from('voc_submission')
      .update({ comments: updated })
      .eq('id', row.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[PUT /api/voc/comment]', errMsg)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.', detail: errMsg }, { status: 500 })
  }
}

/* ── DELETE: 댓글 삭제 ── */
export async function DELETE(req: NextRequest) {
  try {
    const { vocId, viewToken, jiraCommentId } = await req.json() as {
      vocId: number; viewToken: string; jiraCommentId: string
    }

    if (!vocId || !viewToken || !jiraCommentId) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
    }

    const loaded = await loadVoc(vocId, viewToken)
    if (loaded.err) return loaded.err
    const { row, supabase } = loaded

    try {
      await deleteJiraComment(row.jira_issue_key, jiraCommentId)
    } catch (err) {
      console.error('[comment DELETE] JIRA 실패', err)
      return jiraErrResponse(err)
    }

    const existing = (row.comments as Record<string, unknown>[]) ?? []
    const filtered = existing.filter(c =>
      String((c as Record<string, unknown>).jira_comment_id ?? '') !== jiraCommentId
    )

    await supabase
      .from('voc_submission')
      .update({ comments: filtered })
      .eq('id', row.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[DELETE /api/voc/comment]', errMsg)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.', detail: errMsg }, { status: 500 })
  }
}
