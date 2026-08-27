// 模板引擎：ResumeData -> 预览 DOM（createEl 构造，禁用 innerHTML）/ 导出 HTML 字符串

import { ResumeData, ResumeEntry, TemplateId } from "../data/resume-model";
import { t } from "../i18n";

/* ---------- 预览 DOM 构建（合规：全部用 createEl，无 innerHTML） ---------- */

function sectionDom(parent: HTMLElement, title: string, entries: ResumeEntry[]): void {
  if (!entries.length) return;
  parent.createEl("h3", { cls: "r-sec", text: title });
  for (const e of entries) {
    const item = parent.createDiv({ cls: "r-item" });
    const top = item.createDiv({ cls: "r-top" });
    top.createSpan({ cls: "r-nm", text: e.org });
    if (e.time) top.createSpan({ cls: "r-dt", text: e.time });
    if (e.title) item.createDiv({ cls: "r-sub", text: e.title });
    if (e.details) {
      const ul = item.createEl("ul");
      for (const line of e.details.split("\n")) {
        if (line.trim()) ul.createEl("li", { text: line.trim() });
      }
    }
  }
}

export function renderResumeDom(
  root: HTMLElement,
  data: ResumeData,
  template: TemplateId
): void {
  root.empty();
  const paper = root.createDiv({ cls: `re-paper re-${template}` });
  paper.createEl("div", { cls: "r-name", text: data.name || " " });
  if (data.role) paper.createEl("div", { cls: "r-role", text: data.role });

  if (template === "twoCol") {
    const left = paper.createDiv({ cls: "r-col-left" });
    if (data.phone || data.email) {
      left.createEl("h3", { cls: "r-sec", text: t("field.phone") });
      const c = left.createDiv({ cls: "r-sub" });
      if (data.phone) c.createEl("div", { text: t("field.phone") + "：" + data.phone });
      if (data.email) c.createEl("div", { text: t("field.email") + "：" + data.email });
    }
    if (data.skills) {
      left.createEl("h3", { cls: "r-sec", text: t("form.skills") });
      left.createDiv({ cls: "r-sub", text: data.skills });
    }
    const right = paper.createDiv();
    sectionDom(right, t("form.education"), data.education);
    sectionDom(right, t("form.work"), data.work);
    sectionDom(right, t("form.project"), data.projects);
  } else {
    if (data.phone || data.email) {
      const contact = paper.createDiv({ cls: "r-contact" });
      if (data.phone) contact.createSpan({ text: "📞 " + data.phone });
      if (data.email) contact.createSpan({ text: "✉ " + data.email });
    }
    sectionDom(paper, t("form.education"), data.education);
    sectionDom(paper, t("form.work"), data.work);
    sectionDom(paper, t("form.project"), data.projects);
    if (data.skills) {
      paper.createEl("div", {
        cls: "r-skills",
        text: t("form.skills") + "：" + data.skills,
      });
    }
  }
}

/* ---------- 导出 HTML 字符串（全部转义，避免 XSS） ---------- */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sectionHtml(title: string, entries: ResumeEntry[]): string {
  if (!entries.length) return "";
  const items = entries
    .map((e) => {
      const top =
        `<div class="r-top"><span class="r-nm">${esc(e.org)}</span>` +
        (e.time ? `<span class="r-dt">${esc(e.time)}</span>` : "") +
        `</div>`;
      const sub = e.title ? `<div class="r-sub">${esc(e.title)}</div>` : "";
      const details = e.details
        ? `<ul>${e.details
            .split("\n")
            .filter((l) => l.trim())
            .map((l) => `<li>${esc(l.trim())}</li>`)
            .join("")}</ul>`
        : "";
      return `<div class="r-item">${top}${sub}${details}</div>`;
    })
    .join("");
  return `<h3 class="r-sec">${esc(title)}</h3>${items}`;
}

export function resumeToHtml(data: ResumeData, template: TemplateId): string {
  const parts: string[] = [`<div class="re-paper re-${template}">`];
  parts.push(`<div class="r-name">${esc(data.name || " ")}</div>`);
  if (data.role) parts.push(`<div class="r-role">${esc(data.role)}</div>`);

  if (template === "twoCol") {
    parts.push(`<div class="r-col-left">`);
    if (data.phone || data.email) {
      parts.push(`<h3 class="r-sec">${esc(t("field.phone"))}</h3>`);
      const c: string[] = [];
      if (data.phone) c.push(`<div>${esc(t("field.phone"))}：${esc(data.phone)}</div>`);
      if (data.email) c.push(`<div>${esc(t("field.email"))}：${esc(data.email)}</div>`);
      parts.push(`<div class="r-sub">${c.join("")}</div>`);
    }
    if (data.skills) {
      parts.push(`<h3 class="r-sec">${esc(t("form.skills"))}</h3>`);
      parts.push(`<div class="r-sub">${esc(data.skills)}</div>`);
    }
    parts.push(`</div>`);
    parts.push(`<div>`);
    parts.push(sectionHtml(t("form.education"), data.education));
    parts.push(sectionHtml(t("form.work"), data.work));
    parts.push(sectionHtml(t("form.project"), data.projects));
    parts.push(`</div>`);
  } else {
    if (data.phone || data.email) {
      const spans: string[] = [];
      if (data.phone) spans.push(`<span>📞 ${esc(data.phone)}</span>`);
      if (data.email) spans.push(`<span>✉ ${esc(data.email)}</span>`);
      parts.push(`<div class="r-contact">${spans.join("")}</div>`);
    }
    parts.push(sectionHtml(t("form.education"), data.education));
    parts.push(sectionHtml(t("form.work"), data.work));
    parts.push(sectionHtml(t("form.project"), data.projects));
    if (data.skills) {
      parts.push(
        `<div class="r-skills">${esc(t("form.skills"))}：${esc(data.skills)}</div>`
      );
    }
  }
  parts.push(`</div>`);
  return parts.join("");
}

/* 导出用独立样式（脱离 Obsidian 主题，打印友好） */
export const RESUME_CSS = `
*{box-sizing:border-box;}
body{margin:0;font-family:"PingFang SC","Microsoft YaHei",-apple-system,"Segoe UI",sans-serif;color:#222;}
@page{size:A4;margin:14mm;}
.re-paper{background:#fff;width:100%;max-width:720px;margin:0 auto;padding:30px 36px;min-height:900px;}
.re-paper .r-name{font-size:26px;font-weight:700;margin:0 0 2px;}
.re-paper .r-role{color:#666;font-size:13px;margin-bottom:10px;}
.re-paper .r-contact{font-size:12px;color:#666;margin-bottom:14px;}
.re-paper .r-contact span{margin-right:14px;}
.re-paper h3.r-sec{font-size:14px;letter-spacing:.04em;border-bottom:2px solid #7c5cff;padding-bottom:3px;margin:16px 0 8px;}
.re-paper .r-item{margin-bottom:10px;}
.re-paper .r-item .r-top{display:flex;justify-content:space-between;font-size:13px;}
.re-paper .r-item .r-nm{font-weight:600;}
.re-paper .r-item .r-dt{color:#999;font-size:12px;}
.re-paper .r-item .r-sub{color:#555;font-size:12.5px;}
.re-paper ul{margin:3px 0 0;padding-left:18px;}
.re-paper ul li{font-size:12.5px;margin:2px 0;}
.re-paper .r-skills{font-size:12.5px;color:#555;}
.re-paper.re-two-col{display:grid;grid-template-columns:34% 64%;gap:20px;padding:26px 30px;}
.re-paper.re-two-col .r-col-left{background:#f3f0ff;padding:12px;border-radius:8px;align-self:start;}
.re-paper.re-two-col h3.r-sec{border-bottom:1px solid #7c5cff;}
.re-paper.re-academic{font-family:Georgia,"Songti SC",serif;}
.re-paper.re-academic .r-name{text-align:center;border-bottom:3px double #333;padding-bottom:6px;}
`;
