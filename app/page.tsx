import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="logo">V</div>
          <span>VOC 접수 채널</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center" style={{ padding: 'var(--s-9) var(--s-4)' }}>
        <div className="page-container" style={{ textAlign: 'center', width: '100%' }}>

          {/* 로고 */}
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: 'var(--brand-500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--s-6)',
            fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)',
          }}>V</div>

          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-700)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: 'var(--font-mono)', marginBottom: 'var(--s-3)' }}>
            VOC CHANNEL
          </p>

          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.25, margin: '0 0 var(--s-4)' }}>
            VOC 접수 채널
          </h1>

          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 auto var(--s-7)', maxWidth: 480 }}>
            비개발 부서가 보내는 VOC를 단일 채널로 일원화합니다.<br />
            표준 양식으로 접수하면 JIRA 이슈가 자동 생성됩니다.
          </p>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 'var(--s-3)', justifyContent: 'center', flexWrap: 'wrap' as const }}>
            <Link href="/voc/new" className="btn btn-primary btn-lg">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              새 VOC 접수
            </Link>
            <Link href="/voc/lookup" className="btn btn-secondary btn-lg">VOC 조회</Link>
          </div>

        </div>
      </main>
    </div>
  )
}
