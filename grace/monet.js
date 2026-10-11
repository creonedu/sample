/*
 * 은혜의 순간 — 모네 풍 인상주의 필터
 *
 * 서버나 AI 없이 휴대폰 안에서 사진을 그림으로 바꿉니다.
 *   1) 사진을 부드럽게 흐리고, 모네 특유의 빛(밝은 곳은 따뜻한 크림·분홍,
 *      그늘은 보라·푸른빛)으로 색을 옮깁니다.
 *   2) 밑그림을 깔고, 큰 붓 → 중간 붓 → 작은 붓 순서로 짧은 붓터치를 겹칩니다.
 *      붓 방향은 사진의 윤곽을 따라가고, 평평한 곳은 물결처럼 흐릅니다.
 *   3) 마지막으로 캔버스 결을 살짝 입힙니다.
 * 그리는 과정을 화면에 조금씩 보여 주기 위해 onProgress 로 진행률을 알립니다.
 */
(function (root) {
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  // 작은 시드 난수 — 같은 사진은 '다시 그리기' 전까지 같은 그림이 나오도록
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

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

  // 모네의 빛: 밝게, 대비는 부드럽게, 그늘엔 보랏빛, 빛엔 따뜻한 크림색
  function grade(r, g, b) {
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // 채도 살짝 올리기
    const m = (r + g + b) / 3;
    r = m + (r - m) * 1.18; g = m + (g - m) * 1.18; b = m + (b - m) * 1.18;
    // 대비 낮추고 전체를 들어 올림
    r = 40 + r * 0.82; g = 40 + g * 0.82; b = 44 + b * 0.82;
    // 그늘 → 보라·청색, 빛 → 크림·복숭아
    const sh = Math.max(0, 0.55 - l) / 0.55, hi = Math.max(0, l - 0.55) / 0.45;
    r += sh * 10 + hi * 14; g += sh * -4 + hi * 8; b += sh * 30 - hi * 6;
    return [clamp(r), clamp(g), clamp(b)];
  }

  // 그늘·중간·빛에 섞일 모네 팔레트
  const PALETTE = {
    dark: [[92, 88, 150], [70, 96, 130], [110, 86, 128]],
    mid: [[150, 172, 196], [176, 196, 160], [196, 170, 196], [214, 196, 150]],
    light: [[250, 236, 200], [248, 214, 206], [236, 240, 214], [214, 228, 240]],
  };

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
    const aScale = Math.min(1, 480 / Math.max(W, H));
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
    const soft = boxBlur(src, aw, ah, 1);
    const blurry = boxBlur(src, aw, ah, 4);

    // 붓 방향(윤곽선)과 디테일 정도
    const lum = new Float32Array(aw * ah);
    for (let i = 0; i < aw * ah; i++) lum[i] = 0.299 * soft[i * 3] + 0.587 * soft[i * 3 + 1] + 0.114 * soft[i * 3 + 2];
    const gx = new Float32Array(aw * ah), gy = new Float32Array(aw * ah);
    for (let y = 1; y < ah - 1; y++) for (let x = 1; x < aw - 1; x++) {
      const i = y * aw + x;
      gx[i] = (lum[i - aw + 1] + 2 * lum[i + 1] + lum[i + aw + 1]) - (lum[i - aw - 1] + 2 * lum[i - 1] + lum[i + aw - 1]);
      gy[i] = (lum[i + aw - 1] + 2 * lum[i + aw] + lum[i + aw + 1]) - (lum[i - aw - 1] + 2 * lum[i - aw] + lum[i - aw + 1]);
    }
    // 방향장을 부드럽게 (이중 각도로 평균)
    const dir = new Float32Array(aw * ah * 3);
    for (let i = 0; i < aw * ah; i++) {
      const a = gx[i] * gx[i] - gy[i] * gy[i], b = 2 * gx[i] * gy[i];
      dir[i * 3] = a; dir[i * 3 + 1] = b; dir[i * 3 + 2] = Math.hypot(gx[i], gy[i]);
    }
    const sdir = boxBlur(dir, aw, ah, 3);

    const sample = (buf, x, y) => {
      const ax = Math.min(aw - 1, Math.max(0, Math.round(x * aScale)));
      const ay = Math.min(ah - 1, Math.max(0, Math.round(y * aScale)));
      const i = (ay * aw + ax) * 3;
      return [buf[i], buf[i + 1], buf[i + 2]];
    };
    const flow = (x, y) => {
      const [a, b, mag] = sample(sdir, x, y);
      // 윤곽이 약한 곳은 잔잔한 물결 방향
      const wave = Math.sin(x / W * 5.2 + y / H * 2.1) * 0.5 + Math.cos(y / H * 4.3) * 0.35;
      if (mag < 18) return { ang: wave * 0.6, edge: mag / 18 };
      return { ang: 0.5 * Math.atan2(b, a) + Math.PI / 2, edge: Math.min(1, mag / 120) };
    };

    // 밑그림
    const under = document.createElement('canvas'); under.width = aw; under.height = ah;
    const uctx = under.getContext('2d');
    const ud = uctx.createImageData(aw, ah);
    for (let i = 0, j = 0; i < ud.data.length; i += 4, j += 3) {
      ud.data[i] = blurry[j]; ud.data[i + 1] = blurry[j + 1]; ud.data[i + 2] = blurry[j + 2]; ud.data[i + 3] = 255;
    }
    uctx.putImageData(ud, 0, 0);
    ctx.fillStyle = '#f4efe6'; ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(under, 0, 0, W, H);

    const unit = Math.max(W, H) / 1000; // 1000px 기준 붓 크기 단위
    const layers = [
      { buf: blurry, size: 30, spacing: 17, alpha: 0.8, len: 2.0, jitter: 34, mix: 0.24, minEdge: 0 },
      { buf: soft, size: 17, spacing: 10, alpha: 0.85, len: 2.2, jitter: 30, mix: 0.2, minEdge: 0 },
      { buf: soft, size: 8.5, spacing: 5.5, alpha: 0.9, len: 2.4, jitter: 20, mix: 0.12, minEdge: 0.2 },
    ];

    // 붓터치 목록을 만들고 순서를 섞어 겹칩니다
    const strokes = [];
    layers.forEach((L, li) => {
      const sp = L.spacing * unit;
      for (let y = 0; y < H + sp; y += sp) for (let x = 0; x < W + sp; x += sp) {
        const px = x + (rand() - 0.5) * sp * 1.4, py = y + (rand() - 0.5) * sp * 1.4;
        const f = flow(px, py);
        if (f.edge < L.minEdge && rand() > 0.15) continue;
        strokes.push({ li, x: px, y: py, f, k: rand() });
      }
    });
    const byLayer = [[], [], []];
    strokes.forEach((s) => byLayer[s.li].push(s));
    byLayer.forEach((arr) => arr.sort((a, b) => a.k - b.k));
    const ordered = byLayer.flat();

    const total = ordered.length;
    const CHUNK = 2200;
    for (let n = 0; n < total; n += CHUNK) {
      const end = Math.min(total, n + CHUNK);
      for (let s = n; s < end; s++) {
        const st = ordered[s], L = layers[st.li];
        let [r, g, b] = sample(L.buf, st.x, st.y);
        const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const pal = l < 0.38 ? PALETTE.dark : l > 0.72 ? PALETTE.light : PALETTE.mid;
        const pc = pal[Math.floor(rand() * pal.length)];
        const mix = L.mix * (0.4 + rand());
        r = r * (1 - mix) + pc[0] * mix; g = g * (1 - mix) + pc[1] * mix; b = b * (1 - mix) + pc[2] * mix;
        const j = L.jitter;
        r += (rand() - 0.5) * j; g += (rand() - 0.5) * j; b += (rand() - 0.5) * j;
        const size = L.size * unit * (0.7 + rand() * 0.6) * (1 - st.f.edge * 0.35);
        const len = size * L.len * (0.8 + rand() * 0.5);
        const ang = st.f.ang + (rand() - 0.5) * 0.9;

        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.rotate(ang);
        ctx.globalAlpha = L.alpha * (0.75 + rand() * 0.25);
        ctx.fillStyle = `rgb(${clamp(r) | 0},${clamp(g) | 0},${clamp(b) | 0})`;
        // 끝이 둥근 짧은 붓자국 (살짝 휘어짐)
        const bend = (rand() - 0.5) * size * 0.8;
        ctx.beginPath();
        ctx.moveTo(-len / 2, 0);
        ctx.quadraticCurveTo(0, -size / 2 + bend, len / 2, 0);
        ctx.quadraticCurveTo(0, size / 2 + bend, -len / 2, 0);
        ctx.fill();
        // 물감이 묻은 듯한 밝은 결 한 줄
        if (rand() < 0.35) {
          ctx.globalAlpha *= 0.45;
          ctx.fillStyle = `rgb(${clamp(r + 26) | 0},${clamp(g + 24) | 0},${clamp(b + 18) | 0})`;
          ctx.beginPath();
          ctx.ellipse(0, -size * 0.15, len * 0.38, size * 0.14, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      progress(end / total);
      await new Promise((res) => requestAnimationFrame(res));
    }

    // 캔버스 결 + 은은한 빛
    const tex = document.createElement('canvas');
    const ts = 160; tex.width = ts; tex.height = ts;
    const tctx = tex.getContext('2d');
    const td = tctx.createImageData(ts, ts);
    for (let y = 0; y < ts; y++) for (let x = 0; x < ts; x++) {
      const i = (y * ts + x) * 4;
      const weave = (Math.sin(x * 1.9) + Math.sin(y * 1.9)) * 18;
      const v = 128 + weave + (rand() - 0.5) * 40;
      td.data[i] = td.data[i + 1] = td.data[i + 2] = v; td.data[i + 3] = 255;
    }
    tctx.putImageData(td, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = ctx.createPattern(tex, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    const glow = ctx.createRadialGradient(W * 0.5, H * 0.4, Math.min(W, H) * 0.2, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    glow.addColorStop(0, 'rgba(255,244,222,0.10)');
    glow.addColorStop(1, 'rgba(120,110,160,0.14)');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    progress(1);
    return canvas;
  }

  root.GraceMonet = { paint };
})(window);
