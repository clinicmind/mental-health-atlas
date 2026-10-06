// Loads the CSV files in /data and renders one chart-led section per tab.
(function () {
  const REGIONS = [
    { id: "HK", zh: "香港", en: "Hong Kong", color: "--s-hk" },
    { id: "TW", zh: "台灣", en: "Taiwan", color: "--s-tw" },
    { id: "MO", zh: "澳門", en: "Macau", color: "--s-mo" },
  ];
  const TABS = ["overview", "suicide", "services", "surveys", "sources"];
  const TYPE_COLOR = { government: "--t-gov", ngo: "--t-ngo", academic: "--t-aca", news: "--t-news" };
  const state = { lang: "zh", tab: "overview", measure: "crude_rate", shown: new Set(REGIONS.map(r => r.id)), srcType: "all" };
  let DATA = null;

  try { const l = localStorage.getItem("atlas-lang"); if (l === "zh" || l === "en") state.lang = l; } catch (e) {}

  const t = k => (I18N[state.lang] && I18N[state.lang][k]) || I18N.en[k] || k;
  const tl = s => (state.lang === "zh" && I18N.labels[s]) || s; // data label translation
  const zh = (d, k) => (state.lang === "zh" && d[k + "_zh"]) || d[k] || ""; // prefer the *_zh column in Chinese
  const per = p => state.lang === "zh" ? String(p).replace(" to ", " 至 ") : p;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const region = id => REGIONS.find(r => r.id === id);
  const rname = id => state.lang === "zh" ? region(id).zh : region(id).en;
  const num = v => Number(v).toLocaleString(state.lang === "zh" ? "zh-TW" : "en");
  const one = v => Number(v).toFixed(1);
  const dot = color => `<span class="dot" style="background:var(${color})"></span>`;

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
    const names = ["suicide", "suicide_quarterly", "services", "surveys", "sources"];
    const texts = await Promise.all(names.map(n => fetch(`data/${n}.csv`).then(r => { if (!r.ok) throw new Error(n); return r.text(); })));
    const d = {};
    names.forEach((n, i) => { d[n] = parseCSV(texts[i]); });
    // Optional: monthly news-report counts from scripts/fetch_hkspd.py. The site works without it.
    try { const r = await fetch("data/hk_press_monthly.csv"); d.hk_press = r.ok ? parseCSV(await r.text()) : []; } catch (e) { d.hk_press = []; }
    d.sourceById = Object.fromEntries(d.sources.map(s => [s.source_id, s]));
    return d;
  }

  const src = id => DATA.sourceById[id] || { name: id, url: "#", type: "" };
  const srcLink = id => { const s = src(id); return `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(zh(s, "name"))}</a>`; };
  const srcBadge = id => { const s = src(id); return s.type ? `<span class="type t-${s.type}">${t(s.type)}</span>` : ""; };
  const cite = ids => `<p class="cite">${t("source_label")}：${[...new Set(ids)].map(i => `${srcBadge(i)} ${srcLink(i)}`).join("；")}</p>`;

  const suicide = (f) => DATA.suicide.filter(d => Object.entries(f).every(([k, v]) => d[k] === v));
  const overall = (r, m) => suicide({ region: r, sex: "all", age_group: "all", measure: m }).map(d => ({ ...d, y: +d.value, x: +d.year })).sort((a, b) => a.x - b.x);

  // ---------- building blocks ----------
  function card(id, title, sub, body, note) {
    return `<section class="panel chart-card">
      <div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ""}</div>
      ${body || `<div class="chartwrap" id="${id}"></div>`}
      ${note || ""}
    </section>`;
  }

  function tilesHTML() {
    return `<div class="tiles">${REGIONS.map(R => {
      const series = overall(R.id, "crude_rate");
      const last = series[series.length - 1];
      if (!last) return "";
      const prev = series[series.length - 2];
      const delta = prev ? last.y - prev.y : null;
      return `<div class="tile" style="--c:var(${R.color})">
        <div class="who">${dot(R.color)}${rname(R.id)}</div>
        <div class="big">${one(last.y)}<em>${t("per100k")} · ${last.x}</em></div>
        <div class="sparkwrap" data-spark="${R.id}"></div>
        <div class="meta">${delta != null ? `<span class="delta ${delta > 0 ? "up" : "down"}">${delta > 0 ? "▲" : "▼"} ${one(Math.abs(delta))}</span> ${t("vs")} ${prev.x}` : ""}
        ${last.estimate === "yes" ? `<span class="pill">${t("estimated")}</span>` : ""}</div>
      </div>`;
    }).join("")}</div>`;
  }

  function drawSparks() {
    document.querySelectorAll("[data-spark]").forEach(w => {
      const R = region(w.dataset.spark);
      Charts.sparkline(w, overall(R.id, "crude_rate").filter(p => p.x >= 2012), R.color);
    });
  }

  function trendCard() {
    return `<section class="panel chart-card">
      <div><h2>${t("trend_title")}</h2><p class="sub" id="trend-sub"></p></div>
      <div class="bar">
        <div class="legend">${REGIONS.map(R => `<label for="lg-${R.id}"><input type="checkbox" id="lg-${R.id}" data-region="${R.id}" ${state.shown.has(R.id) ? "checked" : ""}>${dot(R.color)}${rname(R.id)}</label>`).join("")}</div>
        <div class="seg" role="group" aria-label="${t("measure")}">
          ${["crude_rate", "age_std_rate", "deaths"].map(m => `<button type="button" data-measure="${m}" aria-pressed="${state.measure === m}">${t("m_" + m)}</button>`).join("")}
        </div>
      </div>
      <div class="chartwrap" id="trend"></div>
      <p class="note">${t("trend_note")}</p>
      <div id="trend-cite"></div>
    </section>`;
  }

  function drawTrend() {
    const wrap = document.getElementById("trend");
    if (!wrap) return;
    const m = state.measure;
    document.getElementById("trend-sub").textContent = t("trend_sub_" + m);
    const series = REGIONS.filter(R => state.shown.has(R.id)).map(R => ({
      id: R.id, label: rname(R.id), color: R.color,
      points: overall(R.id, m).filter(p => p.x >= 2012).map(p => ({ x: p.x, y: p.y, est: p.estimate === "yes" })),
    })).filter(s => s.points.length);
    const ids = REGIONS.flatMap(R => overall(R.id, m).filter(p => p.x >= 2012 && state.shown.has(R.id)).map(p => p.source_id));
    Charts.lineChart(wrap, {
      series, xMin: 2012, xMax: 2026,
      fmt: (v, axis) => m === "deaths" ? num(Math.round(v)) : (axis ? String(+v.toFixed(1)) : one(v)),
      estLabel: t("est"), noFigure: t("no_figure"), aria: t("trend_title"),
    });
    document.getElementById("trend-cite").innerHTML = cite(ids);
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

  function details(summary, inner) {
    return `<details class="data"><summary>${summary}</summary>${inner}</details>`;
  }

  function table(cols, rows, right = []) {
    return `<div class="tablewrap"><table><thead><tr>${cols.map((c, i) => `<th${right.includes(i) ? ' class="r"' : ""}>${t(c)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${right.includes(i) ? ' class="r"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  const valueCell = d => `<span class="num">${d.measure === "deaths" || d.measure === "attempt_notifications" ? num(d.value) : one(d.value)}</span>${d.estimate === "yes" ? ` <span class="est">${t("est")}</span>` : ""}`;

  // ---------- chart data helpers ----------
  const quarterBars = () => DATA.suicide_quarterly.map(q => ({ label: `${q.year} Q${q.quarter}`, value: +q.deaths, color: "--s-mo", note: esc(zh(q, "note")) }));
  const hkNewCases = () => DATA.services.filter(d => d.region === "HK" && d.indicator === "psychiatric_new_cases");
  const twNotif = () => overall("TW", "attempt_notifications");

  function surveyRows(regionId) {
    return DATA.surveys.filter(d => (!regionId || d.region === regionId) && d.unit === "%").map(d => ({
      label: `${regionId ? "" : rname(d.region) + " · "}${tl(d.indicator)}`,
      value: +d.value, color: `--m-${d.method}`,
      sub: `${esc(tl(d.survey))} · ${esc(d.year)} · n=${num(d.sample)} · ${t("method_" + d.method)}`,
      source: d.source_id,
    }));
  }

  // ---------- views ----------
  const views = {
    overview() {
      const pct = twNotif();
      const growth = pct.length > 1 ? Math.round((pct[pct.length - 1].y / pct[0].y - 1) * 100) : 0;
      return `<p class="lead">${t("overview_lead")}</p>
        <section><div class="sec-head"><h2>${t("latest_rate")}</h2><p class="sub">${t("latest_rate_sub")}</p></div>${tilesHTML()}</section>
        ${trendCard()}
        <div class="grid3">
          ${card("ov-tw", t("tw_notif_title"), t("tw_notif_sub").replace("{g}", growth), null, cite(pct.map(p => p.source_id)))}
          ${card("ov-mo", t("mo_q_title"), t("mo_q_sub"), null, cite(DATA.suicide_quarterly.map(q => q.source_id)))}
          ${card("ov-hk", t("hk_cases_title"), t("hk_cases_sub"), null, cite(hkNewCases().map(d => d.source_id)))}
        </div>
        ${card("ov-surveys", t("survey_title"), t("survey_sub"), `<div class="legend static">${["diagnostic", "screening"].map(m => `<span>${dot("--m-" + m)}${t("method_" + m)}</span>`).join("")}</div><div class="chartwrap" id="ov-surveys"></div>`, cite(DATA.surveys.filter(d => d.unit === "%").map(d => d.source_id)))}`;
    },
    suicide() {
      const moAnnual = overall("MO", "deaths");
      const all = [...DATA.suicide].sort((a, b) => b.year - a.year || a.region.localeCompare(b.region));
      return `<p class="lead">${t("suicide_lead")}</p>
        ${trendCard()}
        <div class="grid2">
          ${card("hk-groups", t("hk_groups_title"), t("hk_groups_sub"), null, cite(["csrp_2022"]))}
          ${card("hk-youth", t("hk_youth_title"), t("hk_youth_sub"), null, cite(suicide({ region: "HK", age_group: "15-24" }).map(d => d.source_id)))}
        </div>
        <div class="grid2">
          ${card("tw-deaths", t("tw_deaths_title"), t("tw_deaths_sub"), null, cite(["mohw_suicide"]))}
          ${card("tw-notif", t("tw_notif_title"), t("tw_notif_sub2"), null, cite(["mohw_suicide"]))}
        </div>
        <div class="grid2">
          ${card("mo-annual", t("mo_annual_title"), t("mo_annual_sub"), null, cite(moAnnual.map(d => d.source_id)))}
          ${card("mo-quarter", t("mo_q_title"), t("mo_q_sub"), null, cite(DATA.suicide_quarterly.map(q => q.source_id)))}
          ${DATA.hk_press.length ? card("hk-press", t("hk_press_title"), t("hk_press_sub"), null, cite(["hkspd"]) + `<p class="note">${t("hkspd_use_1")}</p>`) : ""}
        </div>
        ${details(t("all_figures"), table(["col_region", "col_year", "col_group", "col_measure", "col_value", "col_note", "col_source"], all.map(d => [
          rname(d.region), d.year, `${t(d.sex)} · ${tl(d.age_group)}`, t("m_" + d.measure), valueCell(d), esc(zh(d, "note")), `${srcBadge(d.source_id)} ${srcLink(d.source_id)}`]), [4]))}`;
    },
    services() {
      return `<p class="lead">${t("services_lead")}</p>
        <div class="grid2">
          ${card("hk-cases", t("hk_cases_title"), t("hk_cases_sub"), null, cite(hkNewCases().map(d => d.source_id)))}
          ${card("hk-wait", t("hk_wait_title"), t("hk_wait_sub"), null, cite(["legco_2025_10"]))}
        </div>
        <div class="grid2">
          ${card("hk-att", t("hk_att_title"), t("hk_att_sub"), null, cite(["legco_2025_10"]))}
        </div>
        <div class="grid2">
          ${card("tw-cap", t("tw_cap_title"), t("tw_cap_sub"), null, cite(["udn_mohw_2026"]))}
          ${card("hotlines", t("hotline_title"), t("hotline_sub"), `<div class="stats">
            ${DATA.services.filter(d => d.indicator === "hotline_calls").map(d => `<div class="stat"><span class="big">${num(d.value)}</span><span class="k">${dot(region(d.region).color)} ${rname(d.region)} · ${esc(tl(d.group))}</span><span class="s">${esc(per(d.period))}${d.note ? " · " + esc(zh(d, "note")) : ""}</span></div>`).join("")}
            ${DATA.services.filter(d => d.indicator === "people_treated").map(d => `<div class="stat"><span class="big">${num(d.value)}</span><span class="k">${dot(region(d.region).color)} ${rname(d.region)} · ${t("people_treated")}</span><span class="s">${esc(per(d.period))}</span></div>`).join("")}
          </div>`, cite(DATA.services.filter(d => d.indicator === "hotline_calls" || d.indicator === "people_treated").map(d => d.source_id)))}
        </div>
        <p class="note gap">${t("mo_services_gap")}</p>
        ${details(t("all_figures"), table(["col_region", "col_period", "col_indicator", "col_group", "col_value", "col_note", "col_source"],
          DATA.services.map(d => [rname(d.region), esc(per(d.period)), t(d.indicator), esc(tl(d.group)), `<span class="num">${num(d.value)}</span>`, esc(zh(d, "note")), `${srcBadge(d.source_id)} ${srcLink(d.source_id)}`]), [4]))}`;
    },
    surveys() {
      return `<p class="lead">${t("surveys_lead")}</p>
        <div class="legend static">${["diagnostic", "screening"].map(m => `<span>${dot("--m-" + m)}${t("method_" + m)}</span>`).join("")}</div>
        ${REGIONS.map(R => surveyRows(R.id).length ? card("sv-" + R.id, `${dot(R.color)} ${rname(R.id)}`, t("survey_region_sub"), null, cite(surveyRows(R.id).map(r => r.source))) : "").join("")}
        ${details(t("all_figures"), table(["col_region", "col_year", "col_survey", "col_population", "col_sample", "col_indicator", "col_value", "col_source"],
          DATA.surveys.map(d => [rname(d.region), esc(d.year), esc(tl(d.survey)), esc(tl(d.population)), `<span class="num">${num(d.sample)}</span>`, `${esc(tl(d.indicator))}<br><span class="est">${t("method_" + d.method)}</span>`, `<span class="num">${d.unit === "%" ? d.value + "%" : d.value}</span>`, `${srcBadge(d.source_id)} ${srcLink(d.source_id)}`]), [4, 6]))}`;
    },
    sources() {
      const types = ["government", "ngo", "academic", "news"];
      const counts = Object.fromEntries(types.map(ty => [ty, DATA.sources.filter(s => s.type === ty).length]));
      const news = DATA.sources.filter(s => s.type === "news" && s.published).sort((a, b) => b.published.localeCompare(a.published));
      const list = DATA.sources.filter(s => state.srcType === "all" || s.type === state.srcType);
      return `<p class="lead">${t("sources_lead")}</p>
        ${card("src-mix", t("src_mix_title"), t("src_mix_sub").replace("{n}", DATA.sources.length), `<div class="stack">${types.map(ty => `<span style="flex:${counts[ty]};background:var(${TYPE_COLOR[ty]})" title="${t(ty)} ${counts[ty]}"></span>`).join("")}</div>
          <div class="legend static">${types.map(ty => `<span>${dot(TYPE_COLOR[ty])}${t(ty)} <b class="num">${counts[ty]}</b></span>`).join("")}</div>`)}
        <section class="panel">
          <div><h2>${t("news_title")}</h2><p class="sub">${t("news_sub")}</p></div>
          <ol class="timeline">${news.map(s => `<li><span class="when num">${esc(s.published)}</span>${dot(region(s.region).color)}<span>${srcLink(s.source_id)}</span></li>`).join("")}</ol>
          <p class="note">${t("hkspd_note")} <a href="https://hkspd.siuyeong.com/" target="_blank" rel="noopener">hkspd.siuyeong.com</a></p>
          <div class="panel"><h3>${t("hkspd_use_title")}</h3><p class="note">${t("hkspd_use_1")}</p><p class="note">${t("hkspd_use_2")}</p><p class="note">${t("hkspd_use_3")}</p></div>
        </section>
        <section class="panel">
          <div class="bar"><h2>${t("all_sources")}</h2>
            <div class="seg" role="group" aria-label="${t("col_type")}">${["all", ...types].map(ty => `<button type="button" data-srctype="${ty}" aria-pressed="${state.srcType === ty}">${t(ty === "all" ? "all_types" : ty)}</button>`).join("")}</div>
          </div>
          ${table(["col_region", "col_type", "col_source", "col_date", "col_licence", "col_cadence"], list.map(s => [rname(s.region), srcBadge(s.source_id), srcLink(s.source_id), `<span class="num">${esc(s.published)}</span>`, esc(tl(s.licence)), esc(tl(s.cadence))]))}
        </section>`;
    },
  };

  function afterRender() {
    drawSparks();
    if (document.getElementById("trend")) bindTrend();
    const has = id => document.getElementById(id);
    const twN = twNotif();
    if (has("ov-tw")) Charts.barChart(has("ov-tw"), { bars: twN.map(p => ({ label: String(p.x), value: p.y })), color: "--s-tw", fmt: num, emphasizeLast: true, aria: t("tw_notif_title") });
    if (has("tw-notif")) Charts.barChart(has("tw-notif"), { bars: twN.map(p => ({ label: String(p.x), value: p.y })), color: "--s-tw", fmt: num, emphasizeLast: true, aria: t("tw_notif_title") });
    ["ov-mo", "mo-quarter"].forEach(id => has(id) && Charts.barChart(has(id), { bars: quarterBars(), color: "--s-mo", fmt: num, emphasizeLast: true, aria: t("mo_q_title") }));
    ["ov-hk", "hk-cases"].forEach(id => has(id) && Charts.barChart(has(id), { bars: hkNewCases().map(d => ({ label: d.period, value: +d.value, note: esc(zh(d, "note")) })), color: "--s-hk", fmt: num, emphasizeLast: true, aria: t("hk_cases_title") }));
    if (has("ov-surveys")) Charts.hbarChart(has("ov-surveys"), { rows: surveyRows(), max: 100, fmt: v => v + "%", aria: t("survey_title") });
    REGIONS.forEach(R => has("sv-" + R.id) && Charts.hbarChart(has("sv-" + R.id), { rows: surveyRows(R.id), max: 100, fmt: v => v + "%" }));
    if (has("hk-groups")) {
      const groups = [["men_60", "male", "60+"], ["men", "male", "all"], ["women_60", "female", "60+"], ["youth", "all", "15-24"], ["women", "female", "all"], ["under15", "all", "under 15"]];
      Charts.hbarChart(has("hk-groups"), { rows: groups.map(([k, sex, age]) => { const d = suicide({ region: "HK", year: "2021", sex, age_group: age, measure: "crude_rate" })[0]; return d && { label: t("g_" + k), value: +d.value, color: "--s-hk" }; }).filter(Boolean), fmt: one });
    }
    if (has("hk-youth")) {
      const pts = suicide({ region: "HK", sex: "all", age_group: "15-24", measure: "crude_rate" }).map(d => ({ x: +d.year, y: +d.value }));
      Charts.lineChart(has("hk-youth"), { series: [{ id: "HK", label: t("g_youth"), color: "--s-hk", points: pts }], xMin: 2011, xMax: Math.max(...pts.map(p => p.x)) + 1, fmt: (v, a) => a ? String(+v.toFixed(1)) : one(v), height: 220 });
    }
    if (has("tw-deaths")) Charts.barChart(has("tw-deaths"), { bars: overall("TW", "deaths").map(p => ({ label: String(p.x), value: p.y })), color: "--s-tw", fmt: num, emphasizeLast: true });
    if (has("mo-annual")) Charts.barChart(has("mo-annual"), { bars: overall("MO", "deaths").map(p => ({ label: String(p.x), value: p.y, note: esc(zh(p, "note")) })), color: "--s-mo", fmt: num, emphasizeLast: true });
    if (has("tw-cap")) Charts.hbarChart(has("tw-cap"), { rows: DATA.services.filter(d => d.region === "TW" && ["psychiatric_beds", "rehab_places"].includes(d.indicator)).map(d => ({ label: `${t(d.indicator)} · ${tl(d.group)}`, value: +d.value, color: "--s-tw", sub: esc(zh(d, "note")) })), fmt: num });
    if (has("hk-press")) {
      const byMonth = {};
      DATA.hk_press.forEach(r => { byMonth[r.month] = (byMonth[r.month] || 0) + (+r.reports || 0); });
      const months = Object.keys(byMonth).sort().slice(-24);
      Charts.barChart(has("hk-press"), { bars: months.map(m => ({ label: m, value: byMonth[m] })), color: "--s-hk", fmt: num, emphasizeLast: true, aria: t("hk_press_title") });
    }
    if (has("hk-att")) Charts.barChart(has("hk-att"), { bars: DATA.services.filter(d => d.region === "HK" && d.indicator === "psychiatric_attendances").map(d => ({ label: d.period, value: +d.value })), color: "--s-hk", fmt: num, emphasizeLast: true, aria: t("hk_att_title") });
    if (has("hk-wait")) Charts.hbarChart(has("hk-wait"), { rows: DATA.services.filter(d => d.region === "HK" && d.indicator === "routine_wait_weeks").map(d => ({ label: tl(d.group), value: +d.value, color: "--s-hk", sub: esc(zh(d, "note")) })), fmt: v => `${v} ${t("weeks")}` });
    document.querySelectorAll("[data-srctype]").forEach(b => b.addEventListener("click", () => { state.srcType = b.dataset.srctype; render(); }));
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
    if (!DATA) return;
    document.getElementById("app").innerHTML = views[state.tab]();
    afterRender();
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
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  applyStaticText();
  load().then(d => { DATA = d; route(); }).catch(() => {
    document.getElementById("app").innerHTML = `<p class="loading">${t("load_error")}</p>`;
  });
})();
