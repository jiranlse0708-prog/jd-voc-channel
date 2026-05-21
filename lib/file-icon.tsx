/**
 * 파일 확장자별 색상 박스 아이콘.
 * PDF=빨강, Word=파랑, Excel=초록, PPT=주황, HWP=짙은파랑, TXT=회색.
 * 미등록 확장자는 회색 + 그대로 표시 (최대 4글자).
 */

const FILE_EXT_COLOR: Record<string, string> = {
  pdf:  '#dc2626',
  doc:  '#2563eb', docx: '#2563eb',
  xls:  '#16a34a', xlsx: '#16a34a',
  ppt:  '#ea580c', pptx: '#ea580c',
  hwp:  '#1e40af',
  txt:  '#6b7280',
  zip:  '#7c3aed', rar: '#7c3aed', '7z': '#7c3aed',
}

export function getFileExt(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? (parts.pop()?.toLowerCase() ?? '') : ''
}

interface Props {
  name: string
  size?: 'md' | 'sm'
}

export function FileExtBadge({ name, size = 'md' }: Props) {
  const ext   = getFileExt(name)
  const color = FILE_EXT_COLOR[ext] ?? '#9ca3af'
  const label = ext.toUpperCase().slice(0, 4) || 'FILE'

  const dim = size === 'md'
    ? { w: 56, h: 68, fontSize: 13 }
    : { w: 40, h: 48, fontSize: 11 }

  return (
    <div style={{
      width: dim.w,
      height: dim.h,
      background: color,
      borderRadius: 6,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: 700,
      fontSize: dim.fontSize,
      fontFamily: 'var(--font-mono)',
      letterSpacing: '-0.02em',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {label}
    </div>
  )
}
