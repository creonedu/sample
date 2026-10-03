/**
 * 크레온에듀 교재몰 → 구글 시트 주문 기록 스크립트
 *
 * 사용법은 docs/구매_오픈_가이드.md 의 [5단계]를 따라 하세요.
 * 아래 SECRET 값은 Vercel 환경변수 ORDER_WEBHOOK_SECRET 과 똑같이 맞춰주세요.
 */
var SECRET = '여기에-아무도-모르는-문자열-입력';

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  if (data.secret !== SECRET) {
    return ContentService.createTextOutput('forbidden');
  }
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('주문') ||
              SpreadsheetApp.getActiveSpreadsheet().insertSheet('주문');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['결제일시', '주문번호', '교재', '금액', '결제수단', '받는방법',
      '주문자', '연락처', '이메일', '학생', '캠퍼스/반', '우편번호', '주소', '배송메모', '테스트여부', '처리상태']);
  }
  var c = data.customer || {}, a = data.address || {};
  sheet.appendRow([
    data.paidAt, data.orderId, data.items, data.amount, data.method, data.delivery,
    c.name, "'" + (c.phone || ''), c.email, c.student, c.className,
    a.zip || '', ((a.addr1 || '') + ' ' + (a.addr2 || '')).trim(), a.memo || '',
    data.test ? '테스트' : '실결제', '접수'
  ]);
  return ContentService.createTextOutput('ok');
}
