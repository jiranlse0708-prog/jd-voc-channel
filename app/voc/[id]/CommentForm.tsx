'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface CommentFormProps {
  vocId:         number
  viewToken:     string
  requesterName: string
}

export default function CommentForm({ vocId, viewToken, requesterName }: CommentFormProps) {
  const [authorName, setAuthorName] = useState(requesterName)
  const [body, setBody]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<{ msg: string; detail?: string } | null>(null)
  const [success, setSuccess]       = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!authorName.trim() || !body.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/voc/comment', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocId, viewToken, authorName: authorName.trim(), body: body.trim() }),
      })

      let data: Record<string, unknown> = {}
      try { data = await res.json() } catch {}

      if (!res.ok) {
        setError({
          msg:    (data.error as string) ?? '댓글 등록에 실패했습니다.',
          detail: (data.detail as string) ?? undefined,
        })
        setSubmitting(false)
        return
      }

      setBody('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      router.refresh()
    } catch {
      setError({ msg: '네트워크 오류가 발생했습니다.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card detail-card">
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          <path d="M14 10a2 2 0 01-2 2H5l-3 3V4a2 2 0 012-2h8a2 2 0 012 2v6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
          댓글 작성
        </span>
      </div>

      {/* 작성자 */}
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">작성자</label>
        <input
          className="input"
          value={authorName}
          onChange={e => setAuthorName(e.target.value)}
          placeholder="이름"
          style={{ maxWidth: 200 }}
        />
      </div>

      {/* 댓글 내용 */}
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">내용</label>
        <textarea
          ref={textareaRef}
          className="textarea"
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="댓글을 입력하세요"
          rows={3}
          maxLength={5000}
          style={{ resize: 'vertical', minHeight: 80 }}
        />
      </div>

      {/* 에러 */}
      {error && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--danger-50, #fef2f2)', border: '1px solid var(--danger-200, #fecaca)' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--danger-600, #dc2626)' }}>{error.msg}</p>
          {error.detail && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--danger-500, #ef4444)' }}>{error.detail}</p>
          )}
        </div>
      )}

      {/* 성공 */}
      {success && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--success-50, #f0fdf4)', border: '1px solid var(--success-200, #bbf7d0)' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--success-600, #16a34a)' }}>댓글이 등록되었습니다.</p>
        </div>
      )}

      {/* 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary btn-sm"
          disabled={submitting || !authorName.trim() || !body.trim()}
          onClick={handleSubmit}
        >
          {submitting ? (
            <>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.3"/>
                <path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              등록 중…
            </>
          ) : '댓글 등록'}
        </button>
      </div>
    </div>
  )
}
