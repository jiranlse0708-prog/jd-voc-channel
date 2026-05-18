import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase-server'
import { createJiraIssue, addJiraAttachment, JiraAuthError } from '@/lib/jira'
import { sendSubmissionConfirm } from '@/lib/mail'
import { VOC_TYPE_LABEL, PRIORITY_LABEL } from '@/lib/mapping'

const BUCKET = 'voc-attachments'

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient()

    /* ── 1. FormData 파싱 ── */
    const fd = await req.formData()
    const get = (k: string) => (fd.get(k) as string | null)?.trim() ?? ''

    const dept       = get('dept')
    const name       = get('name')
    const email      = get('email')
    const product    = get('product')
    const vocType    = get('vocType')
    const summary    = get('summary')
    const customer   = get('customer')
    const priority   = get('priority') || 'medium'
    const purpose    = get('purpose')
    const screenPath = get('screenPath')
    const detail     = get('detail')
    const dueDate    = get('dueDate') || null

    /* ── 2. 서버 기본 검증 ── */
    const required = { dept, name, product, vocType, summary, purpose, screenPath, detail }
    const missing = Object.entries(required)
      .filter(([, v]) => !v)
      .map(([k]) => k)

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `필수 항목 누락: ${missing.join(', ')}` },
        { status: 400 }
      )
    }

    /* ── 3. Storage 버킷 확인 (없으면 생성) ── */
    const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024, // 50 MB
    })
    // 이미 존재하는 경우는 무시
    if (bucketErr && !bucketErr.message.toLowerCase().includes('already exists')) {
      console.error('[Storage bucket error]', bucketErr)
    }

    /* ── 4. 파일을 메모리에 읽기 (Supabase + JIRA 양쪽에 재사용) ── */
    const rawFiles = fd.getAll('files')
    const storagePrefix = randomUUID()

    interface FileEntry {
      name:   string
      size:   number
      type:   string
      buffer: Buffer
    }
    const fileEntries: FileEntry[] = []

    for (const entry of rawFiles) {
      if (!(entry instanceof File) || entry.size === 0) continue
      fileEntries.push({
        name:   entry.name,
        size:   entry.size,
        type:   entry.type,
        buffer: Buffer.from(await entry.arrayBuffer()),
      })
    }

    /* ── 5. Supabase Storage 업로드 ── */
    const attachments: { name: string; size: number; type: string; path: string }[] = []

    for (const f of fileEntries) {
      const filePath = `${storagePrefix}/${f.name}`
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, f.buffer, { contentType: f.type, upsert: false })

      if (uploadErr) {
        console.error(`[Storage upload failed] ${f.name}:`, uploadErr.message)
        continue
      }
      attachments.push({ name: f.name, size: f.size, type: f.type, path: filePath })
    }

    /* ── 6. DB 삽입 ── */
    const { data, error: dbErr } = await supabase
      .from('voc_submission')
      .insert({
        requester_dept:  dept,
        requester_name:  name,
        requester_email: email || null,
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
        current_status:  '접수됨',
        jira_issue_key:  null,
      })
      .select('id, view_token')
      .single()

    if (dbErr) {
      console.error('[DB insert error]', dbErr)
      return NextResponse.json(
        { error: 'DB 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 }
      )
    }

    /* ── 7. JIRA 이슈 생성 ── */
    let jiraKey: string | null = null
    try {
      const jiraResult = await createJiraIssue({
        dept, name, email, product, vocType, summary,
        customer, priority, purpose, screenPath, detail, dueDate,
      })
      jiraKey = jiraResult.key

      /* JIRA 첨부파일 업로드 */
      for (const f of fileEntries) {
        try {
          await addJiraAttachment(jiraKey, f.name, f.buffer, f.type)
        } catch (attachErr) {
          console.error(`[JIRA attach failed] ${f.name}:`, attachErr)
        }
      }

      /* DB에 jira_issue_key 반영 */
      await supabase
        .from('voc_submission')
        .update({ jira_issue_key: jiraKey })
        .eq('id', data.id)
    } catch (jiraErr) {
      if (jiraErr instanceof JiraAuthError) {
        /* 토큰 만료·무효 — 운영자가 즉시 조치 필요 */
        console.error('[JIRA 인증 오류] API 토큰이 만료되었거나 유효하지 않습니다. .env의 JIRA_API_TOKEN을 갱신하세요.', jiraErr)
      } else {
        console.error('[JIRA issue creation failed]', jiraErr)
      }
    }

    /* ── 8. 접수 확인 이메일 ── */
    if (email) {
      sendSubmissionConfirm({
        to:      email,
        vocId:   data.id,
        token:   data.view_token,
        summary,
        product,
        vocType: VOC_TYPE_LABEL[vocType] ?? vocType,
      }).catch(e => console.error('[mail sendSubmissionConfirm]', e))
    }

    /* ── 9. 성공 응답 ── */
    return NextResponse.json(
      { id: data.id, viewToken: data.view_token, jiraKey },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/voc]', err)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
