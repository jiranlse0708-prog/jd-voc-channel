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
    const email      = get('email').toLowerCase()  // 정규화: lowercase + trim (get()이 trim 처리)
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
    const required = { dept, name, email, product, vocType, summary, purpose, screenPath, detail }
    const missing = Object.entries(required)
      .filter(([, v]) => !v)
      .map(([k]) => k)

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `필수 항목 누락: ${missing.join(', ')}` },
        { status: 400 }
      )
    }

    // 이메일 형식 검증
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: '이메일 형식이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    /* ── 3. Storage 버킷 확인 (없으면 생성) + MIME 제한 해제 ── */
    const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
    })
    if (bucketErr && !bucketErr.message.toLowerCase().includes('already exists')) {
      console.error('[Storage bucket error]', bucketErr)
    }
    // 버킷 MIME 타입 제한 해제 (allowedMimeTypes: null = 모든 타입 허용)
    await supabase.storage.updateBucket(BUCKET, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
      allowedMimeTypes: null,  // 모든 MIME 타입 허용
    }).catch(e => console.error('[Storage updateBucket error]', e))

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

    /* ── 5. JIRA 이슈 생성 (DB 저장 전 — 실패 시 접수 자체를 중단) ── */
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

    /* ── 6. Supabase Storage 업로드 ── */
    const attachments: { name: string; size: number; type: string; path: string }[] = []
    const failedUploads: string[] = []

    for (const f of fileEntries) {
      // 한글·특수문자 등 non-ASCII 파일명 → UUID 기반 경로로 대체
      // 원본 파일명은 DB attachments.name 에 보존
      const ext      = f.name.split('.').pop()?.toLowerCase() ?? ''
      const safeKey  = `${randomUUID()}${ext ? `.${ext}` : ''}`
      const filePath = `${storagePrefix}/${safeKey}`
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, f.buffer, { contentType: f.type || 'application/octet-stream', upsert: false })

      if (uploadErr) {
        console.error(`[Storage upload failed] ${f.name}:`, uploadErr)
        failedUploads.push(f.name)
        continue
      }
      attachments.push({ name: f.name, size: f.size, type: f.type, path: filePath })
    }

    /* ── 7. DB 삽입 (jira_issue_key 포함) ── */
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

    /* ── 8. JIRA 첨부파일 업로드 (실패해도 접수는 유지) ── */
    for (const f of fileEntries) {
      try {
        await addJiraAttachment(jiraKey, f.name, f.buffer, f.type)
      } catch (attachErr) {
        console.error(`[JIRA attach failed] ${f.name}:`, attachErr)
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
        vocType:  VOC_TYPE_LABEL[vocType] ?? vocType,
        jiraKey:  jiraKey,
      }).catch(e => console.error('[mail sendSubmissionConfirm]', e))
    }

    /* ── 9. 성공 응답 ── */
    return NextResponse.json(
      { id: data.id, viewToken: data.view_token, jiraKey, failedUploads },
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
