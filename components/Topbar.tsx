import Link from 'next/link'

/**
 * 공통 상단 바.
 * 좌측: 로고/브랜드 (홈 링크) — 우측: [내 접수 조회] 메뉴.
 */
export default function Topbar() {
  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand" style={{ textDecoration: 'none' }}>
        <div className="logo">V</div>
        <span>서버솔루션팀 VOC 채널</span>
      </Link>
      <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
        <Link href="/voc/my" className="topbar-link">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>내 접수 조회</span>
        </Link>
      </nav>
    </header>
  )
}
