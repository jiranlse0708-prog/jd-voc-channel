'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { VOC_TYPE_LABEL } from '@/lib/mapping'
import Topbar from '@/components/Topbar'

/* ── 상수 ── */
const LS_EMAIL    = 'voc.requester.email'
const LS_VERIFIED = 'voc.email.verified'  // 인증된 이메일 로컬 캐시
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* ── 상태 표시 매핑 (JIRA 워크플로우 기준) ── */
const STATUS_DISPLAY: Record<string, { cls: string; label: string }> = {
  '접수':    { cls: 'status-received', label: '접수' },
  '처리 중': { cls: 'status-progress', label: '처리 중' },
  '완료':    { cls: 'status-done',     label: '완료' },
  '보류':    { cls: 'status-hold',     label: '보류' },
}

const FILTER_OPTIONS = ['전체', '접수', '처리 중', '완료', '보류'] as const
type FilterValue = typeof FILTER_OPTIONS[number]

/* ── 타입 ── */
interface VocItem {
  id:               number
  view_token:       string
  product:          string
  voc_type:         string
  summary:          string
  current_status:   string
  jira_issue_key:   string | null
  jira_url:         string | null
  comments_count:   number
  created_at:       string
}

/* ── 유틸 ── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  })
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit',
    timeZone: 'Asia/Seoul',
  })
}

/* ════════════════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════════════════ */
export default function VocMyPage() {
  const router = useRouter()

  /* 인증 이메일 */
  const [email, setEmail]           = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)

  /* OTP 단계: 'email' | 'code' */
  const [step, setStep]           = useState<'email' | 'code'>('email')
  const [digits, setDigits]       = useState<string[]>(Array(6).fill(''))
  const digitRefs                 = useRef<(HTMLInputElement | null)[]>([])
  const [codeError, setCodeError] = useState<string | null>(null)
  const [sending, setSending]     = useState(false)
  const [verifying, setVerifying] = useState(false)

  /* 조회 결과 */
  const [items, setItems]         = useState<VocItem[]>([])
  const [loading, setLoading]     = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  /* 필터 */
  const [filter, setFilter] = useState<FilterValue>('전체')

  /* ── 마운트 시 인증 쿠키 확인 (서버가 세팅한 쿠키는 httpOnly라 직접 읽기 불가 → API로 확인) ── */
  useEffect(() => {
    const cached = localStorage.getItem(LS_VERIFIED)
    if (cached && EMAIL_RE.test(cached)) {
      /* 서버에서 인증 쿠키 유효성 확인 */
      fetch('/api/voc/auth/me')
        .then(r => r.json())
        .then(d => {
          if (d.email) {
            setEmail(d.email)
            void loadItems(d.email)
          } else {
            localStorage.removeItem(LS_VERIFIED)
          }
        })
        .catch(() => localStorage.removeItem(LS_VERIFIED))
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  /* ── 조회 API 호출 ── */
  const loadItems = async (e: string) => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/voc/my?email=${encodeURIComponent(e)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '조회에 실패했습니다.')
      setItems(data.items ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  /* ── OTP 전송 ── */
  const onSendOtp = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const value = emailInput.trim().toLowerCase()
    if (!value) { setEmailError('이메일을 입력해 주세요.'); return }
    if (!EMAIL_RE.test(value)) { setEmailError('올바른 이메일 형식이 아닙니다.'); return }
    setEmailError(null)
    setSending(true)
    try {
      const res = await fetch('/api/voc/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStep('code')
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : '발송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  /* ── 자릿수 입력 핸들러 ── */
  const onDigitInput = (idx: number, val: string) => {
    const char = val.replace(/\s/g, '').toUpperCase().slice(-1)
    const next = [...digits]; next[idx] = char; setDigits(next)
    setCodeError(null)
    if (char && idx < 5) digitRefs.current[idx + 1]?.focus()
  }
  const onDigitKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) { const n = [...digits]; n[idx] = ''; setDigits(n) }
      else if (idx > 0) digitRefs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      digitRefs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < 5) {
      digitRefs.current[idx + 1]?.focus()
    }
  }
  const onDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\s/g, '').toUpperCase().slice(0, 6)
    const next = Array(6).fill('')
    text.split('').forEach((c, i) => { next[i] = c })
    setDigits(next)
    digitRefs.current[Math.min(text.length, 5)]?.focus()
  }

  /* ── step → code 전환 시 첫 번째 박스 포커스 ── */
  useEffect(() => {
    if (step === 'code') setTimeout(() => digitRefs.current[0]?.focus(), 50)
  }, [step])

  /* ── OTP 확인 ── */
  const onVerifyOtp = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const code = digits.join('')
    if (code.length < 6) { setCodeError('인증코드 6자리를 모두 입력해 주세요.'); return }
    setCodeError(null)
    setVerifying(true)
    try {
      const res = await fetch('/api/voc/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim().toLowerCase(), code: digits.join('') }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const verifiedEmail = data.email as string
      localStorage.setItem(LS_VERIFIED, verifiedEmail)
      localStorage.setItem(LS_EMAIL, verifiedEmail)
      setEmail(verifiedEmail)
      void loadItems(verifiedEmail)
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : '인증에 실패했습니다.')
    } finally {
      setVerifying(false)
    }
  }

  /* ── 로그아웃 (인증 초기화) ── */
  const onSignOut = async () => {
    await fetch('/api/voc/auth/signout', { method: 'POST' })
    localStorage.removeItem(LS_VERIFIED)
    setEmail(null)
    setItems([])
    setStep('email')
    setEmailInput('')
    setDigits(Array(6).fill(''))
  }

  /* ── 필터링 ── */
  const filteredItems = useMemo(() => {
    if (filter === '전체') return items
    return items.filter(i => i.current_status === filter)
  }, [items, filter])

  /* ── 행 클릭 → 단건 조회 페이지 ── */
  const goDetail = (item: VocItem) => {
    router.push(`/voc/${item.id}?token=${item.view_token}`)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Topbar ─── */}
      <Topbar />

      {/* ─── 본문 ─── */}
      <main className="flex-1 voc-page-main">
        <div className="page-container-wide voc-page-container" style={{ width: '100%', maxWidth: 1040, margin: '0 auto' }}>

          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-strong)' }}>
                내 접수 조회
              </h1>
              {email && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 14, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-strong)', fontWeight: 500 }}>{email}</span>
                  <button
                    type="button"
                    onClick={onSignOut}
                    style={{ background: 'none', border: 0, padding: 0, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textDecoration: 'underline' }}
                  >
                    변경
                  </button>
                </div>
              )}
            </div>
            <Link href="/voc/new" className="btn btn-primary btn-sm">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              새 VOC 접수
            </Link>
          </div>

          {/* ─── 이메일 인증 폼 (미인증 상태) ─── */}
          {!email && (
            <div className="card" style={{ maxWidth: 440, margin: '40px auto 16px', padding: '40px 36px' }}>

              {/* STEP 1: 이메일 입력 */}
              {step === 'email' && (
                <form onSubmit={onSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-strong)', textAlign: 'center' }}>이메일 인증</h2>
                    <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, textAlign: 'center' }}>
                      접수 시 입력한 이메일을 입력하면<br/>인증코드를 발송해드려요.
                    </p>
                    <input
                      className={`input${emailError ? ' invalid' : ''}`}
                      type="email" inputMode="email" autoComplete="email" autoFocus
                      value={emailInput}
                      onChange={ev => { setEmailInput(ev.target.value); setEmailError(null) }}
                      placeholder="예: hong@jiran.com"
                    />
                    {emailError && (
                      <p className="field-error" style={{ marginTop: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M6 3.5v3M6 8.2v.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                        {emailError}
                      </p>
                    )}
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={sending}>
                    {sending ? '전송 중…' : '인증코드 전송'}
                  </button>
                </form>
              )}

              {/* STEP 2: 코드 입력 */}
              {step === 'code' && (
                <form onSubmit={onVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div style={{ textAlign: 'center' }}>
                    <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-strong)' }}>이메일 인증</h2>
                    <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                      <strong style={{ color: 'var(--text-strong)' }}>{emailInput}</strong>으로<br/>
                      인증코드를 발송했어요. (10분 유효)
                    </p>

                    {/* OTP 박스 */}
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                      {[0, 1, 2, 3, 4, 5].map(idx => (
                        <input
                          key={idx}
                          ref={el => { digitRefs.current[idx] = el }}
                          type="text"
                          inputMode="text"
                          maxLength={1}
                          value={digits[idx]}
                          onChange={e => onDigitInput(idx, e.target.value)}
                          onKeyDown={e => onDigitKeyDown(idx, e)}
                          onPaste={onDigitPaste}
                          style={{
                            flex: '1 1 0', minWidth: 0, maxWidth: 52, height: 60,
                            border: `1.5px solid ${digits[idx] ? 'var(--brand-500)' : 'var(--surface-border)'}`,
                            borderRadius: 12,
                            fontSize: 24, fontWeight: 700, textAlign: 'center',
                            color: 'var(--text-strong)',
                            background: digits[idx] ? 'var(--brand-50, #fff8f2)' : '#fff',
                            outline: 'none', caretColor: 'transparent',
                            fontFamily: 'var(--font-mono)',
                            transition: 'border-color 0.15s, background 0.15s',
                          }}
                        />
                      ))}
                    </div>

                    {codeError && (
                      <p className="field-error" style={{ marginTop: 12, justifyContent: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M6 3.5v3M6 8.2v.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                        {codeError}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button type="submit" className="btn btn-primary" disabled={verifying || digits.join('').length < 6}>
                      {verifying ? '확인 중…' : '확인'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStep('email'); setDigits(Array(6).fill('')); setCodeError(null) }}
                      style={{ background: 'none', border: 0, padding: '6px 0', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
                    >
                      이메일 다시 입력
                    </button>
                  </div>
                </form>
              )}

            </div>
          )}

          {/* ─── 상태 필터 ─── */}
          {email && !loading && items.length > 0 && (
            <div className="filter-chips-row">
              {FILTER_OPTIONS.map(opt => {
                const count = opt === '전체'
                  ? items.length
                  : items.filter(i => i.current_status === opt).length
                const isActive = filter === opt
                const isDisabled = count === 0 && opt !== '전체'
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { if (!isDisabled) setFilter(opt) }}
                    disabled={isDisabled}
                    className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                    style={{
                      fontWeight: 500,
                      opacity: isDisabled ? 0.45 : 1,
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {opt} <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* ─── 에러 ─── */}
          {loadError && (
            <div className="card" style={{ marginBottom: 16, padding: '16px 20px', background: 'var(--danger-50)', borderColor: 'var(--danger-100)' }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--danger-700)' }}>{loadError}</p>
            </div>
          )}

          {/* ─── 로딩 ─── */}
          {loading && (
            <div className="card" style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }}>
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.3" />
                <path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <p style={{ margin: 0, fontSize: 13 }}>접수 내역을 불러오는 중…</p>
            </div>
          )}

          {/* ─── 결과 0건 ─── */}
          {!loading && !loadError && email && items.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '56px 16px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: 'var(--text-strong)' }}>
                접수 내역이 없습니다
              </p>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                이메일 도입 이전에 접수한 건은 JIRA에서 확인하세요.
              </p>
              <Link href="/voc/new" className="btn btn-primary btn-sm" style={{ display: 'inline-flex' }}>
                새 접수하러 가기
              </Link>
            </div>
          )}

          {/* ─── 필터링 결과 0건 (전체는 0건 아니지만 필터 결과만 0) ─── */}
          {!loading && !loadError && items.length > 0 && filteredItems.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: 14 }}>
                선택한 상태(<strong>{filter}</strong>)에 해당하는 접수가 없습니다.
              </p>
            </div>
          )}

          {/* ─── 목록 (데스크탑: 테이블) ─── */}
          {!loading && filteredItems.length > 0 && (
            <>
              <div className="voc-desktop-only" style={{ overflow: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 56, textAlign: 'center' }}>순번</th>
                      <th style={{ width: 110, textAlign: 'center' }}>제품</th>
                      <th style={{ width: 84, textAlign: 'center' }}>유형</th>
                      <th>제목</th>
                      <th style={{ width: 90, textAlign: 'center' }}>상태</th>
                      <th style={{ width: 80, textAlign: 'center' }}>댓글</th>
                      <th style={{ width: 110, textAlign: 'center' }}>JIRA</th>
                      <th style={{ width: 110, textAlign: 'center' }}>접수일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, idx) => {
                      const status = STATUS_DISPLAY[item.current_status] ?? { cls: 'status-received', label: item.current_status }
                      return (
                        <tr key={item.id} onClick={() => goDetail(item)} style={{ cursor: 'pointer' }}>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ textAlign: 'center' }}>{item.product}</td>
                          <td style={{ textAlign: 'center' }}>{VOC_TYPE_LABEL[item.voc_type] ?? item.voc_type}</td>
                          <td className="voc-title-cell">{item.summary}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status ${status.cls}`}>
                              <span className="dot" />
                              {status.label}
                            </span>
                          </td>
                          <td style={{
                            textAlign: 'center',
                            color: item.comments_count > 0 ? 'var(--text-strong)' : 'var(--text-subtle)',
                            fontWeight: item.comments_count > 0 ? 600 : 400,
                            fontSize: 13,
                          }}>
                            {`${item.comments_count}개`}
                          </td>
                          <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                            {item.jira_issue_key && item.jira_url ? (
                              <a
                                href={item.jira_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--brand-600)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                {item.jira_issue_key}
                                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                  <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-subtle)' }}>–</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                              title={fmtDate(item.created_at)}>
                            {fmtDateShort(item.created_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* ─── 목록 (모바일: 카드) ─── */}
              <div className="voc-mobile-list">
                {filteredItems.map(item => {
                  const status = STATUS_DISPLAY[item.current_status] ?? { cls: 'status-received', label: item.current_status }
                  return (
                    <div
                      key={item.id}
                      className="card"
                      onClick={() => goDetail(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={ev => { if (ev.key === 'Enter') goDetail(item) }}
                      style={{ cursor: 'pointer', padding: 20 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        {item.jira_issue_key && item.jira_url ? (
                          <a
                            href={item.jira_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--brand-600)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            {item.jira_issue_key}
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </a>
                        ) : <span />}
                        <span className={`status ${status.cls}`} style={{ fontSize: 12 }}>
                          <span className="dot" />
                          {status.label}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600, color: 'var(--text-strong)', lineHeight: 1.4 }}>
                        {item.summary}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                        <span>{VOC_TYPE_LABEL[item.voc_type] ?? item.voc_type}</span>
                        <span>·</span>
                        <span>{item.product}</span>
                        {item.comments_count > 0 && (
                          <span>· 💬 {item.comments_count}</span>
                        )}
                        <span style={{ marginLeft: 'auto', fontSize: 12 }} title={fmtDate(item.created_at)}>
                          {fmtDate(item.created_at)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {items.length >= 50 && (
                <p style={{ margin: '20px 0 0', fontSize: 12, color: 'var(--text-subtle)', textAlign: 'center' }}>
                  최근 50건만 표시됩니다. 그 이전 접수는 JIRA에서 확인하세요.
                </p>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  )
}
