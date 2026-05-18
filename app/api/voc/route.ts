import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase-server'

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
    const priority   = get('priority') || '중'
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

    /* ── 4. 파일 업로드 ── */
    const rawFiles = fd.getAll('files')
    const storagePrefix = randomUUID()
    const attachments: {
      name: string
      size: number
      type: string
      path: string
    }[] = []

    for (const entry of rawFiles) {
      if (!(entry instanceof File) || entry.size === 0) continue

      const buffer   = Buffer.from(await entry.arrayBuffer())
      const filePath = `${storagePrefix}/${entry.name}`

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, buffer, { contentType: entry.type, upsert: false })

      if (uploadErr) {
        // 파일 하나 실패해도 나머지 진행
        console.error(`[Storage upload failed] ${entry.name}:`, uploadErr.message)
        continue
      }

      attachments.push({
        name: entry.name,
        size: entry.size,
        type: entry.type,
        path: filePath,
      })
    }

    /* ── 5. DB 삽입 ── */
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

    /* ── 6. 성공 응답 ── */
    return NextResponse.json(
      { id: data.id, viewToken: data.view_token },
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
