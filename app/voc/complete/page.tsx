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
            <span>VOC 접수 채널</span>
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Topbar ─── */}
      <header className="topbar">
        <Link href="/" className="topbar-brand" style={{ textDecoration: 'none' }}>
          <div className="logo">V</div>
          <span>VOC 접수 채널</span>
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
              제품팀이 검토 후 피드백을 드리겠습니다.
            </p>
          </div>

          {/* 접수 정보 카드 */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 접수 번호 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--surface-border)' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'var(--brand-50)', border: '1px solid var(--brand-100)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--brand-600)', flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                  접수 번호
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>
                  #{id}
                </div>
              </div>
            </div>

            {/* JIRA 이슈 키 */}
            {jira && (
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
            )}

            {/* 진행 상황 조회 링크 */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)', marginBottom: 8 }}>
                진행 상황 조회 링크
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: 'var(--surface-canvas)',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--r-md)',
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                  <path d="M6.5 9.5l3-3M9.5 10.5l1-1a3.535 3.535 0 10-5-5l-1 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M6.5 5.5l-1 1a3.535 3.535 0 005 5l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span style={{
                  fontSize: 12, fontFamily: 'var(--font-mono)',
                  color: 'var(--brand-700)', flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {viewUrl}
                </span>
                <Link
                  href={viewUrl}
                  className="btn btn-sm btn-secondary"
                  style={{ flexShrink: 0 }}
                >
                  조회하기
                </Link>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                이 링크를 저장해두시면 언제든지 접수 상태를 확인할 수 있습니다.
              </p>
            </div>

            {/* 이메일 알림 안내 */}
            <div style={{
              display: 'flex', gap: 10, padding: '12px 14px',
              background: 'var(--info-50)', border: '1px solid var(--info-100)',
              borderRadius: 'var(--r-md)',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1, color: 'var(--info-500)' }}>
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8 5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <p style={{ fontSize: 13, color: 'var(--info-700)', margin: 0, lineHeight: 1.5 }}>
                이메일을 입력하신 경우, 상태 변경·처리자 댓글 추가 시 자동으로 알림이 발송됩니다.
              </p>
            </div>

            {/* 처리 안내 */}
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--text-subtle)', lineHeight: 1.6 }}>
                • 처리 기준: 접수일 기준 <strong style={{ color: 'var(--text-muted)' }}>7일 이내</strong> 피드백 목표<br />
                • 문의: 제품팀 메신저 채널 또는 담당자에게 직접 연락
              </div>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center" style={{ marginTop: 24 }}>
            <Link href="/" className="btn btn-ghost btn-lg" style={{ justifyContent: 'center' }}>
              홈으로
            </Link>
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
