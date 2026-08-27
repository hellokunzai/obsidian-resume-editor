// 模板引擎：ResumeData -> 预览 DOM（createEl 构造，禁用 innerHTML）/ 导出 HTML 字符串

import { App, TFile } from "obsidian";
import { ResumeData, ResumeEntry, ResumeCustomField, ResumeLayout, TemplateId } from "../data/resume-model";
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

function resolveAvatarUrl(app: App | undefined, avatarPath: string): string {
  if (!app || !avatarPath) return "";
  const f = app.vault.getAbstractFileByPath(avatarPath);
  if (f && f instanceof TFile) {
    try {
      return app.vault.getResourcePath(f);
    } catch {
      return "";
    }
  }
  return "";
}

interface ContactItem {
  icon: string;
  label: string;
  value: string;
  showLabel: boolean;
}

function buildContactItems(data: ResumeData): ContactItem[] {
  const items: ContactItem[] = [];
  if (data.phone) items.push({ icon: "📞", label: t("field.phone"), value: data.phone, showLabel: false });
  if (data.email) items.push({ icon: "✉", label: t("field.email"), value: data.email, showLabel: false });
  for (const f of data.customFields) {
    if (!f.visible || (!f.value && !f.icon)) continue;
    items.push({
      icon: f.icon || "•",
      label: f.label,
      value: f.value,
      showLabel: f.showLabel,
    });
  }
  return items;
}

function renderContactItem(parent: HTMLElement, item: ContactItem): void {
  const el = parent.createDiv({ cls: "r-contact-item" });
  if (item.icon) el.createSpan({ cls: "r-ci-icon", text: item.icon });
  if (item.showLabel && item.label) {
    el.createSpan({ cls: "r-ci-label", text: item.label + "：" });
  }
  el.createSpan({ cls: "r-ci-value", text: item.value });
}

function renderHeaderDom(
  paper: HTMLElement,
  data: ResumeData,
  app?: App
): void {
  const header = paper.createDiv({ cls: `r-header r-layout-${data.layout}` });
  const avatarUrl = resolveAvatarUrl(app, data.avatar);

  const main = header.createDiv({ cls: "r-header-main" });
  if (avatarUrl) main.createEl("img", { cls: "r-avatar", attr: { src: avatarUrl } });

  const headText = main.createDiv({ cls: "r-header-text" });
  headText.createEl("div", { cls: "r-name", text: data.name || " " });
  if (data.role) headText.createEl("div", { cls: "r-role", text: data.role });

  const contacts = buildContactItems(data);
  if (contacts.length) {
    const grid = header.createDiv({ cls: "r-contact-grid" });
    for (const c of contacts) renderContactItem(grid, c);
  }
}

export function renderResumeDom(
  root: HTMLElement,
  data: ResumeData,
  template: TemplateId,
  app?: App
): void {
  root.empty();
  const paper = root.createDiv({
    cls: template === "academic" ? "re-paper re-academic" : "re-paper",
  });

  const basicVisible = data.sections.find((s) => s.type === "basic")?.visible !== false;
  if (basicVisible) renderHeaderDom(paper, data, app);

  for (const sec of data.sections) {
    if (!sec.visible) continue;
    if (sec.type === "basic") continue;
    if (  sec.type === "skills") {
      if (data.skills) {
        paper.createEl("div", {
          cls: "r-skills",
          text: t("form.skills") + "：" + data.skills,
        });
      }
    } else if (sec.type === "education") {
      sectionDom(paper, t("form.education"), data.education);
    } else if (sec.type === "work") {
      sectionDom(paper, t("form.work"), data.work);
    } else if (sec.type === "projects") {
      sectionDom(paper, t("form.project"), data.projects);
    } else if (sec.type === "custom") {
      if (sec.content.trim()) {
        paper.createEl("h3", {
          cls: "r-sec",
          text: sec.title || t("form.customModule"),
        });
        const ul = paper.createEl("ul");
        sec.content.split("\n").filter((l) => l.trim()).forEach((l) => {
          ul.createEl("li", { text: l.trim() });
        });
      }
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

function contactItemHtml(item: ContactItem): string {
  const icon = item.icon ? `<span class="r-ci-icon">${esc(item.icon)}</span>` : "";
  const label = item.showLabel && item.label ? `<span class="r-ci-label">${esc(item.label)}：</span>` : "";
  return `<div class="r-contact-item">${icon}${label}<span class="r-ci-value">${esc(item.value)}</span></div>`;
}

function headerHtml(data: ResumeData, app?: App): string {
  const avatarUrl = app ? resolveAvatarUrl(app, data.avatar) : "";
  const contacts = buildContactItems(data);
  const contactGrid = contacts.length
    ? `<div class="r-contact-grid">${contacts.map(contactItemHtml).join("")}</div>`
    : "";
  const avatar = avatarUrl ? `<img class="r-avatar" src="${esc(avatarUrl)}">` : "";
  const role = data.role ? `<div class="r-role">${esc(data.role)}</div>` : "";
  return `
    <div class="r-header r-layout-${esc(data.layout)}">
      <div class="r-header-main">
        ${avatar}
        <div class="r-header-text">
          <div class="r-name">${esc(data.name || " ")}</div>
          ${role}
        </div>
      </div>
      ${contactGrid}
    </div>
  `;
}

export function resumeToHtml(data: ResumeData, template: TemplateId, app?: App): string {
  const cls = template === "academic" ? "re-paper re-academic" : "re-paper";
  const parts: string[] = [`<div class="${cls}">`];

  const basicVisible = data.sections.find((s) => s.type === "basic")?.visible !== false;
  if (basicVisible) parts.push(headerHtml(data, app));

  for (const sec of data.sections) {
    if (!sec.visible) continue;
    if (sec.type === "basic") continue;
    if (sec.type === "skills") {
      if (data.skills) {
        parts.push(
          `<div class="r-skills">${esc(t("form.skills"))}：${esc(data.skills)}</div>`
        );
      }
    } else if (sec.type === "education") {
      parts.push(sectionHtml(t("form.education"), data.education));
    } else if (sec.type === "work") {
      parts.push(sectionHtml(t("form.work"), data.work));
    } else if (sec.type === "projects") {
      parts.push(sectionHtml(t("form.project"), data.projects));
    } else if (sec.type === "custom") {
      if (sec.content.trim()) {
        const title = sec.title || t("form.customModule");
        const items = sec.content
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => `<li>${esc(l.trim())}</li>`)
          .join("");
        parts.push(`<h3 class="r-sec">${esc(title)}</h3><ul>${items}</ul>`);
      }
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

/* header 布局 */
.re-paper .r-header{display:grid;align-items:center;gap:24px;margin-bottom:18px;}
.re-paper .r-header.r-layout-left{grid-template-columns:auto 1fr;}
.re-paper .r-header.r-layout-right{grid-template-columns:1fr auto;}
.re-paper .r-header.r-layout-top{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;}
.re-paper .r-header-main{display:flex;align-items:center;gap:12px;min-width:0;}
.re-paper .r-header.r-layout-top .r-header-main{flex-direction:column;gap:10px;}

.re-paper .r-avatar{width:90px;height:110px;object-fit:cover;border-radius:8px;border:1px solid #e0e0e0;flex:none;}
.re-paper .r-header-text{min-width:0;}
.re-paper .r-name{font-size:26px;font-weight:700;margin:0 0 2px;}
.re-paper .r-role{color:#666;font-size:13px;}

.re-paper .r-contact-grid{display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px 18px;font-size:12px;color:#555;}
.re-paper .r-header.r-layout-top .r-contact-grid{grid-template-columns:repeat(auto-fit, minmax(140px, auto));justify-content:center;}
.re-paper .r-contact-item{display:flex;align-items:center;gap:5px;min-width:0;}
.re-paper .r-ci-icon{flex:none;}
.re-paper .r-ci-label{color:#888;flex:none;}
.re-paper .r-ci-value{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

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
