import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}
const FROM = () => process.env.EMAIL_FROM ?? '서버솔루션팀 VOC 채널 <onboarding@resend.dev>'
const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

function skipEmail(to: string, subject: string) {
  if (process.env.SKIP_EMAIL !== 'true') return false
  console.log(`[mail] SKIP_EMAIL=true → subject: "${subject}" (to: ${to})`)
  return true
}

/* ─── 공통 HTML 래퍼 ─── */
function wrap(title: string, body: string) {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
  <tr><td style="background:#F78121;padding:20px 28px;">
    <span style="color:#fff;font-size:18px;font-weight:700;">서버솔루션팀 VOC 채널</span>
  </td></tr>
  <tr><td style="padding:28px;">${body}</td></tr>
  <tr><td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#6b7280;">이 메일은 자동 발송됩니다. 회신하지 마세요.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function btn(url: string, text: string) {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:11px 22px;background:#F78121;color:#fff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">${text}</a>`
}

function infoRow(label: string, value: string) {
  return `<tr>
    <td style="padding:7px 0;font-size:13px;color:#6b7280;white-space:nowrap;width:90px;">${label}</td>
    <td style="padding:7px 0;font-size:13px;color:#111827;font-weight:500;">${value}</td>
  </tr>`
}

/* ─── 1. 접수 확인 ─── */
export async function sendSubmissionConfirm(params: {
  to:      string
  vocId:   number
  token:   string
  summary: string
  product: string
  vocType: string
}) {
  const subject = `[VOC 접수] #${params.vocId} ${params.summary}`
  if (skipEmail(params.to, subject)) return
  const viewUrl = `${SITE()}/voc/${params.vocId}?token=${params.token}`
  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">VOC가 접수됐습니다</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">제품팀이 검토 후 피드백을 드리겠습니다.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;">
      ${infoRow('접수 번호', `#${params.vocId}`)}
      ${infoRow('제품',     params.product)}
      ${infoRow('유형',     params.vocType)}
      ${infoRow('요약',     params.summary)}
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">아래 링크를 저장해두시면 언제든지 접수 상태를 확인할 수 있습니다.</p>
    ${btn(viewUrl, '접수 내용 조회하기')}
  `
  return getResend().emails.send({ from: FROM(), to: params.to, subject, html: wrap('VOC 접수 확인', body) })
}

/* ─── 2. 상태 변경 알림 ─── */
export async function sendStatusChanged(params: {
  to:        string
  vocId:     number
  token:     string
  summary:   string
  oldStatus: string
  newStatus: string
  changedBy: string
}) {
  const subject = `[VOC 상태 변경] #${params.vocId} → ${params.newStatus}`
  if (skipEmail(params.to, subject)) return
  const viewUrl = `${SITE()}/voc/${params.vocId}?token=${params.token}`
  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">VOC 처리 상태가 변경됐습니다</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">#${params.vocId} ${params.summary}</p>
    <div style="display:flex;align-items:center;gap:12px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <span style="font-size:14px;color:#6b7280;">${params.oldStatus}</span>
      <span style="font-size:14px;color:#9ca3af;">→</span>
      <span style="font-size:14px;font-weight:700;color:#F78121;">${params.newStatus}</span>
    </div>
    <p style="margin:12px 0 0;font-size:13px;color:#6b7280;">담당자: ${params.changedBy}</p>
    ${btn(viewUrl, '상세 내용 확인하기')}
  `
  return getResend().emails.send({ from: FROM(), to: params.to, subject, html: wrap('VOC 상태 변경 알림', body) })
}

/* ─── 3. 댓글 알림 ─── */
export async function sendCommentAdded(params: {
  to:          string
  vocId:       number
  token:       string
  summary:     string
  author:      string
  commentText: string
}) {
  const subject = `[VOC 댓글] #${params.vocId} ${params.summary}`
  if (skipEmail(params.to, subject)) return
  const viewUrl = `${SITE()}/voc/${params.vocId}?token=${params.token}`
  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">담당자가 댓글을 남겼습니다</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">#${params.vocId} ${params.summary}</p>
    <div style="padding:16px;background:#f9fafb;border-radius:8px;border-left:3px solid #F78121;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#F78121;">${params.author}</p>
      <p style="margin:0;font-size:14px;color:#111827;line-height:1.6;white-space:pre-wrap;">${params.commentText}</p>
    </div>
    ${btn(viewUrl, '전체 내용 확인하기')}
  `
  return getResend().emails.send({ from: FROM(), to: params.to, subject, html: wrap('VOC 댓글 알림', body) })
}

/* ─── 4. 조회 링크 재발송 ─── */
export async function sendVocLookupLinks(params: {
  to:    string
  items: { id: number; token: string; summary: string; status: string; createdAt: string }[]
}) {
  const subject = `[VOC] 접수 조회 링크 (${params.items.length}건)`
  if (skipEmail(params.to, subject)) return
  const rows = params.items.map(it => {
    const url = `${SITE()}/voc/${it.id}?token=${it.token}`
    const date = new Date(it.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' })
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">
        <a href="${url}" style="color:#F78121;text-decoration:none;font-weight:600;">#${it.id} ${it.summary}</a>
        <div style="margin-top:4px;font-size:12px;color:#6b7280;">${date} · ${it.status}</div>
      </td>
    </tr>`
  }).join('')
  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">접수하신 VOC 조회 링크입니다</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">총 ${params.items.length}건의 접수 내역을 확인하실 수 있습니다.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;">${rows}</table>
    <p style="margin:20px 0 0;font-size:12px;color:#6b7280;">본인 외 타인에게 링크가 공유되지 않도록 주의해 주세요.</p>
  `
  return getResend().emails.send({ from: FROM(), to: params.to, subject, html: wrap('VOC 조회 링크', body) })
}
