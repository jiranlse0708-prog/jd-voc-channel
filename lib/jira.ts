/**
 * JIRA REST API v3 클라이언트
 * - 이슈 생성 (ADF description)
 * - 첨부파일 업로드
 * - 재시도 (최대 3회, 지수 백오프)
 */

import { PRODUCT_ASSIGNEE_ID, PRODUCT_ASSIGNEE_NAME, VOC_TYPE_LABEL, PRIORITY_LABEL } from './mapping'

/* ─── 환경 변수 ─── */
const HOST      = process.env.JIRA_HOST        // https://xxx.atlassian.net
const EMAIL     = process.env.JIRA_EMAIL
const TOKEN     = process.env.JIRA_API_TOKEN
const PROJECT   = process.env.JIRA_PROJECT_KEY

function authHeader() {
  const cred = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')
  return `Basic ${cred}`
}

function apiUrl(path: string) {
  return `${HOST?.replace(/\/$/, '')}/rest/api/3${path}`
}

/* ─── ADF 헬퍼 ─── */
type AdfNode =
  | { type: 'doc'; version: 1; content: AdfNode[] }
  | { type: 'heading'; attrs: { level: number }; content: AdfNode[] }
  | { type: 'paragraph'; content: AdfNode[] }
  | { type: 'text'; text: string; marks?: { type: string }[] }
  | { type: 'rule' }
  | { type: 'bulletList'; content: AdfNode[] }
  | { type: 'listItem'; content: AdfNode[] }

function heading(level: number, text: string): AdfNode {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

function para(...texts: string[]): AdfNode {
  return {
    type: 'paragraph',
    content: texts.map(t => ({ type: 'text' as const, text: t })),
  }
}

function labeledPara(label: string, value: string): AdfNode {
  return {
    type: 'paragraph',
    content: [
      { type: 'text', text: `${label}  `, marks: [{ type: 'strong' }] },
      { type: 'text', text: value },
    ],
  }
}

function rule(): AdfNode {
  return { type: 'rule' }
}

export interface JiraIssueParams {
  dept:       string
  name:       string
  email:      string
  product:    string
  vocType:    string
  summary:    string
  customer:   string
  priority:   string
  purpose:    string
  screenPath: string
  detail:     string
  dueDate:    string | null
}


/** JIRA description ADF 생성 */
export function buildAdfDescription(p: JiraIssueParams): AdfNode {
  const vocTypeLabel  = VOC_TYPE_LABEL[p.vocType]  ?? p.vocType
  const priorityLabel = PRIORITY_LABEL[p.priority] ?? p.priority

  const nodes: AdfNode[] = [
    heading(1, '접수 정보'),
    heading(2, '부서명'),
    para(p.dept),
    heading(2, '접수자'),
    para(p.name),
    heading(2, '이메일'),
    para(p.email),
    rule(),

    heading(1, '요구사항 구분'),
    heading(2, 'VOC 유형'),
    para(vocTypeLabel),
    heading(2, '담당 제품'),
    para(p.product),
    heading(2, '고객사'),
    para(p.customer || '-'),
    heading(2, '우선순위'),
    para(priorityLabel),
    rule(),

    heading(1, '요청 내용'),
    heading(2, '화면 경로'),
    para(p.screenPath),
    heading(2, '목적/배경'),
    para(p.purpose),
    heading(2, '상세 내용'),
    para(p.detail),
    heading(2, '요청 기한'),
    para(p.dueDate || '-'),
  ]

  return { type: 'doc', version: 1, content: nodes }
}

/* ─── 에러 타입 ─── */

/** 인증 실패(401): 재시도해도 의미 없음 — 토큰 만료/무효 */
export class JiraAuthError extends Error {
  constructor(body: string) {
    super(`JIRA 인증 실패 (401): ${body}`)
    this.name = 'JiraAuthError'
  }
}

/* ─── 재시도 유틸 ─── */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      // 인증 오류는 재시도해도 소용없으므로 즉시 중단
      if (err instanceof JiraAuthError) throw err
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 500 * 2 ** (attempt - 1)))
      }
    }
  }
  throw lastErr
}

/* ─── JIRA 이슈 생성 ─── */
export interface CreateJiraResult {
  key: string
  id:  string
}

export async function createJiraIssue(
  params: JiraIssueParams,
): Promise<CreateJiraResult> {
  if (!HOST || !EMAIL || !TOKEN || !PROJECT) {
    throw new Error('JIRA 환경 변수가 설정되지 않았습니다.')
  }

  const assigneeId = PRODUCT_ASSIGNEE_ID[params.product]
  const description = buildAdfDescription(params)

  const body: Record<string, unknown> = {
    fields: {
      project:            { key: PROJECT },
      summary:            `[VOC] [${params.product}] ${params.summary}`,
      issuetype:          { name: 'VOC 검토' },
      description,
      priority:           { name: PRIORITY_LABEL[params.priority] ?? params.priority },
      customfield_10110:  { value: VOC_TYPE_LABEL[params.vocType] ?? params.vocType }, // VOC 유형
      customfield_10228:  { value: params.product },                                   // 제품
      ...(params.customer ? { customfield_10039: [params.customer] } : {}),             // 고객사 (Labels)
      ...(assigneeId ? { assignee:  { accountId: assigneeId } } : {}),
      ...(assigneeId ? { reporter:  { accountId: assigneeId } } : {}),
      ...(params.dueDate ? { duedate: params.dueDate } : {}),
    },
  }

  return withRetry(async () => {
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 15000)
    let res: Response
    try {
      res = await fetch(apiUrl('/issue'), {
        method:  'POST',
        headers: {
          Authorization:  authHeader(),
          'Content-Type': 'application/json',
          Accept:         'application/json',
        },
        body:   JSON.stringify(body),
        signal: ctrl.signal,
      })
    } finally {
      clearTimeout(tid)
    }

    if (!res.ok) {
      const text = await res.text()
      if (res.status === 401) throw new JiraAuthError(text)
      throw new Error(`JIRA 이슈 생성 실패 (${res.status}): ${text}`)
    }

    const json = await res.json() as { key: string; id: string }
    return { key: json.key, id: json.id }
  })
}


/* ─── JIRA 첨부파일 업로드 ─── */
export async function addJiraAttachment(
  issueKey: string,
  fileName: string,
  buffer:   Buffer,
  mimeType: string,
): Promise<void> {
  if (!HOST || !EMAIL || !TOKEN) {
    throw new Error('JIRA 환경 변수가 설정되지 않았습니다.')
  }

  await withRetry(async () => {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName)

    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 15000)
    let res: Response
    try {
      res = await fetch(apiUrl(`/issue/${issueKey}/attachments`), {
        method:  'POST',
        headers: {
          Authorization:         authHeader(),
          'X-Atlassian-Token':   'no-check',
          Accept:                'application/json',
        },
        body:   form,
        signal: ctrl.signal,
      })
    } finally {
      clearTimeout(tid)
    }

    if (!res.ok) {
      const text = await res.text()
      if (res.status === 401) throw new JiraAuthError(text)
      throw new Error(`JIRA 첨부파일 업로드 실패 (${res.status}): ${text}`)
    }
  })
}
