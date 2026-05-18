export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="logo">V</div>
          <span>VOC 접수 채널</span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          v0.1 · 1단계 완료
        </span>
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
            VOC CHANNEL · v0.1
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
            <button className="btn btn-primary btn-lg">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              새 VOC 접수
            </button>
            <button className="btn btn-secondary btn-lg">VOC 조회</button>
          </div>

          {/* 상태 배지 샘플 */}
          <div style={{ marginTop: 'var(--s-9)', display: 'flex', gap: 'var(--s-2)', justifyContent: 'center', flexWrap: 'wrap' as const }}>
            <span className="status status-received"><span className="dot"/>접수</span>
            <span className="status status-progress"><span className="dot"/>처리중</span>
            <span className="status status-done"><span className="dot"/>완료</span>
            <span className="status status-hold"><span className="dot"/>보류</span>
            <span className="status status-deleted"><span className="dot"/>삭제</span>
          </div>
          <div style={{ marginTop: 'var(--s-3)', display: 'flex', gap: 'var(--s-2)', justifyContent: 'center', flexWrap: 'wrap' as const }}>
            <span className="cat cat-inquiry">단순문의</span>
            <span className="cat cat-improve">개선</span>
            <span className="cat cat-defect">결함</span>
            <span className="cat cat-new">신규</span>
          </div>

          {/* 개발 로드맵 */}
          <div className="card" style={{ marginTop: 'var(--s-9)', textAlign: 'left' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: 'var(--font-mono)', margin: '0 0 var(--s-4)' }}>
              개발 로드맵
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 'var(--s-3)' }}>
              {[
                { step: '1단계', label: '프로젝트 셋업 + 인프라 골격', done: true },
                { step: '2단계', label: '접수 양식 화면 (정적 UI)', done: false },
                { step: '3단계', label: '로컬스토리지 + 클라이언트 검증', done: false },
                { step: '4단계', label: '백엔드 API + DB 저장', done: false },
                { step: '5단계', label: 'JIRA 자동 등록', done: false },
                { step: '6단계', label: '조회 페이지 + 이메일 + 웹훅', done: false },
              ].map(({ step, label, done }) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', fontSize: 13 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: done ? 'var(--brand-700)' : 'var(--text-subtle)', width: 48, flexShrink: 0 }}>{step}</span>
                  <span style={{ color: done ? 'var(--text-strong)' : 'var(--text-muted)', fontWeight: done ? 600 : 400 }}>{label}</span>
                  {done && <span style={{ marginLeft: 'auto', color: 'var(--success-500)', fontSize: 12, fontWeight: 600 }}>✓ 완료</span>}
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
