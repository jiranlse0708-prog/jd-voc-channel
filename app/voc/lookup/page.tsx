'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export default function VocLookupPage() {
  const [email, setEmail]           = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [submitError, setSubmitErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent]             = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitErr(null)

    const trimmed = email.trim()
    if (!trimmed) { setError('이메일을 입력해 주세요.'); return }
    if (!isValidEmail(trimmed)) { setError('이메일 형식이 올바르지 않습니다.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/voc/lookup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? '요청 처리 중 오류가 발생했습니다.')
      setSent(true)
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Topbar */}
      <header className="topbar">
        <Link href="/" className="topbar-brand" style={{ textDecoration: 'none' }}>
          <div className="logo">V</div>
          <span>VOC 접수 채널</span>
        </Link>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          VOC 조회
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center" style={{ background: 'var(--surface-canvas)', padding: '40px 16px 80px' }}>
        <div className="page-container" style={{ width: '100%' }}>

          {sent ? (
            /* ── 발송 완료 안내 ── */
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--success-50)', border: '2px solid var(--success-100)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
                  <path d="M6 14l5.5 5.5L22 9" stroke="var(--success-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 8px' }}>
                메일을 발송했습니다
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.6 }}>
                입력하신 이메일로 접수 내역이 있는 경우<br />조회 링크 목록을 발송했습니다.
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-subtle)', margin: '0 0 24px' }}>
                메일이 도착하지 않으면 스팸함을 확인하거나 잠시 후 다시 시도해 주세요.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/" className="btn btn-ghost">홈으로</Link>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setSent(false); setEmail('') }}
                >
                  다른 이메일로 다시
                </button>
              </div>
            </div>
          ) : (
            /* ── 입력 폼 ── */
            <>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 8px' }}>
                  VOC 조회
                </h1>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                  접수 시 입력한 이메일을 알려 주시면<br />접수 내역 조회 링크를 메일로 보내드립니다.
                </p>
              </div>

              <form onSubmit={onSubmit} noValidate className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="field-label">이메일<span className="req">*</span></label>
                  <input
                    className={`input${error ? ' invalid' : ''}`}
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(null) }}
                    placeholder="접수 시 입력한 이메일"
                    autoFocus
                  />
                  {error
                    ? (
                      <p className="field-error">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
                          <path d="M6 3.5v3M6 8.2v.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                        {error}
                      </p>
                    )
                    : <p className="field-help">최근 50건까지 조회 링크가 발송됩니다.</p>
                  }
                </div>

                {submitError && (
                  <div className="field-error" style={{ padding: '10px 14px', background: 'var(--danger-50)', borderRadius: 'var(--r-md)', border: '1px solid var(--danger-100)' }}>
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M6 3.5v3M6 8.2v.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.3"/>
                        <path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                      발송 중…
                    </>
                  ) : '조회 링크 받기'}
                </button>

                <div style={{ textAlign: 'center', paddingTop: 4 }}>
                  <Link href="/voc/new" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    아직 접수 전이신가요? 새 VOC 접수 →
                  </Link>
                </div>
              </form>
            </>
          )}

        </div>
      </main>
    </div>
  )
}
