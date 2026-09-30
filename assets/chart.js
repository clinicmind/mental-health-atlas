// Small dependency-free SVG charts: line, vertical bar, horizontal bar and sparkline.
// Every chart sizes itself to its container and reads colours from the page's CSS tokens.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const css = v => (v && v.startsWith("--") ? getComputedStyle(document.documentElement).getPropertyValue(v).trim() : v);

  function niceMax(v) {
    const steps = [1, 2, 2.5, 5];
    let mag = Math.pow(10, Math.floor(Math.log10(v || 1)));
    for (;;) {
      for (const s of steps) { const n = s * mag; if (v <= n * 5) return Math.ceil(v / n) * n; }
      mag *= 10;
    }
  }

  function el(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  function txt(x, y, s, anchor, cls) {
    return el("text", { x, y, "text-anchor": anchor || "start", class: cls }, s);
  }

  function makeTip(wrap) {
    const tip = document.createElement("div");
    tip.className = "tip"; tip.hidden = true;
    wrap.append(tip);
    return {
      show(ev, html) {
        tip.innerHTML = html; tip.hidden = false;
        const r = wrap.getBoundingClientRect();
        let left = ev.clientX - r.left + 14;
        if (left + 210 > r.width) left = ev.clientX - r.left - 220;
        tip.style.left = Math.max(0, left) + "px";
        tip.style.top = Math.max(0, ev.clientY - r.top - 24) + "px";
      },
      hide() { tip.hidden = true; },
    };
  }

  function width(wrap) { return Math.max(300, Math.round(wrap.clientWidth || 860)); }

  // opts: { series: [{id, label, color, points: [{x, y, est}]}], fmt, xMin, xMax, estLabel, noFigure, aria, height }
  function lineChart(wrap, opts) {
    wrap.innerHTML = "";
    const W = width(wrap), H = opts.height || (W < 600 ? 260 : 320), m = { t: 16, r: 48, b: 32, l: 44 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.aria || "" });
    wrap.append(svg);
    const tip = makeTip(wrap);
    const all = opts.series.flatMap(s => s.points);
    if (!all.length) return;
    const x0 = opts.xMin, x1 = opts.xMax;
    const ymax = niceMax(Math.max(...all.map(p => p.y)) * 1.1);
    const X = x => m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r);
    const Y = v => H - m.b - v / ymax * (H - m.t - m.b);
    const fmt = opts.fmt || (v => String(v));
    for (let i = 0; i <= 4; i++) {
      const v = ymax / 4 * i;
      svg.append(el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: "gl" }));
      svg.append(txt(m.l - 8, Y(v) + 4, fmt(v, true), "end"));
    }
    const stepX = Math.ceil((x1 - x0) / (W < 600 ? 5 : 11));
    for (let x = Math.ceil(x0); x <= Math.floor(x1); x += stepX) svg.append(txt(X(x), H - 10, x, "middle"));
    const surface = css("--surface");
    opts.series.forEach(s => {
      const pts = [...s.points].sort((a, b) => a.x - b.x);
      const col = css(s.color);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        svg.append(el("line", { x1: X(a.x), y1: Y(a.y), x2: X(b.x), y2: Y(b.y), stroke: col, "stroke-width": 2.5, "stroke-linecap": "round", "stroke-dasharray": b.x - a.x > 1 ? "4 5" : null }));
      }
      pts.forEach((p, i) => svg.append(el("circle", { cx: X(p.x), cy: Y(p.y), r: i === pts.length - 1 ? 5 : 3.5, fill: p.est ? surface : col, stroke: col, "stroke-width": 2 })));
      if (pts.length) {
        const p = pts[pts.length - 1];
        svg.append(txt(X(p.x) + 9, Y(p.y) + 4, fmt(p.y), "start", "lbl"));
      }
    });
    const xh = el("line", { x1: 0, x2: 0, y1: m.t, y2: H - m.b, class: "xh", visibility: "hidden" });
    const hit = el("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" });
    svg.append(xh, hit);
    const hide = () => { tip.hide(); xh.setAttribute("visibility", "hidden"); };
    hit.addEventListener("pointermove", ev => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const x = Math.round(x0 + (p.x - m.l) / (W - m.l - m.r) * (x1 - x0));
      const rows = opts.series.map(s => ({ s, p: s.points.find(q => q.x === x) }));
      if (!rows.some(r => r.p)) return hide();
      xh.setAttribute("x1", X(x)); xh.setAttribute("x2", X(x)); xh.setAttribute("visibility", "visible");
      tip.show(ev, `<b>${x}</b>` + rows.map(r => `<div><span class="l"><span class="dot" style="background:${css(r.s.color)}"></span>${r.s.label}</span><span class="num">${r.p ? fmt(r.p.y) + (r.p.est ? " " + (opts.estLabel || "est.") : "") : (opts.noFigure || "–")}</span></div>`).join(""));
    });
    hit.addEventListener("pointerleave", hide);
  }

  // opts: { bars: [{label, value, color?, note?, group?}], color, fmt, aria, height, emphasizeLast }
  function barChart(wrap, opts) {
    wrap.innerHTML = "";
    const W = width(wrap), H = opts.height || 220, m = { t: 22, r: 8, b: 30, l: 8 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.aria || "" });
    wrap.append(svg);
    const tip = makeTip(wrap);
    const bars = opts.bars;
    if (!bars.length) return;
    const ymax = niceMax(Math.max(...bars.map(b => b.value)) * 1.08);
    const n = bars.length, band = (W - m.l - m.r) / n, bw = Math.max(6, Math.min(64, band * 0.7));
    const Y = v => H - m.b - v / ymax * (H - m.t - m.b);
    const fmt = opts.fmt || (v => v.toLocaleString());
    const showEvery = Math.ceil(n / Math.max(1, Math.floor((W - m.l - m.r) / 44)));
    const valueEvery = band < 46 ? Math.ceil(46 / band) : 1;
    svg.append(el("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: "axis" }));
    bars.forEach((b, i) => {
      const cx = m.l + band * i + band / 2, y = Y(b.value), h = H - m.b - y, r = Math.min(3, h);
      const x0 = cx - bw / 2, x1 = cx + bw / 2;
      const col = css(b.color || opts.color);
      const faded = opts.emphasizeLast && i !== n - 1;
      const path = el("path", { d: `M${x0},${H - m.b} V${y + r} Q${x0},${y} ${x0 + r},${y} H${x1 - r} Q${x1},${y} ${x1},${y + r} V${H - m.b} Z`, fill: col, opacity: faded ? 0.55 : 1 });
      svg.append(path);
      const nearLast = i !== n - 1 && n - 1 - i < Math.max(valueEvery, band < 40 ? 2 : 1);
      if ((i % valueEvery === 0 && !nearLast) || i === n - 1) svg.append(txt(cx, y - 6, fmt(b.value), "middle", "lbl"));
      const nearLastLabel = i !== n - 1 && n - 1 - i < showEvery;
      if ((i % showEvery === 0 && !nearLastLabel) || i === n - 1) svg.append(txt(cx, H - 10, b.label, "middle"));
      const hit = el("rect", { x: m.l + band * i, y: m.t, width: band, height: H - m.t - m.b, fill: "transparent" });
      hit.addEventListener("pointermove", ev => tip.show(ev, `<b>${b.label}</b><div><span class="num">${fmt(b.value)}</span></div>${b.note ? `<div class="tn">${b.note}</div>` : ""}`));
      hit.addEventListener("pointerleave", () => tip.hide());
      svg.append(hit);
    });
  }

  // opts: { rows: [{label, value, color, sub?, badge?}], fmt, max?, aria }
  function hbarChart(wrap, opts) {
    wrap.innerHTML = "";
    const W = width(wrap), narrow = W < 560;
    const labelW = narrow ? 0 : Math.min(260, W * 0.36);
    const rowH = narrow ? 50 : 34, m = { t: 4, r: 56, b: 4 };
    const H = m.t + m.b + rowH * opts.rows.length;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.aria || "" });
    wrap.append(svg);
    const tip = makeTip(wrap);
    const max = opts.max || niceMax(Math.max(...opts.rows.map(r => r.value)));
    const fmt = opts.fmt || (v => v.toLocaleString());
    const x0 = labelW + 8, span = W - x0 - m.r;
    opts.rows.forEach((row, i) => {
      const top = m.t + rowH * i;
      const barY = narrow ? top + 24 : top + 8, bh = 16;
      const lab = txt(narrow ? 0 : labelW, narrow ? top + 16 : top + 21, row.label, narrow ? "start" : "end", "hl");
      svg.append(lab);
      const w = Math.max(2, row.value / max * span);
      svg.append(el("rect", { x: x0, y: barY, width: span, height: bh, rx: 3, class: "track" }));
      svg.append(el("rect", { x: x0, y: barY, width: w, height: bh, rx: 3, fill: css(row.color) }));
      svg.append(txt(x0 + w + 6, barY + 12, fmt(row.value), "start", "lbl"));
      const hit = el("rect", { x: 0, y: top, width: W, height: rowH, fill: "transparent" });
      hit.addEventListener("pointermove", ev => tip.show(ev, `<b>${row.label}</b><div><span class="num">${fmt(row.value)}</span></div>${row.sub ? `<div class="tn">${row.sub}</div>` : ""}`));
      hit.addEventListener("pointerleave", () => tip.hide());
      svg.append(hit);
    });
  }

  // A tiny trend line for stat tiles. points: [{x, y}]
  function sparkline(wrap, points, color) {
    wrap.innerHTML = "";
    if (points.length < 2) return;
    const W = 160, H = 40, pad = 4;
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys) * 0.95, ymax = Math.max(...ys) * 1.02;
    const X = x => pad + (x - xmin) / (xmax - xmin || 1) * (W - pad * 2);
    const Y = y => H - pad - (y - ymin) / (ymax - ymin || 1) * (H - pad * 2);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "spark", "aria-hidden": "true" });
    const d = points.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
    const col = css(color);
    svg.append(el("path", { d: `${d} L${X(xmax)},${H} L${X(xmin)},${H} Z`, fill: col, opacity: 0.12 }));
    svg.append(el("path", { d, fill: "none", stroke: col, "stroke-width": 2, "stroke-linejoin": "round" }));
    const last = points[points.length - 1];
    svg.append(el("circle", { cx: X(last.x), cy: Y(last.y), r: 3, fill: col }));
    wrap.append(svg);
  }

  window.Charts = { lineChart, barChart, hbarChart, sparkline };
})();
