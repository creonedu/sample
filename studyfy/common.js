/* Studyfy 공통 기능: 금액 표시, 저장소, 하단 회사정보, 약관 */
var SF = window.STUDYFY;
var ORDER_KEY = 'studyfy_pending_order_v1';

function $(id) { return document.getElementById(id); }
function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function findProgram(id) {
  for (var i = 0; i < SF.programs.length; i++) if (SF.programs[i].id === id) return SF.programs[i];
  return null;
}
function findService(id) {
  for (var i = 0; i < SF.services.length; i++) if (SF.services[i].id === id) return SF.services[i];
  return null;
}

/* 저장소 접근은 사생활 보호 모드 등에서 실패할 수 있어 항상 try/catch */
function readJSON(kind, key, fallback) {
  try { var v = window[kind].getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
}
function writeJSON(kind, key, val) { try { window[kind].setItem(key, JSON.stringify(val)); } catch (e) {} }
function removeKey(kind, key) { try { window[kind].removeItem(key); } catch (e) {} }

function isTestMode() { return /^test_/.test(SF.payment.tossClientKey); }

function renderFooter() {
  var c = SF.company;
  var info = [
    ['상호', c.name], ['대표이사', c.ceo], ['사업자등록번호', c.bizNumber],
    ['통신판매업신고', c.mailOrderNumber], ['주소', c.address],
    ['고객센터', c.phone], ['이메일', c.email], ['개인정보보호책임자', c.privacyOfficer]
  ];
  $('footer').innerHTML =
    '<div class="ft-in">' +
    '<div class="ft-top">' +
    '<div class="ft-brand"><span class="mark">S</span><b>Studyfy</b><small>' + esc(SF.brand.tagline) + '</small></div>' +
    '<div class="ft-links">' +
    '<a href="#" data-policy="terms">이용약관</a>' +
    '<a href="#" data-policy="privacy" class="em">개인정보처리방침</a>' +
    '<a href="#" data-policy="refund">환불 정책</a>' +
    '<a href="tel:' + esc(c.phone.replace(/\D/g, '')) + '">' + esc(c.phone) + '</a>' +
    '</div></div>' +
    '<dl class="ft-info">' + info.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('') + '</dl>' +
    '<p class="ft-copy">Studyfy는 ' + esc(c.name) + '가 운영하는 서비스입니다. © ' + new Date().getFullYear() + ' ' + esc(c.name) +
    ' · 결제는 토스페이먼츠를 통해 안전하게 처리됩니다.</p>' +
    '</div>';
}

/* ⚠️ 아래 약관 문구는 기본 예시입니다. 실제 오픈 전 반드시 법률 검토 후 교체하세요. */
var POLICIES = {
  terms: ['이용약관',
    '제1조 (목적)\n이 약관은 ' + SF.company.name + '(이하 "회사")가 운영하는 Studyfy(스터디파이)에서 제공하는 비교과 컨설팅 서비스의 이용 조건 및 절차를 규정합니다.\n\n' +
    '제2조 (서비스 내용)\n회사는 자기소개서 기획·첨삭, 구술·심층면접 코칭, 생활기록부 및 수행평가 관리, 비교과 전략 컨설팅을 1:1로 제공합니다. 회사는 자기소개서 등 제출 서류를 대신 작성(대필)하지 않습니다.\n\n' +
    '제3조 (신청 및 결제)\n회원가입 없이 신청할 수 있으며, 결제는 토스페이먼츠를 통해 처리됩니다. 결제 완료 시 수강 계약이 성립합니다.\n\n' +
    '제4조 (일정)\n결제 완료 후 1영업일 이내 담당 컨설턴트가 연락하여 일정을 확정하며, 이용기간은 프로그램별 안내에 따릅니다.\n\n' +
    '제5조 (결과에 대한 책임)\n회사는 합격 등 특정 결과를 보장하지 않습니다.\n\n' +
    '※ 이 문구는 예시입니다. 실제 약관으로 교체해주세요.'],
  privacy: ['개인정보처리방침',
    '1. 수집 항목: 학부모 성함, 휴대폰 번호, 이메일(선택), 학생 이름·학년·학교(선택), 목표 학교, 상담 내용\n\n' +
    '2. 수집 목적: 상담 신청 응대, 수강 신청 처리 및 일정 안내, 결제 확인, 컨설팅 제공\n\n' +
    '3. 보유 기간: 상담 신청 정보는 상담 종료 후 1년, 결제 정보는 「전자상거래법」에 따라 계약·대금결제 기록 5년, 분쟁처리 기록 3년 보관 후 파기\n\n' +
    '4. 제3자 제공: 결제 처리를 위해 토스페이먼츠(주)에 필요한 최소 정보를 제공합니다.\n\n' +
    '5. 개인정보보호책임자: ' + SF.company.privacyOfficer + ' (' + SF.company.email + ')\n\n' +
    '※ 이 문구는 예시입니다. 실제 개인정보처리방침으로 교체해주세요.'],
  refund: ['환불 정책',
    '• 서비스 시작(첫 수업·첫 첨삭) 전: 전액 환불\n' +
    '• 회차형 프로그램: 이용한 회차 금액을 공제한 잔여 회차 금액 환불\n' +
    '• 기간형 프로그램(월·학기·연간): 총 이용기간의 1/3 경과 전 2/3 환불, 1/2 경과 전 1/2 환불, 1/2 경과 후 환불 불가\n' +
    '• 「자소서 프리미엄 1:1」은 첫 인터뷰 진행 후 서면 첨삭 1회당 정가의 10%를 공제합니다.\n' +
    '• 환불은 결제 수단으로 영업일 기준 3~5일 이내 처리됩니다.\n\n' +
    '문의: ' + SF.company.phone + ' / ' + SF.company.email + '\n\n' +
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
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('modal')) $('modal').hidden = true; });

document.addEventListener('DOMContentLoaded', function () {
  renderFooter();
  if ($('testBanner') && isTestMode()) $('testBanner').hidden = false;
});
