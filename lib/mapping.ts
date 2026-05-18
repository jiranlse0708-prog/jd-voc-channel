/**
 * 제품 → JIRA 담당자 매핑
 *
 * JIRA Cloud accountId 확인 방법:
 *   GET https://{host}/rest/api/3/user/search?query={이름}
 *   또는 JIRA 프로필 페이지 URL에서 accountId 파라미터 복사
 *
 * JIRA Server/Data Center username 확인 방법:
 *   GET https://{host}/rest/api/2/user/search?username={이름}
 */
export const PRODUCT_ASSIGNEE_ID: Record<string, string | null> = {
  // TODO: 테스트 완료 후 원복
  // SERVERFILTER: '5a2e4b4df34f35510563ac4c',                    // 정석범
  // IDFILTER:     '712020:eab47ad1-5185-4f87-ad6e-cf1d7744d516', // 김정태
  SERVERFILTER: '712020:7cd0960b-466d-41ae-aeee-745541c8fb49', // 이세은 (임시)
  IDFILTER:     '712020:7cd0960b-466d-41ae-aeee-745541c8fb49', // 이세은 (임시)
}

/** 사람이 읽을 수 있는 담당자 이름 (로그·UI 표시용) */
export const PRODUCT_ASSIGNEE_NAME: Record<string, string> = {
  SERVERFILTER: '정석범',
  IDFILTER:     '김정태',
}

export const VOC_TYPE_LABEL: Record<string, string> = {
  inquiry: '단순문의',
  improve: '개선',
  defect:  '결함',
  new:     '신규',
}

export const PRIORITY_LABEL: Record<string, string> = {
  highest: '최상',
  high:    '상',
  medium:  '중',
  low:     '하',
}
