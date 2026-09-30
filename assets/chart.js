// Small dependency-free SVG charts: a line chart with gaps and estimates, and a vertical bar chart.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

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
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  // opts: { series: [{id, label, color, points: [{x, y, est}]}], fmt, xMin, xMax, tipTitle }
  function lineChart(wrap, opts) {
    wrap.innerHTML = "";
    const W = Math.max(320, Math.round(wrap.clientWidth || 860)), H = W < 600 ? 260 : 320, m = { t: 16, r: 48, b: 32, l: 44 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.aria || "Line chart" });
    const tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true;
    wrap.append(svg, tip);
    const all = opts.series.flatMap(s => s.points);
    if (!all.length) return;
    const x0 = opts.xMin, x1 = opts.xMax;
    const ymax = niceMax(Math.max(...all.map(p => p.y)) * 1.1);
    const X = x => m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r);
    const Y = v => H - m.b - v / ymax * (H - m.t - m.b);
    const fmt = opts.fmt || (v => String(v));
    for (let i = 0; i <= 5; i++) {
      const v = ymax / 5 * i;
      svg.append(el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: css("--grid"), "stroke-width": 1 }));
      svg.append(el("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" }, fmt(v, true)));
    }
    const stepX = W < 600 ? 2 : 1;
    for (let x = Math.ceil(x0); x <= Math.floor(x1); x += stepX) svg.append(el("text", { x: X(x), y: H - 10, "text-anchor": "middle" }, x));
    const surface = css("--surface");
    opts.series.forEach(s => {
      const pts = [...s.points].sort((a, b) => a.x - b.x);
      const col = css(s.color);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const attrs = { x1: X(a.x), y1: Y(a.y), x2: X(b.x), y2: Y(b.y), stroke: col, "stroke-width": 2, "stroke-linecap": "round", fill: "none" };
        if (b.x - a.x > 1) attrs["stroke-dasharray"] = "4 5";
        svg.append(el("line", attrs));
      }
      pts.forEach((p, i) => svg.append(el("circle", { cx: X(p.x), cy: Y(p.y), r: i === pts.length - 1 ? 5 : 4, fill: p.est ? surface : col, stroke: col, "stroke-width": 2 })));
      if (pts.length) {
        const p = pts[pts.length - 1];
        const t = el("text", { x: X(p.x) + 10, y: Y(p.y) + 4 }, fmt(p.y));
        t.style.fill = css("--ink-2");
        svg.append(t);
      }
    });
    const xh = el("line", { x1: 0, x2: 0, y1: m.t, y2: H - m.b, stroke: css("--ink-3"), "stroke-width": 1, "stroke-dasharray": "2 3", visibility: "hidden" });
    const hit = el("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" });
    svg.append(xh, hit);
    const hide = () => { tip.hidden = true; xh.setAttribute("visibility", "hidden"); };
    hit.addEventListener("pointermove", ev => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const x = Math.round(x0 + (p.x - m.l) / (W - m.l - m.r) * (x1 - x0));
      const rows = opts.series.map(s => ({ s, p: s.points.find(q => q.x === x) }));
      if (!rows.some(r => r.p)) return hide();
      xh.setAttribute("x1", X(x)); xh.setAttribute("x2", X(x)); xh.setAttribute("visibility", "visible");
      tip.innerHTML = `<b>${x}</b>` + rows.map(r => `<div><span class="l"><span class="dot" style="background:var(${r.s.color})"></span>${r.s.label}</span><span class="num">${r.p ? fmt(r.p.y) + (r.p.est ? " " + (opts.estLabel || "est.") : "") : (opts.noFigure || "no figure")}</span></div>`).join("");
      tip.hidden = false;
      const r = wrap.getBoundingClientRect();
      let left = ev.clientX - r.left + 14;
      if (left + 200 > r.width) left = ev.clientX - r.left - 210;
      tip.style.left = Math.max(0, left) + "px";
      tip.style.top = Math.max(0, ev.clientY - r.top - 20) + "px";
    });
    hit.addEventListener("pointerleave", hide);
  }

  // opts: { bars: [{label, value}], color, fmt }
  function barChart(wrap, opts) {
    wrap.innerHTML = "";
    const W = Math.max(320, Math.round(wrap.clientWidth || 860)), H = 240, m = { t: 24, r: 16, b: 32, l: 16 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.aria || "Bar chart" });
    wrap.append(svg);
    const ymax = niceMax(Math.max(...opts.bars.map(b => b.value)) * 1.1);
    const n = opts.bars.length, band = (W - m.l - m.r) / n, bw = Math.min(120, band * 0.5);
    const Y = v => H - m.b - v / ymax * (H - m.t - m.b);
    const col = css(opts.color);
    const fmt = opts.fmt || (v => v.toLocaleString());
    svg.append(el("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, stroke: css("--line"), "stroke-width": 1 }));
    opts.bars.forEach((b, i) => {
      const cx = m.l + band * i + band / 2, y = Y(b.value), h = H - m.b - y, r = Math.min(4, h);
      const path = `M${cx - bw / 2},${H - m.b} V${y + r} Q${cx - bw / 2},${y} ${cx - bw / 2 + r},${y} H${cx + bw / 2 - r} Q${cx + bw / 2},${y} ${cx + bw / 2},${y + r} V${H - m.b} Z`;
      const bar = el("path", { d: path, fill: col });
      bar.append(el("title", {}, `${b.label}: ${fmt(b.value)}`));
      svg.append(bar);
      const v = el("text", { x: cx, y: y - 8, "text-anchor": "middle" }, fmt(b.value));
      v.style.fill = css("--ink-2");
      svg.append(v, el("text", { x: cx, y: H - 10, "text-anchor": "middle" }, b.label));
    });
  }

  window.Charts = { lineChart, barChart };
})();
