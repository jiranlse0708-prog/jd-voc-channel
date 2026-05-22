import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import nodemailer from 'nodemailer'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 현재 10분 윈도우 기준 6자리 OTP 생성 */
function makeOtp(email: string): string {
  const window = Math.floor(Date.now() / 1000 / 600)
  const hmac = createHmac('sha256', process.env.NEXTAUTH_SECRET ?? 'fallback')
    .update(`${email.toLowerCase()}:${window}`)
    .digest('hex')
  return hmac.slice(0, 6).toUpperCase()
}

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email?: string }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '유효한 이메일을 입력해 주세요.' }, { status: 400 })
  }

  const code = makeOtp(email)

  if (process.env.SKIP_EMAIL === 'true') {
    console.log(`[send-otp] SKIP_EMAIL=true → 고정 코드 123456 사용 (to: ${email})`)
    return NextResponse.json({ ok: true })
  }

  try {
    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    await transport.sendMail({
      from:    `JD VOC 채널 <${process.env.GMAIL_USER}>`,
      to:      email,
      subject: '[JD VOC 채널] 이메일 인증코드',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h2 style="font-size:20px;font-weight:700;color:#161a23;margin:0 0 8px;">이메일 인증코드</h2>
          <p style="font-size:14px;color:#5b6271;margin:0 0 24px;">
            VOC 접수 조회를 위해 아래 코드를 입력해 주세요.<br/>
            코드는 <strong>10분간</strong> 유효합니다.
          </p>
          <div style="background:#f5f6f7;border-radius:10px;padding:24px;text-align:center;">
            <span style="font-size:36px;font-weight:800;letter-spacing:0.15em;color:#161a23;font-family:monospace;">
              ${code}
            </span>
          </div>
          <p style="font-size:12px;color:#a4abb6;margin:20px 0 0;">
            본인이 요청하지 않은 경우 이 메일을 무시해 주세요.
          </p>
        </div>
      `,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[send-otp] email error', e)
    return NextResponse.json({ error: `[DEBUG] ${msg}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
