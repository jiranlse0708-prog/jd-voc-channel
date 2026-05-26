export const PRODUCTS = [
  { value: 'SERVERFILTER', label: 'SERVERFILTER' },
  { value: 'IDFILTER',     label: 'IDFILTER' },
] as const

export const VOC_TYPES = [
  { value: 'inquiry', label: '단순문의', desc: '사용 방법·정책 등 답변만 필요한 문의' },
  { value: 'improve', label: '개선',    desc: '기존 기능 보완·UX 개선 제안' },
  { value: 'defect',  label: '결함',    desc: '정상 동작하지 않는 버그·오류' },
  { value: 'new',     label: '신규',    desc: '새로운 기능·서비스 요청' },
] as const

export const PRIORITIES = [
  { value: 'highest', label: '최상', desc: '당장 진행이 필요한 급 건' },
  { value: 'high',    label: '상',   desc: '고객과 약속된 기한이 있는 건' },
  { value: 'medium',  label: '중',   desc: '정해진 기한이 없는 일반 건' },
  { value: 'low',     label: '하',   desc: '처리되면 좋지만 당장 급하지는 않은 건' },
] as const
