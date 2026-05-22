import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createJiraIssue, addJiraAttachment, JiraAuthError } from '@/lib/jira'
import { sendSubmissionConfirm } from '@/lib/mail'
import { VOC_TYPE_LABEL } from '@/lib/mapping'

const BUCKET = 'voc-attachments'

interface AttachmentMeta { name: string; size: number; type: string; path: string }

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
        customer, priority, purpose, screenPath, detail, dueDate,
      })
      jiraKey = jiraResult.key
    } catch (jiraErr) {
      if (jiraErr instanceof JiraAuthError) {
        console.error('[JIRA 인증 오류]', jiraErr)
        return NextResponse.json(
          { error: 'JIRA 연동에 인증 오류가 발생했습니다. 관리자에게 문의해 주세요.' },
          { status: 500 }
        )
      }
      console.error('[JIRA issue creation failed]', jiraErr)
      return NextResponse.json(
        { error: 'JIRA 이슈 등록에 실패했습니다. 관리자에게 문의해주세요.' },
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
        customer:        customer || null,
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
        { error: 'DB 저장 중 오류가 발생했습니다. 관리자에게 문의해주세요.' },
        { status: 500 }
      )
    }

    /* ── 5. JIRA 첨부파일 업로드 (Supabase에서 다운로드 후 JIRA에 업로드) ── */
    for (const a of attachments) {
      try {
        const { data: urlData } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(a.path, 60)
        if (!urlData?.signedUrl) continue

        const fileRes = await fetch(urlData.signedUrl)
        if (!fileRes.ok) continue
        const buffer = Buffer.from(await fileRes.arrayBuffer())

        await addJiraAttachment(jiraKey, a.name, buffer, a.type || 'application/octet-stream')
      } catch (e) {
        console.error(`[JIRA attach failed] ${a.name}:`, e)
      }
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
    console.error('[POST /api/voc]', err)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 관리자에게 문의해주세요.' },
      { status: 500 }
    )
  }
}
