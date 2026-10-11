/*
 * 은혜의 순간 — 모네 풍 인상주의 필터
 *
 * 서버나 AI 없이 휴대폰 안에서 사진을 그림으로 바꿉니다.
 *   1) 빛 옮기기: 모네는 검정을 쓰지 않았습니다. 어두운 곳은 보라·푸른 그늘로,
 *      밝은 곳은 크림·복숭아빛으로 옮기고 전체를 밝고 파스텔하게 올립니다.
 *   2) 밑칠: 흐린 색면을 깔고 그 위에
 *   3) 붓터치: 큰 붓 → 중간 붓 → 작은 붓 순서로 두툼한 짧은 붓자국을 겹칩니다.
 *      붓 방향은 사진의 윤곽을 따르고, 평평한 곳(하늘·물)은 수면처럼 가로로 흐릅니다.
 *      '색의 병치' — 한 붓자국마다 이웃한 색(초록 옆에 노랑·청록, 파랑 옆에 보라·분홍)을
 *      섞어 가까이서는 색점, 멀리서는 빛으로 보이게 합니다.
 *   4) 빛 조각: 밝은 곳에 크림·분홍·연노랑 점을 얹고,
 *   5) 아지랑이: 전체를 살짝 번지게 해 공기와 빛이 감도는 느낌을 줍니다.
 * 그리는 과정을 화면에 조금씩 보여 주기 위해 onProgress 로 진행률을 알립니다.
 */
(function (root) {
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  // 작은 시드 난수 — 같은 사진은 '다시 그리기' 전까지 같은 그림이 나오도록
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn;
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h;
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => {
      t = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  // 색상환에서 a 를 b 쪽으로 t 만큼 (가까운 방향으로)
  const hueToward = (a, b, t) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;

  function boxBlur(src, w, h, r) {
    const out = new Float32Array(src.length);
    const tmp = new Float32Array(src.length);
    for (let c = 0; c < 3; c++) {
      for (let y = 0; y < h; y++) {
        let acc = 0;
        for (let x = -r; x <= r; x++) acc += src[(y * w + Math.min(w - 1, Math.max(0, x))) * 3 + c];
        for (let x = 0; x < w; x++) {
          tmp[(y * w + x) * 3 + c] = acc / (2 * r + 1);
          const xa = Math.min(w - 1, x + r + 1), xs = Math.max(0, x - r);
          acc += src[(y * w + xa) * 3 + c] - src[(y * w + xs) * 3 + c];
        }
      }
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += tmp[(Math.min(h - 1, Math.max(0, y)) * w + x) * 3 + c];
        for (let y = 0; y < h; y++) {
          out[(y * w + x) * 3 + c] = acc / (2 * r + 1);
          const ya = Math.min(h - 1, y + r + 1), ys = Math.max(0, y - r);
          acc += tmp[(ya * w + x) * 3 + c] - tmp[(ys * w + x) * 3 + c];
        }
      }
    }
    return out;
  }

  // 모네의 빛: 검정 없이, 그늘은 보랏빛 푸름, 빛은 따뜻한 크림, 전체는 밝은 파스텔
  function grade(r, g, b) {
    let [h, s, l] = rgb2hsl(r, g, b);
    l = 0.24 + Math.pow(l, 0.85) * 0.7;           // 검정을 들어 올리고 높은 키로
    const shade = clamp01((0.5 - l) / 0.26);      // 그늘 정도
    const light = clamp01((l - 0.66) / 0.28);     // 빛 정도
    if (s < 0.08) h = shade > 0 ? 245 : 42;       // 무채색에도 색을 입힘
    h = hueToward(h, 248, shade * 0.55);          // 그늘 → 보라·청색
    h = hueToward(h, 40, light * 0.4);            // 빛 → 크림·복숭아
    s = 0.16 + s * 0.6 + shade * 0.1;             // 탁한 회색 없이, 원색 같은 날카로움도 없이
    s = Math.min(s, 0.52 - light * 0.2);
    return hsl2rgb(h, s, l);
  }

  // 한 붓자국의 색: 이웃한 색을 병치하고 빛을 섞습니다
  function strokeColor(r, g, b, rand, L) {
    let [h, s, l] = rgb2hsl(r, g, b);
    h += (rand() - 0.5) * L.hueJ;
    if (rand() < L.broken) {
      // 색의 병치: 초록은 노랑·청록, 파랑은 보라·청록, 따뜻한 색은 분홍·노랑 쪽으로
      const dir = rand() < 0.5 ? -1 : 1;
      h += dir * (24 + rand() * 26);
      s = Math.min(0.58, s * 1.05);
    }
    l += (rand() - 0.5) * L.lumJ;
    s *= 0.9 + rand() * 0.25;
    return hsl2rgb(h, clamp01(s), clamp01(l));
  }

  const LIGHT_DABS = [[255, 246, 214], [252, 226, 214], [246, 244, 200], [226, 236, 246], [244, 222, 236]];

  /**
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} img
   * @param {HTMLCanvasElement} canvas  결과를 그릴 캔버스 (크기는 여기서 맞춤)
   * @param {{maxSize?:number, seed?:number, onProgress?:(p:number)=>void}} opts
   */
  async function paint(img, canvas, opts = {}) {
    const maxSize = opts.maxSize || 1200;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSize / Math.max(iw, ih));
    const W = Math.round(iw * scale), H = Math.round(ih * scale);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const rand = rng(opts.seed || 7);
    const progress = opts.onProgress || (() => {});

    // 분석은 작은 크기에서 (빠르게)
    const aScale = Math.min(1, 400 / Math.max(W, H));
    const aw = Math.max(8, Math.round(W * aScale)), ah = Math.max(8, Math.round(H * aScale));
    const ac = document.createElement('canvas'); ac.width = aw; ac.height = ah;
    const actx = ac.getContext('2d', { willReadFrequently: true });
    actx.drawImage(img, 0, 0, aw, ah);
    const raw = actx.getImageData(0, 0, aw, ah).data;
    const src = new Float32Array(aw * ah * 3);
    for (let i = 0, j = 0; i < raw.length; i += 4, j += 3) {
      const [r, g, b] = grade(raw[i], raw[i + 1], raw[i + 2]);
      src[j] = r; src[j + 1] = g; src[j + 2] = b;
    }
    const soft = boxBlur(src, aw, ah, 2);
    const blurry = boxBlur(src, aw, ah, 6);

    // 붓 방향(윤곽선)과 디테일 정도
    const lum = new Float32Array(aw * ah);
    for (let i = 0; i < aw * ah; i++) lum[i] = 0.299 * soft[i * 3] + 0.587 * soft[i * 3 + 1] + 0.114 * soft[i * 3 + 2];
    const dir = new Float32Array(aw * ah * 3);
    for (let y = 1; y < ah - 1; y++) for (let x = 1; x < aw - 1; x++) {
      const i = y * aw + x;
      const gx = (lum[i - aw + 1] + 2 * lum[i + 1] + lum[i + aw + 1]) - (lum[i - aw - 1] + 2 * lum[i - 1] + lum[i + aw - 1]);
      const gy = (lum[i + aw - 1] + 2 * lum[i + aw] + lum[i + aw + 1]) - (lum[i - aw - 1] + 2 * lum[i - aw] + lum[i - aw + 1]);
      // 이중 각도로 저장해 방향장을 부드럽게 평균
      dir[i * 3] = gx * gx - gy * gy; dir[i * 3 + 1] = 2 * gx * gy; dir[i * 3 + 2] = Math.hypot(gx, gy);
    }
    const sdir = boxBlur(dir, aw, ah, 4);

    const sample = (buf, x, y) => {
      const ax = Math.min(aw - 1, Math.max(0, Math.round(x * aScale)));
      const ay = Math.min(ah - 1, Math.max(0, Math.round(y * aScale)));
      const i = (ay * aw + ax) * 3;
      return [buf[i], buf[i + 1], buf[i + 2]];
    };
    const flow = (x, y) => {
      const [a, b, mag] = sample(sdir, x, y);
      // 윤곽이 약한 곳(하늘·물·벽)은 수면처럼 거의 가로로 흐르는 붓질
      const wave = Math.sin(x / W * 6.3 + y / H * 2.4) * 0.22 + Math.sin(y / H * 9.1 + x / W) * 0.12;
      const e = clamp01((mag - 10) / 90);
      if (e <= 0) return { ang: wave, edge: 0 };
      const along = 0.5 * Math.atan2(b, a) + Math.PI / 2;
      return { ang: e > 0.35 ? along : wave + (along - wave) * (e / 0.35) * 0.6, edge: e };
    };

    // 밑칠 — 밝은 바탕 위에 흐린 색면
    const under = document.createElement('canvas'); under.width = aw; under.height = ah;
    const uctx = under.getContext('2d');
    const ud = uctx.createImageData(aw, ah);
    for (let i = 0, j = 0; i < ud.data.length; i += 4, j += 3) {
      ud.data[i] = blurry[j]; ud.data[i + 1] = blurry[j + 1]; ud.data[i + 2] = blurry[j + 2]; ud.data[i + 3] = 255;
    }
    uctx.putImageData(ud, 0, 0);
    ctx.fillStyle = '#f6f0e4'; ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 0.85;
    ctx.drawImage(under, 0, 0, W, H);
    ctx.globalAlpha = 1;

    const unit = Math.max(W, H) / 1000; // 1000px 기준 붓 크기 단위
    const layers = [
      { buf: blurry, size: 38, spacing: 20, alpha: 0.82, len: 1.9, hueJ: 18, lumJ: 0.09, broken: 0.26, minEdge: 0 },
      { buf: soft, size: 22, spacing: 12, alpha: 0.86, len: 2.0, hueJ: 16, lumJ: 0.09, broken: 0.3, minEdge: 0 },
      { buf: soft, size: 12, spacing: 7, alpha: 0.9, len: 2.1, hueJ: 12, lumJ: 0.07, broken: 0.24, minEdge: 0.15 },
    ];

    // 붓터치 목록을 만들고 층마다 순서를 섞어 겹칩니다
    const byLayer = layers.map(() => []);
    layers.forEach((L, li) => {
      const sp = L.spacing * unit;
      for (let y = -sp; y < H + sp; y += sp) for (let x = -sp; x < W + sp; x += sp) {
        const px = x + (rand() - 0.5) * sp * 1.5, py = y + (rand() - 0.5) * sp * 1.5;
        const f = flow(px, py);
        if (f.edge < L.minEdge && rand() > 0.22) continue;
        byLayer[li].push({ li, x: px, y: py, f, k: rand() });
      }
      byLayer[li].sort((a, b) => a.k - b.k);
    });
    // 빛 조각 — 밝은 곳에만 드문드문
    const dabs = [];
    const dsp = 9 * unit;
    for (let y = 0; y < H; y += dsp) for (let x = 0; x < W; x += dsp) {
      const px = x + (rand() - 0.5) * dsp * 2, py = y + (rand() - 0.5) * dsp * 2;
      const [r, g, b] = sample(soft, px, py);
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (rand() < (l - 0.66) * 0.9) dabs.push({ x: px, y: py, f: flow(px, py) });
    }
    const ordered = byLayer.flat();
    const total = ordered.length + dabs.length;

    // 붓자국 하나: 끝이 둥글고 살짝 휜 두툼한 획 + 물감이 묻은 밝은 결
    function stroke(x, y, ang, size, len, color, alpha, ridge) {
      const [r, g, b] = color;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${clamp(r) | 0},${clamp(g) | 0},${clamp(b) | 0})`;
      const bend = (rand() - 0.5) * size * 0.9;
      const hw = size / 2, hl = len / 2;
      ctx.beginPath();
      ctx.moveTo(-hl, -hw * 0.35);
      ctx.bezierCurveTo(-hl * 0.4, -hw * 1.1 + bend, hl * 0.5, -hw + bend, hl, -hw * 0.15 + bend * 0.3);
      ctx.quadraticCurveTo(hl + hw * 0.5, bend * 0.2, hl * 0.8, hw * 0.5 + bend * 0.3);
      ctx.bezierCurveTo(hl * 0.3, hw * 1.05 + bend, -hl * 0.5, hw + bend, -hl, hw * 0.4);
      ctx.quadraticCurveTo(-hl - hw * 0.45, 0, -hl, -hw * 0.35);
      ctx.fill();
      if (ridge) {
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = `rgb(${clamp(r + 30) | 0},${clamp(g + 28) | 0},${clamp(b + 22) | 0})`;
        ctx.beginPath();
        ctx.ellipse(-hl * 0.1, -hw * 0.3 + bend * 0.5, hl * 0.62, hw * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.22;
        ctx.fillStyle = `rgb(${clamp(r - 34) | 0},${clamp(g - 34) | 0},${clamp(b - 20) | 0})`;
        ctx.beginPath();
        ctx.ellipse(hl * 0.1, hw * 0.45 + bend * 0.6, hl * 0.55, hw * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const CHUNK = 1800;
    let done = 0;
    for (let n = 0; n < ordered.length; n += CHUNK) {
      const end = Math.min(ordered.length, n + CHUNK);
      for (let s = n; s < end; s++) {
        const st = ordered[s], L = layers[st.li];
        const [r0, g0, b0] = sample(L.buf, st.x, st.y);
        const color = strokeColor(r0, g0, b0, rand, L);
        const size = L.size * unit * (0.7 + rand() * 0.6) * (1 - st.f.edge * 0.4);
        const len = size * L.len * (0.8 + rand() * 0.6);
        const ang = st.f.ang + (rand() - 0.5) * (0.35 + (1 - st.f.edge) * 0.35);
        stroke(st.x, st.y, ang, size, len, color, L.alpha * (0.78 + rand() * 0.22), rand() < 0.45);
      }
      done = end;
      progress(done / total);
      await new Promise((res) => requestAnimationFrame(res));
    }
    for (const d of dabs) {
      const c = LIGHT_DABS[Math.floor(rand() * LIGHT_DABS.length)];
      const size = 9 * unit * (0.7 + rand() * 0.7);
      stroke(d.x, d.y, d.f.ang + (rand() - 0.5) * 0.6, size, size * (1.4 + rand()), c, 0.35 + rand() * 0.3, false);
    }

    // 아지랑이 — 작게 줄였다 키워 번진 사본을 은은하게 겹침
    const haze = document.createElement('canvas');
    haze.width = Math.max(1, Math.round(W / 10)); haze.height = Math.max(1, Math.round(H / 10));
    const hctx = haze.getContext('2d');
    hctx.imageSmoothingQuality = 'high';
    hctx.drawImage(canvas, 0, 0, haze.width, haze.height);
    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.16;
    ctx.drawImage(haze, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.1;
    ctx.drawImage(haze, 0, 0, W, H);
    ctx.restore();

    // 캔버스 결
    const tex = document.createElement('canvas');
    const ts = 160; tex.width = ts; tex.height = ts;
    const tctx = tex.getContext('2d');
    const td = tctx.createImageData(ts, ts);
    for (let y = 0; y < ts; y++) for (let x = 0; x < ts; x++) {
      const i = (y * ts + x) * 4;
      const weave = (Math.sin(x * 1.9) + Math.sin(y * 1.9)) * 16;
      const v = 128 + weave + (rand() - 0.5) * 36;
      td.data[i] = td.data[i + 1] = td.data[i + 2] = v; td.data[i + 3] = 255;
    }
    tctx.putImageData(td, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = ctx.createPattern(tex, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 은은한 빛 — 가운데는 따뜻하게, 가장자리는 보랏빛으로
    ctx.save();
    const glow = ctx.createRadialGradient(W * 0.5, H * 0.42, Math.min(W, H) * 0.15, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    glow.addColorStop(0, 'rgba(255,240,214,0.16)');
    glow.addColorStop(1, 'rgba(120,108,170,0.2)');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    progress(1);
    return canvas;
  }

  root.GraceMonet = { paint };
})(window);
