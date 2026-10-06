/*
 * Studyfy 무료 상담 신청 접수 (Vercel 서버리스 함수)
 *
 * studyfy/index.html 의 상담 신청 폼이 이 주소로 신청 내용을 보냅니다.
 * 입력값을 확인한 뒤 Vercel 로그에 남기고, STUDYFY_WEBHOOK_URL 이 설정되어 있으면
 * 구글 시트('상담신청' 탭)로 보냅니다.
 */
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'POST 요청만 허용됩니다.' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b) return send(res, 400, { ok: false, message: '신청 내용이 올바르지 않습니다.' });

  // 스팸 봇은 숨겨진 칸(website)까지 채움 → 성공처럼 응답하고 버림
  if (b.website) return send(res, 200, { ok: true });

  const name = str(b.name, 40);
  const phone = str(b.phone, 20).replace(/\D/g, '');
  const grade = str(b.grade, 20);
  const interests = Array.isArray(b.interests) ? b.interests.slice(0, 10).map((x) => str(x, 40)).filter(Boolean) : [];
  if (name.length < 2) return send(res, 400, { ok: false, message: '성함을 확인해주세요.' });
  if (!/^01\d{8,9}$/.test(phone)) return send(res, 400, { ok: false, message: '연락처를 확인해주세요.' });
  if (!grade) return send(res, 400, { ok: false, message: '학년을 선택해주세요.' });
  if (!interests.length) return send(res, 400, { ok: false, message: '관심 분야를 선택해주세요.' });

  const record = {
    type: 'consult',
    secret: process.env.STUDYFY_WEBHOOK_SECRET || '',
    createdAt: new Date().toISOString(),
    name, phone, grade,
    goal: str(b.goal, 100),
    interests: interests.join(', '),
    method: ['전화', '화상', '방문'].includes(b.method) ? b.method : '전화',
    message: str(b.message, 2000)
  };
  console.log('[STUDYFY_CONSULT]', JSON.stringify({ ...record, secret: undefined }));

  if (process.env.STUDYFY_WEBHOOK_URL) {
    try {
      const r = await fetch(process.env.STUDYFY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(record)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
    } catch (e) {
      // 로그에는 남았으므로 운영자가 Vercel 로그에서 확인 가능
      console.error('[STUDYFY_CONSULT_WEBHOOK_FAILED]', e.message);
    }
  }
  return send(res, 200, { ok: true });
};
