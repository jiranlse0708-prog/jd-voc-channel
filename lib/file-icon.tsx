/**
 * 파일 확장자별 SVG 아이콘 (흰 종이 + 우상단 접힘 + 하단 색상 라벨).
 * PDF=빨강, Word=파랑, Excel=초록, PPT=주황, HWP=짙은파랑, TXT=회색, ZIP=보라.
 * 라벨은 3글자로 통일하여 가독성 확보.
 * 미등록 확장자는 회색 + 그대로 표시.
 */

interface ExtInfo { color: string; label: string }

const FILE_EXT_INFO: Record<string, ExtInfo> = {
  pdf:  { color: '#dc2626', label: 'PDF' },
  doc:  { color: '#2563eb', label: 'DOC' },
  docx: { color: '#2563eb', label: 'DOC' },
  xls:  { color: '#16a34a', label: 'XLS' },
  xlsx: { color: '#16a34a', label: 'XLS' },
  ppt:  { color: '#ea580c', label: 'PPT' },
  pptx: { color: '#ea580c', label: 'PPT' },
  hwp:  { color: '#1e40af', label: 'HWP' },
  txt:  { color: '#6b7280', label: 'TXT' },
  zip:  { color: '#7c3aed', label: 'ZIP' },
  rar:  { color: '#7c3aed', label: 'RAR' },
  '7z': { color: '#7c3aed', label: '7Z'  },
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
  const info  = FILE_EXT_INFO[ext] ?? { color: '#9ca3af', label: (ext || 'FILE').toUpperCase().slice(0, 4) }
  const label = info.label

  const w = size === 'md' ? 52 : 36
  const h = size === 'md' ? 64 : 46

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 44 56"
      fill="none"
      style={{ flexShrink: 0 }}
      aria-label={`${label} 파일`}
    >
      {/* 종이 본체 */}
      <path
        d="M5 1h25l9 9v44a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
        fill="#ffffff"
        stroke="#d1d5db"
        strokeWidth="1.4"
      />
      {/* 우상단 접힘선 */}
      <path
        d="M30 1v8a1 1 0 0 0 1 1h8"
        fill="none"
        stroke="#d1d5db"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* 하단 색상 라벨 박스 */}
      <rect x="4" y="34" width="35" height="14" rx="2" fill={info.color} />
      {/* 라벨 텍스트 */}
      <text
        x="21.5"
        y="44"
        textAnchor="middle"
        fontSize={label.length >= 4 ? 8 : 10}
        fontWeight="800"
        fill="#ffffff"
        fontFamily="ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
        letterSpacing="-0.02em"
      >
        {label}
      </text>
    </svg>
  )
}
