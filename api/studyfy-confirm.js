/*
 * Studyfy 수강신청 결제 승인 서버 (Vercel 서버리스 함수)
 *
 * 고객이 토스 결제창에서 결제를 마치면 studyfy/success.html 이 이 주소로 결제 정보를 보냅니다.
 *   1) 프로그램 가격표(studyfy/programs.js)로 금액을 다시 확인해 위변조를 막고
 *   2) 토스페이먼츠에 '승인' 요청을 보내 실제 결제를 확정한 뒤
 *   3) (설정한 경우) 구글 시트로 수강신청 내역을 보냅니다.
 *
 * 환경변수
 *   TOSS_SECRET_KEY          토스페이먼츠 시크릿 키 (교재몰과 같은 상점이면 같은 값)
 *   STUDYFY_WEBHOOK_URL      (선택) 신청·상담 내역을 받을 구글 Apps Script 웹앱 주소
 *   STUDYFY_WEBHOOK_SECRET   (선택) 위 웹앱과 맞춰 둘 비밀 문자열
 */
const SF = require('../studyfy/programs.js');

// 토스 공식 문서용 테스트 시크릿 키 — 테스트 클라이언트 키와 짝. 실제 돈은 움직이지 않습니다.
const DOCS_TEST_SECRET = 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
const str = (v, max) => String(v == null ? '' : v).slice(0, max);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, code: 'METHOD', message: 'POST 요청만 허용됩니다.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const { paymentKey, orderId, amount, order } = body || {};
  if (!paymentKey || !orderId || !Number.isInteger(amount) || !order || order.orderId !== orderId) {
    return send(res, 400, { ok: false, code: 'BAD_REQUEST', message: '결제 정보가 올바르지 않습니다.' });
  }

  // 1) 서버 가격표로 다시 확인 — 브라우저에서 금액을 조작해도 여기서 막힙니다.
  const program = SF.programs.find((p) => p.id === order.programId);
  if (!program) return send(res, 400, { ok: false, code: 'INVALID_ORDER', message: '운영하지 않는 프로그램입니다.' });
  if (program.closed) return send(res, 400, { ok: false, code: 'CLOSED', message: `'${program.name}' 프로그램은 마감되었습니다.` });
  if (program.price !== amount) {
    return send(res, 400, { ok: false, code: 'AMOUNT_MISMATCH', message: '결제 금액이 프로그램 금액과 다릅니다. 결제는 승인되지 않았습니다.' });
  }

  const isTestKey = /^test_/.test(SF.payment.tossClientKey);
  const secretKey = process.env.TOSS_SECRET_KEY || (isTestKey ? DOCS_TEST_SECRET : '');
  if (!secretKey) {
    return send(res, 500, { ok: false, code: 'NO_SECRET_KEY', message: '결제 서버 설정이 완료되지 않았습니다. 고객센터로 문의해주세요.' });
  }

  // 2) 토스페이먼츠 결제 승인
  let payment;
  try {
    const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
        'Content-Type': 'application/json',
        'Idempotency-Key': orderId
      },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });
    payment = await r.json();
    if (!r.ok) return send(res, r.status, { ok: false, code: payment.code, message: payment.message });
  } catch (e) {
    return send(res, 502, { ok: false, code: 'TOSS_UNREACHABLE', message: '결제사 서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요.' });
  }

  // 3) 신청 내역 기록. 실패해도 결제는 이미 완료되었으므로 고객에게는 성공으로 응답.
  const c = order.customer || {};
  const record = {
    type: 'enroll',
    secret: process.env.STUDYFY_WEBHOOK_SECRET || '',
    paidAt: payment.approvedAt,
    orderId,
    program: program.name,
    amount,
    method: payment.method,
    customer: {
      name: str(c.name, 40), phone: str(c.phone, 20), email: str(c.email, 100),
      student: str(c.student, 40), grade: str(c.grade, 20), school: str(c.school, 60),
      goal: str(c.goal, 100), memo: str(c.memo, 500)
    },
    paymentKey,
    test: isTestKey
  };
  console.log('[STUDYFY_ENROLL]', JSON.stringify({ ...record, secret: undefined }));
  if (process.env.STUDYFY_WEBHOOK_URL) {
    try {
      await fetch(process.env.STUDYFY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(record)
      });
    } catch (e) {
      console.error('[STUDYFY_WEBHOOK_FAILED]', orderId, e.message);
    }
  }

  return send(res, 200, { ok: true, orderId, method: payment.method, receiptUrl: payment.receipt && payment.receipt.url });
};
