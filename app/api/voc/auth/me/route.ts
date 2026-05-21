import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

const COOKIE = 'voc-verified-email'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value
  if (!token) return NextResponse.json({ email: null })

  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts   = decoded.split(':')
    if (parts.length < 3) return NextResponse.json({ email: null })

    const sig     = parts.pop()!
    const payload = parts.join(':')
    const [email, expiryStr] = payload.split(':')
    const expiry  = parseInt(expiryStr)

    if (Date.now() > expiry) return NextResponse.json({ email: null })

    const expected = createHmac('sha256', process.env.NEXTAUTH_SECRET ?? 'fallback')
      .update(payload).digest('hex')

    if (sig !== expected) return NextResponse.json({ email: null })

    return NextResponse.json({ email })
  } catch {
    return NextResponse.json({ email: null })
  }
}
