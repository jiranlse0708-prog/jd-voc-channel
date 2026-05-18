'use client'

import { useState, useEffect, useRef } from 'react'
import type { FormEvent, DragEvent, ChangeEvent, KeyboardEvent } from 'react'
import Link from 'next/link'

/* ── 상수 ── */
const PRODUCTS = ['SERVERFILTER', 'IDFILTER'] as const

const VOC_TYPES = [
  { value: 'inquiry', label: '단순문의', desc: '사용 방법·정책 등 답변만 필요한 문의' },
  { value: 'improve', label: '개선',    desc: '기존 기능 보완·UX 개선 제안' },
  { value: 'defect',  label: '결함',    desc: '정상 동작하지 않는 버그·오류' },
  { value: 'new',     label: '신규',    desc: '새로운 기능·서비스 요청' },
] as const

const PRIORITIES = [
  { value: '최상', desc: '당장 개발 진행이 필요한 급 건' },
  { value: '상',   desc: '고객과 약속된 기한이 있는 건' },
  { value: '중',   desc: '정해진 기한이 없는 일반 건' },
  { value: '하',   desc: '개발되면 좋지만 현재도 무방' },
] as const

const MAX_FILE_BYTES  = 50  * 1024 * 1024 // 50 MB
const MAX_TOTAL_BYTES = 200 * 1024 * 1024 // 200 MB

const LS = {
  dept:  'voc.requester.dept',
  name:  'voc.requester.name',
  email: 'voc.requester.email',
} as const

/* ── 타입 ── */
type ErrorKey =
  | 'dept' | 'name' | 'email'
  | 'product' | 'vocType'
  | 'summary' | 'purpose' | 'screenPath' | 'detail'
  | 'files'
type Errors = Partial<Record<ErrorKey, string>>

/* ── 유틸 ── */
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
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

/* ── 에러 메시지 ── */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="field-error">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M6 3.5v3M6 8.2v.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      {msg}
    </p>
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

  /* 검증 */
  const [errors,  setErrors]  = useState<Errors>({})

  const fileInputRef = useRef<HTMLInputElement>(null)
  const lsLoaded     = useRef(false) // 로컬스토리지 로드 완료 여부

  /* ── 로컬스토리지 불러오기 (마운트 시 1회) ── */
  useEffect(() => {
    setDept(localStorage.getItem(LS.dept)  ?? '')
    setName(localStorage.getItem(LS.name)  ?? '')
    setEmail(localStorage.getItem(LS.email) ?? '')
    lsLoaded.current = true
  }, [])

  /* ── 로컬스토리지 저장 (로드 후 변경 시) ── */
  useEffect(() => { if (lsLoaded.current) localStorage.setItem(LS.dept,  dept)  }, [dept])
  useEffect(() => { if (lsLoaded.current) localStorage.setItem(LS.name,  name)  }, [name])
  useEffect(() => { if (lsLoaded.current) localStorage.setItem(LS.email, email) }, [email])

  /* ── 클립보드 붙여넣기 ── */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const images: File[] = []
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue
        const blob = item.getAsFile()
        if (!blob) continue
        const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
        images.push(new File([blob], `clipboard-${ts}.png`, { type: 'image/png' }))
      }
      if (images.length > 0) addFiles(images)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [files]) // files 의존 — 총 용량 체크에 필요

  /* ── 파일 추가 (용량 검증 포함) ── */
  const addFiles = (incoming: File[]) => {
    const oversize = incoming.filter(f => f.size > MAX_FILE_BYTES)
    const valid    = incoming.filter(f => f.size <= MAX_FILE_BYTES)

    if (oversize.length > 0) {
      setErrors(prev => ({
        ...prev,
        files: `파일당 최대 50MB입니다. 제외됨: ${oversize.map(f => f.name).join(', ')}`,
      }))
    }

    if (valid.length === 0) return

    const newTotal = [...files, ...valid].reduce((s, f) => s + f.size, 0)
    if (newTotal > MAX_TOTAL_BYTES) {
      setErrors(prev => ({
        ...prev,
        files: `총 첨부 용량이 200MB를 초과합니다. (추가 후 ${fmtSize(newTotal)})`,
      }))
      return
    }

    setFiles(prev => [...prev, ...valid])
    if (oversize.length === 0) {
      setErrors(prev => { const { files: _, ...rest } = prev; return rest })
    }
  }

  /* ── 드래그&드롭 ── */
  const onDragOver  = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false) }
  const onDrop      = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }
  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setErrors(prev => { const { files: _, ...rest } = prev; return rest })
  }

  /* ── 검증 ── */
  const validate = (): Errors => {
    const e: Errors = {}
    if (!dept.trim())       e.dept       = '부서를 입력해 주세요.'
    if (!name.trim())       e.name       = '성함을 입력해 주세요.'
    if (email && !isValidEmail(email))
                            e.email      = '이메일 형식이 올바르지 않습니다.'
    if (!product)           e.product    = '제품을 선택해 주세요.'
    if (!vocType)           e.vocType    = 'VOC 유형을 선택해 주세요.'
    if (!summary.trim())    e.summary    = '요약을 입력해 주세요.'
    if (!purpose.trim())    e.purpose    = '목적/배경을 입력해 주세요.'
    if (!screenPath.trim()) e.screenPath = '화면 위치를 입력해 주세요.'
    if (!detail.trim())     e.detail     = '요구사항 상세를 입력해 주세요.'
    return e
  }

  /* ── 제출 ── */
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const errs = validate()
    setErrors(prev => ({ ...prev, ...errs }))

    if (Object.keys(errs).length > 0) {
      // 첫 번째 에러 필드로 스크롤
      requestAnimationFrame(() => {
        const first = document.querySelector<HTMLElement>('.invalid, [data-error-target]')
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }

    console.log('[VOC 접수 데이터]', {
      requester:   { dept, name, email },
      classification: { product, vocType, priority },
      summary:     { summary, customer },
      detail:      { purpose, screenPath, detail },
      meta:        { dueDate },
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
        <form onSubmit={onSubmit} noValidate className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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
                  className={`input${errors.dept ? ' invalid' : ''}`}
                  value={dept}
                  onChange={e => { setDept(e.target.value); setErrors(p => { const { dept: _, ...r } = p; return r }) }}
                  placeholder="예: 영업팀"
                />
                <FieldError msg={errors.dept} />
              </div>
              <div>
                <label className="field-label">성함<span className="req">*</span></label>
                <input
                  className={`input${errors.name ? ' invalid' : ''}`}
                  value={name}
                  onChange={e => { setName(e.target.value); setErrors(p => { const { name: _, ...r } = p; return r }) }}
                  placeholder="예: 홍길동"
                />
                <FieldError msg={errors.name} />
              </div>
            </div>

            <div>
              <label className="field-label">이메일</label>
              <input
                className={`input${errors.email ? ' invalid' : ''}`}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(p => { const { email: _, ...r } = p; return r }) }}
                placeholder="name@company.com"
              />
              {errors.email
                ? <FieldError msg={errors.email} />
                : <p className="field-help">이메일을 입력하시면 접수 상태 변경 알림을 받을 수 있어요.</p>
              }
            </div>
          </div>

          {/* ══ 2. 분류 ══ */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionTitle>분류</SectionTitle>

            {/* 제품 */}
            <div>
              <label className="field-label">제품<span className="req">*</span></label>
              <select
                className={`select${errors.product ? ' invalid' : ''}`}
                value={product}
                onChange={e => { setProduct(e.target.value); setErrors(p => { const { product: _, ...r } = p; return r }) }}
              >
                <option value="" disabled>제품을 선택하세요</option>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <FieldError msg={errors.product} />
            </div>

            {/* VOC 유형 */}
            <div>
              <label className="field-label">VOC 유형<span className="req">*</span></label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-error-target={errors.vocType ? 'true' : undefined}>
                {VOC_TYPES.map(t => (
                  <div
                    key={t.value}
                    className={`radio-card${vocType === t.value ? ' selected' : ''}`}
                    style={errors.vocType && vocType !== t.value ? { borderColor: 'var(--danger-500)' } : undefined}
                    onClick={() => { setVocType(t.value); setErrors(p => { const { vocType: _, ...r } = p; return r }) }}
                    role="radio"
                    aria-checked={vocType === t.value}
                    tabIndex={0}
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setVocType(t.value)
                        setErrors(p => { const { vocType: _, ...r } = p; return r })
                      }
                    }}
                  >
                    <span className="radio-dot" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>{t.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <FieldError msg={errors.vocType} />
            </div>
          </div>

          {/* ══ 3. 내용 요약 ══ */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionTitle>내용 요약</SectionTitle>

            <div>
              <label className="field-label">요약<span className="req">*</span></label>
              <input
                className={`input${errors.summary ? ' invalid' : ''}`}
                value={summary}
                onChange={e => { setSummary(e.target.value); setErrors(p => { const { summary: _, ...r } = p; return r }) }}
                placeholder="한 줄 요약 (예: 결제 화면 카드 등록 실패)"
              />
              {errors.summary
                ? <FieldError msg={errors.summary} />
                : <p className="field-help">JIRA 등록 시 [제품명] 접두사가 자동으로 붙습니다.</p>
              }
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
                    <option key={p.value} value={p.value}>{p.value} — {p.desc}</option>
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
                className={`textarea${errors.purpose ? ' invalid' : ''}`}
                value={purpose}
                onChange={e => { setPurpose(e.target.value); setErrors(p => { const { purpose: _, ...r } = p; return r }) }}
                rows={4}
                placeholder="왜 이 요청을 하게 됐는지 배경을 설명해 주세요."
              />
              <FieldError msg={errors.purpose} />
            </div>

            <div>
              <label className="field-label">화면 위치 (경로)<span className="req">*</span></label>
              <input
                className={`input${errors.screenPath ? ' invalid' : ''}`}
                value={screenPath}
                onChange={e => { setScreenPath(e.target.value); setErrors(p => { const { screenPath: _, ...r } = p; return r }) }}
                placeholder="예: 설정 > 보안 > 개인정보 관리"
              />
              {errors.screenPath
                ? <FieldError msg={errors.screenPath} />
                : <p className="field-help">접속 메뉴 경로나 URL을 입력해 주세요.</p>
              }
            </div>

            <div>
              <label className="field-label">요구사항 상세<span className="req">*</span></label>
              <textarea
                className={`textarea${errors.detail ? ' invalid' : ''}`}
                value={detail}
                onChange={e => { setDetail(e.target.value); setErrors(p => { const { detail: _, ...r } = p; return r }) }}
                rows={6}
                placeholder={'구체적인 요구사항을 작성해 주세요.\n재현 절차가 있다면 단계별로 적어주세요.\n1. ...\n2. ...'}
              />
              <FieldError msg={errors.detail} />
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
              <p className="field-help">고객사와 협의된 일정 또는 약속된 완료 기한이 있을 경우에만 입력하세요.</p>
            </div>

            {/* 첨부파일 */}
            <div>
              <label className="field-label">첨부파일</label>

              <div
                className={`dropzone${isDragging ? ' active' : ''}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
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
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd>Ctrl</kbd><span>+</span><kbd>V</kbd>
                  <span>로 스크린샷을 바로 붙여넣을 수 있어요</span>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.hwp,.txt"
                onChange={onFileChange}
                style={{ display: 'none' }}
              />

              {/* 파일 에러 */}
              <FieldError msg={errors.files} />

              {/* 파일 목록 */}
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
                    총 {files.length}개 · {fmtSize(files.reduce((s, f) => s + f.size, 0))} / 200MB
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
