'use client'

import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { PRODUCTS, VOC_TYPES, PRIORITIES } from '@/lib/constants'

interface EditFormProps {
  vocId:         number
  viewToken:     string
  currentStatus: string
  initial: {
    product:    string
    vocType:    string
    summary:    string
    customer:   string
    priority:   string
    purpose:    string
    screenPath: string
    detail:     string
    dueDate:    string | null
  }
  children: React.ReactNode
}

export default function EditForm({ vocId, viewToken, currentStatus, initial, children }: EditFormProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [product, setProduct]       = useState(initial.product)
  const [vocType, setVocType]       = useState(initial.vocType)
  const [summary, setSummary]       = useState(initial.summary)
  const [customer, setCustomer]     = useState(initial.customer)
  const [priority, setPriority]     = useState(initial.priority)
  const [purpose, setPurpose]       = useState(initial.purpose)
  const [screenPath, setScreenPath] = useState(initial.screenPath)
  const [detail, setDetail]         = useState(initial.detail)
  const [dueDate, setDueDate]       = useState(initial.dueDate ?? '')

  const router = useRouter()

  const canEdit = currentStatus !== '완료' && currentStatus !== '삭제'

  const startEdit = () => {
    setProduct(initial.product)
    setVocType(initial.vocType)
    setSummary(initial.summary)
    setCustomer(initial.customer)
    setPriority(initial.priority)
    setPurpose(initial.purpose)
    setScreenPath(initial.screenPath)
    setDetail(initial.detail)
    setDueDate(initial.dueDate ?? '')
    setError(null)
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setError(null)
  }

  const save = async () => {
    if (!summary.trim() || !purpose.trim() || !screenPath.trim() || !detail.trim()) {
      setError('필수 항목을 모두 입력해 주세요.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/voc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vocId, viewToken, product, vocType, summary,
          customer, priority, purpose, screenPath, detail,
          dueDate: dueDate || null,
        }),
      })

      let data: Record<string, unknown> = {}
      try { data = await res.json() } catch {}

      if (!res.ok) {
        setError((data.error as string) ?? '수정에 실패했습니다.')
        return
      }

      setEditing(false)
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="detail-section-label" style={{ margin: 0 }}>요청 정보</div>
          {canEdit && (
            <button className="btn btn-ghost" onClick={startEdit} style={{ fontSize: 11, padding: '2px 6px', gap: 3, minHeight: 0 }}>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
              수정
            </button>
          )}
        </div>
        {children}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="detail-section-label" style={{ margin: 0 }}>요청 정보 수정</div>

      {/* 제품 */}
      <div>
        <label className="field-label">제품</label>
        <div className="seg-block" style={{ gridTemplateColumns: `repeat(${PRODUCTS.length}, 1fr)` }} role="radiogroup">
          {PRODUCTS.map(p => (
            <button key={p.value} type="button" className={product === p.value ? 'on' : ''}
              onClick={() => setProduct(p.value)}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* VOC 유형 */}
      <div>
        <label className="field-label">VOC 유형</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VOC_TYPES.map(t => (
            <div key={t.value}
              className={`radio-card${vocType === t.value ? ' selected' : ''}`}
              onClick={() => setVocType(t.value)}
              role="radio" aria-checked={vocType === t.value} tabIndex={0}
              onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') setVocType(t.value) }}
            >
              <span className="radio-dot" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>{t.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 고객사 / 우선순위 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label">요청 고객사</label>
          <input className="input" value={customer}
            onKeyDown={e => { if (e.key === ' ') e.preventDefault() }}
            onChange={e => setCustomer(e.target.value.replace(/\s/g, ''))}
            placeholder="요청 고객사가 있는 경우에만" />
        </div>
        <div>
          <label className="field-label">우선순위</label>
          <select className="select" value={priority} onChange={e => setPriority(e.target.value)}>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* 기한 */}
      <div>
        <label className="field-label">약속된 기한</label>
        <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          style={{ maxWidth: 200 }} />
      </div>

      {/* 제목 */}
      <div>
        <label className="field-label">제목<span className="req">*</span></label>
        <input className="input" value={summary} onChange={e => setSummary(e.target.value)} />
      </div>

      {/* 목적/배경 */}
      <div>
        <label className="field-label">목적 / 배경<span className="req">*</span></label>
        <textarea className="textarea" value={purpose} onChange={e => setPurpose(e.target.value)}
          rows={3} style={{ resize: 'vertical', minHeight: 80 }} />
      </div>

      {/* 화면 경로 */}
      <div>
        <label className="field-label">화면 위치 (경로)<span className="req">*</span></label>
        <textarea className="textarea" value={screenPath} onChange={e => setScreenPath(e.target.value)}
          rows={2} style={{ resize: 'vertical', minHeight: 60 }} />
      </div>

      {/* 상세 내용 */}
      <div>
        <label className="field-label">요구사항 상세<span className="req">*</span></label>
        <textarea className="textarea" value={detail} onChange={e => setDetail(e.target.value)}
          rows={6} style={{ resize: 'vertical', minHeight: 160 }} />
      </div>

      {/* 에러 */}
      {error && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--danger-600, #dc2626)' }}>{error}</p>
      )}

      {/* 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={saving}>취소</button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}
