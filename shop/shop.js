/* 교재 목록 · 장바구니 · 주문/결제 화면 */
(function () {
  var cart = readJSON('localStorage', CART_KEY, []).filter(function (it) {
    var p = findProduct(it.id); return p && !p.soldOut && it.qty > 0;
  });
  var activeCat = SHOP.categories[0];
  var widgets = null, widgetReady = false;

  function saveCart() { writeJSON('localStorage', CART_KEY, cart); renderCart(); }
  function cartQty() { return cart.reduce(function (s, it) { return s + it.qty; }, 0); }
  function delivery() { var r = document.querySelector('input[name=delivery]:checked'); return r ? r.value : 'pickup'; }

  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  /* ── 교재 목록 ── */
  function renderChips() {
    $('chips').innerHTML = SHOP.categories.map(function (c) {
      return '<button class="chip' + (c === activeCat ? ' on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
  }
  var query = '';
  function coverHTML(p) {
    return '<div class="cover" style="background:' + coverColor(p) + '">' +
      (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + ' 표지" loading="lazy">' :
        '<span class="cv-b">CREON EDU</span><span class="cv-n">' + esc(p.name) + '</span><span class="cv-lv">' + esc(p.level) + '</span>') +
      (p.soldOut ? '<span class="float-badge">품절</span>' : '<span class="float-badge">' + esc(p.category) + '</span>') +
      '</div>';
  }
  function matches(p) {
    if (activeCat !== SHOP.categories[0] && p.category !== activeCat) return false;
    if (!query) return true;
    var hay = (p.name + ' ' + p.level + ' ' + p.category + ' ' + p.desc).toLowerCase();
    return hay.indexOf(query.toLowerCase()) !== -1;
  }
  function renderGrid() {
    var list = SHOP.products.filter(matches);
    $('grid').innerHTML = list.length ? list.map(function (p) {
      return '<article class="pc' + (p.soldOut ? ' soldout' : '') + '">' + coverHTML(p) +
        '<div class="pc-b"><div class="pc-top"><h3 class="pc-n">' + esc(p.name) + '</h3><span class="pc-lv">' + esc(p.level) + '</span></div>' +
        '<p class="pc-d">' + esc(p.desc) + '</p>' +
        '<div class="pc-f"><span class="price"><b>' + won(p.price) + '</b></span>' +
        (p.soldOut ? '<button class="btn btn-s" disabled>품절</button>'
          : '<button class="btn btn-s" data-add="' + esc(p.id) + '">담기</button>') +
        '</div></div></article>';
    }).join('') : '<p class="empty">' + (query ? '‘' + esc(query) + '’에 맞는 교재가 없습니다.' : '이 분류에는 아직 교재가 없습니다.') + '</p>';
  }

  /* ── 장바구니 ── */
  function addToCart(id) {
    var it = cart.filter(function (x) { return x.id === id; })[0];
    if (it) it.qty = Math.min(it.qty + 1, 99); else cart.push({ id: id, qty: 1 });
    saveCart(); toast('장바구니에 담았습니다');
  }
  function renderCart() {
    $('cartCount').textContent = cartQty();
    if (!cart.length) {
      $('cartList').innerHTML = '<li class="cart-empty">장바구니가 비어 있습니다.</li>';
    } else {
      $('cartList').innerHTML = cart.map(function (it) {
        var p = findProduct(it.id);
        return '<li class="ci"><div class="ci-th" style="background:' + coverColor(p) + '">' + esc(p.level) + '</div>' +
          '<div class="ci-b"><div class="ci-n">' + esc(p.name) + '</div><div class="ci-p">' + won(p.price) + '</div>' +
          '<div class="ci-r"><span class="qty"><button data-dec="' + esc(p.id) + '" aria-label="수량 빼기">−</button><span>' + it.qty +
          '</span><button data-inc="' + esc(p.id) + '" aria-label="수량 더하기">+</button></span>' +
          '<span><b>' + won(p.price * it.qty) + '</b> <button class="rm" data-rm="' + esc(p.id) + '">삭제</button></span></div></div></li>';
      }).join('');
    }
    var a = calcAmounts(cart, 'pickup');
    $('cSub').textContent = won(a.sub);
    var fo = SHOP.shipping.freeOver;
    var hint = '';
    if (cart.length) {
      hint = '학원 수령 시 배송비 무료';
      if (fo > 0) hint += a.sub >= fo ? ' <span class="save">택배도 무료배송</span>'
        : ' · 택배는 <span class="save">' + won(fo - a.sub) + ' 더 담으면 무료</span>';
    }
    $('cHint').innerHTML = hint;
    $('goCheckout').disabled = !cart.length;
  }
  function changeQty(id, d) {
    cart = cart.map(function (it) { if (it.id === id) it.qty = Math.max(0, Math.min(99, it.qty + d)); return it; })
      .filter(function (it) { return it.qty > 0; });
    saveCart();
  }
  function openCart(open) {
    $('drawer').classList.toggle('open', open);
    $('drawer').setAttribute('aria-hidden', String(!open));
    $('dim').hidden = !open;
  }

  /* ── 주문/결제 ── */
  function showView(name) {
    $('viewList').hidden = name !== 'list';
    $('viewCheckout').hidden = name !== 'checkout';
    window.scrollTo(0, 0);
  }
  function renderCheckout() {
    $('coItems').innerHTML = cart.map(function (it) {
      var p = findProduct(it.id);
      return '<li><span>' + esc(p.name) + ' × ' + it.qty + '</span><span>' + won(p.price * it.qty) + '</span></li>';
    }).join('');
    var fo = SHOP.shipping.freeOver;
    $('shipNote').textContent = '배송비 ' + won(SHOP.shipping.fee) + (fo > 0 ? ' (' + won(fo) + ' 이상 무료)' : '');
    updateAmounts();
  }
  function updateAmounts() {
    var a = calcAmounts(cart, delivery());
    $('aSub').textContent = won(a.sub);
    $('aShip').textContent = a.ship ? won(a.ship) : (delivery() === 'ship' ? '무료' : '0원 (학원 수령)');
    $('aTotal').textContent = won(a.total);
    $('addrBox').hidden = delivery() !== 'ship';
    if (widgetReady) widgets.setAmount({ currency: 'KRW', value: a.total });
  }
  function initWidget() {
    if (widgets) { updateAmounts(); return; }
    if (typeof TossPayments !== 'function') { $('payOff').hidden = false; return; }
    try {
      var tp = TossPayments(SHOP.payment.tossClientKey);
      widgets = tp.widgets({ customerKey: TossPayments.ANONYMOUS });
      widgets.setAmount({ currency: 'KRW', value: calcAmounts(cart, delivery()).total })
        .then(function () {
          return Promise.all([
            widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
            widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' })
          ]);
        })
        .then(function () { widgetReady = true; updateAmounts(); })
        .catch(function (e) { console.error(e); $('payOff').hidden = false; });
    } catch (e) { console.error(e); $('payOff').hidden = false; }
  }
  function goCheckout(noPush) {
    if (!cart.length) return;
    openCart(false); showView('checkout'); renderCheckout(); initWidget();
    if (noPush !== true) history.pushState({ v: 'checkout' }, '', '#checkout');
  }

  function val(id) { return $(id).value.trim(); }
  function validate() {
    var bad = [];
    function need(id, ok) { $(id).classList.toggle('bad', !ok); if (!ok) bad.push(id); }
    need('fName', val('fName').length >= 2);
    need('fPhone', /^01\d{8,9}$/.test(val('fPhone').replace(/\D/g, '')));
    need('fEmail', !val('fEmail') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('fEmail')));
    need('fStudent', val('fStudent').length >= 2);
    if (delivery() === 'ship') { need('fZip', !!val('fZip')); need('fAddr1', !!val('fAddr1')); need('fAddr2', !!val('fAddr2')); }
    if (bad.length) { $(bad[0]).focus(); return '표시된 항목을 확인해주세요.'; }
    if (!$('agreeAll').checked) return '약관 동의에 체크해주세요.';
    return '';
  }
  function makeOrderId() {
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'CREON-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  }
  function pay() {
    var msg = validate();
    $('coErr').textContent = msg;
    if (msg) return;
    if (!widgetReady) { $('coErr').textContent = '결제 모듈이 아직 준비되지 않았습니다. 잠시 후 다시 눌러주세요.'; return; }

    var a = calcAmounts(cart, delivery());
    var first = findProduct(cart[0].id).name;
    var order = {
      orderId: makeOrderId(),
      orderName: cart.length > 1 ? first + ' 외 ' + (cart.length - 1) + '건' : first,
      amount: a.total,
      items: cart.map(function (it) { return { id: it.id, qty: it.qty }; }),
      delivery: delivery(),
      customer: {
        name: val('fName'), phone: val('fPhone').replace(/\D/g, ''), email: val('fEmail'),
        student: val('fStudent'), className: val('fClass')
      },
      address: delivery() === 'ship' ? { zip: val('fZip'), addr1: val('fAddr1'), addr2: val('fAddr2'), memo: val('fMemo') } : null
    };
    // 결제 완료 페이지에서 서버 승인 요청에 사용
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
      // 사용자가 결제창을 닫은 경우 등
      $('coErr').textContent = e && e.message ? e.message : '결제가 취소되었습니다.';
    }).then(function () { $('payBtn').disabled = false; });
  }

  function openPostcode() {
    if (!window.daum || !daum.Postcode) { toast('주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'); return; }
    new daum.Postcode({
      oncomplete: function (d) {
        $('fZip').value = d.zonecode;
        $('fAddr1').value = d.roadAddress || d.jibunAddress;
        $('fAddr2').focus();
      }
    }).open();
  }

  /* ── 이벤트 연결 ── */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.cat) { activeCat = t.dataset.cat; renderChips(); renderGrid(); }
    else if (t.dataset.add) addToCart(t.dataset.add);
    else if (t.dataset.inc) changeQty(t.dataset.inc, 1);
    else if (t.dataset.dec) changeQty(t.dataset.dec, -1);
    else if (t.dataset.rm) changeQty(t.dataset.rm, -999);
  });
  $('cartBtn').onclick = function () { openCart(true); };
  $('searchForm').onsubmit = function (e) { e.preventDefault(); query = $('q').value.trim(); renderGrid(); $('grid').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  $('q').oninput = function () { query = $('q').value.trim(); renderGrid(); };
  $('closeCart').onclick = $('dim').onclick = function () { openCart(false); };
  $('goCheckout').onclick = function () { goCheckout(); };
  $('backBtn').onclick = function () { history.back(); };
  $('payBtn').onclick = pay;
  $('zipBtn').onclick = openPostcode;
  $('fZip').onclick = openPostcode;
  Array.prototype.forEach.call(document.querySelectorAll('input[name=delivery]'), function (r) { r.onchange = updateAmounts; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { openCart(false); $('modal').hidden = true; } });
  window.addEventListener('popstate', function () {
    if (location.hash === '#checkout' && cart.length) goCheckout(true);
    else showView('list');
  });

  renderChips(); renderGrid(); renderCart();
  if (location.hash === '#checkout' && cart.length) goCheckout(true);
  else history.replaceState(null, '', location.pathname + location.search);
})();
