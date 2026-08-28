// 模板引擎：ResumeData -> 预览 DOM（createEl 构造，禁用 innerHTML）/ 导出 HTML 字符串

import { App, TFile, normalizePath, setIcon } from "obsidian";
import { ResumeData, ResumeEntry, ResumeCustomField, ResumeLayout, TemplateId, ResumeSection, computeAvatarStyle, visibleEntries } from "../data/resume-model";
import { t } from "../i18n";
import {
  CONTACT_ICONS,
  contactIconId,
  contactIconSvg,
  normalizeCustomFieldIcon,
} from "../ui/contact-icons";

/* ---------- 预览 DOM 构建（合规：全部用 createEl，无 innerHTML） ---------- */

function sectionDom(parent: HTMLElement, title: string, entries: ResumeEntry[]): void {
  const items = visibleEntries(entries);
  if (!items.length) return;
  parent.createEl("h3", { cls: "r-sec", text: title });
  for (const e of items) {
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

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);

function isImageFile(file: TFile): boolean {
  return IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
}

export function resolveAvatarUrl(app: App | undefined, avatarPath: string): string {
  if (!app || !avatarPath) return "";
  const trimmed = avatarPath.trim();
  if (!trimmed) return "";

  // 支持网络图片链接
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // 支持 vault 内文件路径（使用 normalizePath 兼容 Windows 反斜杠）
  const normalized = normalizePath(trimmed);
  const f = app.vault.getAbstractFileByPath(normalized);
  if (f && f instanceof TFile && isImageFile(f)) {
    try {
      return app.vault.getResourcePath(f);
    } catch {
      return "";
    }
  }

  // 尝试按 basename 模糊匹配（用户可能只输入了文件名）
  const lowerName = normalized.toLowerCase();
  const matched = app.vault.getFiles().find(
    (file) => isImageFile(file) && file.path.toLowerCase().endsWith(lowerName)
  );
  if (matched) {
    try {
      return app.vault.getResourcePath(matched);
    } catch {
      return "";
    }
  }

  return "";
}

interface ContactItem {
  iconKey: string;
  label: string;
  value: string;
  showLabel: boolean;
}

const ICON_EMOJI: Record<string, string> = {
  phone: "📞",
  mail: "✉",
  location: "📍",
  birthDate: "📅",
  employmentStatus: "💼",
  link: "🔗",
};

/** 基础字段 key -> 图标 key（email 在图标库中对应 mail） */
const BASIC_FIELD_ICON_KEY: Record<string, string> = {
  phone: "phone",
  email: "mail",
  employmentStatus: "employmentStatus",
  location: "location",
  birthDate: "birthDate",
};

/** 联系信息：按 basicFields 顺序与可见性渲染，customFields 置后 */
function buildContactItems(data: ResumeData): ContactItem[] {
  const items: ContactItem[] = [];
  for (const f of data.basicFields) {
    if (!f.visible) continue;
    const v = data[f.key as keyof ResumeData];
    if (typeof v !== "string" || !v) continue;
    items.push({
      iconKey: BASIC_FIELD_ICON_KEY[f.key] ?? f.key,
      label: t("field." + f.key),
      value: v,
      showLabel: false,
    });
  }
  for (const cf of data.customFields) {
    if (!cf.visible || (!cf.value && !cf.icon)) continue;
    const iconKey = normalizeCustomFieldIcon(cf.icon);
    items.push({ iconKey, label: cf.label, value: cf.value, showLabel: cf.showLabel });
  }
  return items;
}

function renderContactItem(parent: HTMLElement, item: ContactItem): void {
  const el = parent.createDiv({ cls: "r-contact-item" });
  const iconSpan = el.createSpan({ cls: "r-ci-icon" });
  if (CONTACT_ICONS[item.iconKey]) {
    setIcon(iconSpan, contactIconId(item.iconKey));
  } else {
    iconSpan.setText(ICON_EMOJI[item.iconKey] || "•");
  }
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

  // 头像、姓名岗位、联系信息为三个并列子元素，由 CSS 控制排布
  if (avatarUrl) {
    const st = computeAvatarStyle(data);
    header.createEl("img", {
      cls: "r-avatar",
      attr: {
        src: avatarUrl,
        style: `width:${st.width}px;height:${st.height}px;border-radius:${st.radius};`,
      },
    });
  }

  const headText = header.createDiv({ cls: "r-header-text" });
  headText.createEl("div", { cls: "r-name", text: data.name || " " });
  if (data.role) headText.createEl("div", { cls: "r-role", text: data.role });

  const contacts = buildContactItems(data);
  if (contacts.length) {
    const grid = header.createDiv({ cls: "r-contact-grid" });
    for (const c of contacts) renderContactItem(grid, c);
  }
}

/* ---------- Classic 模板（迁移自 magic-resume） ---------- */

function splitSkills(skills: string): string[] {
  if (!skills.trim()) return [];
  const out: string[] = [];
  for (const line of skills.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed
      .split(/[、；;,.]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    out.push(...parts);
  }
  return out;
}

function renderContactItemClassic(parent: HTMLElement, item: ContactItem): void {
  const el = parent.createDiv({ cls: "r-contact-item r-cic-classic" });
  const iconSpan = el.createSpan({ cls: "r-ci-icon" });
  setIcon(iconSpan, contactIconId(item.iconKey));
  if (item.showLabel && item.label) {
    el.createSpan({ cls: "r-ci-label", text: item.label + "：" });
  }
  el.createSpan({ cls: "r-ci-value", text: item.value });
}

function renderHeaderClassic(
  paper: HTMLElement,
  data: ResumeData,
  app?: App
): void {
  const header = paper.createDiv({ cls: `r-header r-header-classic r-layout-${data.layout}` });
  const avatarUrl = resolveAvatarUrl(app, data.avatar);
  if (avatarUrl) {
    const st = computeAvatarStyle(data);
    header.createEl("img", {
      cls: "r-avatar",
      attr: {
        src: avatarUrl,
        style: `width:${st.width}px;height:${st.height}px;border-radius:${st.radius};`,
      },
    });
  }

  const headText = header.createDiv({ cls: "r-header-text" });
  headText.createEl("div", { cls: "r-name", text: data.name || " " });
  if (data.role) headText.createEl("div", { cls: "r-role", text: data.role });

  const contacts = buildContactItems(data);
  if (contacts.length) {
    const grid = header.createDiv({ cls: "r-contact-grid r-contact-grid-classic" });
    for (const c of contacts) renderContactItemClassic(grid, c);
  }
}

function sectionDomClassic(parent: HTMLElement, title: string, entries: ResumeEntry[]): void {
  const items = visibleEntries(entries);
  if (!items.length) return;
  parent.createEl("h3", { cls: "r-sec r-sec-classic", text: title });
  for (const e of items) {
    const item = parent.createDiv({ cls: "r-item r-item-classic" });
    const top = item.createDiv({ cls: "r-top r-top-classic" });
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

function renderSkillsClassic(parent: HTMLElement, skills: string): void {
  const lines = splitSkills(skills);
  if (!lines.length) return;
  parent.createEl("h3", { cls: "r-sec r-sec-classic", text: t("form.skills") });
  const ul = parent.createEl("ul", { cls: "r-skills-list" });
  for (const l of lines) ul.createEl("li", { text: l });
}

function renderCustomClassic(parent: HTMLElement, sec: ResumeSection): void {
  if (!sec.content.trim()) return;
  parent.createEl("h3", { cls: "r-sec r-sec-classic", text: sec.title || t("form.customModule") });
  const ul = parent.createEl("ul");
  sec.content
    .split("\n")
    .filter((l) => l.trim())
    .forEach((l) => ul.createEl("li", { text: l.trim() }));
}

export function renderResumeDom(
  root: HTMLElement,
  data: ResumeData,
  template: TemplateId,
  app?: App
): void {
  root.empty();

  const paperClass =
    template === "classic"
      ? "re-paper re-classic"
      : template === "academic"
      ? "re-paper re-academic"
      : "re-paper";
  const paper = root.createDiv({ cls: paperClass });
  // 调试：在 DOM 上暴露当前渲染顺序，便于排查顺序是否生效
  paper.setAttribute(
    "data-section-order",
    data.sections.filter((s) => s.visible).map((s) => s.type).join(",")
  );

  for (const sec of data.sections) {
    if (!sec.visible) continue;

    if (sec.type === "basic") {
      if (template === "classic") renderHeaderClassic(paper, data, app);
      else renderHeaderDom(paper, data, app);
      continue;
    }

    if (sec.type === "skills") {
      if (template === "classic") {
        renderSkillsClassic(paper, data.skills);
      } else if (data.skills) {
        paper.createEl("div", {
          cls: "r-skills",
          text: t("form.skills") + "：" + data.skills,
        });
      }
    } else if (sec.type === "education") {
      if (template === "classic") {
        sectionDomClassic(paper, t("form.education"), data.education);
      } else {
        sectionDom(paper, t("form.education"), data.education);
      }
    } else if (sec.type === "work") {
      if (template === "classic") {
        sectionDomClassic(paper, t("form.work"), data.work);
      } else {
        sectionDom(paper, t("form.work"), data.work);
      }
    } else if (sec.type === "projects") {
      if (template === "classic") {
        sectionDomClassic(paper, t("form.project"), data.projects);
      } else {
        sectionDom(paper, t("form.project"), data.projects);
      }
    } else if (sec.type === "custom") {
      if (template === "classic") {
        renderCustomClassic(paper, sec);
      } else if (sec.content.trim()) {
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
  const items = visibleEntries(entries);
  if (!items.length) return "";
  const html = items
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
  return `<h3 class="r-sec">${esc(title)}</h3>${html}`;
}

function contactItemHtml(item: ContactItem): string {
  const iconHtml = CONTACT_ICONS[item.iconKey]
    ? `<span class="r-ci-icon">${contactIconSvg(item.iconKey)}</span>`
    : `<span class="r-ci-icon">${esc(ICON_EMOJI[item.iconKey] || "•")}</span>`;
  const label = item.showLabel && item.label ? `<span class="r-ci-label">${esc(item.label)}：</span>` : "";
  return `<div class="r-contact-item">${iconHtml}${label}<span class="r-ci-value">${esc(item.value)}</span></div>`;
}

function headerHtml(data: ResumeData, app?: App): string {
  const avatarUrl = app ? resolveAvatarUrl(app, data.avatar) : "";
  const contacts = buildContactItems(data);
  const contactGrid = contacts.length
    ? `<div class="r-contact-grid">${contacts.map(contactItemHtml).join("")}</div>`
    : "";
  const avatarStyle = avatarUrl ? computeAvatarStyle(data) : null;
  const avatar = avatarStyle
    ? `<img class="r-avatar" src="${esc(avatarUrl)}" style="width:${avatarStyle.width}px;height:${avatarStyle.height}px;border-radius:${avatarStyle.radius};">`
    : "";
  const role = data.role ? `<div class="r-role">${esc(data.role)}</div>` : "";
  return `
    <div class="r-header r-layout-${esc(data.layout)}">
      ${avatar}
      <div class="r-header-text">
        <div class="r-name">${esc(data.name || " ")}</div>
        ${role}
      </div>
      ${contactGrid}
    </div>
  `;
}

/* ---------- Classic 模板导出 HTML ---------- */

function contactItemHtmlClassic(item: ContactItem): string {
  const icon = `<span class="r-ci-icon">${contactIconSvg(item.iconKey)}</span>`;
  const label = item.showLabel && item.label ? `<span class="r-ci-label">${esc(item.label)}：</span>` : "";
  return `<div class="r-contact-item r-cic-classic">${icon}${label}<span class="r-ci-value">${esc(item.value)}</span></div>`;
}

function headerHtmlClassic(data: ResumeData, app?: App): string {
  const avatarUrl = app ? resolveAvatarUrl(app, data.avatar) : "";
  const contacts = buildContactItems(data);
  const contactGrid = contacts.length
    ? `<div class="r-contact-grid r-contact-grid-classic">${contacts.map(contactItemHtmlClassic).join("")}</div>`
    : "";
  const avatarStyle = avatarUrl ? computeAvatarStyle(data) : null;
  const avatar = avatarStyle
    ? `<img class="r-avatar" src="${esc(avatarUrl)}" style="width:${avatarStyle.width}px;height:${avatarStyle.height}px;border-radius:${avatarStyle.radius};">`
    : "";
  const role = data.role ? `<div class="r-role">${esc(data.role)}</div>` : "";
  return `
    <div class="r-header r-header-classic r-layout-${esc(data.layout)}">
      ${avatar}
      <div class="r-header-text">
        <div class="r-name">${esc(data.name || " ")}</div>
        ${role}
      </div>
      ${contactGrid}
    </div>
  `;
}

function sectionHtmlClassic(title: string, entries: ResumeEntry[]): string {
  const items = visibleEntries(entries);
  if (!items.length) return "";
  const html = items
    .map((e) => {
      const top =
        `<div class="r-top r-top-classic"><span class="r-nm">${esc(e.org)}</span>` +
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
      return `<div class="r-item r-item-classic">${top}${sub}${details}</div>`;
    })
    .join("");
  return `<h3 class="r-sec r-sec-classic">${esc(title)}</h3>${html}`;
}

function skillsHtmlClassic(skills: string): string {
  const lines = splitSkills(skills);
  if (!lines.length) return "";
  return `<h3 class="r-sec r-sec-classic">${esc(t("form.skills"))}</h3><ul class="r-skills-list">${lines
    .map((l) => `<li>${esc(l)}</li>`)
    .join("")}</ul>`;
}

function customHtmlClassic(sec: ResumeSection): string {
  if (!sec.content.trim()) return "";
  const title = sec.title || t("form.customModule");
  const items = sec.content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `<li>${esc(l.trim())}</li>`)
    .join("");
  return `<h3 class="r-sec r-sec-classic">${esc(title)}</h3><ul>${items}</ul>`;
}

export function resumeToHtml(data: ResumeData, template: TemplateId, app?: App): string {
  const cls =
    template === "classic"
      ? "re-paper re-classic"
      : template === "academic"
      ? "re-paper re-academic"
      : "re-paper";
  const parts: string[] = [`<div class="${cls}">`];

  for (const sec of data.sections) {
    if (!sec.visible) continue;

    if (sec.type === "basic") {
      parts.push(template === "classic" ? headerHtmlClassic(data, app) : headerHtml(data, app));
      continue;
    }

    if (sec.type === "skills") {
      if (template === "classic") {
        parts.push(skillsHtmlClassic(data.skills));
      } else if (data.skills) {
        parts.push(`<div class="r-skills">${esc(t("form.skills"))}：${esc(data.skills)}</div>`);
      }
    } else if (sec.type === "education") {
      parts.push(
        template === "classic"
          ? sectionHtmlClassic(t("form.education"), data.education)
          : sectionHtml(t("form.education"), data.education)
      );
    } else if (sec.type === "work") {
      parts.push(
        template === "classic"
          ? sectionHtmlClassic(t("form.work"), data.work)
          : sectionHtml(t("form.work"), data.work)
      );
    } else if (sec.type === "projects") {
      parts.push(
        template === "classic"
          ? sectionHtmlClassic(t("form.project"), data.projects)
          : sectionHtml(t("form.project"), data.projects)
      );
    } else if (sec.type === "custom") {
      if (template === "classic") {
        parts.push(customHtmlClassic(sec));
      } else if (sec.content.trim()) {
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
.re-paper .r-header{display:grid;align-items:center;gap:24px;margin-bottom:22px;}
.re-paper .r-header.r-layout-left{grid-template-columns:auto 1fr auto;}
.re-paper .r-header.r-layout-left .r-header-text{justify-self:start;}
.re-paper .r-header.r-layout-right{grid-template-columns:1fr auto auto;}
.re-paper .r-header.r-layout-right .r-contact-grid{order:1;}
.re-paper .r-header.r-layout-right .r-header-text{order:2;justify-self:end;text-align:right;}
.re-paper .r-header.r-layout-right .r-avatar{order:3;}
.re-paper .r-header.r-layout-top{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;}
.re-paper .r-header-text{min-width:0;}
.re-paper .r-avatar{width:90px;height:110px;object-fit:cover;border-radius:8px;border:1px solid #e0e0e0;flex:none;}
.re-paper .r-name{font-size:26px;font-weight:700;margin:0 0 2px;}
.re-paper .r-role{color:#666;font-size:13px;}
.re-paper .r-contact-grid{display:grid;grid-template-columns:repeat(2, minmax(0, auto));gap:8px 18px;font-size:12px;color:#555;}
.re-paper .r-header.r-layout-top .r-contact-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 22px;width:100%;}
.re-paper .r-header.r-layout-top .r-contact-item{flex:0 1 auto;white-space:nowrap;}
.re-paper .r-contact-item{display:flex;align-items:center;gap:5px;min-width:0;}
.re-paper .r-ci-icon{flex:none;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;}
.re-paper .r-ci-icon svg{width:14px;height:14px;display:block;}
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

/* ===== Classic 模板（迁移自 magic-resume） ===== */
.re-paper.re-classic .r-header-classic{display:grid;align-items:center;gap:24px;margin-bottom:18px;}
.re-paper.re-classic .r-header.r-layout-left{grid-template-columns:auto 1fr auto;}
.re-paper.re-classic .r-header.r-layout-left .r-header-text{justify-self:start;}
.re-paper.re-classic .r-header.r-layout-right{grid-template-columns:1fr auto auto;}
.re-paper.re-classic .r-header.r-layout-right .r-contact-grid{order:1;}
.re-paper.re-classic .r-header.r-layout-right .r-header-text{order:2;justify-self:end;text-align:right;}
.re-paper.re-classic .r-header.r-layout-right .r-avatar{order:3;}
.re-paper.re-classic .r-header.r-layout-top{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;}
.re-paper.re-classic .r-avatar{width:88px;height:112px;object-fit:cover;border-radius:6px;border:1px solid #e0e0e0;flex:none;}
.re-paper.re-classic .r-name{font-size:26px;font-weight:700;margin:0 0 2px;color:#1a1a1a;}
.re-paper.re-classic .r-role{color:#555;font-size:13px;}
.re-paper.re-classic .r-contact-grid-classic{display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:6px 20px;font-size:12px;color:#444;}
.re-paper.re-classic .r-header.r-layout-top .r-contact-grid-classic{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 20px;width:100%;}
.re-paper.re-classic .r-cic-classic{display:flex;align-items:center;gap:6px;min-width:0;}
.re-paper.re-classic .r-cic-classic .r-ci-icon{width:14px;height:14px;flex:none;color:#222;display:inline-flex;align-items:center;justify-content:center;}
.re-paper.re-classic .r-cic-classic .r-ci-icon svg{width:14px;height:14px;display:block;}
.re-paper.re-classic .r-ci-label{color:#666;flex:none;}
.re-paper.re-classic .r-ci-value{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.re-paper.re-classic h3.r-sec-classic{font-size:14px;letter-spacing:.04em;border-bottom:2px solid #222;padding-bottom:3px;margin:16px 0 8px;color:#1a1a1a;}
.re-paper.re-classic .r-item-classic{margin-bottom:10px;}
.re-paper.re-classic .r-item-classic .r-top-classic{display:flex;justify-content:space-between;font-size:13px;}
.re-paper.re-classic .r-item-classic .r-nm{font-weight:600;color:#1a1a1a;}
.re-paper.re-classic .r-item-classic .r-dt{color:#888;font-size:12px;}
.re-paper.re-classic .r-item-classic .r-sub{color:#555;font-size:12.5px;}
.re-paper.re-classic ul{margin:3px 0 0;padding-left:18px;}
.re-paper.re-classic ul li{font-size:12.5px;margin:2px 0;color:#333;}
.re-paper.re-classic .r-skills-list{margin:4px 0 0;padding-left:18px;}
.re-paper.re-classic .r-skills-list li{font-size:12.5px;margin:2px 0;color:#333;}
`;
