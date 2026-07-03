/* LLM Datacenter — дашборд. Статический SPA: дневные JSON — единственный источник,
   срезы Неделя/Месяц считаются здесь (инвариант 5 architecture.md). */

"use strict";

// ---------- i18n: все строки интерфейса только отсюда (инвариант 2) ----------
const I18N = {
  ru: {
    tagline: "ежедневная сводка новостей LLM",
    view_day: "День",
    view_week: "Неделя",
    view_month: "Месяц",
    news_title: "Нововведения — по масштабу инновации",
    experts_title: "Эксперты: статьи и видео",
    demo_banner: "⚠ Демо-данные для макета. Реальная сводка появится после первого запуска пайплайна /digest.",
    kpi_news: "новостей",
    kpi_max_impact: "макс. impact",
    kpi_clusters: "сюжетов",
    kpi_experts: "конспектов",
    opinions: "Мнения",
    use_cases: "Кейсы применения",
    details_show: "Подробнее ▾",
    details_hide: "Свернуть ▴",
    note_link: "Конспект",
    source_link: "Источник",
    original_link: "Оригинал",
    empty_day: "За этот день данных нет.",
    empty_filtered: "Нет новостей по выбранным фильтрам.",
    footer_note: "Обновляется ежедневно в 08:00 (GMT+3). Срезы «Неделя» и «Месяц» — самое важное за период.",
    footer_repo: "Репозиторий",
    tier_minor: "minor",
    tier_notable: "notable",
    tier_major: "major",
    tier_paradigm: "paradigm",
    type_article: "статья",
    type_video: "видео",
    all_models: "Все модели"
  },
  en: {
    tagline: "daily LLM news digest",
    view_day: "Day",
    view_week: "Week",
    view_month: "Month",
    news_title: "What's new — ranked by innovation scale",
    experts_title: "Experts: articles & videos",
    demo_banner: "⚠ Demo data for the mockup. A real digest will appear after the first /digest pipeline run.",
    kpi_news: "news items",
    kpi_max_impact: "max impact",
    kpi_clusters: "stories",
    kpi_experts: "digests",
    opinions: "Opinions",
    use_cases: "Use cases",
    details_show: "Details ▾",
    details_hide: "Collapse ▴",
    note_link: "Digest",
    source_link: "Source",
    original_link: "Original",
    empty_day: "No data for this day.",
    empty_filtered: "No news for the selected filters.",
    footer_note: "Updated daily at 08:00 (GMT+3). Week and Month views show the most important items of the period.",
    footer_repo: "Repository",
    tier_minor: "minor",
    tier_notable: "notable",
    tier_major: "major",
    tier_paradigm: "paradigm",
    type_article: "article",
    type_video: "video",
    all_models: "All models"
  }
};

// Человекочитаемые имена тегов моделей (совпадают с tag в config/sources.yaml)
const MODEL_NAMES = {
  anthropic: "Claude · Anthropic",
  openai: "GPT · OpenAI",
  google: "Gemini · Google",
  meta: "Llama · Meta",
  xai: "Grok · xAI",
  mistral: "Mistral",
  deepseek: "DeepSeek",
  qwen: "Qwen"
};

const TOP_N = { week: 10, month: 15 };

// ---------- состояние ----------
const state = {
  lang: localStorage.getItem("lang") || "ru",
  theme: localStorage.getItem("theme") || "dark",
  view: "day",
  date: null,           // выбранная дата (для view=day и как правая граница периодов)
  filters: new Set(JSON.parse(localStorage.getItem("modelFilters") || "[]")),
  index: null,          // data/index.json
  cache: new Map()      // date -> daily json
};

const t = (key) => (I18N[state.lang] && I18N[state.lang][key]) || key;
const loc = (field) => (field && (field[state.lang] || field.ru || field.en)) || "";

// ---------- загрузка данных ----------
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
    const day = await res.json();
    state.cache.set(date, day);
    return day;
  } catch {
    return null;
  }
}

function datesInPeriod(endDate, days) {
  // доступные даты индекса в [endDate - days + 1, endDate]
  const end = new Date(endDate + "T00:00:00Z");
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return state.index.days
    .map((d) => d.date)
    .filter((date) => {
      const dt = new Date(date + "T00:00:00Z");
      return dt >= start && dt <= end;
    });
}

// ---------- агрегация срезов (сквозной паттерн из architecture.md) ----------
function aggregate(dayJsons, topN) {
  const byCluster = new Map();
  for (const day of dayJsons) {
    for (const item of day.news) {
      const key = item.cluster_id || item.id;
      const prev = byCluster.get(key);
      // в кластере оставляем запись с максимальным score; при равенстве — свежайшую
      if (!prev || item.impact_score > prev.impact_score ||
          (item.impact_score === prev.impact_score && day.date > prev._date)) {
        byCluster.set(key, { ...item, _date: day.date });
      }
    }
  }
  return [...byCluster.values()]
    .sort((a, b) => b.impact_score - a.impact_score || b._date.localeCompare(a._date))
    .slice(0, topN);
}

function collectExperts(dayJsons) {
  const seen = new Set();
  const out = [];
  for (const day of dayJsons) {
    for (const e of day.expert_content || []) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({ ...e, _date: day.date });
    }
  }
  return out;
}

// ---------- рендер ----------
function impactTier(score) {
  if (score >= 9) return "paradigm";
  if (score >= 7) return "major";
  if (score >= 4) return "notable";
  return "minor";
}

function impactMeter(score) {
  // 10 сегментов; заполненные красятся ступенями одной последовательной шкалы
  let cells = "";
  for (let i = 1; i <= 10; i++) {
    let cls = "";
    if (i <= score) {
      if (i <= 3) cls = "f1";
      else if (i <= 6) cls = "f2";
      else if (i <= 8) cls = "f3";
      else cls = "f4";
    }
    cells += `<i class="${cls}"></i>`;
  }
  return `<div class="impact-meter" role="img" aria-label="impact ${score}/10">${cells}</div>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function newsCard(item, showDate) {
  const tags = (item.models || [])
    .map((m) => `<span class="tag">${esc(MODEL_NAMES[m] || m)}</span>`)
    .join("");
  const dateTag = showDate && item._date ? `<span class="date-tag">${item._date}</span>` : "";

  const opinions = (item.opinions || []).map((o) => `
    <div class="opinion">
      <span class="stance-dot ${esc(o.stance || "neutral")}"></span>
      <span><span class="author">${esc(o.author)}:</span> ${esc(loc(o.quote))}
        <a href="${esc(o.url)}" target="_blank" rel="noopener">↗</a></span>
    </div>`).join("");

  const useCases = (item.use_cases || []).map((u) => `
    <div class="use-case">▸ ${esc(loc(u.text))}
      <a href="${esc(u.url)}" target="_blank" rel="noopener">↗</a></div>`).join("");

  const details = (opinions || useCases) ? `
    <div class="card-details" hidden>
      ${opinions ? `<div class="sub-heading">${t("opinions")}</div>${opinions}` : ""}
      ${useCases ? `<div class="sub-heading">${t("use_cases")}</div>${useCases}` : ""}
    </div>
    <button class="details-toggle" data-i18n-toggle>${t("details_show")}</button>` : "";

  return `
  <article class="card" data-id="${esc(item.id)}">
    <div class="card-head">
      <div class="impact">
        <div class="impact-num">${item.impact_score}</div>
        <div class="impact-tier">${t("tier_" + impactTier(item.impact_score))}</div>
        ${impactMeter(item.impact_score)}
      </div>
      <div style="flex:1; min-width:0">
        <h3 class="card-title">
          <a href="${esc(item.source_url)}" target="_blank" rel="noopener">${esc(loc(item.title))}</a>
        </h3>
        <div class="card-meta">${tags}${dateTag}</div>
        <p class="card-summary">${esc(loc(item.summary))}</p>
        <div class="impact-reason">${esc(loc(item.impact_reason))}</div>
        ${details}
      </div>
    </div>
  </article>`;
}

function expertCard(e) {
  return `
  <article class="card expert-card">
    <span class="expert-type">${t("type_" + e.type)} · ${esc(e.author)} · ${e._date || ""}</span>
    <h3 class="card-title">${esc(loc(e.title))}</h3>
    <p class="card-summary">${esc(loc(e.summary))}</p>
    <div class="expert-links">
      ${e.note_page ? `<a href="${esc(e.note_page)}">${t("note_link")} →</a>` : ""}
      <a href="${esc(e.url)}" target="_blank" rel="noopener">${t("original_link")} ↗</a>
    </div>
  </article>`;
}

function renderStatic() {
  document.documentElement.setAttribute("data-theme", state.theme);
  document.documentElement.lang = state.lang;
  document.getElementById("lang-toggle").textContent = state.lang.toUpperCase();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll(".view-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === state.view);
  });
}

function renderDateSelect() {
  const sel = document.getElementById("date-select");
  sel.innerHTML = state.index.days
    .map((d) => `<option value="${d.date}" ${d.date === state.date ? "selected" : ""}>${d.date}</option>`)
    .join("");
  sel.style.display = state.view === "day" ? "" : "none";
}

function renderKpis(items, experts) {
  const clusters = new Set(items.map((i) => i.cluster_id || i.id)).size;
  const maxImpact = items.length ? Math.max(...items.map((i) => i.impact_score)) : 0;
  const kpis = [
    [items.length, t("kpi_news")],
    [maxImpact || "—", t("kpi_max_impact")],
    [clusters, t("kpi_clusters")],
    [experts.length, t("kpi_experts")]
  ];
  document.getElementById("kpi-row").innerHTML = kpis
    .map(([v, l]) => `<div class="kpi"><div class="kpi-value">${v}</div><div class="kpi-label">${l}</div></div>`)
    .join("");
}

function renderFilters(allModels) {
  const el = document.getElementById("model-filters");
  const chips = [...allModels].sort().map((m) => `
    <button class="model-chip ${state.filters.has(m) ? "active" : ""}" data-model="${esc(m)}">
      ${esc(MODEL_NAMES[m] || m)}
    </button>`);
  el.innerHTML = `
    <button class="model-chip ${state.filters.size === 0 ? "active" : ""}" data-model="">
      ${t("all_models")}
    </button>` + chips.join("");
}

async function render() {
  renderStatic();
  renderDateSelect();

  // какие дни попадают в текущий вид
  let dates;
  if (state.view === "day") dates = [state.date];
  else if (state.view === "week") dates = datesInPeriod(state.date, 7);
  else dates = datesInPeriod(state.date, 30);

  const dayJsons = (await Promise.all(dates.map(loadDay))).filter(Boolean);

  document.getElementById("demo-banner").hidden = !dayJsons.some((d) => d.demo);

  let items;
  if (state.view === "day") {
    items = dayJsons.length
      ? dayJsons[0].news.map((n) => ({ ...n, _date: dayJsons[0].date }))
          .sort((a, b) => b.impact_score - a.impact_score)
      : [];
  } else {
    items = aggregate(dayJsons, TOP_N[state.view]);
  }

  const experts = collectExperts(dayJsons);
  const allModels = new Set(items.flatMap((i) => i.models || []));

  renderKpis(items, experts);
  renderFilters(allModels);

  const visible = state.filters.size
    ? items.filter((i) => (i.models || []).some((m) => state.filters.has(m)))
    : items;

  const list = document.getElementById("news-list");
  if (!dayJsons.length) list.innerHTML = `<div class="empty-note">${t("empty_day")}</div>`;
  else if (!visible.length) list.innerHTML = `<div class="empty-note">${t("empty_filtered")}</div>`;
  else list.innerHTML = visible.map((i) => newsCard(i, state.view !== "day")).join("");

  const expEl = document.getElementById("expert-list");
  document.getElementById("expert-section").style.display = experts.length ? "" : "none";
  expEl.innerHTML = experts.map(expertCard).join("");
}

// ---------- события ----------
function bindEvents() {
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

  document.querySelectorAll(".view-btn").forEach((b) => {
    b.addEventListener("click", () => {
      state.view = b.dataset.view;
      render();
    });
  });

  document.getElementById("date-select").addEventListener("change", (e) => {
    state.date = e.target.value;
    render();
  });

  // делегирование: фильтры и раскрытие карточек
  document.body.addEventListener("click", (e) => {
    const chip = e.target.closest(".model-chip");
    if (chip) {
      const m = chip.dataset.model;
      if (!m) state.filters.clear();
      else if (state.filters.has(m)) state.filters.delete(m);
      else state.filters.add(m);
      localStorage.setItem("modelFilters", JSON.stringify([...state.filters]));
      render();
      return;
    }
    const toggle = e.target.closest(".details-toggle");
    if (toggle) {
      const details = toggle.previousElementSibling;
      details.hidden = !details.hidden;
      toggle.textContent = details.hidden ? t("details_show") : t("details_hide");
    }
  });
}

// ---------- старт ----------
(async function init() {
  // URL-параметры: шаринг ссылок на конкретный срез/дату (?view=week&date=...&lang=en&theme=light)
  const params = new URLSearchParams(location.search);
  if (["ru", "en"].includes(params.get("lang"))) state.lang = params.get("lang");
  if (["dark", "light"].includes(params.get("theme"))) state.theme = params.get("theme");
  if (["day", "week", "month"].includes(params.get("view"))) state.view = params.get("view");

  await loadIndex();
  const dates = state.index.days.map((d) => d.date);
  state.date = dates.includes(params.get("date")) ? params.get("date") : dates[0] || null;
  bindEvents();
  await render();
})();
