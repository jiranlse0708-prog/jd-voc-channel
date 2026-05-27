'use client'

import { useState, useRef, useEffect } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import AttachmentList from '@/components/AttachmentList'
import FilePreview from '@/components/FilePreview'
import { FileExtBadge } from '@/lib/file-icon'

interface AttachmentMeta { name: string; size: number; type: string; path: string }
interface SignedAttachment extends AttachmentMeta { signedUrl: string | null }

const ACCEPT = 'image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.hwp,.txt'
const MAX_FILE = 50 * 1024 * 1024
const MAX_TOTAL = 200 * 1024 * 1024
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'])

function isImage(a: { name: string; type: string }) {
  if (a.type.startsWith('image/')) return true
  const ext = a.name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTS.has(ext)
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

interface Props {
  vocId:             number
  viewToken:         string
  currentStatus:     string
  attachments:       AttachmentMeta[]
  signedAttachments: SignedAttachment[]
}

export default function AttachmentEditCard({ vocId, viewToken, currentStatus, attachments, signedAttachments }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [keptAttachments, setKeptAttachments] = useState<AttachmentMeta[]>(attachments)
  const [newFiles, setNewFiles]               = useState<File[]>([])
  const [isDragging, setIsDragging]           = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const router  = useRouter()
  const canEdit = currentStatus !== '완료' && currentStatus !== '삭제'

  const signedMap = new Map(signedAttachments.map(a => [a.path, a.signedUrl]))

  const totalSize = keptAttachments.reduce((s, a) => s + a.size, 0) + newFiles.reduce((s, f) => s + f.size, 0)

  const startEdit = () => {
    setKeptAttachments([...attachments])
    setNewFiles([])
    setError(null)
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setNewFiles([])
    setError(null)
  }

  const addFiles = (incoming: File[]) => {
    const oversize = incoming.filter(f => f.size > MAX_FILE)
    const valid    = incoming.filter(f => f.size <= MAX_FILE)
    if (oversize.length) setError(`파일당 최대 50MB입니다. 제외됨: ${oversize.map(f => f.name).join(', ')}`)

    setNewFiles(prev => {
      const combined = [...prev, ...valid]
      const tot = keptAttachments.reduce((s, a) => s + a.size, 0) + combined.reduce((s, f) => s + f.size, 0)
      if (tot > MAX_TOTAL) { setError(`총 첨부 용량이 200MB를 초과합니다. (${fmtSize(tot)})`); return prev }
      if (oversize.length === 0) setError(null)
      return combined
    })
  }

  const onDragOver  = (e: DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = () => setIsDragging(false)
  const onDrop      = (e: DragEvent) => { e.preventDefault(); setIsDragging(false); addFiles(Array.from(e.dataTransfer.files)) }
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }

  useEffect(() => {
    if (!editing) return
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const pasted: File[] = []
      for (const item of Array.from(items)) {
        if (item.kind === 'file') { const f = item.getAsFile(); if (f) pasted.push(f) }
      }
      if (pasted.length) addFiles(pasted)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, keptAttachments])

  const save = async () => {
    setSaving(true)
    setError(null)

    try {
      interface UploadEntry { name: string; size: number; type: string; path: string }
      const uploaded: UploadEntry[] = []

      if (newFiles.length > 0) {
        const prepRes = await fetch('/api/voc/prepare-uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: newFiles.map(f => ({ name: f.name, size: f.size, type: f.type })) }),
        })
        if (!prepRes.ok) throw new Error('파일 업로드 준비에 실패했습니다.')
        const { uploads } = await prepRes.json() as {
          uploads: { name: string; size: number; type: string; path: string; signedUrl: string }[]
        }

        await Promise.all(uploads.map(async (u) => {
          const file = newFiles.find(f => f.name === u.name)
          if (!file) return
          const putRes = await fetch(u.signedUrl, {
            method: 'PUT', body: file,
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
          })
          if (putRes.ok) uploaded.push({ name: u.name, size: u.size, type: u.type, path: u.path })
        }))
      }

      const finalAttachments = [...keptAttachments, ...uploaded]
      const removedPaths = attachments
        .filter(a => !keptAttachments.some(k => k.path === a.path))
        .map(a => a.path)

      const res = await fetch('/api/voc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocId, viewToken, attachments: finalAttachments, removedPaths }),
      })

      let data: Record<string, unknown> = {}
      try { data = await res.json() } catch {}

      if (!res.ok) {
        setError((data.error as string) ?? '첨부파일 수정에 실패했습니다.')
        return
      }

      setEditing(false)
      setNewFiles([])
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const hasAny = signedAttachments.length > 0

  /* ── 읽기 모드 ── */
  if (!editing) {
    return (
      <div className="card detail-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasAny ? 12 : 0 }}>
          <span className="detail-section-label" style={{ margin: 0 }}>첨부 파일</span>
          {canEdit && (
            <button className="btn btn-ghost" onClick={startEdit} style={{ fontSize: 11, padding: '2px 6px', gap: 3, minHeight: 0 }}>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
              수정
            </button>
          )}
        </div>
        {hasAny ? (
          <AttachmentList items={signedAttachments} />
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>첨부된 파일이 없습니다.</p>
        )}
      </div>
    )
  }

  /* ── 편집 모드 ── */
  return (
    <div className="card detail-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="detail-section-label" style={{ margin: 0 }}>첨부 파일 수정</span>
      </div>

      {/* 기존 첨부파일 */}
      {keptAttachments.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 140px)', gap: 10, marginBottom: 10 }}>
            {keptAttachments.map((a, i) => {
              const url = signedMap.get(a.path) ?? null
              return (
                <div key={`kept-${i}`} style={{
                  width: 140, border: '1px solid var(--surface-border)',
                  borderRadius: 'var(--r-md)', background: 'var(--surface-card)',
                  overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative',
                }}>
                  <div style={{
                    width: '100%', height: 100, background: 'var(--gray-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isImage(a) && url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={url} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <FileExtBadge name={a.name} />
                    )}
                  </div>
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtSize(a.size)}</span>
                  </div>
                  <button type="button"
                    onClick={() => setKeptAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    aria-label={`${a.name} 제거`}
                    style={{
                      position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.55)', color: '#fff', border: 0, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* 새 파일 미리보기 */}
      {newFiles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 140px)', gap: 10, marginBottom: 10 }}>
          {newFiles.map((f, i) => (
            <FilePreview key={`new-${i}-${f.name}`} file={f}
              onRemove={() => setNewFiles(prev => prev.filter((_, idx) => idx !== i))} />
          ))}
        </div>
      )}

      {/* 총 용량 표시 */}
      {(keptAttachments.length + newFiles.length) > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-subtle)', margin: '0 0 10px' }}>
          총 {keptAttachments.length + newFiles.length}개 · {fmtSize(totalSize)} / 200MB
        </p>
      )}

      {/* 드롭존 — 접수 페이지와 동일 */}
      <div
        className={`dropzone${isDragging ? ' active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: isDragging ? 'var(--brand-500)' : 'var(--brand-400)', transition: 'color 0.12s' }}>
          <path d="M12 15V9m0 0l-2.5 2.5M12 9l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6.5 19a4.5 4.5 0 01-.9-8.9 5.5 5.5 0 0110.8 0A3.5 3.5 0 1117.5 19H6.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-strong)' }}>
          {(keptAttachments.length + newFiles.length) > 0
            ? <>파일 더 추가하기 또는 <span style={{ color: 'var(--brand-600)', fontWeight: 600 }}>클릭하여 선택</span></>
            : <>파일 끌어놓기 또는 <span style={{ color: 'var(--brand-600)', fontWeight: 600 }}>클릭하여 선택</span></>
          }
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          이미지 · PDF · 문서 · 파일당 최대 50MB
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple accept={ACCEPT}
        onChange={onFileChange} style={{ display: 'none' }} />

      {/* 에러 */}
      {error && (
        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--danger-600, #dc2626)' }}>{error}</p>
      )}

      {/* 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={saving}>취소</button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}
