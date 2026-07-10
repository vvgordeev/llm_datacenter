/* Страницы конспектов: переключатели темы/языка (общий localStorage с дашбордом)
   + кнопки «Скопировать» (конспект в markdown) и «Поделиться» (ссылка на страницу). */
"use strict";

const html = document.documentElement;
const LABELS = {
  ru: { copy: "Скопировать", share: "Поделиться", copied: "Скопировано ✓", link_copied: "Ссылка скопирована ✓" },
  en: { copy: "Copy", share: "Share", copied: "Copied ✓", link_copied: "Link copied ✓" }
};
const lang = () => localStorage.getItem("lang") || "ru";

function apply() {
  html.setAttribute("data-theme", localStorage.getItem("theme") || "dark");
  html.setAttribute("data-lang-active", lang());
  html.lang = lang();
  document.getElementById("lang-toggle").textContent = lang().toUpperCase();
  const copyBtn = document.getElementById("copy-note");
  const shareBtn = document.getElementById("share-note");
  if (copyBtn) copyBtn.textContent = LABELS[lang()].copy;
  if (shareBtn) shareBtn.textContent = LABELS[lang()].share;
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  const next = (localStorage.getItem("theme") || "dark") === "dark" ? "light" : "dark";
  localStorage.setItem("theme", next);
  apply();
});

document.getElementById("lang-toggle").addEventListener("click", () => {
  const next = lang() === "ru" ? "en" : "ru";
  localStorage.setItem("lang", next);
  apply();
});

/* ── Конспект → markdown ─────────────────────────────────────── */

// Инлайн-сериализация узла с учётом активного языка (span[data-lang])
function mdInline(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName;
  if (node.hasAttribute && node.hasAttribute("data-lang") && node.getAttribute("data-lang") !== lang()) return "";
  const inner = [...node.childNodes].map(mdInline).join("");
  if (tag === "A") {
    const href = node.getAttribute("href");
    return href ? `[${inner.trim()}](${new URL(href, location.href).href})` : inner;
  }
  if (tag === "B" || tag === "STRONG") return `**${inner}**`;
  if (tag === "I" || tag === "EM") return `*${inner}*`;
  if (tag === "CODE") return "`" + inner + "`";
  if (tag === "BR") return "\n";
  return inner;
}
const clean = (s) => s.replace(/\s+/g, " ").trim();

function blockToMd(el) {
  const cls = el.classList;
  if (el.tagName === "H1") return "# " + clean(mdInline(el));
  if (el.tagName === "H2") return "## " + clean(mdInline(el));
  if (cls.contains("note-kicker") || cls.contains("note-hint")) return "*" + clean(mdInline(el)) + "*";
  if (cls.contains("note-source")) return clean(mdInline(el));
  if (el.tagName === "P") return clean(mdInline(el));
  if (el.tagName === "OL") // старый формат: нумерованные тезисы
    return [...el.children].map((li, i) => `${i + 1}. ${clean(mdInline(li))}`).join("\n");
  if (el.tagName === "TABLE") // старый формат: таблица таймкодов
    return [...el.querySelectorAll("tr")].map(tr => {
      const cells = [...tr.children].map(td => clean(mdInline(td))).filter(Boolean);
      return "- " + cells.join(" — ");
    }).join("\n");
  if (el.tagName === "FIGURE") {
    const parts = [];
    el.querySelectorAll("img").forEach(img =>
      parts.push(`![](${new URL(img.getAttribute("src"), location.href).href})`));
    const cap = el.querySelector("figcaption");
    if (cap) parts.push("*" + clean(mdInline(cap)) + "*");
    return parts.join("\n");
  }
  if (cls.contains("frames")) // старый формат: галерея кадров
    return [...el.querySelectorAll("figure")].map(blockToMd).join("\n\n");
  return clean(mdInline(el));
}

function noteToMarkdown() {
  const main = document.querySelector("main.note");
  const blocks = [...main.children]
    .map(blockToMd)
    .filter(b => b && b.trim());
  return blocks.join("\n\n") + `\n\n---\n${location.href}\n`;
}

/* ── Копирование с фолбэком и индикацией ─────────────────────── */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function flash(btn, label) {
  const old = btn.textContent;
  btn.textContent = label;
  btn.disabled = true;
  setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1600);
}

/* ── Вставка кнопок (после .note-source, на всех страницах) ──── */

(function initActions() {
  const anchor = document.querySelector(".note .note-source") || document.querySelector(".note h1");
  if (!anchor) return;
  const row = document.createElement("div");
  row.className = "note-actions";
  row.innerHTML = `
    <button id="copy-note" class="chip-btn" type="button"></button>
    <button id="share-note" class="chip-btn" type="button"></button>`;
  anchor.insertAdjacentElement("afterend", row);

  document.getElementById("copy-note").addEventListener("click", async (e) => {
    if (await copyText(noteToMarkdown())) flash(e.target, LABELS[lang()].copied);
  });
  document.getElementById("share-note").addEventListener("click", async (e) => {
    if (await copyText(location.href)) flash(e.target, LABELS[lang()].link_copied);
  });

  // отладка сериализации: ?md=debug выводит markdown на страницу
  if (new URLSearchParams(location.search).get("md") === "debug") {
    const pre = document.createElement("pre");
    pre.style.cssText = "white-space:pre-wrap;border:1px dashed var(--border);padding:16px;margin-top:24px;font-size:12px;color:var(--ink-2)";
    pre.textContent = noteToMarkdown();
    document.querySelector("main.note").appendChild(pre);
  }
})();

apply();
