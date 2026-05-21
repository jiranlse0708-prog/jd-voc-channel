'use client'

import { useState, useEffect } from 'react'

interface SignedAttachment {
  name:      string
  size:      number
  type:      string
  path:      string
  signedUrl: string | null
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export default function AttachmentList({ items }: { items: SignedAttachment[] }) {
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null)

  /* ESC 닫기 + 스크롤 잠금 */
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [lightbox])

  const images    = items.filter(a => a.type.startsWith('image/'))
  const nonImages = items.filter(a => !a.type.startsWith('image/'))

  return (
    <>
      {/* 이미지 — 220px 카드 그리드 */}
      {images.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: nonImages.length > 0 ? 12 : 0,
        }}>
          {images.map((a, i) => (
            <div key={`img-${i}`} style={{
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--r-md)',
              background: 'var(--surface-card)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <button
                type="button"
                onClick={() => a.signedUrl && setLightbox({ url: a.signedUrl, alt: a.name })}
                aria-label={`${a.name} 크게 보기`}
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  background: 'var(--gray-100)',
                  border: 0,
                  padding: 0,
                  cursor: a.signedUrl ? 'zoom-in' : 'default',
                  display: 'block',
                }}
              >
                {a.signedUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={a.signedUrl}
                    alt={a.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}
              </button>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {a.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {fmtSize(a.size)}
                  </span>
                </div>
                {a.signedUrl && (
                  <a
                    href={a.signedUrl}
                    download={a.name}
                    className="btn btn-sm btn-secondary"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    다운로드
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 비이미지 — 가로 행 형태 유지 */}
      {nonImages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nonImages.map((a, i) => (
            <div key={`file-${i}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              padding: '10px 12px',
              background: 'var(--surface-canvas)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--r-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 13, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtSize(a.size)}</span>
              </div>
              {a.signedUrl && (
                <a href={a.signedUrl} download={a.name} className="btn btn-sm btn-secondary" style={{ flexShrink: 0 }}>
                  다운로드
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox 모달 */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`이미지 크게 보기: ${lightbox.alt}`}
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
            cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.alt}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              cursor: 'default',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="닫기"
            style={{
              position: 'absolute',
              top: 16, right: 16,
              width: 40, height: 40,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 0,
              color: '#fff',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
