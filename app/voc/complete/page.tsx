import Link from 'next/link'
import CopyButton from './CopyButton'
import Topbar from '@/components/Topbar'

interface Props {
  searchParams: Promise<{ id?: string; token?: string; jira?: string; failedUploads?: string }>
}

export default async function CompletePage({ searchParams }: Props) {
  const { id, token, jira, failedUploads: failedUploadsRaw } = await searchParams
  const failedUploads = failedUploadsRaw
    ? decodeURIComponent(failedUploadsRaw).split(',').filter(Boolean)
    : []

  /* 잘못된 접근 처리 */
  if (!id || !token) {
    return (
      <div className="min-h-screen flex flex-col">
        <Topbar />
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
      <Topbar />

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
              진행 상황은 JIRA 또는 [내 접수 조회]에서 확인할 수 있습니다.
            </p>
          </div>

          {/* 업로드 실패 경고 */}
          {failedUploads.length > 0 && (
            <div style={{
              marginBottom: 16, padding: '14px 18px',
              background: 'var(--warning-50)', border: '1px solid var(--warning-100)',
              borderRadius: 'var(--r-md)', display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--warning-700)', flexShrink: 0, marginTop: 1 }}>
                <path d="M8 1.5L1 14h14L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning-700)', marginBottom: 4 }}>
                  일부 첨부파일이 업로드되지 않았습니다
                </div>
                <div style={{ fontSize: 12, color: 'var(--warning-700)' }}>
                  {failedUploads.join(', ')}
                </div>
              </div>
            </div>
          )}

          {/* 접수 정보 카드 */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* JIRA 이슈 */}
            {jira && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 이슈 행 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                  {jiraUrl && (
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <CopyButton url={jiraUrl} />
                      <a
                        href={jiraUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-secondary"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        열기
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* 하단 버튼 */}
          <div className="flex flex-col sm:flex-row justify-center gap-3" style={{ marginTop: 24 }}>
            <Link href="/voc/my" className="btn btn-secondary btn-lg" style={{ justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              내 접수 조회
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
