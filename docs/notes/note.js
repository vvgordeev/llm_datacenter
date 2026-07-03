/* Переключатели темы/языка на страницах конспектов — общий localStorage с дашбордом */
"use strict";

const html = document.documentElement;

function apply() {
  html.setAttribute("data-theme", localStorage.getItem("theme") || "dark");
  html.setAttribute("data-lang-active", localStorage.getItem("lang") || "ru");
  html.lang = localStorage.getItem("lang") || "ru";
  document.getElementById("lang-toggle").textContent = (localStorage.getItem("lang") || "ru").toUpperCase();
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  const next = (localStorage.getItem("theme") || "dark") === "dark" ? "light" : "dark";
  localStorage.setItem("theme", next);
  apply();
});

document.getElementById("lang-toggle").addEventListener("click", () => {
  const next = (localStorage.getItem("lang") || "ru") === "ru" ? "en" : "ru";
  localStorage.setItem("lang", next);
  apply();
});

apply();
