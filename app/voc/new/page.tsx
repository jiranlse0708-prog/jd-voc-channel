'use client'

import { useState, useEffect, useRef } from 'react'
import type { FormEvent, DragEvent, ChangeEvent, KeyboardEvent } from 'react'
import Link from 'next/link'

/* ── 상수 ── */
const PRODUCTS = ['SERVERFILTER', 'IDFILTER'] as const

const VOC_TYPES = [
  { value: 'inquiry', label: '단순문의', desc: '사용 방법·정책 등 답변만 필요한 문의' },
  { value: 'improve', label: '개선',   desc: '기존 기능 보완·UX 개선 제안' },
  { value: 'defect',  label: '결함',   desc: '정상 동작하지 않는 버그·오류' },
  { value: 'new',     label: '신규',   desc: '새로운 기능·서비스 요청' },
] as const

const PRIORITIES = [
  { value: '최상', desc: '당장 개발 진행이 필요한 급 건' },
  { value: '상',   desc: '고객과 약속된 기한이 있는 건' },
  { value: '중',   desc: '정해진 기한이 없는 일반 건' },
  { value: '하',   desc: '개발되면 좋지만 현재도 무방' },
] as const

/* ── 유틸 ── */
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/* ── 파일 아이콘 ── */
function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <circle cx="5.5" cy="5.5" r="1" fill="currentColor"/>
        <path d="M2 11l3.5-3.5L8 10l2.5-2L14 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 2.5A1.5 1.5 0 014.5 1H9l4 4v8.5A1.5 1.5 0 0111.5 15h-7A1.5 1.5 0 013 13.5v-11z" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M9 1v4h4" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )
}

/* ── 섹션 헤더 ── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 20px', paddingBottom: 12, borderBottom: '1px solid var(--surface-border)' }}>
      {children}
    </h2>
  )
}

/* ════════════════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════════════════ */
export default function VocNewPage() {
  /* 요청자 */
  const [dept,  setDept]  = useState('')
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')

  /* 분류 */
  const [product, setProduct] = useState('')
  const [vocType, setVocType] = useState('')

  /* 내용 요약 */
  const [summary,  setSummary]  = useState('')
  const [customer, setCustomer] = useState('')
  const [priority, setPriority] = useState('중')

  /* 상세 */
  const [purpose,    setPurpose]    = useState('')
  const [screenPath, setScreenPath] = useState('')
  const [detail,     setDetail]     = useState('')

  /* 첨부·기한 */
  const [dueDate,    setDueDate]    = useState('')
  const [files,      setFiles]      = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ── 클립보드 붙여넣기 ── */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue
        const blob = item.getAsFile()
        if (!blob) continue
        const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
        setFiles(prev => [...prev, new File([blob], `clipboard-${ts}.png`, { type: 'image/png' })])
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  /* ── 드래그&드롭 ── */
  const onDragOver  = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false) }
  const onDrop      = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
  }
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])
    e.target.value = ''
  }
  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx))

  /* ── 제출 (2단계: console.log만) ── */
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    console.log('[VOC 접수 데이터]', {
      requester: { dept, name, email },
      classification: { product, vocType, priority },
      summary: { summary, customer },
      detail: { purpose, screenPath, detail },
      meta: { dueDate },
      attachments: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
    })
  }

  /* ── 렌더 ── */
  return (
    <div className="min-h-screen flex flex-col">

      {/* ─── Topbar ─── */}
      <header className="topbar">
        <Link href="/" className="topbar-brand" style={{ textDecoration: 'none' }}>
          <div className="logo">V</div>
          <span>VOC 접수 채널</span>
        </Link>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          새 VOC 접수
        </span>
      </header>

      {/* ─── 본문 ─── */}
      <main className="flex-1" style={{ background: 'var(--surface-canvas)', padding: '32px 16px 80px' }}>
        <form onSubmit={onSubmit} className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 페이지 타이틀 */}
          <div style={{ marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 4px' }}>
              새 VOC 접수
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              <span style={{ color: 'var(--danger-500)' }}>*</span> 표시 항목은 필수입니다.
            </p>
          </div>

          {/* ══ 1. 요청자 정보 ══ */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionTitle>요청자 정보</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">부서<span className="req">*</span></label>
                <input
                  className="input"
                  value={dept}
                  onChange={e => setDept(e.target.value)}
                  placeholder="예: 영업팀"
                  required
                />
              </div>
              <div>
                <label className="field-label">성함<span className="req">*</span></label>
                <input
                  className="input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="예: 홍길동"
                  required
                />
              </div>
            </div>

            <div>
              <label className="field-label">이메일</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
              <p className="field-help">이메일을 입력하시면 접수 상태 변경 알림을 받을 수 있어요.</p>
            </div>
          </div>

          {/* ══ 2. 분류 ══ */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionTitle>분류</SectionTitle>

            {/* 제품 */}
            <div>
              <label className="field-label">제품<span className="req">*</span></label>
              <select
                className="select"
                value={product}
                onChange={e => setProduct(e.target.value)}
                required
              >
                <option value="" disabled>제품을 선택하세요</option>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* VOC 유형 */}
            <div>
              <label className="field-label">VOC 유형<span className="req">*</span></label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VOC_TYPES.map(t => (
                  <div
                    key={t.value}
                    className={`radio-card${vocType === t.value ? ' selected' : ''}`}
                    onClick={() => setVocType(t.value)}
                    role="radio"
                    aria-checked={vocType === t.value}
                    tabIndex={0}
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') setVocType(t.value)
                    }}
                  >
                    <span className="radio-dot" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                        {t.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══ 3. 내용 요약 ══ */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionTitle>내용 요약</SectionTitle>

            <div>
              <label className="field-label">요약<span className="req">*</span></label>
              <input
                className="input"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="한 줄 요약 (예: 결제 화면 카드 등록 실패)"
                required
              />
              <p className="field-help">JIRA 등록 시 [제품명] 접두사가 자동으로 붙습니다.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">고객사</label>
                <input
                  className="input"
                  value={customer}
                  onChange={e => setCustomer(e.target.value)}
                  placeholder="해당 고객사가 있는 경우에만"
                />
              </div>
              <div>
                <label className="field-label">우선순위</label>
                <select
                  className="select"
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                >
                  {PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>
                      {p.value} — {p.desc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ══ 4. 상세 내용 ══ */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionTitle>상세 내용</SectionTitle>

            <div>
              <label className="field-label">목적 / 배경<span className="req">*</span></label>
              <textarea
                className="textarea"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                rows={4}
                placeholder="왜 이 요청을 하게 됐는지 배경을 설명해 주세요."
                required
              />
            </div>

            <div>
              <label className="field-label">화면 위치 (경로)<span className="req">*</span></label>
              <input
                className="input"
                value={screenPath}
                onChange={e => setScreenPath(e.target.value)}
                placeholder="예: 설정 > 보안 > 개인정보 관리"
                required
              />
              <p className="field-help">접속 메뉴 경로나 URL을 입력해 주세요.</p>
            </div>

            <div>
              <label className="field-label">요구사항 상세<span className="req">*</span></label>
              <textarea
                className="textarea"
                value={detail}
                onChange={e => setDetail(e.target.value)}
                rows={6}
                placeholder={'구체적인 요구사항을 작성해 주세요.\n재현 절차가 있다면 단계별로 적어주세요.\n1. ...\n2. ...'}
                required
              />
            </div>
          </div>

          {/* ══ 5. 첨부 및 기한 ══ */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionTitle>첨부 및 기한</SectionTitle>

            {/* 기한 */}
            <div>
              <label className="field-label">기한</label>
              <input
                className="input"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                style={{ maxWidth: 200 }}
              />
              <p className="field-help">
                고객사와 협의된 일정 또는 약속된 완료 기한이 있을 경우에만 입력하세요.
              </p>
            </div>

            {/* 첨부파일 */}
            <div>
              <label className="field-label">첨부파일</label>

              {/* Dropzone */}
              <div
                className={`dropzone${isDragging ? ' active' : ''}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {/* 업로드 아이콘 */}
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <path d="M8 11V3m0 0L5 6m3-3l3 3M3 12v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-strong)' }}>
                  파일을 드래그하거나{' '}
                  <span style={{ color: 'var(--brand-700)', textDecoration: 'underline' }}>찾아보기</span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  PNG · JPG · PDF · DOCX · PPTX · XLSX · HWP · TXT — 파일당 최대 50MB
                </div>

                {/* 클립보드 힌트 */}
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd>Ctrl</kbd>
                  <span>+</span>
                  <kbd>V</kbd>
                  <span>로 스크린샷을 바로 붙여넣을 수 있어요</span>
                </div>
              </div>

              {/* hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.hwp,.txt"
                onChange={onFileChange}
                style={{ display: 'none' }}
              />

              {/* 첨부 파일 목록 */}
              {files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {files.map((file, idx) => (
                    <div key={`${file.name}-${file.size}-${idx}`} className="file-item">
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        <FileIcon mime={file.type} />
                      </span>
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{fmtSize(file.size)}</span>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 24, height: 24, flexShrink: 0 }}
                        onClick={e => { e.stopPropagation(); removeFile(idx) }}
                        aria-label={`${file.name} 제거`}
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: 'var(--text-subtle)', margin: '2px 0 0' }}>
                    총 {files.length}개 ·{' '}
                    {fmtSize(files.reduce((sum, f) => sum + f.size, 0))}
                    {' '}/ 200MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ══ 하단 버튼 ══ */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 pb-4">
            <Link href="/" className="btn btn-ghost btn-lg" style={{ justifyContent: 'center' }}>
              취소
            </Link>
            <button type="submit" className="btn btn-primary btn-lg">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              VOC 접수하기
            </button>
          </div>

        </form>
      </main>
    </div>
  )
}
