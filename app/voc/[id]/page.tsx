import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-server'
import { VOC_TYPE_LABEL, PRIORITY_LABEL } from '@/lib/mapping'
import Topbar from '@/components/Topbar'

const BUCKET = 'voc-attachments'

/* ─── 타입 ─── */
interface Attachment { name: string; size: number; type: string; path: string }
interface Comment    { author: string; body: string; created_at: string }
interface VocRow {
  id:              number
  view_token:      string
  requester_dept:  string
  requester_name:  string
  requester_email: string | null
  product:         string
  voc_type:        string
  summary:         string
  customer:        string | null
  priority:        string
  purpose:         string
  screen_path:     string
  detail:          string
  due_date:        string | null
  attachments:     Attachment[]
  current_status:  string
  jira_issue_key:  string | null
  comments:        Comment[] | null
  created_at:      string
}

/* ─── 상태 표시 매핑 (JIRA 워크플로우 VOC 검토 이슈 타입 기준) ─── */
const STATUS: Record<string, { cls: string; label: string }> = {
  '접수':    { cls: 'status-received', label: '접수' },
  '처리 중': { cls: 'status-progress', label: '처리 중' },
  '완료':    { cls: 'status-done',     label: '완료' },
  '보류':    { cls: 'status-hold',     label: '보류' },
  '삭제':    { cls: 'status-deleted',  label: '삭제' },
}

/* ─── 워크플로우 stepper 단계 (JIRA 정상 흐름) ─── */
const WORKFLOW_STAGES = ['접수', '처리 중', '완료'] as const

/* ─── Stepper 컴포넌트 ─── */
function WorkflowStepper({ status }: { status: string }) {
  // 삭제: stepper 대체 뱃지
  if (status === '삭제') {
    return (
      <div className="card workflow-card" style={{ marginBottom: 16 }}>
        <span className="workflow-badge deleted">
          <span aria-hidden="true">✕</span> 삭제된 접수입니다
        </span>
      </div>
    )
  }

  const stageIdx = WORKFLOW_STAGES.indexOf(status as typeof WORKFLOW_STAGES[number])
  // 보류 또는 알 수 없는 상태: stageIdx = -1 → 모든 단계 inactive

  return (
    <div className="card workflow-card" style={{ marginBottom: 16 }}>
      {status === '보류' && (
        <div style={{ marginBottom: 12 }}>
          <span className="workflow-badge hold">
            <span aria-hidden="true">⏸</span> 보류 중
          </span>
        </div>
      )}
      <div className="stepper">
        {WORKFLOW_STAGES.map((stage, idx) => {
          let dotCls = 'inactive'
          let labelCls = 'inactive'
          if (stageIdx >= 0) {
            if (idx < stageIdx) { dotCls = 'done'; labelCls = 'done' }
            else if (idx === stageIdx) { dotCls = 'active'; labelCls = 'active' }
          }
          const dotContent = dotCls === 'done' ? '✓' : String(idx + 1)
          return (
            <span key={stage} style={{ display: 'flex', alignItems: 'center', flex: idx === WORKFLOW_STAGES.length - 1 ? '0 0 auto' : '1 1 0', minWidth: 0 }}>
              <span className="stepper-step">
                <span className={`stepper-dot ${dotCls}`}>{dotContent}</span>
                <span className={`stepper-label ${labelCls}`}>{stage}</span>
              </span>
              {idx < WORKFLOW_STAGES.length - 1 && (
                <span className={`stepper-line ${idx < stageIdx ? 'done' : ''}`} />
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ─── 유틸 ─── */
function fmtSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  })
}

/* ─── 섹션 헤더 ─── */
function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 12 }}>
      {children}
    </div>
  )
}

/* ─── 필드 행 ─── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--text-strong)', lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}

/* ─── 페이지 ─── */
interface Props {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function VocViewPage({ params, searchParams }: Props) {
  const { id }    = await params
  const { token } = await searchParams
  const numId     = Number(id)

  if (!token || isNaN(numId)) notFound()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('voc_submission')
    .select('*')
    .eq('id', numId)
    .single()

  if (error || !data) notFound()

  const row = data as VocRow
  if (row.view_token !== token) notFound()

  /* 참고 화면 서명 URL 생성 */
  const signedAttachments = await Promise.all(
    (row.attachments ?? []).map(async (a) => {
      const { data: url } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(a.path, 3600)
      return { ...a, signedUrl: url?.signedUrl ?? null }
    })
  )

  const status   = STATUS[row.current_status] ?? { cls: 'status-received', label: row.current_status }
  const comments = row.comments ?? []
  const jiraHost = process.env.JIRA_HOST?.replace(/\/$/, '')

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Topbar ─── */}
      <Topbar />

      {/* ─── 본문 ─── */}
      <main className="flex-1 voc-page-main">
        <div className="page-container-wide voc-page-container" style={{ width: '100%', maxWidth: 880 }}>

          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                {row.summary}
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                접수일: {fmtDate(row.created_at)}
              </p>
            </div>
            <Link href="/voc/new" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              새 VOC 접수
            </Link>
          </div>

          {/* ─── 워크플로우 Stepper ─── */}
          <WorkflowStepper status={row.current_status} />

          {/* ─── 접수 정보 ─── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <SectionLabel>접수 정보</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16 }}>
              <Field label="부서">{row.requester_dept}</Field>
              <Field label="접수자">{row.requester_name}</Field>
              <Field label="상태">
                <span className={`status ${status.cls}`}>
                  <span className="dot" />
                  {status.label}
                </span>
              </Field>
              <Field label="JIRA">
                {row.jira_issue_key && jiraHost ? (
                  <a
                    href={`${jiraHost}/browse/${row.jira_issue_key}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 13, color: 'var(--brand-600)', fontFamily: 'var(--font-mono)',
                      textDecoration: 'none',
                      background: 'var(--brand-50)', border: '1px solid var(--brand-100)',
                      borderRadius: 6, padding: '4px 10px',
                      width: 'fit-content',
                    }}
                  >
                    {row.jira_issue_key}
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M3.5 8.5L8.5 3.5M8.5 3.5H5M8.5 3.5V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-subtle)' }}>–</span>
                )}
              </Field>
            </div>
          </div>

          {/* ─── 요청 정보 ─── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <SectionLabel>요청 정보</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16, marginBottom: 16 }}>
              <Field label="제품">{row.product}</Field>
              <Field label="VOC 유형">{VOC_TYPE_LABEL[row.voc_type] ?? row.voc_type}</Field>
              {row.customer && <Field label="요청 고객사">{row.customer}</Field>}
              <Field label="우선순위">{PRIORITY_LABEL[row.priority] ?? row.priority}</Field>
              {row.due_date && <Field label="요청 기한">{row.due_date}</Field>}
            </div>
            <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="요약">{row.summary}</Field>
              <Field label="목적/배경">
                <span style={{ whiteSpace: 'pre-wrap' }}>{row.purpose}</span>
              </Field>
              <Field label="화면 경로">
                {(() => {
                  const paths = row.screen_path.split('\n').map(p => p.trim()).filter(Boolean)
                  if (paths.length <= 1) return <span>{row.screen_path}</span>
                  return (
                    <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'disc' }}>
                      {paths.map((path, i) => (
                        <li key={i} style={{ lineHeight: 1.6, marginTop: i === 0 ? 0 : 4 }}>{path}</li>
                      ))}
                    </ul>
                  )
                })()}
              </Field>
              <Field label="상세 내용">
                <span style={{ whiteSpace: 'pre-wrap' }}>{row.detail}</span>
              </Field>
            </div>
          </div>

          {/* ─── 참고 화면 ─── */}
          {signedAttachments.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <SectionLabel>참고 화면</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {signedAttachments.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-canvas)', border: '1px solid var(--surface-border)', borderRadius: 'var(--r-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      <span style={{ fontSize: 13, color: 'var(--text-strong)' }}>{a.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtSize(a.size)}</span>
                    </div>
                    {a.signedUrl && (
                      <a href={a.signedUrl} download={a.name} className="btn btn-sm btn-secondary" style={{ flexShrink: 0 }}>
                        다운로드
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── 처리 이력 / 댓글 ─── */}
          {comments.length > 0 && (
            <div className="card">
              <SectionLabel>담당자 코멘트</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {comments.map((c, i) => (
                  <div key={i} style={{ padding: '12px 14px', background: 'var(--surface-canvas)', border: '1px solid var(--surface-border)', borderLeft: '3px solid var(--brand-400)', borderRadius: 'var(--r-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-700)' }}>{c.author}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(c.created_at)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-strong)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
