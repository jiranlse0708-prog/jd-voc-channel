import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createJiraIssue, updateJiraIssue, addJiraAttachment, deleteJiraAttachment, JiraAuthError } from '@/lib/jira'
import { sendSubmissionConfirm } from '@/lib/mail'
import { VOC_TYPE_LABEL } from '@/lib/mapping'

export const maxDuration = 30

const BUCKET = 'voc-attachments'

interface AttachmentMeta { name: string; size: number; type: string; path: string; jiraAttachmentId?: string }

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient()

    /* ── 1. JSON 파싱 ── */
    const body = await req.json() as {
      dept:        string
      name:        string
      email:       string
      product:     string
      vocType:     string
      summary:     string
      customer:    string
      priority:    string
      purpose:     string
      screenPath:  string
      detail:      string
      dueDate:     string | null
      attachments: AttachmentMeta[]
    }

    const {
      dept, name, email: rawEmail, product, vocType, summary,
      customer, priority, purpose, screenPath, detail, dueDate,
      attachments = [],
    } = body
    const email = rawEmail?.toLowerCase().trim() ?? ''
    const safeCustomer = (customer ?? '').replace(/\s/g, '')

    /* ── 2. 서버 기본 검증 ── */
    const required = { dept, name, email, product, vocType, summary, purpose, screenPath, detail }
    const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k)
    if (missing.length > 0) {
      return NextResponse.json({ error: `필수 항목 누락: ${missing.join(', ')}` }, { status: 400 })
    }

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 })
    }

    /* ── 3. JIRA 이슈 생성 ── */
    let jiraKey: string
    try {
      const jiraResult = await createJiraIssue({
        dept, name, email, product, vocType, summary,
        customer: safeCustomer, priority, purpose, screenPath, detail, dueDate,
      })
      jiraKey = jiraResult.key
    } catch (jiraErr) {
      if (jiraErr instanceof JiraAuthError) {
        console.error('[JIRA 인증 오류]', jiraErr)
        return NextResponse.json(
          { error: 'JIRA 연동에 인증 오류가 발생했습니다.', detail: '관리자에게 문의해 주세요.' },
          { status: 500 }
        )
      }
      const errMsg = jiraErr instanceof Error ? jiraErr.message : String(jiraErr)
      console.error('[JIRA issue creation failed]', errMsg)
      return NextResponse.json(
        { error: 'JIRA 이슈 등록에 실패했습니다.', detail: errMsg },
        { status: 500 }
      )
    }

    /* ── 4. DB 삽입 ── */
    const { data, error: dbErr } = await supabase
      .from('voc_submission')
      .insert({
        requester_dept:  dept,
        requester_name:  name,
        requester_email: email,
        product,
        voc_type:        vocType,
        summary,
        customer:        safeCustomer || null,
        priority,
        purpose,
        screen_path:     screenPath,
        detail,
        due_date:        dueDate,
        attachments,
        current_status:  '접수',
        jira_issue_key:  jiraKey,
      })
      .select('id, view_token')
      .single()

    if (dbErr) {
      console.error('[DB insert error]', dbErr)
      return NextResponse.json(
        { error: 'DB 저장 중 오류가 발생했습니다.', detail: dbErr.message },
        { status: 500 }
      )
    }

    /* ── 5. JIRA 첨부파일 업로드 (Supabase에서 다운로드 후 JIRA에 업로드) ── */
    const updatedAttachments = [...attachments]
    for (let i = 0; i < attachments.length; i++) {
      const a = attachments[i]
      try {
        const { data: urlData } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(a.path, 60)
        if (!urlData?.signedUrl) continue

        const fileRes = await fetch(urlData.signedUrl)
        if (!fileRes.ok) continue
        const buffer = Buffer.from(await fileRes.arrayBuffer())

        const jiraId = await addJiraAttachment(jiraKey, a.name, buffer, a.type || 'application/octet-stream')
        if (jiraId) updatedAttachments[i] = { ...a, jiraAttachmentId: jiraId }
      } catch (e) {
        console.error(`[JIRA attach failed] ${a.name}:`, e)
      }
    }
    if (updatedAttachments.some(a => 'jiraAttachmentId' in a)) {
      await supabase.from('voc_submission').update({ attachments: updatedAttachments }).eq('id', data.id)
    }

    /* ── 6. 접수 확인 이메일 ── */
    if (email) {
      sendSubmissionConfirm({
        to:      email,
        vocId:   data.id,
        token:   data.view_token,
        summary,
        product,
        vocType:  VOC_TYPE_LABEL[vocType] ?? vocType,
        jiraKey,
      }).catch(e => console.error('[mail sendSubmissionConfirm]', e))
    }

    /* ── 7. 성공 응답 ── */
    return NextResponse.json(
      { id: data.id, viewToken: data.view_token, jiraKey },
      { status: 201 }
    )
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/voc]', errMsg)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', detail: errMsg },
      { status: 500 }
    )
  }
}

/* ═══════════════════════════════════════════════════
   PUT — VOC 접수 내용 수정
═══════════════════════════════════════════════════ */
export async function PUT(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await req.json() as {
      vocId:      number
      viewToken:  string
      product:    string
      vocType:    string
      summary:    string
      customer:   string
      priority:   string
      purpose:    string
      screenPath: string
      detail:     string
      dueDate:    string | null
    }

    const { vocId, viewToken, product, vocType, summary, customer: rawCustomer,
            priority, purpose, screenPath, detail, dueDate } = body
    const customer = (rawCustomer ?? '').replace(/\s/g, '')

    /* ── 1. VOC 조회 + view_token 검증 ── */
    const { data: row, error: dbErr } = await supabase
      .from('voc_submission')
      .select('id, view_token, jira_issue_key, requester_dept, requester_name, requester_email, current_status')
      .eq('id', vocId)
      .single()

    if (dbErr || !row) {
      return NextResponse.json({ error: '접수 건을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (row.view_token !== viewToken) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }
    if (row.current_status === '완료' || row.current_status === '삭제') {
      return NextResponse.json({ error: '완료 또는 삭제된 접수는 수정할 수 없습니다.' }, { status: 400 })
    }

    /* ── 2. 서버 검증 ── */
    const required = { product, vocType, summary, purpose, screenPath, detail }
    const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k)
    if (missing.length > 0) {
      return NextResponse.json({ error: `필수 항목 누락: ${missing.join(', ')}` }, { status: 400 })
    }

    /* ── 3. DB 업데이트 ── */
    const { error: updateErr } = await supabase
      .from('voc_submission')
      .update({
        product,
        voc_type:    vocType,
        summary,
        customer:    customer || null,
        priority,
        purpose,
        screen_path: screenPath,
        detail,
        due_date:    dueDate,
      })
      .eq('id', row.id)

    if (updateErr) {
      console.error('[PUT /api/voc] DB update error', updateErr)
      return NextResponse.json({ error: 'DB 수정에 실패했습니다.', detail: updateErr.message }, { status: 500 })
    }

    /* ── 4. JIRA 이슈 업데이트 ── */
    if (row.jira_issue_key) {
      try {
        await updateJiraIssue(row.jira_issue_key, {
          dept: row.requester_dept,
          name: row.requester_name,
          email: row.requester_email ?? '',
          product, vocType, summary, customer, priority, purpose, screenPath, detail, dueDate,
        })
      } catch (jiraErr) {
        const errMsg = jiraErr instanceof Error ? jiraErr.message : String(jiraErr)
        console.error('[PUT /api/voc] JIRA update failed', errMsg)
        return NextResponse.json({ ok: true, jiraWarning: errMsg })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[PUT /api/voc]', errMsg)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.', detail: errMsg }, { status: 500 })
  }
}

/* ═══════════════════════════════════════════════════
   PATCH — 첨부파일만 수정
═══════════════════════════════════════════════════ */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await req.json() as {
      vocId:        number
      viewToken:    string
      attachments:  AttachmentMeta[]
      removedPaths?: string[]
    }

    const { vocId, viewToken, attachments, removedPaths } = body

    const { data: row, error: dbErr } = await supabase
      .from('voc_submission')
      .select('id, view_token, current_status, jira_issue_key, attachments')
      .eq('id', vocId)
      .single()

    if (dbErr || !row) {
      return NextResponse.json({ error: '접수 건을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (row.view_token !== viewToken) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }
    if (row.current_status === '완료' || row.current_status === '삭제') {
      return NextResponse.json({ error: '완료 또는 삭제된 접수는 수정할 수 없습니다.' }, { status: 400 })
    }

    if (removedPaths && removedPaths.length > 0) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(removedPaths)
      if (rmErr) console.error('[PATCH /api/voc] Storage remove error', rmErr)
    }

    const { error: updateErr } = await supabase
      .from('voc_submission')
      .update({ attachments })
      .eq('id', row.id)

    if (updateErr) {
      console.error('[PATCH /api/voc] DB update error', updateErr)
      return NextResponse.json({ error: 'DB 수정에 실패했습니다.', detail: updateErr.message }, { status: 500 })
    }

    /* ── JIRA 첨부파일 동기화 ── */
    if (row.jira_issue_key) {
      const existingArr = (row.attachments as (AttachmentMeta & { jiraAttachmentId?: string })[]) ?? []
      const existingPaths = new Set(existingArr.map(a => a.path))

      /* 삭제: removedPaths 중 jiraAttachmentId가 있는 것 JIRA에서도 삭제 */
      if (removedPaths && removedPaths.length > 0) {
        for (const path of removedPaths) {
          const orig = existingArr.find(a => a.path === path)
          if (orig?.jiraAttachmentId) {
            try {
              await deleteJiraAttachment(orig.jiraAttachmentId)
            } catch (e) {
              console.error(`[PATCH JIRA delete failed] ${orig.name}:`, e)
            }
          }
        }
      }

      /* 추가: 새 파일 JIRA에 업로드 + jiraAttachmentId 저장 */
      const newlyAdded = attachments.filter(a => !existingPaths.has(a.path))
      const finalAttachments = [...attachments]

      for (const a of newlyAdded) {
        try {
          const { data: urlData } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(a.path, 60)
          if (!urlData?.signedUrl) continue

          const fileRes = await fetch(urlData.signedUrl)
          if (!fileRes.ok) continue
          const buffer = Buffer.from(await fileRes.arrayBuffer())

          const jiraId = await addJiraAttachment(row.jira_issue_key!, a.name, buffer, a.type || 'application/octet-stream')
          if (jiraId) {
            const idx = finalAttachments.findIndex(x => x.path === a.path)
            if (idx >= 0) finalAttachments[idx] = { ...a, jiraAttachmentId: jiraId } as AttachmentMeta
          }
        } catch (e) {
          console.error(`[PATCH JIRA attach failed] ${a.name}:`, e)
        }
      }

      /* jiraAttachmentId가 추가되었으면 DB 재업데이트 */
      if (newlyAdded.length > 0) {
        await supabase.from('voc_submission').update({ attachments: finalAttachments }).eq('id', row.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH /api/voc]', errMsg)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.', detail: errMsg }, { status: 500 })
  }
}
