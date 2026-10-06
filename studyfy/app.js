/* 소개 · 프로그램 · 상담 신청 · 수강신청/결제 화면 */
(function () {
  var activeTarget = SF.targets[0];
  var current = null;               // 수강신청 중인 프로그램
  var widgets = null, widgetReady = false;
  var prefill = {};

  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2000);
  }
  function val(id) { return $(id).value.trim(); }
  function digits(s) { return s.replace(/\D/g, ''); }

  /* ── 소개 섹션 ── */
  function renderServices() {
    $('svcList').innerHTML = SF.services.map(function (s) {
      return '<article class="svc-i"><span class="no">' + esc(s.no) + '</span>' +
        '<h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p>' +
        '<ul>' + s.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
        '<button class="link" data-svc="' + esc(s.id) + '">관련 프로그램 →</button></article>';
    }).join('');
  }
  function renderTabs() {
    $('tabs').innerHTML = SF.targets.map(function (t) {
      return '<button class="tab' + (t === activeTarget ? ' on' : '') + '" data-target="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
  }
  var svcFilter = '';
  function renderPrograms() {
    var list = SF.programs.filter(function (p) {
      if (svcFilter && p.category !== svcFilter) return false;
      return activeTarget === SF.targets[0] || p.targets.indexOf(activeTarget) !== -1;
    });
    var head = svcFilter ? '<div class="filter-note">' + esc(findService(svcFilter).title) +
      ' 프로그램만 보는 중 <button class="link" data-clear="1">전체 보기</button></div>' : '';
    $('progList').innerHTML = head + (list.length ? list.map(function (p) {
      var s = findService(p.category);
      return '<article class="pg' + (p.closed ? ' closed' : '') + (p.best ? ' best' : '') + '">' +
        '<div class="pg-top"><span class="cat">' + esc(s ? s.title : '') + '</span>' +
        (p.best ? '<span class="badge">추천</span>' : '') + (p.closed ? '<span class="badge mute">마감</span>' : '') + '</div>' +
        '<h3>' + esc(p.name) + '</h3><p class="pg-d">' + esc(p.desc) + '</p>' +
        '<ul class="inc">' + p.includes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<p class="for">' + p.targets.map(esc).join(' · ') + '</p>' +
        '<div class="pg-f"><div class="price"><b>' + won(p.price) + '</b><small>/ ' + esc(p.unit) + '</small></div>' +
        (p.closed ? '<button class="btn btn-g btn-sm" disabled>마감</button>'
          : '<button class="btn btn-p btn-sm" data-enroll="' + esc(p.id) + '">수강신청</button>') +
        '</div></article>';
    }).join('') : '<p class="empty">해당 대상의 프로그램이 준비 중입니다. 상담으로 문의해주세요.</p>');
  }
  function renderSteps() {
    $('stepList').innerHTML = SF.process.map(function (s, i) {
      return '<li><span class="no">STEP ' + (i + 1) + '</span><b>' + esc(s[0]) + '</b><p>' + esc(s[1]) + '</p></li>';
    }).join('');
  }
  function renderFaq() {
    $('faqList').innerHTML = SF.faq.map(function (f) {
      return '<details><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>';
    }).join('');
  }
  function renderConsultForm() {
    $('cInterest').innerHTML = SF.services.map(function (s) {
      return '<label class="pill"><input type="checkbox" value="' + esc(s.title) + '"><span>' + esc(s.title) + '</span></label>';
    }).join('');
    var c = SF.company;
    $('contactInfo').innerHTML =
      '<div><dt>전화</dt><dd><a href="tel:' + esc(digits(c.phone)) + '">' + esc(c.phone) + '</a></dd></div>' +
      '<div><dt>이메일</dt><dd><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></dd></div>' +
      '<div><dt>운영 시간</dt><dd>' + esc(c.hours) + '</dd></div>';
  }

  /* ── 상담 신청 ── */
  function mark(id, ok, bad) { $(id).classList.toggle('bad', !ok); if (!ok) bad.push(id); }
  function submitConsult(e) {
    e.preventDefault();
    var bad = [];
    var interests = Array.prototype.map.call(document.querySelectorAll('#cInterest input:checked'), function (i) { return i.value; });
    mark('cName', val('cName').length >= 2, bad);
    mark('cPhone', /^01\d{8,9}$/.test(digits(val('cPhone'))), bad);
    mark('cGrade', !!val('cGrade'), bad);
    $('cInterest').classList.toggle('bad', !interests.length);
    var msg = '';
    if (bad.length) { $(bad[0]).focus(); msg = '표시된 항목을 확인해주세요.'; }
    else if (!interests.length) msg = '관심 분야를 하나 이상 선택해주세요.';
    else if (!$('cAgree').checked) msg = '개인정보 수집·이용에 동의해주세요.';
    $('cErr').textContent = msg;
    if (msg) return;

    var m = document.querySelector('input[name=cMethod]:checked');
    var payload = {
      name: val('cName'), phone: digits(val('cPhone')), grade: val('cGrade'), goal: val('cGoal'),
      interests: interests, method: m ? m.value : '전화', message: val('cMsg'), website: val('cWeb')
    };
    $('cSubmit').disabled = true; $('cSubmit').textContent = '접수 중…';
    fetch('/api/studyfy-consult', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, message: '상담 접수 서버에 연결할 수 없습니다.' }; });
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || '접수에 실패했습니다.');
      $('consultForm').hidden = true; $('consultDone').hidden = false;
      $('consultDoneMsg').textContent = payload.name + '님, 1영업일 안에 ' + payload.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3') +
        '로 ' + payload.method + ' 상담 연락을 드리겠습니다.';
      // 같은 정보로 수강신청할 때 다시 입력하지 않도록 채워둠
      prefill = { name: payload.name, phone: payload.phone, grade: payload.grade, goal: payload.goal };
    }).catch(function (err) {
      $('cErr').textContent = err.message + ' 급하시면 ' + SF.company.phone + '로 연락주세요.';
    }).then(function () { $('cSubmit').disabled = false; $('cSubmit').textContent = '상담 신청하기'; });
  }

  /* ── 수강신청 / 결제 ── */
  function showView(name) {
    $('viewHome').hidden = name !== 'home';
    $('viewEnroll').hidden = name !== 'enroll';
    window.scrollTo(0, 0);
  }
  function goEnroll(id, noPush) {
    var p = findProgram(id);
    if (!p || p.closed) { toast('신청할 수 없는 프로그램입니다.'); return; }
    current = p;
    var s = findService(p.category);
    $('pick').innerHTML = '<div class="pick-b"><span class="cat">' + esc(s ? s.title : '') + '</span>' +
      '<b>' + esc(p.name) + '</b><p>' + esc(p.includes.join(' · ')) + '</p></div>' +
      '<div class="pick-p"><b>' + won(p.price) + '</b><small>/ ' + esc(p.unit) + '</small></div>';
    $('aName').textContent = p.name;
    $('aPrice').textContent = won(p.price);
    $('aTotal').textContent = won(p.price);
    if (prefill.name && !val('fName')) {
      $('fName').value = prefill.name; $('fPhone').value = prefill.phone;
      $('fGrade').value = prefill.grade; $('fGoal').value = prefill.goal;
    }
    $('coErr').textContent = '';
    showView('enroll');
    initWidget();
    if (noPush !== true) history.pushState({ v: 'enroll' }, '', '#enroll=' + encodeURIComponent(p.id));
  }
  function initWidget() {
    if (widgets) { if (widgetReady) widgets.setAmount({ currency: 'KRW', value: current.price }); return; }
    if (typeof TossPayments !== 'function') { $('payOff').hidden = false; return; }
    try {
      var tp = TossPayments(SF.payment.tossClientKey);
      widgets = tp.widgets({ customerKey: TossPayments.ANONYMOUS });
      widgets.setAmount({ currency: 'KRW', value: current.price })
        .then(function () {
          return Promise.all([
            widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
            widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' })
          ]);
        })
        .then(function () { widgetReady = true; return widgets.setAmount({ currency: 'KRW', value: current.price }); })
        .catch(function (e) { console.error(e); $('payOff').hidden = false; });
    } catch (e) { console.error(e); $('payOff').hidden = false; }
  }
  function validateEnroll() {
    var bad = [];
    mark('fName', val('fName').length >= 2, bad);
    mark('fPhone', /^01\d{8,9}$/.test(digits(val('fPhone'))), bad);
    mark('fEmail', !val('fEmail') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('fEmail')), bad);
    mark('fStudent', val('fStudent').length >= 2, bad);
    mark('fGrade', !!val('fGrade'), bad);
    if (bad.length) { $(bad[0]).focus(); return '표시된 항목을 확인해주세요.'; }
    if (!$('agreeAll').checked) return '약관 동의에 체크해주세요.';
    return '';
  }
  function makeOrderId() {
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'SF-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  }
  function pay() {
    var msg = validateEnroll();
    $('coErr').textContent = msg;
    if (msg) return;
    if (!widgetReady) { $('coErr').textContent = '결제 모듈이 아직 준비되지 않았습니다. 잠시 후 다시 눌러주세요.'; return; }

    var order = {
      orderId: makeOrderId(),
      orderName: 'Studyfy ' + current.name,
      programId: current.id,
      amount: current.price,
      customer: {
        name: val('fName'), phone: digits(val('fPhone')), email: val('fEmail'),
        student: val('fStudent'), grade: val('fGrade'), school: val('fSchool'),
        goal: val('fGoal'), memo: val('fMemo')
      }
    };
    writeJSON('sessionStorage', ORDER_KEY, order);

    var base = location.href.replace(/[#?].*$/, '').replace(/index\.html$/, '');
    var req = {
      orderId: order.orderId, orderName: order.orderName,
      successUrl: base + 'success.html', failUrl: base + 'fail.html',
      customerName: order.customer.name, customerMobilePhone: order.customer.phone
    };
    if (order.customer.email) req.customerEmail = order.customer.email;
    $('payBtn').disabled = true;
    widgets.requestPayment(req).catch(function (e) {
      $('coErr').textContent = e && e.message ? e.message : '결제가 취소되었습니다.';
    }).then(function () { $('payBtn').disabled = false; });
  }

  function route() {
    var m = /^#enroll=(.+)$/.exec(location.hash);
    if (m) goEnroll(decodeURIComponent(m[1]), true);
    else showView('home');
  }

  /* ── 이벤트 연결 ── */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.target) { activeTarget = t.dataset.target; renderTabs(); renderPrograms(); }
    else if (t.dataset.enroll) goEnroll(t.dataset.enroll);
    else if (t.dataset.svc) { svcFilter = t.dataset.svc; activeTarget = SF.targets[0]; renderTabs(); renderPrograms(); $('programs').scrollIntoView({ behavior: 'smooth' }); }
    else if (t.dataset.clear) { svcFilter = ''; renderPrograms(); }
  });
  // 상단 메뉴·버튼: 결제 화면에서 눌러도 소개 화면의 해당 섹션으로 이동
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]'); if (!a || a.hasAttribute('data-policy')) return;
    var id = a.getAttribute('href').slice(1); if (!id || !$(id)) return;
    e.preventDefault();
    if ($('viewHome').hidden) { history.pushState(null, '', location.pathname); showView('home'); }
    $(id).scrollIntoView({ behavior: 'smooth' });
  });
  $('consultForm').onsubmit = submitConsult;
  $('backBtn').onclick = function () {
    if (history.state && history.state.v === 'enroll') history.back();
    else { history.replaceState(null, '', location.pathname); showView('home'); $('programs').scrollIntoView(); }
  };
  $('payBtn').onclick = pay;
  window.addEventListener('popstate', route);

  renderServices(); renderTabs(); renderPrograms(); renderSteps(); renderFaq(); renderConsultForm();
  route();
})();
