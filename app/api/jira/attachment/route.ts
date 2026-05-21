import { NextRequest, NextResponse } from 'next/server'

/**
 * JIRA 첨부파일 프록시
 * GET /api/jira/attachment?url=<encoded_jira_content_url>
 * JIRA Basic 인증을 대신 처리해서 파일을 스트리밍.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'url required' }, { status: 400 })
  }

  /* JIRA 인증 헤더 */
  const cred = Buffer.from(
    `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
  ).toString('base64')

  const jiraRes = await fetch(url, {
    headers: { Authorization: `Basic ${cred}` },
  })

  if (!jiraRes.ok) {
    return NextResponse.json(
      { error: 'JIRA fetch failed', status: jiraRes.status },
      { status: 502 }
    )
  }

  const contentType        = jiraRes.headers.get('content-type') ?? 'application/octet-stream'
  const contentDisposition = jiraRes.headers.get('content-disposition') ?? ''

  return new NextResponse(jiraRes.body, {
    status: 200,
    headers: {
      'Content-Type':        contentType,
      'Content-Disposition': contentDisposition || 'attachment',
      'Cache-Control':       'private, max-age=3600',
    },
  })
}
