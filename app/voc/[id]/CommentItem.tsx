'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CommentItemProps {
  vocId:          number
  viewToken:      string
  jiraCommentId:  string | null
  author:         string
  body:           string
  editable:       boolean
  children:       React.ReactNode
}

export default function CommentItem({ vocId, viewToken, jiraCommentId, author, body, editable, children }: CommentItemProps) {
  const [mode, setMode]         = useState<'view' | 'edit'>('view')
  const [editBody, setEditBody] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const router = useRouter()

  const rawBody = body.replace(/^\[.+?\]\s*/, '')

  const startEdit = () => {
    setEditBody(rawBody)
    setMode('edit')
    setError(null)
  }

  const cancelEdit = () => {
    setMode('view')
    setError(null)
  }

  const submitEdit = async () => {
    if (!editBody.trim() || !jiraCommentId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/voc/comment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocId, viewToken, jiraCommentId, authorName: author, body: editBody.trim() }),
      })
      let data: Record<string, unknown> = {}
      try { data = await res.json() } catch {}
      if (!res.ok) {
        setError((data.error as string) ?? '수정에 실패했습니다.')
        return
      }
      setMode('view')
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!jiraCommentId || !window.confirm('댓글을 삭제할까요?')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/voc/comment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocId, viewToken, jiraCommentId }),
      })
      let data: Record<string, unknown> = {}
      try { data = await res.json() } catch {}
      if (!res.ok) {
        setError((data.error as string) ?? '삭제에 실패했습니다.')
        return
      }
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'edit') {
    return (
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
          [{author}]
        </div>
        <textarea
          className="textarea"
          value={editBody}
          onChange={e => setEditBody(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit() }
            if (e.key === 'Escape') cancelEdit()
          }}
          rows={2}
          disabled={loading}
          autoFocus
          style={{ resize: 'vertical', minHeight: 60, fontSize: 13 }}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={submitEdit} disabled={loading || !editBody.trim()}>
            {loading ? '저장 중…' : '저장'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={cancelEdit} disabled={loading}>취소</button>
        </div>
        {error && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--danger-600, #dc2626)' }}>{error}</p>}
      </div>
    )
  }

  return (
    <div className="comment-item-wrap">
      {jiraCommentId && editable && (
        <div className="comment-actions">
          <button onClick={startEdit} disabled={loading}>수정</button>
          <button onClick={handleDelete} disabled={loading}>삭제</button>
        </div>
      )}
      {children}
      {error && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--danger-600, #dc2626)' }}>{error}</p>}
    </div>
  )
}
