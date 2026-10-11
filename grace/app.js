/*
 * 은혜의 순간 — 화면 흐름
 *   사진 찍기 → 모네 풍 그림 → 감사일기 → 말씀 추천 → 카드 저장 · 공유
 * 기록은 서버 없이 이 휴대폰의 IndexedDB 에만 저장됩니다.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const CARD_W = 1080, CARD_H = 1350;
  const SERIF = "'Gowun Batang', serif";
  const SANS = "'Pretendard Variable', Pretendard, system-ui, sans-serif";

  // ───────── 저장소 (IndexedDB) ─────────
  const db = (() => {
    let p;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open('grace-moments', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('entries', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const tx = async (mode, fn) => {
      const d = await open();
      return new Promise((res, rej) => {
        const t = d.transaction('entries', mode);
        const out = fn(t.objectStore('entries'));
        t.oncomplete = () => res(out && out.result);
        t.onerror = () => rej(t.error);
      });
    };
    return {
      put: (e) => tx('readwrite', (s) => s.put(e)),
      del: (id) => tx('readwrite', (s) => s.delete(id)),
      get: (id) => tx('readonly', (s) => s.get(id)),
      all: () => tx('readonly', (s) => s.getAll()),
    };
  })();

  // ───────── 상태 ─────────
  const state = {
    image: null,      // 원본 사진 (HTMLImageElement)
    seed: 1,
    painted: false,
    text: '',
    verses: [],
    shown: [],        // 이미 보여 준 말씀 (다른 말씀 보기용)
    verse: null,
    entryId: null,
    createdAt: null,
    detail: null,     // 보고 있는 기록
  };

  // ───────── 화면 전환 (뒤로 가기 지원) ─────────
  const views = ['Home', 'Paint', 'Write', 'Verse', 'Card', 'Detail'];
  const stepOf = { Paint: 0, Write: 1, Verse: 2, Card: 3 };
  let current = 'Home';
  function show(name, push = true) {
    views.forEach((v) => { $('view' + v).hidden = v !== name; });
    current = name;
    const step = stepOf[name];
    $('bar').hidden = name === 'Home';
    $('steps').style.visibility = step === undefined ? 'hidden' : 'visible';
    [...$('steps').children].forEach((li, i) => li.classList.toggle('on', i === step));
    if (push) history.pushState({ v: name }, '', '');
    window.scrollTo(0, 0);
    if (name === 'Home') renderJournal();
  }
  history.replaceState({ v: 'Home' }, '', '');
  window.addEventListener('popstate', (e) => {
    const v = (e.state && e.state.v) || 'Home';
    // 필요한 데이터가 없으면 홈으로
    if ((v !== 'Home' && v !== 'Detail' && !state.image) || (v === 'Detail' && !state.detail)) return show('Home', false);
    show(v, false);
  });
  $('backBtn').onclick = () => history.back();

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  }

  const fmtDate = (d) => {
    const w = '일월화수목금토'[d.getDay()];
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${w})`;
  };

  // ───────── 1. 사진 ─────────
  $('cameraBtn').onclick = () => $('cameraInput').click();
  $('galleryBtn').onclick = () => $('galleryInput').click();
  ['cameraInput', 'galleryInput'].forEach((id) => {
    $(id).onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) loadPhoto(f);
    };
  });

  function loadPhoto(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.seed = (Date.now() % 100000) + 1;
      state.text = ''; state.verse = null; state.verses = []; state.shown = [];
      state.entryId = 'g' + Date.now().toString(36);
      state.createdAt = Date.now();
      $('diary').value = ''; updateCount();
      show('Paint');
      runPaint();
    };
    img.onerror = () => toast('사진을 불러오지 못했어요. 다른 사진을 골라 주세요.');
    img.src = url;
  }

  // ───────── 2. 모네 풍 그림 ─────────
  let painting = false;
  async function runPaint() {
    if (painting) return;
    painting = true; state.painted = false;
    $('repaintBtn').disabled = true; $('toWriteBtn').disabled = true;
    $('paintStatus').textContent = '붓터치를 올리고 있어요…';
    $('paintProgress').hidden = false;
    const bar = $('paintProgress').firstElementChild;
    bar.style.width = '0%';
    try {
      await GraceMonet.paint(state.image, $('paintCanvas'), {
        seed: state.seed,
        onProgress: (p) => { bar.style.width = Math.round(p * 100) + '%'; },
      });
      state.painted = true;
      $('paintStatus').textContent = '모네의 빛으로 다시 그린 오늘이에요.';
      $('writeThumb').src = $('paintCanvas').toDataURL('image/jpeg', 0.7);
    } catch (err) {
      console.error(err);
      $('paintStatus').textContent = '그림을 그리지 못했어요. 다시 시도해 주세요.';
    } finally {
      painting = false;
      $('paintProgress').hidden = true;
      $('repaintBtn').disabled = false;
      $('toWriteBtn').disabled = !state.painted;
    }
  }
  $('repaintBtn').onclick = () => { state.seed = state.seed * 7 + 13; runPaint(); };
  $('toWriteBtn').onclick = () => {
    $('writeDate').textContent = fmtDate(new Date(state.createdAt));
    show('Write');
  };

  // ───────── 3. 감사일기 ─────────
  function updateCount() {
    const v = $('diary').value;
    $('diaryCount').textContent = v.length;
    $('toVerseBtn').disabled = !v.trim();
  }
  $('diary').addEventListener('input', updateCount);
  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const ta = $('diary');
    const sep = ta.value && !ta.value.endsWith('\n') ? '\n' : '';
    ta.value = (ta.value + sep + b.dataset.t).slice(0, 500);
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    updateCount();
  });
  $('toVerseBtn').onclick = () => {
    const text = $('diary').value.trim();
    if (text !== state.text || !state.verses.length) {
      state.text = text; state.shown = []; state.verse = null;
      nextVerses();
    }
    show('Verse');
  };

  // ───────── 4. 말씀 추천 ─────────
  function nextVerses() {
    state.verses = GraceVerses.recommend(state.text, 3, state.shown);
    state.shown.push(...state.verses.map((v) => v.ref));
    state.verse = state.verses[0];
    renderVerses();
  }
  function renderVerses() {
    const list = $('verseList');
    list.innerHTML = '';
    state.verses.forEach((v) => {
      const b = document.createElement('button');
      b.className = 'verse'; b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(state.verse && state.verse.ref === v.ref));
      const p = document.createElement('p'); p.textContent = v.text;
      const meta = document.createElement('div'); meta.className = 'meta';
      const ref = document.createElement('b'); ref.textContent = v.ref;
      const th = document.createElement('span'); th.textContent = v.theme;
      meta.append(ref, th); b.append(p, meta);
      b.onclick = () => { state.verse = v; renderVerses(); };
      list.appendChild(b);
    });
    $('toCardBtn').disabled = !state.verse;
  }
  $('moreVerseBtn').onclick = nextVerses;
  $('toCardBtn').onclick = async () => {
    show('Card');
    await drawCard();
    saveEntry();
  };

  // ───────── 5. 카드 ─────────
  function wrapLines(ctx, text, maxW, maxLines) {
    const lines = [];
    const paras = String(text).split('\n');
    outer: for (const para of paras) {
      const words = para.split(/(\s+)/).filter((w) => w.length);
      let line = '';
      for (const w of words) {
        const test = line + w;
        if (ctx.measureText(test).width <= maxW) { line = test; continue; }
        if (line.trim()) { lines.push(line.trim()); line = ''; if (lines.length >= maxLines) break outer; }
        let word = w.trim();
        // 한 단어가 너무 길면 글자 단위로 자릅니다
        while (word && ctx.measureText(word).width > maxW) {
          let i = word.length;
          while (i > 1 && ctx.measureText(word.slice(0, i)).width > maxW) i--;
          lines.push(word.slice(0, i)); word = word.slice(i);
          if (lines.length >= maxLines) break outer;
        }
        line = word;
      }
      if (line.trim()) lines.push(line.trim());
      if (lines.length >= maxLines) break;
    }
    const full = lines.join('').replace(/\s/g, '').length >= String(text).replace(/\s/g, '').length;
    const out = lines.slice(0, maxLines);
    if (!full || lines.length > maxLines) {
      let last = out[out.length - 1] || '';
      while (last && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      out[out.length - 1] = last.trimEnd() + '…';
    }
    return out;
  }

  async function drawCard() {
    const withText = $('includeDiary').checked;
    try {
      await Promise.all([
        document.fonts.load(`32px ${SERIF}`, '은혜'),
        document.fonts.load(`700 32px ${SERIF}`, '은혜'),
        document.fonts.load(`500 24px ${SANS}`, '들벗교회'),
      ]);
    } catch (e) { /* 글꼴이 없으면 기본 글꼴로 */ }

    const c = $('cardCanvas'), ctx = c.getContext('2d');
    const M = 72, innerW = CARD_W - M * 2;
    ctx.fillStyle = '#faf7f1'; ctx.fillRect(0, 0, CARD_W, CARD_H);

    // 글 영역 높이를 먼저 계산
    ctx.font = `34px ${SERIF}`;
    const diaryLines = withText ? wrapLines(ctx, state.text, innerW, 4) : [];
    ctx.font = `29px ${SERIF}`;
    const verseLines = wrapLines(ctx, state.verse.text, innerW, withText ? 4 : 6);
    const diaryH = diaryLines.length ? diaryLines.length * 56 + 34 : 0;
    const verseH = verseLines.length * 48 + 52;
    const footH = 96;
    const textTop = 64 + 40;
    const imgH = Math.max(560, Math.min(980, CARD_H - footH - textTop - 48 - 34 - diaryH - verseH - 40));

    // 그림 (가운데 맞춰 자르기)
    const p = $('paintCanvas');
    const r = Math.max(innerW / p.width, imgH / p.height);
    const sw = innerW / r, sh = imgH / r;
    ctx.drawImage(p, (p.width - sw) / 2, (p.height - sh) / 2, sw, sh, M, 64, innerW, imgH);

    let y = 64 + imgH + 64;
    ctx.textBaseline = 'alphabetic';
    // 날짜
    ctx.fillStyle = '#a59f95';
    ctx.font = `500 24px ${SANS}`;
    ctx.fillText(fmtDate(new Date(state.createdAt)), M, y);
    y += 58;
    // 감사일기
    if (diaryLines.length) {
      ctx.fillStyle = '#2b2a27';
      ctx.font = `34px ${SERIF}`;
      diaryLines.forEach((l) => { ctx.fillText(l, M, y); y += 56; });
      y += 18;
      ctx.fillStyle = '#e4ddd0'; ctx.fillRect(M, y - 20, 48, 2);
      y += 30;
    }
    // 말씀
    ctx.fillStyle = '#5b5852';
    ctx.font = `29px ${SERIF}`;
    verseLines.forEach((l) => { ctx.fillText(l, M, y); y += 48; });
    ctx.fillStyle = '#8b857b';
    ctx.font = `500 24px ${SANS}`;
    ctx.fillText(state.verse.ref, M, y + 6);

    // 바닥글
    ctx.fillStyle = '#2b2a27';
    ctx.font = `700 26px ${SERIF}`;
    ctx.textAlign = 'right';
    ctx.fillText('은혜의 순간', CARD_W - M, CARD_H - 56);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a59f95';
    ctx.font = `500 22px ${SANS}`;
    ctx.fillText('들벗교회', M, CARD_H - 56);
  }

  $('includeDiary').onchange = async () => { await drawCard(); saveEntry(); };

  const toBlob = (canvas, q = 0.9) => new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));

  async function saveEntry() {
    try {
      const card = await toBlob($('cardCanvas'), 0.9);
      const thumbC = document.createElement('canvas');
      thumbC.width = 360; thumbC.height = 450;
      thumbC.getContext('2d').drawImage($('cardCanvas'), 0, 0, 360, 450);
      const thumb = await toBlob(thumbC, 0.8);
      await db.put({
        id: state.entryId, createdAt: state.createdAt,
        text: state.text, verse: { ref: state.verse.ref, text: state.verse.text },
        card, thumb,
      });
    } catch (e) {
      console.error(e);
      toast('기록을 저장하지 못했어요.');
    }
  }

  const fileName = (ts) => {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `은혜의순간_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.jpg`;
  };

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function shareBlob(blob, ts, verse) {
    const file = new File([blob], fileName(ts), { type: 'image/jpeg' });
    const text = `${verse.text}\n— ${verse.ref}\n\n#은혜의순간 #들벗교회`;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: '은혜의 순간', text });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    download(blob, file.name);
    toast('이미지를 저장했어요. 카카오톡 등에서 사진으로 보내 주세요.');
  }

  async function saveBlob(blob, ts) {
    const file = new File([blob], fileName(ts), { type: 'image/jpeg' });
    // iOS 는 공유 시트의 '이미지 저장'이 사진 앱에 저장하는 가장 쉬운 방법입니다
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    download(blob, file.name);
    toast('사진을 저장했어요.');
  }

  $('shareBtn').onclick = async () => shareBlob(await toBlob($('cardCanvas'), 0.92), state.createdAt, state.verse);
  $('saveImgBtn').onclick = async () => saveBlob(await toBlob($('cardCanvas'), 0.92), state.createdAt);
  $('doneBtn').onclick = () => {
    state.image = null;
    show('Home');
    toast('오늘의 은혜가 기록되었어요.');
  };

  // ───────── 홈: 나의 기록 ─────────
  const thumbURLs = [];
  async function renderJournal() {
    let entries = [];
    try { entries = await db.all(); } catch (e) { console.error(e); }
    entries.sort((a, b) => b.createdAt - a.createdAt);
    thumbURLs.splice(0).forEach((u) => URL.revokeObjectURL(u));
    const grid = $('entryGrid');
    grid.innerHTML = '';
    entries.forEach((e) => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', fmtDate(new Date(e.createdAt)) + ' 기록 보기');
      const img = document.createElement('img');
      const u = URL.createObjectURL(e.thumb || e.card); thumbURLs.push(u);
      img.src = u; img.alt = ''; img.loading = 'lazy';
      b.appendChild(img);
      b.onclick = () => openDetail(e.id);
      grid.appendChild(b);
    });
    $('emptyMsg').hidden = entries.length > 0;
    $('entryCount').textContent = entries.length ? `${entries.length}개의 순간` : '';
  }

  // ───────── 6. 기록 보기 ─────────
  let detailURL;
  async function openDetail(id) {
    const e = await db.get(id);
    if (!e) return;
    state.detail = e;
    if (detailURL) URL.revokeObjectURL(detailURL);
    detailURL = URL.createObjectURL(e.card);
    $('detailImg').src = detailURL;
    $('detailDate').textContent = fmtDate(new Date(e.createdAt));
    $('detailText').textContent = e.text;
    $('detailVerse').textContent = e.verse.text;
    $('detailRef').textContent = e.verse.ref;
    show('Detail');
  }
  $('detailShareBtn').onclick = () => shareBlob(state.detail.card, state.detail.createdAt, state.detail.verse);
  $('detailSaveBtn').onclick = () => saveBlob(state.detail.card, state.detail.createdAt);
  $('deleteBtn').onclick = async () => {
    if (!state.detail || !confirm('이 기록을 지울까요? 지운 기록은 되돌릴 수 없어요.')) return;
    await db.del(state.detail.id);
    state.detail = null;
    show('Home');
    toast('기록을 지웠어요.');
  };

  // 앱처럼 설치 (오프라인에서도 열리도록)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  show('Home', false);
})();
