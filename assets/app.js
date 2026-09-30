// Loads the CSV files in /data and renders one section per tab.
(function () {
  const REGIONS = [
    { id: "HK", zh: "香港", en: "Hong Kong", color: "--s-hk" },
    { id: "TW", zh: "台灣", en: "Taiwan", color: "--s-tw" },
    { id: "MO", zh: "澳門", en: "Macau", color: "--s-mo" },
  ];
  const TABS = ["overview", "suicide", "services", "surveys", "sources"];
  const state = { lang: "en", tab: "overview", measure: "crude_rate", shown: new Set(REGIONS.map(r => r.id)) };
  let DATA = null;

  try { const l = localStorage.getItem("atlas-lang"); if (l === "zh" || l === "en") state.lang = l; } catch (e) {}

  const t = k => (I18N[state.lang] && I18N[state.lang][k]) || I18N.en[k] || k;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const region = id => REGIONS.find(r => r.id === id);
  const regionName = id => state.lang === "zh" ? region(id).zh : region(id).en;
  const num = v => Number(v).toLocaleString(state.lang === "zh" ? "zh-TW" : "en");
  const one = v => Number(v).toFixed(1);

  // Quote-aware CSV parser returning an array of objects keyed by the header row.
  function parseCSV(text) {
    const rows = []; let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') q = false;
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some(f => f !== "")) rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); if (row.some(f => f !== "")) rows.push(row); }
    const head = rows.shift();
    return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
  }

  async function load() {
    const names = ["suicide", "services", "surveys", "sources"];
    const texts = await Promise.all(names.map(n => fetch(`data/${n}.csv`).then(r => { if (!r.ok) throw new Error(n); return r.text(); })));
    const d = {};
    names.forEach((n, i) => { d[n] = parseCSV(texts[i]); });
    d.sourceById = Object.fromEntries(d.sources.map(s => [s.source_id, s]));
    return d;
  }

  const srcLink = id => {
    const s = DATA.sourceById[id];
    return s ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(id);
  };
  const dot = id => `<span class="dot" style="background:var(${region(id).color})"></span>`;

  // Headline: the latest all-ages crude rate per region.
  function latestRates() {
    return REGIONS.map(R => {
      const rows = DATA.suicide.filter(d => d.region === R.id && d.sex === "all" && d.age_group === "all" && d.measure === "crude_rate");
      rows.sort((a, b) => b.year - a.year);
      return { R, row: rows[0] };
    });
  }

  function tilesHTML() {
    return `<div class="tiles">${latestRates().map(({ R, row }) => row ? `
      <div class="tile">
        <div class="who">${dot(R.id)}${regionName(R.id)} <span class="zh">${state.lang === "zh" ? R.en : R.zh}</span></div>
        <div class="big">${one(row.value)}<em>${t("per100k")}, ${row.year}</em></div>
        <span class="pill">${row.estimate === "yes" ? t("estimated") : t("published")}</span>
        <div class="meta">${srcLink(row.source_id)}</div>
      </div>` : "").join("")}</div>`;
  }

  function trendPanelHTML() {
    return `<section class="panel">
      <div><h2>${t("trend_title")}</h2><p class="sub" id="trend-sub"></p></div>
      <div class="bar">
        <div class="legend">${REGIONS.map(R => `<label for="lg-${R.id}"><input type="checkbox" id="lg-${R.id}" data-region="${R.id}" ${state.shown.has(R.id) ? "checked" : ""}>${dot(R.id)}${regionName(R.id)}</label>`).join("")}</div>
        <div class="seg" role="group" aria-label="${t("col_measure")}">
          <button type="button" data-measure="crude_rate" aria-pressed="${state.measure === "crude_rate"}">${t("rate")}</button>
          <button type="button" data-measure="deaths" aria-pressed="${state.measure === "deaths"}">${t("deaths")}</button>
        </div>
      </div>
      <div class="chartwrap" id="trend"></div>
      <p class="note">${t("trend_note")}</p>
    </section>`;
  }

  function drawTrend() {
    const wrap = document.getElementById("trend");
    if (!wrap) return;
    const m = state.measure;
    document.getElementById("trend-sub").textContent = m === "deaths" ? t("trend_sub_deaths") : t("trend_sub_rate");
    const rows = DATA.suicide.filter(d => d.sex === "all" && d.age_group === "all" && d.measure === m);
    const years = rows.map(d => +d.year);
    const series = REGIONS.filter(R => state.shown.has(R.id)).map(R => ({
      id: R.id, label: regionName(R.id), color: R.color,
      points: rows.filter(d => d.region === R.id).map(d => ({ x: +d.year, y: +d.value, est: d.estimate === "yes" })),
    }));
    Charts.lineChart(wrap, {
      series, xMin: Math.min(...years) - 1, xMax: Math.max(...years) + 1,
      fmt: (v, axis) => m === "deaths" ? num(Math.round(v)) : (axis ? String(+v.toFixed(1)) : one(v)),
      estLabel: t("est"), noFigure: t("no_figure"), aria: t("trend_title"),
    });
  }

  function bindTrend() {
    document.querySelectorAll("[data-region]").forEach(i => i.addEventListener("change", e => {
      e.target.checked ? state.shown.add(e.target.dataset.region) : state.shown.delete(e.target.dataset.region);
      drawTrend();
    }));
    document.querySelectorAll("[data-measure]").forEach(b => b.addEventListener("click", () => {
      state.measure = b.dataset.measure;
      document.querySelectorAll("[data-measure]").forEach(x => x.setAttribute("aria-pressed", x === b));
      drawTrend();
    }));
    drawTrend();
  }

  function factsFor(regionId) {
    const svc = DATA.services.filter(d => d.region === regionId && d.highlight === "yes").map(d => ({
      v: num(d.value), k: `${t(d.indicator)} · ${esc(d.group)}`, s: `${esc(d.period)} · ${srcLink(d.source_id)}`,
    }));
    const srv = DATA.surveys.filter(d => d.region === regionId).slice(0, 2).map(d => ({
      v: d.unit === "%" ? `${d.value}%` : d.value, k: esc(d.indicator), s: `${esc(d.survey)}, ${esc(d.year)} · ${srcLink(d.source_id)}`,
    }));
    return [...svc, ...srv];
  }

  function regionCardsHTML(pick) {
    return `<div class="regions">${REGIONS.map(R => {
      const items = pick(R.id);
      return `<div class="panel"><h3>${dot(R.id)} ${regionName(R.id)}</h3>
        <ul class="facts">${items.map(f => `<li><span class="v">${f.v}</span><span class="k">${f.k}</span><span class="s">${f.s}</span></li>`).join("")}</ul></div>`;
    }).join("")}</div>`;
  }

  const views = {
    overview() {
      return `<section><p class="lead">${t("overview_lead")}</p></section>
        <section><div><h2>${t("latest_rate")}</h2><p class="sub">${t("latest_rate_sub")}</p></div>${tilesHTML()}</section>
        ${trendPanelHTML()}
        <section><h2>${t("highlights")}</h2>${regionCardsHTML(factsFor)}</section>`;
    },
    suicide() {
      const breakdown = DATA.suicide.filter(d => d.sex !== "all" || d.age_group !== "all" || d.measure === "age_std_rate");
      const all = [...DATA.suicide].sort((a, b) => b.year - a.year || a.region.localeCompare(b.region));
      return `<section><p class="lead">${t("suicide_lead")}</p></section>
        ${trendPanelHTML()}
        <section><h2>${t("breakdowns")}</h2>${table(["col_region", "col_year", "col_group", "col_measure", "col_value", "col_source"], breakdown.map(d => [
          regionName(d.region), d.year, `${t(d.sex)} · ${esc(d.age_group)}`, t(d.measure), valueCell(d), srcLink(d.source_id)]))}</section>
        <section><h2>${t("all_figures")}</h2>${table(["col_region", "col_year", "col_measure", "col_value", "col_note", "col_source"], all.filter(d => d.sex === "all" && d.age_group === "all").map(d => [
          regionName(d.region), d.year, t(d.measure), valueCell(d), esc(d.note), srcLink(d.source_id)]))}</section>`;
    },
    services() {
      const hk = DATA.services.filter(d => d.region === "HK" && d.indicator === "psychiatric_new_cases");
      return `<section><p class="lead">${t("services_lead")}</p></section>
        <section class="panel"><div><h2>${t("services_hk_chart")}</h2><p class="sub">${t("services_hk_chart_sub")}</p></div><div class="chartwrap" id="hk-bars"></div></section>
        ${REGIONS.map(R => `<section><h2>${dot(R.id)} ${regionName(R.id)}</h2>${table(["col_period", "col_indicator", "col_group", "col_value", "col_note", "col_source"],
          DATA.services.filter(d => d.region === R.id).map(d => [esc(d.period), t(d.indicator), esc(d.group), `<span class="num">${num(d.value)}</span>`, esc(d.note), srcLink(d.source_id)]), [3])}</section>`).join("")}`;
    },
    surveys() {
      return `<section><p class="lead">${t("surveys_lead")}</p></section>
        ${REGIONS.map(R => `<section><h2>${dot(R.id)} ${regionName(R.id)}</h2>${table(["col_year", "col_survey", "col_population", "col_sample", "col_indicator", "col_value", "col_source"],
          DATA.surveys.filter(d => d.region === R.id).map(d => [esc(d.year), esc(d.survey), esc(d.population), `<span class="num">${num(d.sample)}</span>`, esc(d.indicator) + (d.note ? `<br><span class="est">${esc(d.note)}</span>` : ""), `<span class="num">${d.unit === "%" ? d.value + "%" : d.value}</span>`, srcLink(d.source_id)]), [3, 5])}</section>`).join("")}`;
    },
    sources() {
      return `<section><p class="lead">${t("sources_lead")}</p>${table(["col_region", "col_type", "col_source", "col_licence", "col_cadence"],
        DATA.sources.map(s => [regionName(s.region), `<span class="type">${t(s.type)}</span>`, srcLink(s.source_id), esc(s.licence), esc(s.cadence)]))}</section>`;
    },
  };

  function valueCell(d) {
    const v = d.measure === "deaths" ? num(d.value) : one(d.value);
    return `<span class="num">${v}</span>${d.estimate === "yes" ? ` <span class="est">${t("est")}</span>` : ""}`;
  }

  function table(cols, rows, rightCols = []) {
    return `<div class="tablewrap"><table><thead><tr>${cols.map((c, i) => `<th${rightCols.includes(i) ? ' class="r"' : ""}>${t(c)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${rightCols.includes(i) ? ' class="r"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function applyStaticText() {
    document.documentElement.lang = state.lang === "zh" ? "zh-Hant" : "en";
    document.querySelectorAll("[data-i18n]").forEach(e => { e.innerHTML = t(e.dataset.i18n); });
    document.getElementById("lang").textContent = t("lang_button");
    document.title = t("title");
  }

  function render() {
    applyStaticText();
    document.querySelectorAll(".tabs a").forEach(a => { if (a.dataset.tab === state.tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    const app = document.getElementById("app");
    if (!DATA) return;
    app.innerHTML = views[state.tab]();
    if (document.getElementById("trend")) bindTrend();
    const bars = document.getElementById("hk-bars");
    if (bars) Charts.barChart(bars, {
      bars: DATA.services.filter(d => d.region === "HK" && d.indicator === "psychiatric_new_cases").map(d => ({ label: d.period, value: +d.value })),
      color: "--s-hk", fmt: num, aria: t("services_hk_chart"),
    });
  }

  function route() {
    const h = location.hash.replace("#", "");
    state.tab = TABS.includes(h) ? h : "overview";
    render();
  }

  document.getElementById("lang").addEventListener("click", () => {
    state.lang = state.lang === "en" ? "zh" : "en";
    try { localStorage.setItem("atlas-lang", state.lang); } catch (e) {}
    render();
  });
  window.addEventListener("hashchange", route);
  let resizeTimer, lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);

  applyStaticText();
  load().then(d => { DATA = d; route(); }).catch(() => {
    document.getElementById("app").innerHTML = `<p class="loading">${t("load_error")}</p>`;
  });
})();
