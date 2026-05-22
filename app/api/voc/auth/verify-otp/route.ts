import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COOKIE   = 'voc-verified-email'

function makeOtp(email: string, windowOffset = 0): string {
  const window = Math.floor(Date.now() / 1000 / 600) + windowOffset
  const hmac = createHmac('sha256', process.env.NEXTAUTH_SECRET ?? 'fallback')
    .update(`${email.toLowerCase()}:${window}`)
    .digest('hex')
  return hmac.slice(0, 6).toUpperCase()
}

function makeToken(email: string): string {
  const payload = `${email.toLowerCase()}:${Date.now() + 1000 * 60 * 60 * 24 * 7}` // 7일
  const sig = createHmac('sha256', process.env.NEXTAUTH_SECRET ?? 'fallback')
    .update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export async function POST(req: NextRequest) {
  const { email, code } = await req.json() as { email?: string; code?: string }

  if (!email || !EMAIL_RE.test(email) || !code) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase()
  const input = code.trim().toUpperCase()

  /* 로컬 개발 시 고정 코드 허용 */
  if (process.env.SKIP_EMAIL === 'true' && input === '123456') {
    const token = makeToken(normalizedEmail)
    const res   = NextResponse.json({ ok: true, email: normalizedEmail })
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure:   false,
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 7,
      path:     '/',
    })
    return res
  }

  /* 현재 윈도우 + 이전 윈도우 모두 허용 (창이 막 바뀐 타이밍 대응) */
  const valid = makeOtp(normalizedEmail, 0) === input
             || makeOtp(normalizedEmail, -1) === input

  if (!valid) {
    return NextResponse.json({ error: '인증코드가 올바르지 않거나 만료됐습니다.' }, { status: 401 })
  }

  const token = makeToken(normalizedEmail)
  const res   = NextResponse.json({ ok: true, email: normalizedEmail })

  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7, // 7일
    path:     '/',
  })

  return res
}
