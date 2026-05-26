'use client'

import { useState } from 'react'
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
    <div>
      {/* 작성자 + 내용 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <input
          className="input"
          value={authorName}
          onChange={e => setAuthorName(e.target.value)}
          placeholder="작성자"
          style={{ maxWidth: 120, flexShrink: 0 }}
        />
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            className="textarea"
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={submitting ? '등록 중…' : '댓글을 입력하세요'}
            rows={1}
            maxLength={5000}
            disabled={submitting}
            style={{ resize: 'none', minHeight: 40 }}
          />
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--danger-50, #fef2f2)', border: '1px solid var(--danger-200, #fecaca)' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--danger-600, #dc2626)' }}>{error.msg}</p>
          {error.detail && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--danger-500, #ef4444)' }}>{error.detail}</p>
          )}
        </div>
      )}

      {/* 성공 */}
      {success && (
        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--success-50, #f0fdf4)', border: '1px solid var(--success-200, #bbf7d0)' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--success-600, #16a34a)' }}>댓글이 등록되었습니다.</p>
        </div>
      )}
    </div>
  )
}
