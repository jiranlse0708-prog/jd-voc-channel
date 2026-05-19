import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendVocLookupLinks } from '@/lib/mail'

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function POST(req: NextRequest) {
  try {
    const body  = await req.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 })
    }

    /* 해당 이메일의 VOC 조회 — 존재 여부 응답에서 노출하지 않음 */
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('voc_submission')
      .select('id, view_token, summary, current_status, created_at')
      .eq('requester_email', email)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[POST /api/voc/lookup] db error', error)
      return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
    }

    /* 결과가 있을 때만 메일 발송. 응답은 항상 동일 (이메일 존재 여부 누설 방지) */
    if (data && data.length > 0) {
      sendVocLookupLinks({
        to:    email,
        items: data.map(r => ({
          id:        r.id as number,
          token:     r.view_token as string,
          summary:   r.summary as string,
          status:    r.current_status as string,
          createdAt: r.created_at as string,
        })),
      }).catch(e => console.error('[mail sendVocLookupLinks]', e))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/voc/lookup]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
