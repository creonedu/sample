/* 교재몰 공통 기능: 금액 표시, 장바구니 저장, 하단 회사정보, 약관 */
var SHOP = window.CREON_SHOP;
var CART_KEY = 'creon_cart_v1';
var ORDER_KEY = 'creon_pending_order_v1';

function $(id) { return document.getElementById(id); }
function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function findProduct(id) {
  for (var i = 0; i < SHOP.products.length; i++) if (SHOP.products[i].id === id) return SHOP.products[i];
  return null;
}

/* 저장소 접근은 사생활 보호 모드 등에서 실패할 수 있어 항상 try/catch */
function store(kind) { try { return window[kind]; } catch (e) { return null; } }
function readJSON(kind, key, fallback) {
  try { var v = store(kind).getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
}
function writeJSON(kind, key, val) {
  try { store(kind).setItem(key, JSON.stringify(val)); } catch (e) { /* 저장 실패 시 화면 동작만 유지 */ }
}
function removeKey(kind, key) { try { store(kind).removeItem(key); } catch (e) {} }

/* 같은 색 규칙으로 레벨별 표지 색상 지정 */
var COVER_COLORS = ['#1A2B5E', '#E55C20', '#0D9065', '#7C3AED', '#0891B2', '#D97706', '#DC2626', '#334155'];
function coverColor(p) {
  var h = 0, s = p.category + p.level;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COVER_COLORS[h % COVER_COLORS.length];
}

/* 금액 계산 — 서버(api/confirm.js)도 같은 규칙으로 다시 계산합니다 */
function calcAmounts(items, delivery) {
  var sub = 0;
  items.forEach(function (it) { var p = findProduct(it.id); if (p) sub += p.price * it.qty; });
  var ship = 0;
  if (delivery === 'ship' && sub > 0) {
    ship = (SHOP.shipping.freeOver > 0 && sub >= SHOP.shipping.freeOver) ? 0 : SHOP.shipping.fee;
  }
  return { sub: sub, ship: ship, total: sub + ship };
}

function isTestMode() { return /^test_/.test(SHOP.payment.tossClientKey); }

function renderFooter() {
  var c = SHOP.company;
  var info = [
    ['상호', c.name], ['대표이사', c.ceo], ['사업자등록번호', c.bizNumber],
    ['통신판매업신고', c.mailOrderNumber], ['주소', c.address],
    ['고객센터', c.phone], ['이메일', c.email], ['개인정보보호책임자', c.privacyOfficer]
  ];
  $('footer').innerHTML =
    '<div class="ft-in">' +
    '<div class="ft-top">' +
    '<div class="ft-brand"><div class="ft-mark">CREON EDU.</div>' +
    '<p class="ft-tag">레벨에 맞는 교재를, 가장 간단하게.</p></div>' +
    '<div class="ft-cols">' +
    '<div class="ft-col"><b>고객 안내</b>' +
    '<a href="#" data-policy="terms">이용약관</a>' +
    '<a href="#" data-policy="privacy" class="em">개인정보처리방침</a>' +
    '<a href="#" data-policy="refund">교환·환불 정책</a></div>' +
    '<div class="ft-col"><b>크레온에듀</b>' +
    (c.website ? '<a href="' + esc(c.website) + '" target="_blank" rel="noopener">' + esc(c.service || '홈페이지') + ' ↗</a>' : '') +
    '<a href="tel:' + esc(c.phone.replace(/\D/g, '')) + '">' + esc(c.phone) + '</a>' +
    '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></div>' +
    '</div></div>' +
    '<dl class="ft-info">' + info.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('') + '</dl>' +
    '<p class="ft-copy">© ' + new Date().getFullYear() + ' ' + esc(c.name) + '. All rights reserved.</p>' +
    '</div>';
}

/* ⚠️ 아래 약관 문구는 기본 예시입니다. 실제 오픈 전 반드시 법률 검토 후 교체하세요. */
var POLICIES = {
  terms: ['이용약관',
    '제1조 (목적)\n이 약관은 ' + SHOP.company.name + '(이하 "회사")가 운영하는 교재몰에서 제공하는 교재 판매 서비스의 이용 조건 및 절차를 규정합니다.\n\n' +
    '제2조 (주문 및 결제)\n회원가입 없이 주문할 수 있으며, 결제는 토스페이먼츠를 통해 처리됩니다. 결제 완료 시 주문이 확정됩니다.\n\n' +
    '제3조 (배송)\n학원 수령 선택 시 결제일로부터 영업일 기준 3일 이내 담임 선생님을 통해 전달되며, 택배 선택 시 영업일 기준 2~3일 이내 출고됩니다.\n\n' +
    '제4조 (청약철회)\n「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 교재 수령 후 7일 이내 청약철회가 가능합니다.\n\n' +
    '※ 이 문구는 예시입니다. 실제 약관으로 교체해주세요.'],
  privacy: ['개인정보처리방침',
    '1. 수집 항목: 주문자 이름, 휴대폰 번호, 이메일(선택), 학생 이름, 소속 캠퍼스/반(선택), 배송 주소(택배 선택 시)\n\n' +
    '2. 수집 목적: 교재 주문 처리, 배송 및 학원 내 전달, 결제 확인, 고객 문의 응대\n\n' +
    '3. 보유 기간: 「전자상거래법」에 따라 계약·청약철회·대금결제 기록 5년, 소비자 불만·분쟁처리 기록 3년 보관 후 파기\n\n' +
    '4. 제3자 제공: 결제 처리를 위해 토스페이먼츠(주)에, 택배 배송을 위해 배송업체에 필요한 최소 정보를 제공합니다.\n\n' +
    '5. 개인정보보호책임자: ' + SHOP.company.privacyOfficer + ' (' + SHOP.company.email + ')\n\n' +
    '※ 이 문구는 예시입니다. 실제 개인정보처리방침으로 교체해주세요.'],
  refund: ['교환·환불 정책',
    '• 교재 수령 후 7일 이내, 사용하지 않은 상태라면 교환·환불이 가능합니다.\n' +
    '• 필기·훼손·포장 개봉으로 재판매가 어려운 경우 환불이 제한될 수 있습니다.\n' +
    '• 단순 변심에 의한 택배 반품 시 왕복 배송비는 고객 부담입니다.\n' +
    '• 파본·오배송은 회사가 배송비를 부담하여 교환해드립니다.\n' +
    '• 환불은 결제 수단으로 영업일 기준 3~5일 이내 처리됩니다.\n\n' +
    '문의: ' + SHOP.company.phone + ' / ' + SHOP.company.email + '\n\n' +
    '※ 이 문구는 예시입니다. 실제 정책으로 교체해주세요.']
};

function openPolicy(key) {
  var p = POLICIES[key];
  if (!p || !$('modal')) return;
  $('mTitle').textContent = p[0];
  $('mBody').textContent = p[1];
  $('modal').hidden = false;
}

document.addEventListener('click', function (e) {
  var a = e.target.closest('[data-policy]');
  if (a) { e.preventDefault(); openPolicy(a.getAttribute('data-policy')); }
  if (e.target.id === 'mClose' || e.target.id === 'modal') $('modal').hidden = true;
});

document.addEventListener('DOMContentLoaded', function () {
  renderFooter();
  if ($('testBanner') && isTestMode()) $('testBanner').hidden = false;
});
