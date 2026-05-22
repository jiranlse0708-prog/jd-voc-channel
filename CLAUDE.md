# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Important:** This is Next.js 16 with Turbopack — APIs and conventions differ from earlier versions. Read `node_modules/next/dist/docs/` before writing routing or config code.

## Commands

```bash
npm run dev      # 개발 서버 (Turbopack, port 3000)
npm run build    # 프로덕션 빌드 + TypeScript 검사
npm run lint     # ESLint
```

수정 완료 후 커밋·푸시는 자동으로 실행한다 (사용자 확인 불필요).

## Architecture

### 기술 스택
- **Next.js 16** App Router + Turbopack, TypeScript, Tailwind v4 (CSS-first, `globals.css`에 토큰 정의)
- **Supabase** — DB(`voc_submission` 테이블) + Storage(`voc-attachments` 버킷)
- **JIRA REST API v3** — 이슈 생성, 첨부파일 업로드, ADF description
- **Nodemailer (Gmail SMTP)** — 이메일 발송 (OTP, 접수 확인, 상태 변경 알림, 댓글 알림)

### 주요 데이터 흐름

```
사용자 폼 제출 (app/voc/new/page.tsx)
  → POST /api/voc
    1. Supabase Storage에 첨부파일 업로드
    2. voc_submission 테이블에 행 삽입 (status: '접수')
    3. JIRA 이슈 생성 + 첨부파일 업로드 → jira_issue_key DB 반영
    4. 이메일 주소 있으면 Resend로 확인 메일 발송 (비동기)
  → 완료 페이지 (app/voc/complete)로 redirect

JIRA Webhook → POST /api/jira-webhook
  → 상태 변경 시 voc_submission.current_status 업데이트
  → 댓글 추가 시 voc_submission.comments 배열에 append
  → 이메일 주소 있으면 Resend로 알림 발송
```

### 페이지 구조
- `/` → `/voc/new` redirect
- `/voc/new` — VOC 접수 폼 (Client Component, localStorage 드래프트 자동저장)
- `/voc/complete` — 접수 완료 화면 (JIRA 티켓 링크 표시)
- `/voc/[id]` — 접수 내역 조회 (Server Component, `view_token` 쿼리파라미터로 인증)

### 핵심 파일
| 파일 | 역할 |
|------|------|
| `app/globals.css` | 디자인 토큰 (CSS 변수), 컴포넌트 클래스 (`.input`, `.card`, `.btn` 등), 모바일 미디어쿼리 |
| `lib/mapping.ts` | 제품→JIRA 담당자 ID(`PRODUCT_ASSIGNEE_ID`), 레이블 매핑 |
| `lib/jira.ts` | JIRA REST API 클라이언트, ADF description 빌더, 재시도 로직 |
| `lib/supabase-server.ts` | service_role 키 사용 admin 클라이언트 (API Route 전용) |
| `lib/mail.ts` | Resend 이메일 템플릿 (현재 미사용, 미래 재활용용) |

### 환경 변수 (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL
JIRA_HOST           # https://xxx.atlassian.net
JIRA_EMAIL
JIRA_API_TOKEN
JIRA_PROJECT_KEY
JIRA_WEBHOOK_SECRET
GMAIL_USER          # Gmail 주소 (발신용)
GMAIL_APP_PASSWORD  # Gmail 앱 비밀번호 (16자리)
```

### 설계 메모
- `voc_submission` 테이블의 `view_token`이 조회 페이지 접근 권한 역할 — URL로 공유 가능
- JIRA 담당자·보고자는 `PRODUCT_ASSIGNEE_ID`로 제품별 설정 (ServerFilter→정석범, IDFilter→김정태)
- 모바일 미디어쿼리 기준: `max-width: 640px`; 터치 기기 감지는 `navigator.maxTouchPoints > 0`
- 이메일 기능은 Gmail SMTP 사용 — `GMAIL_USER` + `GMAIL_APP_PASSWORD` 환경변수 필요
