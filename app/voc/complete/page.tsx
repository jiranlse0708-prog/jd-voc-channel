import Link from 'next/link'

interface Props {
  searchParams: Promise<{ id?: string; token?: string; jira?: string }>
}

export default async function CompletePage({ searchParams }: Props) {
  const { id, token, jira } = await searchParams

  /* 잘못된 접근 처리 */
  if (!id || !token) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="topbar">
          <Link href="/" className="topbar-brand" style={{ textDecoration: 'none' }}>
            <div className="logo">V</div>
            <span>서버솔루션팀 VOC 채널</span>
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center" style={{ padding: '40px 16px' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)' }}>잘못된 접근입니다.</p>
            <Link href="/voc/new" className="btn btn-primary" style={{ marginTop: 16 }}>
              새 VOC 접수
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const viewUrl = `/voc/${id}?token=${token}`
  const fullViewUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}${viewUrl}`
  const jiraHost = process.env.JIRA_HOST?.replace(/\/$/, '') ?? ''
  const jiraUrl  = jira && jiraHost ? `${jiraHost}/browse/${jira}` : null

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Topbar ─── */}
      <header className="topbar">
        <Link href="/" className="topbar-brand" style={{ textDecoration: 'none' }}>
          <div className="logo">V</div>
          <span>서버솔루션팀 VOC 채널</span>
        </Link>
      </header>

      {/* ─── 본문 ─── */}
      <main
        className="flex-1 flex items-center justify-center"
        style={{ background: 'var(--surface-canvas)', padding: '40px 16px 80px' }}
      >
        <div className="page-container" style={{ width: '100%' }}>

          {/* 성공 아이콘 */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--success-50)', border: '2px solid var(--success-100)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M6 14l5.5 5.5L22 9"
                  stroke="var(--success-500)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 8px' }}>
              VOC가 접수됐습니다
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
              진행 상황은 JIRA에서 확인할 수 있습니다.
            </p>
          </div>

          {/* 접수 정보 카드 */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* JIRA 이슈 — 클릭 시 JIRA 페이지로 이동 */}
            {jira && (
              jiraUrl ? (
                <a
                  href={jiraUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    paddingBottom: 16, borderBottom: '1px solid var(--surface-border)',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'var(--brand-50)', border: '1px solid var(--brand-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--brand-600)', flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="currentColor"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                      JIRA 이슈
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>
                      {jira}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--text-muted)' }} aria-label="새 탭에서 열기">
                    <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--surface-border)' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'var(--brand-50)', border: '1px solid var(--brand-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--brand-600)', flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="currentColor"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                      JIRA 이슈
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>
                      {jira}
                    </div>
                  </div>
                </div>
              )
            )}

          </div>

          {/* 하단 버튼 */}
          <div className="flex justify-center" style={{ marginTop: 24 }}>
            <Link href="/voc/new" className="btn btn-primary btn-lg" style={{ justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              새 VOC 접수
            </Link>
          </div>

        </div>
      </main>
    </div>
  )
}
