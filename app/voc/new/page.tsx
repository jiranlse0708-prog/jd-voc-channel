'use client'

import { useState, useEffect, useRef } from 'react'
import type { FormEvent, DragEvent, ChangeEvent, KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/* ── 상수 ── */
const PRODUCTS = [
  { value: 'SERVERFILTER', label: 'ServerFilter' },
  { value: 'IDFILTER',     label: 'IDFilter' },
] as const

const VOC_TYPES = [
  { value: 'inquiry', label: '단순문의', desc: '사용 방법·정책 등 답변만 필요한 문의' },
  { value: 'improve', label: '개선',    desc: '기존 기능 보완·UX 개선 제안' },
  { value: 'defect',  label: '결함',    desc: '정상 동작하지 않는 버그·오류' },
  { value: 'new',     label: '신규',    desc: '새로운 기능·서비스 요청' },
] as const

const PRIORITIES = [
  { value: 'highest', label: '최상', desc: '당장 개발 진행이 필요한 급 건' },
  { value: 'high',    label: '상',   desc: '고객과 약속된 기한이 있는 건' },
  { value: 'medium',  label: '중',   desc: '정해진 기한이 없는 일반 건' },
  { value: 'low',     label: '하',   desc: '개발되면 좋지만 당장 급하지는 않은 건' },
] as const

const MAX_FILE_BYTES  = 50  * 1024 * 1024 // 50 MB
const MAX_TOTAL_BYTES = 200 * 1024 * 1024 // 200 MB

const LS = {
  dept:     'voc.requester.dept',
  name:     'voc.requester.name',
  remember: 'voc.requester.remember',
  draft:    'voc.draft',
} as const

/* ── 타입 ── */
type ErrorKey =
  | 'dept' | 'name'
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
    <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 4px', paddingBottom: 10, borderBottom: '1px solid var(--surface-border)' }}>
      {children}
    </h2>
  )
}

/* ── 자동 높이 textarea ── */
interface AutoTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'ref'> {
  value: string
  minHeight?: number
}
function AutoTextarea({ value, minHeight = 96, style, ...rest }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`
  }, [value, minHeight])
  return <textarea ref={ref} value={value} style={{ resize: 'none', minHeight, overflow: 'hidden', ...style }} {...rest} />
}

/* ════════════════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════════════════ */
export default function VocNewPage() {
  /* 요청자 */
  const [dept, setDept] = useState('')
  const [name, setName] = useState('')

  /* 분류 */
  const [product, setProduct] = useState<string>('SERVERFILTER')
  const [vocType, setVocType] = useState('')

  /* 내용 요약 */
  const [summary,  setSummary]  = useState('')
  const [customer, setCustomer] = useState('')
  const [priority, setPriority] = useState('medium')

  /* 상세 */
  const [purpose,     setPurpose]     = useState('')
  const [screenPaths, setScreenPaths] = useState<string[]>([''])
  const [detail,      setDetail]      = useState('')

  /* 참고 화면·기한 */
  const [dueDate,    setDueDate]    = useState('')
  const [files,      setFiles]      = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

  /* 검증 */
  const [errors,      setErrors]      = useState<Errors>({})

  /* 제출 상태 */
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError,  setSubmitError]  = useState<string | null>(null)

  /* 로컬 저장 동의 (기본 ON) */
  const [remember, setRemember] = useState(true)

  /* 스크롤 진행률 (0 ~ 1) */
  const [scrollProgress, setScrollProgress] = useState(0)

  /* 터치 기기 여부 (달력 아이콘 표시 제어) */
  const [isTouch, setIsTouch] = useState(false)

  /* 모바일 키보드 감지 (visualViewport) */
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lsLoaded     = useRef(false) // 로컬스토리지 로드 완료 여부

  /* ── 로컬스토리지 불러오기 (마운트 시 1회) ── */
  useEffect(() => {
    /* remember는 기본 ON, 명시적으로 '0'으로 저장된 경우만 OFF */
    const rememberRaw = localStorage.getItem(LS.remember)
    const rememberOn  = rememberRaw !== '0'
    setRemember(rememberOn)
    if (rememberOn) {
      setDept(localStorage.getItem(LS.dept) ?? '')
      setName(localStorage.getItem(LS.name) ?? '')
    }

    /* 드래프트 복원 — 작성 중이던 폼이 있으면 자동으로 채움 */
    const draftRaw = localStorage.getItem(LS.draft)
    if (draftRaw) {
      try {
        const d = JSON.parse(draftRaw)
        if (typeof d.product    === 'string') setProduct(d.product)
        if (typeof d.vocType    === 'string') setVocType(d.vocType)
        if (typeof d.summary    === 'string') setSummary(d.summary)
        if (typeof d.customer   === 'string') setCustomer(d.customer)
        if (typeof d.priority   === 'string') setPriority(d.priority)
        if (typeof d.purpose    === 'string') setPurpose(d.purpose)
        if (Array.isArray(d.screenPaths) && d.screenPaths.length > 0)
          setScreenPaths(d.screenPaths)
        if (typeof d.detail     === 'string') setDetail(d.detail)
        if (typeof d.dueDate    === 'string') setDueDate(d.dueDate)
      } catch { /* 손상된 드래프트는 무시 */ }
    }

    lsLoaded.current = true
  }, [])

  /* ── 로컬스토리지 저장 (remember ON일 때만) ── */
  useEffect(() => { if (lsLoaded.current && remember) localStorage.setItem(LS.dept, dept) }, [dept, remember])
  useEffect(() => { if (lsLoaded.current && remember) localStorage.setItem(LS.name, name) }, [name, remember])

  /* ── 드래프트 자동 저장 (500ms 디바운스) ── */
  useEffect(() => {
    if (!lsLoaded.current) return
    const handle = setTimeout(() => {
      localStorage.setItem(LS.draft, JSON.stringify({
        product, vocType, summary, customer, priority,
        purpose, screenPaths, detail, dueDate,
      }))
    }, 500)
    return () => clearTimeout(handle)
  }, [product, vocType, summary, customer, priority, purpose, screenPaths, detail, dueDate])

  /* ── remember 토글 시: OFF로 바뀌면 즉시 저장값 삭제, ON으로 바뀌면 현재 값 기록 ── */
  useEffect(() => {
    if (!lsLoaded.current) return
    if (remember) {
      localStorage.setItem(LS.remember, '1')
      localStorage.setItem(LS.dept, dept)
      localStorage.setItem(LS.name, name)
    } else {
      localStorage.setItem(LS.remember, '0')
      localStorage.removeItem(LS.dept)
      localStorage.removeItem(LS.name)
    }
  }, [remember]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 스크롤 진행률 계산 ── */
  useEffect(() => {
    const update = () => {
      const doc = document.documentElement
      const total = doc.scrollHeight - window.innerHeight
      if (total <= 0) { setScrollProgress(0); return }
      const ratio = window.scrollY / total
      setScrollProgress(Math.min(1, Math.max(0, ratio)))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  /* ── 터치 기기 감지 (달력 아이콘 제어) ── */
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  /* ── 모바일 키보드 감지 ── */
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      const diff = window.innerHeight - vv.height
      setKeyboardOpen(diff > 150) // 150px 이상 줄어들면 키보드로 간주
    }
    onResize()
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

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
        files: `총 참고 화면 용량이 200MB를 초과합니다. (추가 후 ${fmtSize(newTotal)})`,
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
    if (!name.trim())       e.name       = '이름을 입력해 주세요.'
    if (!product)           e.product    = '제품을 선택해 주세요.'
    if (!vocType)           e.vocType    = 'VOC 유형을 선택해 주세요.'
    if (!summary.trim())    e.summary    = '제목을 입력해 주세요.'
    if (!purpose.trim())    e.purpose    = '목적/배경을 입력해 주세요.'
    if (screenPaths.every(s => !s.trim()))
                            e.screenPath = '화면 위치를 입력해 주세요.'
    if (!detail.trim())     e.detail     = '요구사항 상세를 입력해 주세요.'
    return e
  }

  /* ── 제출 ── */
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // 클라이언트 검증
    const errs = validate()
    setErrors(prev => ({ ...prev, ...errs }))
    if (Object.keys(errs).length > 0) {
      requestAnimationFrame(() => {
        const first = document.querySelector<HTMLElement>('.invalid, [data-error-target]')
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }

    // API 호출
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const fd = new FormData()
      fd.append('dept',       dept)
      fd.append('name',       name)
      fd.append('product',    product)
      fd.append('vocType',    vocType)
      fd.append('summary',    summary)
      fd.append('customer',   customer)
      fd.append('priority',   priority)
      fd.append('purpose',    purpose)
      fd.append('screenPath', screenPaths.map(s => s.trim()).filter(Boolean).join('\n'))
      fd.append('detail',     detail)
      fd.append('dueDate',    dueDate)
      files.forEach(f => fd.append('files', f))

      const res  = await fetch('/api/voc', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? '접수 중 오류가 발생했습니다.')
      }

      /* 접수 성공 — 드래프트 삭제 */
      localStorage.removeItem(LS.draft)

      const jiraParam = data.jiraKey ? `&jira=${data.jiraKey}` : ''
      router.push(`/voc/complete?id=${data.id}&token=${data.viewToken}${jiraParam}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      setIsSubmitting(false)
    }
  }

  /* ── 렌더 ── */
  return (
    <div className="min-h-screen flex flex-col">

      {/* ─── Topbar ─── */}
      <header className="topbar">
        <Link href="/" className="topbar-brand" style={{ textDecoration: 'none' }}>
          <div className="logo">V</div>
          <span>서버솔루션팀 VOC 채널</span>
        </Link>
      </header>

      {/* ─── 스크롤 진행률 ─── */}
      <div
        className="scroll-progress"
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="작성 진행률"
      >
        <div className="bar" style={{ width: `${scrollProgress * 100}%` }} />
      </div>

      {/* ─── 본문 ─── */}
      <main className="flex-1" style={{ background: 'var(--surface-canvas)', padding: '32px 16px 80px' }}>
        <form onSubmit={onSubmit} noValidate className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 페이지 타이틀 */}
          <div style={{ marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 4px' }}>
              VOC 접수
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
                  placeholder="예: 수도권사업부 영업팀"
                />
                <FieldError msg={errors.dept} />
              </div>
              <div>
                <label className="field-label">이름<span className="req">*</span></label>
                <input
                  className={`input${errors.name ? ' invalid' : ''}`}
                  value={name}
                  onChange={e => { setName(e.target.value); setErrors(p => { const { name: _, ...r } = p; return r }) }}
                  placeholder="예: 홍길동"
                />
                <FieldError msg={errors.name} />
              </div>
            </div>

            {/* 자동 저장 동의 */}
            <div style={{
              display: 'flex', alignItems: 'center',
              paddingTop: 12, borderTop: '1px solid var(--surface-border)',
            }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-default)' }}>
                <span
                  className={`check${remember ? ' on' : ''}`}
                  onClick={(e) => { e.preventDefault(); setRemember(v => !v) }}
                  role="checkbox"
                  aria-checked={remember}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRemember(v => !v) } }}
                />
                이 브라우저에 부서·이름 기억하기
              </label>
            </div>
          </div>

          {/* ══ 2. 요구사항 구분 ══ */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionTitle>요구사항 구분</SectionTitle>

            {/* 제품 */}
            <div>
              <label className="field-label">제품<span className="req">*</span></label>
              <div
                className={`seg-block${errors.product ? ' invalid' : ''}`}
                style={{ gridTemplateColumns: `repeat(${PRODUCTS.length}, 1fr)` }}
                role="radiogroup"
                aria-label="제품"
                data-error-target={errors.product ? 'true' : undefined}
              >
                {PRODUCTS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    className={product === p.value ? 'on' : ''}
                    role="radio"
                    aria-checked={product === p.value}
                    onClick={() => { setProduct(p.value); setErrors(prev => { const { product: _, ...r } = prev; return r }) }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
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

            {/* 요청 고객사 / 우선순위 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">요청 고객사</label>
                <input
                  className="input"
                  value={customer}
                  onChange={e => setCustomer(e.target.value)}
                  placeholder="요청 고객사가 있는 경우에만 작성"
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
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <p className="field-help">
                  {PRIORITIES.find(p => p.value === priority)?.desc}
                </p>
              </div>
            </div>
          </div>

          {/* ══ 3. 상세 내용 ══ */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionTitle>상세 내용</SectionTitle>

            <div>
              <label className="field-label">제목<span className="req">*</span></label>
              <input
                className={`input${errors.summary ? ' invalid' : ''}`}
                value={summary}
                onChange={e => { setSummary(e.target.value); setErrors(p => { const { summary: _, ...r } = p; return r }) }}
                placeholder="관리자 추가 오류 확인 요청"
              />
              {errors.summary
                ? <FieldError msg={errors.summary} />
                : <p className="field-help">제목 앞에 [제품명]이 자동으로 추가됩니다.</p>
              }
            </div>

            <div>
              <label className="field-label">목적 / 배경<span className="req">*</span></label>
              <AutoTextarea
                className={`textarea${errors.purpose ? ' invalid' : ''}`}
                value={purpose}
                onChange={e => { setPurpose(e.target.value); setErrors(p => { const { purpose: _, ...r } = p; return r }) }}
                rows={2}
                minHeight={62}
                placeholder="왜 이 요청을 하게 됐는지 배경을 설명해 주세요."
              />
              <FieldError msg={errors.purpose} />
            </div>

            <div>
              <label className="field-label">화면 위치 (경로)<span className="req">*</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {screenPaths.map((path, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6 }}>
                    <input
                      className={`input${errors.screenPath && idx === 0 ? ' invalid' : ''}`}
                      value={path}
                      onChange={e => {
                        const next = [...screenPaths]
                        next[idx] = e.target.value
                        setScreenPaths(next)
                        setErrors(p => { const { screenPath: _, ...r } = p; return r })
                      }}
                      placeholder="진단 관리 > 보유 현황 > 조치 파일 목록"
                    />
                    {screenPaths.length > 1 && (
                      <button
                        type="button"
                        className="icon-btn-md"
                        onClick={() => setScreenPaths(screenPaths.filter((_, i) => i !== idx))}
                        aria-label={`${idx + 1}번째 화면 위치 제거`}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M3 6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setScreenPaths([...screenPaths, ''])}
                  style={{
                    alignSelf: 'flex-end',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontWeight: 400, color: 'var(--text-subtle)',
                    background: 'none', border: 0, padding: '4px 0',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 3v6M3 6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  화면 위치 추가
                </button>
              </div>
              <FieldError msg={errors.screenPath} />
            </div>

            <div>
              <label className="field-label">요구사항 상세<span className="req">*</span></label>
              <AutoTextarea
                className={`textarea${errors.detail ? ' invalid' : ''}`}
                value={detail}
                onChange={e => { setDetail(e.target.value); setErrors(p => { const { detail: _, ...r } = p; return r }) }}
                rows={9}
                minHeight={200}
                placeholder="구체적인 요구사항을 작성해주세요."
              />
              <FieldError msg={errors.detail} />
            </div>
          </div>

          {/* ══ 4. 참고 화면 및 기한 ══ */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionTitle>참고 화면 및 기한</SectionTitle>

            {/* 기한 */}
            <div>
              <label className="field-label">약속된 기한</label>
              <div style={{ position: 'relative', maxWidth: 200 }}>
                <input
                  className="input"
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  onClick={e => {
                    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void }
                    try { el.showPicker?.() } catch {}
                  }}
                  style={{ paddingRight: dueDate ? 40 : (isTouch ? 36 : undefined), cursor: 'pointer' }}
                />
                {/* 달력 아이콘 — 터치 기기 전용 */}
                {!dueDate && isTouch && (
                  <svg
                    aria-hidden="true"
                    width="16" height="16" viewBox="0 0 16 16" fill="none"
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}
                  >
                    <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M2 6h12M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                )}
                {/* X 버튼 — 날짜 입력 시 (데스크탑·모바일 공통) */}
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate('')}
                    aria-label="기한 지우기"
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      width: 28, height: 28, padding: 0, border: 0, background: 'transparent',
                      cursor: 'pointer', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="var(--gray-200)"/>
                      <path d="M5 5l6 6M11 5l-6 6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
              <p className="field-help">고객사와 협의된 일정 또는 약속된 완료 기한이 있을 경우에만 입력하세요.</p>
            </div>

            {/* 참고 화면 */}
            <div>
              <label className="field-label">참고 화면</label>
              <p className="field-help" style={{ marginTop: 0, marginBottom: 8 }}>
                화면 캡쳐본, 고객사 요청 원본 등 이해에 도움이 될만한 자료를 올려주세요.
              </p>

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
                {/* 데스크탑 안내 */}
                <div className="show-desktop">
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-strong)' }}>
                    파일을 드래그하거나{' '}
                    <span style={{ color: 'var(--brand-700)', textDecoration: 'underline' }}>찾아보기</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    PNG · JPG · PDF · DOCX · PPTX · XLSX · HWP · TXT — 파일당 최대 50MB
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <kbd>Ctrl</kbd><span>+</span><kbd>V</kbd>
                    <span>로 스크린샷을 바로 붙여넣을 수 있어요</span>
                  </div>
                </div>

                {/* 모바일 안내 */}
                <div className="show-mobile">
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-strong)' }}>
                    탭하여 파일 선택
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    PNG · JPG · PDF · DOCX 등 — 파일당 최대 50MB
                  </div>
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
          {submitError && (
            <div className="field-error" style={{ justifyContent: 'center', padding: '10px 14px', background: 'var(--danger-50)', borderRadius: 'var(--r-md)', border: '1px solid var(--danger-100)' }}>
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M6 3.5v3M6 8.2v.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {submitError}
            </div>
          )}

          <div className={`submit-bar flex flex-col sm:flex-row justify-end gap-3 pt-2 pb-4${keyboardOpen ? ' hidden' : ''}`}>
            <button
              type="button"
              className="btn btn-ghost btn-lg"
              style={{ justifyContent: 'center' }}
              onClick={() => {
                if (!window.confirm('입력한 내용이 모두 사라집니다. 초기화할까요?')) return
                setDept('')
                setName('')
                setProduct('SERVERFILTER')
                setVocType('')
                setSummary('')
                setCustomer('')
                setPriority('medium')
                setPurpose('')
                setScreenPaths([''])
                setDetail('')
                setDueDate('')
                setFiles([])
                setErrors({})
                setSubmitError(null)
                localStorage.removeItem(LS.draft)
                if (fileInputRef.current) fileInputRef.current.value = ''
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              초기화
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isSubmitting}
              style={{ minWidth: 140 }}
            >
              {isSubmitting ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.3"/>
                    <path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  접수 중…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  VOC 접수하기
                </>
              )}
            </button>
          </div>

        </form>
      </main>
    </div>
  )
}
