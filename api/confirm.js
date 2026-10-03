/*
 * 결제 승인 서버 (Vercel 서버리스 함수)
 *
 * 고객이 토스 결제창에서 결제를 마치면 success.html 이 이 주소(/api/confirm)로
 * 결제 정보를 보냅니다. 여기서
 *   1) 교재 가격표(shop/products.js)로 금액을 다시 계산해 위변조를 막고
 *   2) 토스페이먼츠에 '승인' 요청을 보내 실제 결제를 확정한 뒤
 *   3) (설정한 경우) 구글 시트로 주문 내역을 보냅니다.
 *
 * 필요한 환경변수 (Vercel > Project > Settings > Environment Variables)
 *   TOSS_SECRET_KEY        토스페이먼츠 시크릿 키 (절대 공개 금지)
 *   ORDER_WEBHOOK_URL      (선택) 주문 내역을 받을 구글 Apps Script 웹앱 주소
 *   ORDER_WEBHOOK_SECRET   (선택) 위 웹앱과 맞춰 둘 비밀 문자열
 */
const SHOP = require('../shop/products.js');

// 토스 공식 문서용 테스트 시크릿 키 — 테스트 클라이언트 키와 짝. 실제 돈은 움직이지 않습니다.
const DOCS_TEST_SECRET = 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';

function computeTotal(items, delivery) {
  if (!Array.isArray(items) || !items.length || items.length > 50) throw new Error('주문 교재가 올바르지 않습니다.');
  let sub = 0;
  for (const it of items) {
    const p = SHOP.products.find((x) => x.id === it.id);
    if (!p) throw new Error('판매하지 않는 교재가 포함되어 있습니다.');
    if (p.soldOut) throw new Error(`'${p.name}' 교재가 품절되었습니다.`);
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 99) throw new Error('수량이 올바르지 않습니다.');
    sub += p.price * it.qty;
  }
  let ship = 0;
  if (delivery === 'ship') {
    ship = SHOP.shipping.freeOver > 0 && sub >= SHOP.shipping.freeOver ? 0 : SHOP.shipping.fee;
  } else if (delivery !== 'pickup') {
    throw new Error('받는 방법이 올바르지 않습니다.');
  }
  return sub + ship;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, code: 'METHOD', message: 'POST 요청만 허용됩니다.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const { paymentKey, orderId, amount, order } = body || {};
  if (!paymentKey || !orderId || !Number.isInteger(amount) || !order || order.orderId !== orderId) {
    return send(res, 400, { ok: false, code: 'BAD_REQUEST', message: '결제 정보가 올바르지 않습니다.' });
  }

  // 1) 서버 가격표로 다시 계산 — 브라우저에서 금액을 조작해도 여기서 막힙니다.
  let expected;
  try { expected = computeTotal(order.items, order.delivery); }
  catch (e) { return send(res, 400, { ok: false, code: 'INVALID_ORDER', message: e.message }); }
  if (expected !== amount) {
    return send(res, 400, { ok: false, code: 'AMOUNT_MISMATCH', message: '결제 금액이 주문 금액과 다릅니다. 결제는 승인되지 않았습니다.' });
  }

  const isTestKey = /^test_/.test(SHOP.payment.tossClientKey);
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

  // 3) 주문 내역 기록 (구글 시트 등). 실패해도 결제는 이미 완료되었으므로 고객에게는 성공으로 응답.
  const record = {
    secret: process.env.ORDER_WEBHOOK_SECRET || '',
    paidAt: payment.approvedAt,
    orderId,
    orderName: payment.orderName,
    amount,
    method: payment.method,
    items: order.items.map((it) => {
      const p = SHOP.products.find((x) => x.id === it.id);
      return `${p.name} x${it.qty}`;
    }).join(', '),
    delivery: order.delivery === 'pickup' ? '학원수령' : '택배',
    customer: order.customer || {},
    address: order.address || null,
    paymentKey,
    test: isTestKey
  };
  console.log('[ORDER]', JSON.stringify({ ...record, secret: undefined }));
  if (process.env.ORDER_WEBHOOK_URL) {
    try {
      await fetch(process.env.ORDER_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(record)
      });
    } catch (e) {
      console.error('[ORDER_WEBHOOK_FAILED]', orderId, e.message);
    }
  }

  return send(res, 200, {
    ok: true,
    orderId,
    method: payment.method,
    receiptUrl: payment.receipt && payment.receipt.url
  });
};
