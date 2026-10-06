/**
 * Studyfy → 구글 시트 기록 스크립트 (상담신청 · 수강신청)
 *
 * 사용법은 docs/Studyfy_운영가이드.md 의 [3단계]를 따라 하세요.
 * 아래 SECRET 값은 Vercel 환경변수 STUDYFY_WEBHOOK_SECRET 과 똑같이 맞춰주세요.
 */
var SECRET = '여기에-아무도-모르는-문자열-입력';

function sheet_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(header);
  return sh;
}

function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  if (d.secret !== SECRET) return ContentService.createTextOutput('forbidden');

  if (d.type === 'consult') {
    sheet_('상담신청', ['접수일시', '학부모', '연락처', '학년', '목표 학교', '관심 분야', '상담 방식', '문의 내용', '처리상태'])
      .appendRow([d.createdAt, d.name, "'" + d.phone, d.grade, d.goal, d.interests, d.method, d.message, '미연락']);
  } else if (d.type === 'enroll') {
    var c = d.customer || {};
    sheet_('수강신청', ['결제일시', '주문번호', '프로그램', '금액', '결제수단', '학부모', '연락처', '이메일',
      '학생', '학년', '학교', '목표 학교', '요청 사항', '테스트여부', '담당 컨설턴트', '처리상태'])
      .appendRow([d.paidAt, d.orderId, d.program, d.amount, d.method, c.name, "'" + c.phone, c.email,
        c.student, c.grade, c.school, c.goal, c.memo, d.test ? '테스트' : '실결제', '', '배정 대기']);
  }
  return ContentService.createTextOutput('ok');
}
