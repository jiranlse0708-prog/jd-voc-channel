'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CommentFormProps {
  vocId:         number
  viewToken:     string
  requesterName: string
}

export default function CommentForm({ vocId, viewToken, requesterName }: CommentFormProps) {
  const [body, setBody]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!body.trim() || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/voc/comment', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocId, viewToken, authorName: requesterName, body: body.trim() }),
      })

      let data: Record<string, unknown> = {}
      try { data = await res.json() } catch {}

      if (!res.ok) {
        setError((data.error as string) ?? '댓글 등록에 실패했습니다.')
        setSubmitting(false)
        return
      }

      setBody('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
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
        placeholder={submitting ? '등록 중…' : '댓글을 입력 후 Enter를 누르세요.'}
        rows={2}
        maxLength={5000}
        disabled={submitting}
        style={{ resize: 'none', minHeight: 64 }}
      />
      {error && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--danger-600, #dc2626)' }}>{error}</p>}
      {success && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--success-600, #16a34a)' }}>댓글이 등록되었습니다.</p>}
    </div>
  )
}
