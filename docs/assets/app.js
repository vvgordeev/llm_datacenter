/* LLM Radar — дашборд (дизайн Neural Radar, ADR-6).
   Статический SPA: дневные JSON — единственный источник, срезы
   Неделя/Месяц считаются на клиенте (инвариант 5 architecture.md). */

"use strict";

// ---------- i18n: все строки интерфейса только отсюда (инвариант 2) ----------
const I18N = {
  ru: {
    logo_sub: "сводка новостей LLM", live: "обновлено",
    tab_radar: "Радар дня", tab_experts: "Эксперты · статьи и видео",
    tagline: "ежедневная разведка мира LLM",
    demo_banner: "⚠ Демо-данные для макета. Реальная сводка появится после первого запуска пайплайна /digest.",
    radar_title: "Радар нововведений", radar_sub: "ранжировано по масштабу инновации",
    experts_title: "Эксперты", experts_sub: "конспекты статей и видео с раскрытием методов",
    view_day: "День", view_week: "Неделя", view_month: "Месяц",
    stat_news: "новостей", stat_impact: "макс. impact", stat_clusters: "сюжетов", stat_experts: "конспектов",
    tier_critical: "Парадигма", tier_high: "Мажор", tier_medium: "Заметно", tier_low: "Минор",
    details: "Мнения и кейсы", source: "Источник",
    note_link: "Конспект", original_link: "Оригинал ↗",
    type_article: "Статья", type_video: "Видео",
    impact: "Impact", empty: "Нет данных за период", empty_filtered: "Нет новостей по выбранным фильтрам",
    all_models: "Все модели",
    footer: "LLM Radar · обновляется ежедневно в 08:00 GMT+3 · ", footer_repo: "репозиторий"
  },
  en: {
    logo_sub: "LLM news digest", live: "updated",
    tab_radar: "Daily radar", tab_experts: "Experts · articles & videos",
    tagline: "daily intelligence on the LLM landscape",
    demo_banner: "⚠ Demo data for the mockup. A real digest will appear after the first /digest pipeline run.",
    radar_title: "Innovation radar", radar_sub: "ranked by innovation scale",
    experts_title: "Experts", experts_sub: "article & video digests that unpack the methods",
    view_day: "Day", view_week: "Week", view_month: "Month",
    stat_news: "news items", stat_impact: "max impact", stat_clusters: "stories", stat_experts: "digests",
    tier_critical: "Paradigm", tier_high: "Major", tier_medium: "Notable", tier_low: "Minor",
    details: "Opinions & use cases", source: "Source",
    note_link: "Digest", original_link: "Original ↗",
    type_article: "Article", type_video: "Video",
    impact: "Impact", empty: "No data for this period", empty_filtered: "No news for the selected filters",
    all_models: "All models",
    footer: "LLM Radar · updated daily at 08:00 GMT+3 · ", footer_repo: "repository"
  }
};

// Вендоры: имя + фирменный цвет (токены в style.css); ключи = tag из config/sources.yaml
const VENDORS = {
  anthropic: ["Anthropic", "var(--vendor-anthropic)"], openai: ["OpenAI", "var(--vendor-openai)"],
  google: ["Google", "var(--vendor-google)"], meta: ["Meta", "var(--vendor-meta)"],
  xai: ["xAI", "var(--vendor-xai)"], mistral: ["Mistral", "var(--vendor-mistral)"],
  deepseek: ["DeepSeek", "var(--vendor-deepseek)"], qwen: ["Qwen", "var(--vendor-qwen)"],
  tencent: ["Tencent", "var(--vendor-tencent)"]
};
const TOP_N = { week: 10, month: 15 };

// ---------- состояние ----------
const state = {
  lang: localStorage.getItem("lang") || "ru",
  theme: localStorage.getItem("theme") || "dark",
  view: "day",
  pageTab: "radar",
  date: null,
  filters: new Set(JSON.parse(localStorage.getItem("modelFilters") || "[]")),
  index: null,
  cache: new Map()
};
const t = (k) => (I18N[state.lang] && I18N[state.lang][k]) || k;
const loc = (f) => (f && (f[state.lang] || f.ru || f.en)) || "";
const esc = (s) => String(s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- данные ----------
async function loadIndex() {
  const res = await fetch("data/index.json");
  state.index = await res.json();
  state.index.days.sort((a, b) => b.date.localeCompare(a.date));
}
async function loadDay(date) {
  if (state.cache.has(date)) return state.cache.get(date);
  try {
    const res = await fetch(`data/daily/${date}.json`);
    if (!res.ok) return null;
    const d = await res.json();
    state.cache.set(date, d);
    return d;
  } catch { return null; }
}
function datesInPeriod(endDate, days) {
  const end = new Date(endDate + "T00:00:00Z"), start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return state.index.days.map(d => d.date).filter(date => {
    const dt = new Date(date + "T00:00:00Z");
    return dt >= start && dt <= end;
  });
}

// ---------- агрегация срезов (сквозной паттерн architecture.md) ----------
function aggregate(dayJsons, topN) {
  const byCluster = new Map();
  for (const day of dayJsons) {
    for (const item of day.news) {
      const key = item.cluster_id || item.id, prev = byCluster.get(key);
      if (!prev || item.impact_score > prev.impact_score ||
          (item.impact_score === prev.impact_score && day.date > prev._date))
        byCluster.set(key, { ...item, _date: day.date });
    }
  }
  return [...byCluster.values()]
    .sort((a, b) => b.impact_score - a.impact_score || b._date.localeCompare(a._date))
    .slice(0, topN);
}
function collectExperts(dayJsons) {
  const seen = new Set(), out = [];
  for (const day of dayJsons) {
    for (const e of day.expert_content || []) {
      if (!seen.has(e.id)) { seen.add(e.id); out.push({ ...e, _date: day.date }); }
    }
  }
  return out;
}
const tierOf = (s) => s >= 9 ? "critical" : s >= 7 ? "high" : s >= 4 ? "medium" : "low";
const tierBadge = { critical: "danger", high: "warning", medium: "info", low: "muted" };

// ---------- рендер ----------
function newsCard(item, i, showDate) {
  const tier = tierOf(item.impact_score);
  const vendor = (item.models || [])[0];
  const [vName, vColor] = VENDORS[vendor] || [vendor || "", "var(--color-text-secondary)"];
  const firstOp = (item.opinions || [])[0];
  const restOps = (item.opinions || []).slice(1);
  const quote = firstOp ? `
    <div class="quote-block">«${esc(loc(firstOp.quote))}»
      <div class="quote-author">— <a href="${esc(firstOp.url)}" target="_blank" rel="noopener">${esc(firstOp.author)}</a></div>
    </div>` : "";
  const detailRows = [
    ...restOps.map(o => `<div class="detail-item"><span class="stance ${esc(o.stance || "neutral")}">●</span>
      <b>${esc(o.author)}:</b> ${esc(loc(o.quote))} <a href="${esc(o.url)}" target="_blank" rel="noopener">↗</a></div>`),
    ...(item.use_cases || []).map(u => `<div class="detail-item">▸ ${esc(loc(u.text))} <a href="${esc(u.url)}" target="_blank" rel="noopener">↗</a></div>`)
  ].join("");
  const details = detailRows ? `<details><summary>${t("details")}</summary>${detailRows}</details>` : "";
  return `
  <article class="card tier-${tier}">
    <div class="card-header">
      <span class="card-tag ${tierBadge[tier]}">${t("tier_" + tier)}</span>
      <span class="rank-vendor">
        ${vName ? `<span class="vendor-chip" style="--vendor-c:${vColor}">${esc(vName)}</span>` : ""}
        <span class="priority-rank">${String(i + 1).padStart(2, "0")}</span>
      </span>
    </div>
    <h3 class="card-title"><a href="${esc(item.source_url)}" target="_blank" rel="noopener">${esc(loc(item.title))}</a></h3>
    <p class="card-text">${esc(loc(item.summary))}</p>
    <div class="impact-reason">${esc(loc(item.impact_reason))}</div>
    ${quote}${details}
    <div class="impact-row">
      <span class="impact-label">${t("impact")}</span>
      <div class="impact-bar"><div class="impact-fill" style="width:${item.impact_score * 10}%"></div></div>
      <span class="impact-value">${item.impact_score}.0</span>
    </div>
    <div class="card-footer">
      <span class="card-source"><a href="${esc(item.source_url)}" target="_blank" rel="noopener">${t("source")} ↗</a></span>
      <span>${showDate ? item._date : ""}</span>
    </div>
  </article>`;
}

function expertCard(e) {
  const cover = e.cover
    ? `<div class="expert-cover"><img src="${esc(e.cover)}" alt="" loading="lazy"></div>`
    : `<div class="expert-cover"><div class="type-glyph">${e.type === "video" ? "▶" : "¶"}</div></div>`;
  return `
  <article class="card tier-medium">
    ${cover}
    <div class="card-header" style="margin-bottom:8px">
      <span class="card-tag ${e.type === "video" ? "violet" : "info"}">${t("type_" + e.type)}</span>
      <span class="expert-meta">${esc(e.author)} · ${e._date || ""}</span>
    </div>
    <h3 class="card-title">${esc(loc(e.title))}</h3>
    <p class="card-text">${esc(loc(e.summary))}</p>
    <div class="expert-links">
      ${e.note_page ? `<a href="${esc(e.note_page)}">${t("note_link")} →</a>` : ""}
      <a href="${esc(e.url)}" target="_blank" rel="noopener">${t("original_link")}</a>
    </div>
  </article>`;
}

function renderChrome() {
  document.documentElement.setAttribute("data-theme", state.theme);
  document.documentElement.lang = state.lang;
  document.getElementById("lang-toggle").textContent = state.lang.toUpperCase();
  document.querySelectorAll("[data-i18n]").forEach(el => el.textContent = t(el.getAttribute("data-i18n")));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === state.pageTab));
  document.querySelectorAll(".pill").forEach(b => b.classList.toggle("active", b.dataset.view === state.view));
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + state.pageTab));
  // селектор даты виден всегда: в «Дне» — выбор дня, в «Неделе»/«Месяце» — конец периода
  const sel = document.getElementById("date-select");
  sel.innerHTML = state.index.days.map(d =>
    `<option value="${d.date}" ${d.date === state.date ? "selected" : ""}>${d.date}</option>`).join("");
}

async function renderLiveMeta() {
  // дата и время последнего обновления — generated_at свежайшего дневного файла.
  // Показывается в московском времени (GMT+3) с явной пометкой: расписание
  // пайплайна задано в этом поясе, а пояс браузера зрителя может быть любым.
  const newest = state.index.days[0];
  if (!newest) return;
  const day = await loadDay(newest.date);
  if (!day || !day.generated_at) return;
  const dt = new Date(day.generated_at);
  const formatted = dt.toLocaleString(
    state.lang === "ru" ? "ru-RU" : "en-GB",
    { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Moscow" }
  );
  document.getElementById("live-meta").textContent =
    `${formatted} ${state.lang === "ru" ? "МСК" : "MSK"}`;
}

function renderFilters(allModels) {
  const chips = [...allModels].sort().map(m => {
    const [name, color] = VENDORS[m] || [m, "var(--color-brand-cyan)"];
    return `<button class="model-chip ${state.filters.has(m) ? "active" : ""}" data-model="${esc(m)}"
      style="--vendor-c:${color}">${esc(name)}</button>`;
  });
  document.getElementById("model-filters").innerHTML = `
    <button class="model-chip ${state.filters.size === 0 ? "active" : ""}" data-model="">${t("all_models")}</button>` +
    chips.join("");
}

async function render() {
  renderChrome();
  renderLiveMeta();
  let dates;
  if (state.view === "day") dates = [state.date];
  else if (state.view === "week") dates = datesInPeriod(state.date, 7);
  else dates = datesInPeriod(state.date, 30);
  const dayJsons = (await Promise.all(dates.map(loadDay))).filter(Boolean);

  document.getElementById("demo-banner").hidden = !dayJsons.some(d => d.demo);

  let items;
  if (state.view === "day")
    items = dayJsons.length ? dayJsons[0].news.map(n => ({ ...n, _date: dayJsons[0].date }))
      .sort((a, b) => b.impact_score - a.impact_score) : [];
  else items = aggregate(dayJsons, TOP_N[state.view]);
  const experts = collectExperts(dayJsons);

  const clusters = new Set(items.map(i => i.cluster_id || i.id)).size;
  const maxImpact = items.length ? Math.max(...items.map(i => i.impact_score)) : 0;
  document.getElementById("hero-stats").innerHTML = [
    [items.length, t("stat_news")], [maxImpact || "—", t("stat_impact")],
    [clusters, t("stat_clusters")], [experts.length, t("stat_experts")]
  ].map(([v, l]) => `<div class="hero-stat"><div class="hero-stat-value">${v}</div><div class="hero-stat-label">${l}</div></div>`).join("");

  renderFilters(new Set(items.flatMap(i => i.models || [])));
  const visible = state.filters.size
    ? items.filter(i => (i.models || []).some(m => state.filters.has(m)))
    : items;

  const grid = document.getElementById("news-grid");
  if (!dayJsons.length) grid.innerHTML = `<div class="empty-note">${t("empty")}</div>`;
  else if (!visible.length) grid.innerHTML = `<div class="empty-note">${t("empty_filtered")}</div>`;
  else grid.innerHTML = visible.map((it, i) => newsCard(it, i, state.view !== "day")).join("");

  document.getElementById("expert-grid").innerHTML =
    experts.length ? experts.map(expertCard).join("") : `<div class="empty-note">${t("empty")}</div>`;
}

// ---------- события ----------
document.getElementById("theme-toggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", state.theme);
  render();
});
document.getElementById("lang-toggle").addEventListener("click", () => {
  state.lang = state.lang === "ru" ? "en" : "ru";
  localStorage.setItem("lang", state.lang);
  render();
});
document.querySelectorAll(".nav-btn").forEach(b =>
  b.addEventListener("click", () => { state.pageTab = b.dataset.page; render(); }));
document.querySelectorAll(".pill").forEach(b =>
  b.addEventListener("click", () => { state.view = b.dataset.view; render(); }));
document.getElementById("date-select").addEventListener("change", (e) => {
  state.date = e.target.value;
  render();
});
document.getElementById("model-filters").addEventListener("click", (e) => {
  const chip = e.target.closest(".model-chip");
  if (!chip) return;
  const m = chip.dataset.model;
  if (!m) state.filters.clear();
  else if (state.filters.has(m)) state.filters.delete(m);
  else state.filters.add(m);
  localStorage.setItem("modelFilters", JSON.stringify([...state.filters]));
  render();
});

// ---------- старт ----------
(async function init() {
  // URL-параметры: шаринг ссылок (?view=week&date=...&lang=en&theme=light&tab=experts)
  const params = new URLSearchParams(location.search);
  if (["ru", "en"].includes(params.get("lang"))) state.lang = params.get("lang");
  if (["dark", "light"].includes(params.get("theme"))) state.theme = params.get("theme");
  if (["day", "week", "month"].includes(params.get("view"))) state.view = params.get("view");
  if (["radar", "experts"].includes(params.get("tab"))) state.pageTab = params.get("tab");
  await loadIndex();
  const dates = state.index.days.map(d => d.date);
  state.date = dates.includes(params.get("date")) ? params.get("date") : dates[0] || null;
  await render();
})();
