'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { VOC_TYPE_LABEL } from '@/lib/mapping'
import Topbar from '@/components/Topbar'

/* ── 상수 ── */
const LS_EMAIL = 'voc.requester.email'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  /* 로컬에서 불러올 이메일 (마운트 후에만 의미 있는 값) */
  const [email, setEmail]               = useState<string | null>(null)
  const [emailInput, setEmailInput]     = useState('')
  const [emailError, setEmailError]     = useState<string | null>(null)
  const [showEmailForm, setShowEmailForm] = useState(false)

  /* 조회 결과 */
  const [items, setItems]       = useState<VocItem[]>([])
  const [loading, setLoading]   = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  /* 필터 */
  const [filter, setFilter] = useState<FilterValue>('전체')

  /* ── 마운트 시 로컬 이메일 확인 ── */
  useEffect(() => {
    const saved = (localStorage.getItem(LS_EMAIL) ?? '').trim().toLowerCase()
    if (saved && EMAIL_RE.test(saved)) {
      setEmail(saved)
      void loadItems(saved)
    } else {
      setShowEmailForm(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* ── 이메일 입력 폼 제출 ── */
  const onSubmitEmail = (ev: React.FormEvent) => {
    ev.preventDefault()
    const value = emailInput.trim().toLowerCase()
    if (!value) { setEmailError('이메일을 입력해 주세요.'); return }
    if (!EMAIL_RE.test(value)) { setEmailError('올바른 이메일 형식이 아닙니다.'); return }
    setEmailError(null)
    setEmail(value)
    localStorage.setItem(LS_EMAIL, value)
    setShowEmailForm(false)
    void loadItems(value)
  }

  /* ── 다른 이메일로 조회 ── */
  const onChangeEmail = () => {
    setEmailInput(email ?? '')
    setShowEmailForm(true)
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
      <main className="flex-1" style={{ background: 'var(--surface-canvas)', padding: '32px 16px 80px' }}>
        <div className="page-container-wide" style={{ width: '100%', maxWidth: 1040, margin: '0 auto' }}>

          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-strong)' }}>
                내 접수 조회
              </h1>
              {email && !showEmailForm && (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{email}</span>{' '}
                  <button
                    type="button"
                    onClick={onChangeEmail}
                    style={{
                      background: 'none', border: 0, padding: 0,
                      color: 'var(--brand-600)', cursor: 'pointer',
                      fontSize: 12, fontFamily: 'inherit', textDecoration: 'underline',
                    }}
                  >
                    다른 이메일로 조회
                  </button>
                </p>
              )}
            </div>
            <Link href="/voc/new" className="btn btn-primary btn-sm">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              새 VOC 접수
            </Link>
          </div>

          {/* ─── 이메일 입력 폼 ─── */}
          {showEmailForm && (
            <div className="card" style={{ marginBottom: 16 }}>
              <form onSubmit={onSubmitEmail} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="field-label">접수 시 입력한 이메일</label>
                  <input
                    className={`input${emailError ? ' invalid' : ''}`}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
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
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {email && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setShowEmailForm(false); setEmailInput(''); setEmailError(null) }}
                    >
                      취소
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary btn-sm">
                    조회
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ─── 상태 필터 ─── */}
          {email && !showEmailForm && !loading && items.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {FILTER_OPTIONS.map(opt => {
                const count = opt === '전체'
                  ? items.length
                  : items.filter(i => i.current_status === opt).length
                const isActive = filter === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setFilter(opt)}
                    className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontWeight: 500 }}
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
          {!loading && !loadError && email && !showEmailForm && items.length === 0 && (
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
                      <th style={{ width: 64 }}>No</th>
                      <th style={{ width: 110 }}>제품</th>
                      <th style={{ width: 84 }}>유형</th>
                      <th>제목</th>
                      <th style={{ width: 90 }}>상태</th>
                      <th style={{ width: 64 }} title="담당자 코멘트 수">💬</th>
                      <th style={{ width: 100 }}>JIRA</th>
                      <th style={{ width: 110 }}>접수일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => {
                      const status = STATUS_DISPLAY[item.current_status] ?? { cls: 'status-received', label: item.current_status }
                      return (
                        <tr key={item.id} onClick={() => goDetail(item)} style={{ cursor: 'pointer' }}>
                          <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>#{item.id}</td>
                          <td>{item.product}</td>
                          <td>
                            <span className={`cat cat-${item.voc_type}`}>
                              {VOC_TYPE_LABEL[item.voc_type] ?? item.voc_type}
                            </span>
                          </td>
                          <td className="voc-title-cell">{item.summary}</td>
                          <td>
                            <span className={`status ${status.cls}`}>
                              <span className="dot" />
                              {status.label}
                            </span>
                          </td>
                          <td style={{
                            textAlign: 'center',
                            fontFamily: 'var(--font-mono)',
                            color: item.comments_count > 0 ? 'var(--text-strong)' : 'var(--text-subtle)',
                            fontWeight: item.comments_count > 0 ? 600 : 400,
                          }}>
                            {item.comments_count > 0 ? item.comments_count : '–'}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: item.jira_issue_key ? 'var(--brand-600)' : 'var(--text-muted)' }}>
                            {item.jira_issue_key ?? '–'}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
                      style={{ cursor: 'pointer', padding: 16 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          #{item.id}
                        </span>
                        <span className={`status ${status.cls}`} style={{ fontSize: 11 }}>
                          <span className="dot" />
                          {status.label}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: 'var(--text-strong)', lineHeight: 1.4 }}>
                        {item.summary}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                        <span className={`cat cat-${item.voc_type}`}>
                          {VOC_TYPE_LABEL[item.voc_type] ?? item.voc_type}
                        </span>
                        <span>{item.product}</span>
                        {item.jira_issue_key && (
                          <span style={{ color: 'var(--brand-600)', fontFamily: 'var(--font-mono)' }}>· {item.jira_issue_key}</span>
                        )}
                        {item.comments_count > 0 && (
                          <span>· 💬 {item.comments_count}</span>
                        )}
                        <span style={{ marginLeft: 'auto', fontSize: 11 }}>{fmtDate(item.created_at)}</span>
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
