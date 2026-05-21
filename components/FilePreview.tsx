'use client'

import { useEffect, useState } from 'react'
import { FileExtBadge } from '@/lib/file-icon'

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

interface Props {
  file:     File
  onRemove: () => void
}

/**
 * 접수 폼 단계의 첨부파일 미리보기 카드.
 * 이미지 파일은 blob URL로 인라인 썸네일을, 그 외에는 기본 파일 아이콘을 표시한다.
 * objectURL은 unmount 시 revoke.
 */
export default function FilePreview({ file, onRemove }: Props) {
  const isImage = file.type.startsWith('image/')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  /* effect 안에서 url을 생성하고 동일 url을 cleanup에서 revoke.
   * React Strict Mode가 effect를 두 번 실행해도 cleanup → 재생성 흐름으로 안전. */
  useEffect(() => {
    if (!isImage) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file, isImage])

  return (
    <div style={{
      width: 140,
      border: '1px solid var(--surface-border)',
      borderRadius: 'var(--r-md)',
      background: 'var(--surface-card)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      {/* 썸네일 영역 */}
      <div style={{
        width: '100%',
        height: 100,
        background: 'var(--gray-100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        {previewUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt={file.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <FileExtBadge name={file.name} />
        )}
      </div>

      {/* 메타 정보 */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {fmtSize(file.size)}
        </span>
      </div>

      {/* 제거 버튼 — 우상단 오버레이 */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onRemove() }}
        aria-label={`${file.name} 제거`}
        style={{
          position: 'absolute',
          top: 6, right: 6,
          width: 22, height: 22,
          borderRadius: '50%',
          background: 'rgba(0, 0, 0, 0.55)',
          color: '#fff',
          border: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
