import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-server'
import { VOC_TYPE_LABEL, PRIORITY_LABEL, PRODUCT_LABEL } from '@/lib/mapping'
import Topbar from '@/components/Topbar'
import AttachmentList from '@/components/AttachmentList'

const BUCKET = 'voc-attachments'

/* ─── 타입 ─── */
interface Attachment { name: string; size: number; type: string; path: string }
interface CommentAttachment { name: string; url: string }
interface Comment    { jira_comment_id?: string; author: string; body: string; created_at: string; attachments?: CommentAttachment[] }
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

/* ─── JIRA 위키 마크업 렌더러 ─── */

/* accountId → 표시 이름 (알려진 담당자만) */
const KNOWN_ACCOUNTS: Record<string, string> = {
  '5a2e4b4df34f35510563ac4c':                    '정석범',
  '712020:eab47ad1-5185-4f87-ad6e-cf1d7744d516': '김정태',
}

/** 인라인: *볼드*, _이탤릭_, [^파일명], !이미지.png|...!, [~accountid:...] 멘션 */
function jiraInline(text: string, attachments?: CommentAttachment[], accountMap?: Map<string, string>) {
  const re = /(!([^!\s][^!|]*)(?:\|[^!]*)?!|\[\^([^\]]+)\]|\[~accountid:([^\]]+)\]|\[~([^\]]+)\]|\*([^*\n]+)\*|_([^_\n]+)_)/g
  const parts: React.ReactNode[] = []
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[0].startsWith('!') && m[2]) {
      /* !이미지.png|params! 임베드 */
      const filename = m[2].trim()
      const attached = attachments?.find(a => a.name === filename)
      const proxyUrl = attached ? `/api/jira/attachment?url=${encodeURIComponent(attached.url)}` : null
      parts.push(
        proxyUrl ? (
          <a key={m.index} href={proxyUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', margin: '4px 0' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proxyUrl} alt={filename}
              style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 6, display: 'block', border: '1px solid var(--surface-border)' }} />
          </a>
        ) : (
          <span key={m.index} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, color: 'var(--text-muted)',
            background: 'var(--gray-100)', borderRadius: 4, padding: '1px 6px',
          }}>🖼 {filename}</span>
        )
      )
    } else if (m[0].startsWith('[^')) {
      const filename = m[3]
      const attached = attachments?.find(a => a.name === filename)
      const proxyUrl = attached ? `/api/jira/attachment?url=${encodeURIComponent(attached.url)}` : null
      parts.push(
        proxyUrl ? (
          <a key={m.index} href={proxyUrl} download={filename} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, color: 'var(--brand-700)',
            background: 'var(--brand-50)', borderRadius: 4, padding: '1px 6px',
            textDecoration: 'none',
          }}>📎 {filename}</a>
        ) : (
          <span key={m.index} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, color: 'var(--text-muted)',
            background: 'var(--gray-100)', borderRadius: 4, padding: '1px 6px',
          }}>📎 {filename}</span>
        )
      )
    } else if (m[0].startsWith('[~accountid:') || m[0].startsWith('[~')) {
      const accountId  = m[4] ?? m[5] ?? ''
      const name = accountMap?.get(accountId) ?? KNOWN_ACCOUNTS[accountId] ?? '담당자'
      parts.push(
        <span key={m.index} style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)' }}>@{name}</span>
      )
    } else if (m[0].startsWith('*')) {
      parts.push(<strong key={m.index}>{m[6]}</strong>)
    } else {
      parts.push(<em key={m.index}>{m[7]}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

/** DB 저장 attachments + JIRA API 맵을 합쳐 최종 첨부파일 배열 반환 */
function resolveAttachments(
  body: string,
  stored: CommentAttachment[] | undefined,
  liveMap: Map<string, string>
): CommentAttachment[] {
  const fromBracket = [...body.matchAll(/\[\^([^\]]+)\]/g)].map(m => m[1])
  const fromEmbed   = [...body.matchAll(/!([^!\s][^!|]*)(?:\|[^!]*)?!/g)].map(m => m[1].trim())
  const refs = [...new Set([...fromBracket, ...fromEmbed])]
  return refs.map(name => {
    const url = liveMap.get(name) ?? stored?.find(a => a.name === name)?.url ?? ''
    return { name, url }
  }).filter(a => a.url)
}

/** 블록: 테이블(||헤더||, |데이터|) + 인라인 마크업 */
function renderJira(text: string, attachments?: CommentAttachment[], accountMap?: Map<string, string>) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let tableRows: { header: boolean; cells: string[] }[] = []

  const flushTable = (key: number) => {
    if (!tableRows.length) return
    const rows = tableRows; tableRows = []
    out.push(
      <div key={`tbl-${key}`} style={{ overflowX: 'auto', margin: '6px 0' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, width: 'max-content', maxWidth: '100%' }}>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.cells.map((cell, ci) => {
                  const Tag = r.header ? 'th' : 'td'
                  return (
                    <Tag key={ci} style={{
                      border: '1px solid var(--surface-border)',
                      padding: '5px 10px', textAlign: 'left',
                      fontWeight: r.header ? 700 : 400,
                      background: r.header ? 'var(--gray-50)' : 'transparent',
                    }}>
                      {jiraInline(cell.trim(), attachments, accountMap)}
                    </Tag>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  lines.forEach((line, li) => {
    if (line.startsWith('||')) {
      tableRows.push({ header: true, cells: line.replace(/^\|\|/, '').replace(/\|\|$/, '').split('||') })
    } else if (/^\|[^|]/.test(line) || line === '|') {
      tableRows.push({ header: false, cells: line.replace(/^\|/, '').replace(/\|$/, '').split('|') })
    } else {
      flushTable(li)
      if (line.trim() === '') {
        out.push(<br key={`br-${li}`} />)
      } else {
        out.push(<div key={`l-${li}`} style={{ lineHeight: 1.65 }}>{jiraInline(line, attachments, accountMap)}</div>)
      }
    }
  })
  flushTable(lines.length)
  return <>{out}</>
}

/* ─── 유틸 ─── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  })
}

function fmtDateKo(dateStr: string) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Seoul',
  })
}

/* ─── 섹션 헤더 ─── */
function SectionLabel({ children }: { children: string }) {
  return <div className="detail-section-label">{children}</div>
}

/* ─── 필드 행 ─── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="detail-field-label">{label}</span>
      <span className="detail-field-value">{children}</span>
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
  const comments = [...(row.comments ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const jiraHost = process.env.JIRA_HOST?.replace(/\/$/, '')

  const cred     = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64')
  const jiraHdrs = { Authorization: `Basic ${cred}`, Accept: 'application/json' }

  /* JIRA 첨부파일 맵 + 계정 이름 맵 — 병렬 조회 */
  const jiraAttachMap  = new Map<string, string>()
  const jiraAccountMap = new Map<string, string>()

  const hasAttachRef  = comments.some(c =>
    /\[\^[^\]]+\]/.test(c.body) || /![^!\s][^!|]*(?:\|[^!]*)?!/.test(c.body)
  )

  /* 멘션된 accountId 수집 (KNOWN_ACCOUNTS 제외) */
  const mentionIds = [...new Set(
    comments.flatMap(c => [
      ...[...c.body.matchAll(/\[~accountid:([^\]]+)\]/g)].map(m => m[1]),
      ...[...c.body.matchAll(/\[~([^\]]+)\]/g)].map(m => m[1]),
    ]).filter(id => id && !KNOWN_ACCOUNTS[id])
  )]

  if (jiraHost) {
    await Promise.all([
      /* 첨부파일 URL */
      hasAttachRef && row.jira_issue_key
        ? fetch(`${jiraHost}/rest/api/3/issue/${row.jira_issue_key}?fields=attachment`, { headers: jiraHdrs, cache: 'no-store' })
            .then(r => r.ok ? r.json() : null)
            .then((data: { fields?: { attachment?: { filename: string; content: string }[] } } | null) => {
              for (const a of data?.fields?.attachment ?? []) jiraAttachMap.set(a.filename, a.content)
            })
            .catch(e => console.error('[detail] jira attachment fetch', e))
        : Promise.resolve(),

      /* 계정 이름 */
      ...mentionIds.map(id =>
        fetch(`${jiraHost}/rest/api/3/user?accountId=${encodeURIComponent(id)}`, { headers: jiraHdrs, cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
          .then((u: { displayName?: string } | null) => { if (u?.displayName) jiraAccountMap.set(id, u.displayName) })
          .catch(e => console.error('[detail] jira user fetch', e))
      ),
    ])
  }

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
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                [{row.product}] {row.summary}
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                접수일: {fmtDate(row.created_at)}
              </p>
            </div>
            <div className="show-desktop" style={{ flexShrink: 0 }}>
              <Link href="/voc/new" className="btn btn-primary btn-sm">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                새 VOC 접수
              </Link>
            </div>
          </div>

          {/* ─── 워크플로우 Stepper ─── */}
          <WorkflowStepper status={row.current_status} />

          {/* ─── 접수 정보 ─── */}
          <div className="card detail-card" style={{ marginBottom: 16 }}>
            <SectionLabel>접수 정보</SectionLabel>
            <div className="detail-field-grid">
              <Field label="접수자">{row.requester_name}</Field>
              <Field label="부서">{row.requester_dept}</Field>
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
                    style={{ color: 'var(--brand-600)', fontFamily: 'var(--font-mono)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {row.jira_issue_key}
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-subtle)' }}>–</span>
                )}
              </Field>
            </div>
          </div>

          {/* ─── 요청 정보 ─── */}
          <div className="card detail-card" style={{ marginBottom: 16 }}>
            <SectionLabel>요청 정보</SectionLabel>
            <div className="detail-field-grid" style={{ marginBottom: 16 }}>
              <Field label="제품">{row.product}</Field>
              <Field label="VOC 유형">{VOC_TYPE_LABEL[row.voc_type] ?? row.voc_type}</Field>
              {row.customer && <Field label="요청 고객사">{row.customer}</Field>}
              <Field label="우선순위">{PRIORITY_LABEL[row.priority] ?? row.priority}</Field>
              {row.due_date && <Field label="요청 기한">{fmtDateKo(row.due_date)}</Field>}
            </div>
            <div className="detail-text-section" style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="요약">{row.summary}</Field>
              <Field label="목적/배경">
                <span style={{ whiteSpace: 'pre-wrap' }}>{row.purpose}</span>
              </Field>
              <Field label="화면 경로">
                <span style={{ whiteSpace: 'pre-wrap' }}>{row.screen_path}</span>
              </Field>
              <Field label="상세 내용">
                <span style={{ whiteSpace: 'pre-wrap' }}>{row.detail}</span>
              </Field>
            </div>
          </div>

          {/* ─── 참고 화면 ─── */}
          {signedAttachments.length > 0 && (
            <div className="card detail-card" style={{ marginBottom: 16 }}>
              <SectionLabel>첨부 파일</SectionLabel>
              <AttachmentList items={signedAttachments} />
            </div>
          )}

          {/* ─── 담당자 코멘트 ─── */}
          {comments.length > 0 && (
            <div className="card detail-card">
              {/* 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  <path d="M14 10a2 2 0 01-2 2H5l-3 3V4a2 2 0 012-2h8a2 2 0 012 2v6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                  담당자 코멘트 {comments.length}개
                </span>
              </div>

              {/* 댓글 목록 — 구분선만, 박스 없음 */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {comments.map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    paddingTop: i === 0 ? 0 : 16,
                    paddingBottom: 16,
                    borderBottom: i < comments.length - 1 ? '1px solid var(--surface-border)' : 'none',
                  }}>
                    {/* 아바타 */}
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: 'var(--brand-500)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, flexShrink: 0,
                    }}>
                      {(c.author ?? '?').slice(0, 1)}
                    </div>
                    {/* 내용 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>{c.author}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(c.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-default)' }}>{renderJira(c.body, resolveAttachments(c.body, c.attachments, jiraAttachMap), jiraAccountMap)}</div>
                    </div>
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
