// 模板引擎：ResumeData -> 预览 DOM（createEl 构造，禁用 innerHTML）/ 导出 HTML 字符串
// 渲染按 data.templateId 分发（配置驱动，见 ./templates/registry.ts），与 magic-resume 思路一致。

import { App, TFile, normalizePath, setIcon } from "obsidian";
import {
  ResumeData,
  ResumeEntry,
  ResumeCustomField,
  ResumeLayout,
  TemplateId,
  MenuSection,
  SectionType,
  CustomItem,
  computeAvatarStyle,
  visibleEntries,
  formatEntryTime,
  GlobalSettings,
  DEFAULT_GLOBAL_SETTINGS,
} from "../data/resume-model";
import { t } from "../i18n";
import {
  CONTACT_ICONS,
  contactIconId,
  contactIconSvg,
  normalizeCustomFieldIcon,
} from "../ui/contact-icons";

/* ---------- 全局样式 -> CSS 变量（预览与导出共用） ---------- */

/** 全局样式 -> CSS 变量名值对（预览时逐个 setProperty 注入到 .re-paper） */
export function globalSettingsCssProps(gs: GlobalSettings): Record<string, string> {
  const s = gs ?? DEFAULT_GLOBAL_SETTINGS;
  const props: Record<string, string> = {
    "--r-theme": s.themeColor,
    "--r-font-size": `${s.baseFontSize}px`,
    "--r-line-height": String(s.lineHeight),
    "--r-sec-spacing": `${s.sectionSpacing}px`,
    "--r-page-padding": `${s.pagePadding}px`,
  };
  if (s.fontFamily && s.fontFamily.trim()) {
    props["--r-font-family"] = s.fontFamily.trim();
  }
  if (typeof s.paragraphSpacing === "number" && isFinite(s.paragraphSpacing)) {
    props["--r-para-spacing"] = `${s.paragraphSpacing}px`;
  }
  return props;
}

/** 全局样式 -> CSS 文本（导出 HTML/PDF 时拼进 <style>，作用于 .re-paper） */
export function globalSettingsCss(gs: GlobalSettings): string {
  const decls = Object.entries(globalSettingsCssProps(gs))
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `.re-paper{${decls}}`;
}

/* ---------- 预览 DOM 构建（合规：全部用 createEl，无 innerHTML） ---------- */

function sectionDom(parent: HTMLElement, title: string, entries: ResumeEntry[]): void {
  const items = visibleEntries(entries);
  if (!items.length) return;
  parent.createEl("h3", { cls: "r-sec", text: title });
  for (const e of items) {
    const item = parent.createDiv({ cls: "r-item" });
    const top = item.createDiv({ cls: "r-top" });
    top.createSpan({ cls: "r-nm", text: e.org });
    const timeStr = formatEntryTime(e);
    if (timeStr) top.createSpan({ cls: "r-dt", text: timeStr });
    const subParts: string[] = [];
    if (e.title) subParts.push(e.title);
    if (e.degree) subParts.push(e.degree);
    if (e.gpa) subParts.push(`GPA ${e.gpa}`);
    if (subParts.length) item.createDiv({ cls: "r-sub", text: subParts.join(" · ") });
    if (e.details.trim()) {
      const ul = item.createEl("ul", { cls: "r-details" });
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
    const v = (data as unknown as Record<string, unknown>)[f.key];
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

export function splitSkills(skills: string): string[] {
  if (!skills.trim()) return [];
  // 每行即一条技能（magic-resume 导入后每个 <li> 已被降级为一行；
  // 不再按顿号/逗号二次切分，避免把完整描述句切碎）
  return skills
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
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
    const timeStr = formatEntryTime(e);
    if (timeStr) top.createSpan({ cls: "r-dt", text: timeStr });
    const subParts: string[] = [];
    if (e.title) subParts.push(e.title);
    if (e.degree) subParts.push(e.degree);
    if (e.gpa) subParts.push(`GPA ${e.gpa}`);
    if (subParts.length) item.createDiv({ cls: "r-sub", text: subParts.join(" · ") });
    if (e.details.trim()) {
      const ul = item.createEl("ul", { cls: "r-details" });
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

function renderSkills(parent: HTMLElement, skills: string): void {
  const lines = splitSkills(skills);
  if (!lines.length) return;
  parent.createEl("h3", { cls: "r-sec", text: t("form.skills") });
  const ul = parent.createEl("ul", { cls: "r-skills-list" });
  for (const l of lines) ul.createEl("li", { text: l });
}

/* ---------- Timeline 模板（参考 magic-resume 时间轴布局原生重写） ---------- */

function sectionDomTimeline(parent: HTMLElement, title: string, entries: ResumeEntry[]): void {
  const items = visibleEntries(entries);
  if (!items.length) return;
  parent.createEl("h3", { cls: "r-sec r-sec-tl", text: title });
  const list = parent.createDiv({ cls: "r-tl-list" });
  for (const e of items) {
    const item = list.createDiv({ cls: "r-tl-item" });
    const timeStr = formatEntryTime(e);
    item.createDiv({ cls: "r-tl-time", text: timeStr || " " });
    item.createDiv({ cls: "r-tl-dot" });
    const body = item.createDiv({ cls: "r-tl-body" });
    const head = body.createDiv({ cls: "r-tl-head" });
    head.createSpan({ cls: "r-nm", text: e.org });
    if (e.title) head.createSpan({ cls: "r-tl-title", text: e.title });
    const subParts: string[] = [];
    if (e.degree) subParts.push(e.degree);
    if (e.gpa) subParts.push(`GPA ${e.gpa}`);
    if (subParts.length) body.createDiv({ cls: "r-sub", text: subParts.join(" · ") });
    if (e.details.trim()) {
      const ul = body.createEl("ul", { cls: "r-details" });
      for (const line of e.details.split("\n")) {
        if (line.trim()) ul.createEl("li", { text: line.trim() });
      }
    }
  }
}

/* ---------- Swiss 模板（瑞士网格风格原生重写） ---------- */

function renderHeaderSwiss(paper: HTMLElement, data: ResumeData, app?: App): void {
  const header = paper.createDiv({ cls: "r-header-swiss" });
  const top = header.createDiv({ cls: "r-swiss-top" });

  const nameBlock = top.createDiv({ cls: "r-swiss-name-block" });
  nameBlock.createEl("div", { cls: "r-swiss-name", text: data.name || " " });
  if (data.role) nameBlock.createEl("div", { cls: "r-swiss-role", text: data.role });

  const avatarUrl = resolveAvatarUrl(app, data.avatar);
  if (avatarUrl) {
    const st = computeAvatarStyle(data);
    top.createEl("img", {
      cls: "r-avatar",
      attr: {
        src: avatarUrl,
        style: `width:${st.width}px;height:${st.height}px;border-radius:${st.radius};`,
      },
    });
  }

  const contacts = buildContactItems(data);
  if (contacts.length) {
    const row = header.createDiv({ cls: "r-swiss-contacts" });
    contacts.forEach((c, i) => {
      if (i > 0) row.createSpan({ cls: "r-swiss-sep", text: "/" });
      renderContactItem(row, c);
    });
  }
}

function sectionDomSwiss(parent: HTMLElement, title: string, entries: ResumeEntry[]): void {
  const items = visibleEntries(entries);
  if (!items.length) return;
  parent.createEl("h3", { cls: "r-sec r-sec-swiss", text: title });
  for (const e of items) {
    const item = parent.createDiv({ cls: "r-item r-item-swiss" });
    const top = item.createDiv({ cls: "r-top r-top-swiss" });
    top.createSpan({ cls: "r-nm", text: e.org });
    const timeStr = formatEntryTime(e);
    if (timeStr) top.createSpan({ cls: "r-dt", text: timeStr });
    const subParts: string[] = [];
    if (e.title) subParts.push(e.title);
    if (e.degree) subParts.push(e.degree);
    if (e.gpa) subParts.push(`GPA ${e.gpa}`);
    if (subParts.length) item.createDiv({ cls: "r-sub", text: subParts.join(" · ") });
    if (e.details.trim()) {
      const ul = item.createEl("ul", { cls: "r-details" });
      for (const line of e.details.split("\n")) {
        if (line.trim()) ul.createEl("li", { text: line.trim() });
      }
    }
  }
}

/* ---------- 自定义模块渲染（从 customData 读取条目，回退旧 content 文本） ---------- */

function customSecCls(tpl: TemplateId): string {
  return tpl === "classic" ? "r-sec r-sec-classic" : "r-sec";
}
function customItemCls(tpl: TemplateId): string {
  return tpl === "classic" ? "r-item r-item-classic" : "r-item";
}

function renderCustomDom(parent: HTMLElement, sec: MenuSection, data: ResumeData, tpl: TemplateId): void {
  const items = data.customData[sec.id];
  if (items && items.length) {
    parent.createEl("h3", { cls: customSecCls(tpl), text: sec.title || t("form.customModule") });
    for (const it of items) {
      if (!it.visible) continue;
      if (!it.title.trim() && !it.subtitle.trim() && !it.description.trim()) continue;
      const item = parent.createDiv({ cls: customItemCls(tpl) });
      const top = item.createDiv({ cls: "r-top" });
      top.createSpan({ cls: "r-nm", text: it.title });
      if (it.dateRange) top.createSpan({ cls: "r-dt", text: it.dateRange });
      if (it.subtitle.trim()) item.createDiv({ cls: "r-sub", text: it.subtitle });
      if (it.description.trim()) {
        const ul = item.createEl("ul", { cls: "r-details" });
        for (const line of it.description.split("\n")) {
          if (line.trim()) ul.createEl("li", { text: line.trim() });
        }
      }
    }
    return;
  }
  if (!sec.content.trim()) return;
  parent.createEl("h3", { cls: customSecCls(tpl), text: sec.title || t("form.customModule") });
  const ul = parent.createEl("ul");
  sec.content
    .split("\n")
    .filter((l) => l.trim())
    .forEach((l) => ul.createEl("li", { text: l.trim() }));
}

/* ---------- 自我评价 / 证书 模块（对齐 magic-resume 内置模块） ---------- */

function renderSelfEvaluationDom(parent: HTMLElement, data: ResumeData, tpl: TemplateId): void {
  const text = data.selfEvaluationContent.trim();
  if (!text) return;
  const cls = tpl === "classic" ? "r-sec r-sec-classic" : "r-sec";
  parent.createEl("h3", { cls, text: t("form.selfEvaluation") });
  const ul = parent.createEl("ul", { cls: "r-details" });
  for (const line of text.split("\n")) {
    if (line.trim()) ul.createEl("li", { text: line.trim() });
  }
}

function renderCertificatesDom(
  parent: HTMLElement,
  data: ResumeData,
  app: App | undefined,
  tpl: TemplateId
): void {
  const certs = (data.certificates || []).filter((c) => c.url && c.url.trim());
  if (!certs.length) return;
  const cls = tpl === "classic" ? "r-sec r-sec-classic" : "r-sec";
  parent.createEl("h3", { cls, text: t("form.certificates") });
  const grid = parent.createDiv({ cls: "r-cert-grid" });
  for (const c of certs) {
    const url = resolveAvatarUrl(app, c.url);
    if (!url) continue;
    grid.createEl("img", {
      cls: "r-cert-img",
      attr: {
        src: url,
        style: `width:${Math.max(10, Math.min(100, c.width || 100))}%;`,
      },
    });
  }
}

/* ---------- 双栏模板（左：专业技能 / 教育经历；右：工作 / 项目 / 自定义） ---------- */

/** 归入左栏的模块类型（其余非 basic 模块进右栏） */
const TWO_COL_LEFT = new Set<SectionType>(["skills", "education"]);

/** 按类型渲染单个非 basic 模块到指定容器（单栏内容渲染器，供双栏复用） */
function renderSectionIntoDom(
  host: HTMLElement,
  sec: MenuSection,
  data: ResumeData,
  tpl: TemplateId,
  app?: App
): void {
  if (sec.type === "skills") {
    (tpl === "classic" ? renderSkillsClassic : renderSkills)(host, data.skillContent);
  } else if (sec.type === "education") {
    (tpl === "classic" ? sectionDomClassic : sectionDom)(host, t("form.education"), data.education);
  } else if (sec.type === "experience") {
    (tpl === "classic" ? sectionDomClassic : sectionDom)(host, t("form.work"), data.experience);
  } else if (sec.type === "projects") {
    (tpl === "classic" ? sectionDomClassic : sectionDom)(host, t("form.project"), data.projects);
  } else if (sec.type === "selfEvaluation") {
    renderSelfEvaluationDom(host, data, tpl);
  } else if (sec.type === "certificates") {
    renderCertificatesDom(host, data, app, tpl);
  } else if (sec.type === "custom") {
    renderCustomDom(host, sec, data, tpl);
  }
}

function renderTwoColDom(paper: HTMLElement, data: ResumeData, app?: App): void {
  // header 跨两栏（CSS: grid-column: 1 / -1）
  if (data.menuSections.some((s) => s.visible && s.type === "basic")) {
    renderHeaderDom(paper, data, app);
  }

  const left = paper.createDiv({ cls: "r-col-left" });
  const right = paper.createDiv({ cls: "r-col-right" });
  for (const sec of data.menuSections) {
    if (!sec.visible || sec.type === "basic") continue;
    renderSectionIntoDom(TWO_COL_LEFT.has(sec.type) ? left : right, sec, data, data.templateId, app);
  }

  // 左栏为空（技能与教育均被隐藏）时退回单栏，避免右侧被挤进窄列
  if (!left.childElementCount) {
    left.remove();
    paper.addClass("re-two-col-nogrid");
  }
}

/* ---------- LeftRight 模板（左：头像+联系；右：姓名+内容） ---------- */

function renderLeftRightDom(paper: HTMLElement, data: ResumeData, app?: App): void {
  const left = paper.createDiv({ cls: "r-col-left" });
  const avatarUrl = resolveAvatarUrl(app, data.avatar);
  if (avatarUrl) {
    const st = computeAvatarStyle(data);
    left.createEl("img", {
      cls: "r-avatar",
      attr: {
        src: avatarUrl,
        style: `width:${st.width}px;height:${st.height}px;border-radius:${st.radius};`,
      },
    });
  }
  const contacts = buildContactItems(data);
  if (contacts.length) {
    const grid = left.createDiv({ cls: "r-contact-grid" });
    for (const c of contacts) renderContactItem(grid, c);
  }

  const right = paper.createDiv({ cls: "r-col-right" });
  right.createEl("div", { cls: "r-name", text: data.name || " " });
  if (data.role) right.createEl("div", { cls: "r-role", text: data.role });

  const sr = (tpl: TemplateId) =>
    tpl === "classic"
      ? sectionDomClassic
      : tpl === "timeline"
      ? sectionDomTimeline
      : tpl === "swiss"
      ? sectionDomSwiss
      : sectionDom;
  const skr = (tpl: TemplateId) => (tpl === "classic" ? renderSkillsClassic : renderSkills);

  for (const sec of data.menuSections) {
    if (!sec.visible || sec.type === "basic") continue;
    if (sec.type === "skills") skr(data.templateId)(right, data.skillContent);
    else if (sec.type === "education") sr(data.templateId)(right, t("form.education"), data.education);
    else if (sec.type === "experience") sr(data.templateId)(right, t("form.work"), data.experience);
    else if (sec.type === "projects") sr(data.templateId)(right, t("form.project"), data.projects);
    else if (sec.type === "selfEvaluation") renderSelfEvaluationDom(right, data, data.templateId);
    else if (sec.type === "certificates") renderCertificatesDom(right, data, app, data.templateId);
    else if (sec.type === "custom") renderCustomDom(right, sec, data, data.templateId);
  }

  if (!right.childElementCount) {
    right.remove();
    paper.addClass("re-leftright-nogrid");
  }
}

/* ---------- 单栏渲染分发（single / academic / modern / minimalist / elegant / creative / editorial） ---------- */

function pickHeader(tpl: TemplateId) {
  if (tpl === "classic") return renderHeaderClassic;
  if (tpl === "swiss") return renderHeaderSwiss;
  return renderHeaderDom;
}
function pickSection(tpl: TemplateId) {
  if (tpl === "classic") return sectionDomClassic;
  if (tpl === "timeline") return sectionDomTimeline;
  if (tpl === "swiss") return sectionDomSwiss;
  return sectionDom;
}
function pickSkills(tpl: TemplateId) {
  return tpl === "classic" ? renderSkillsClassic : renderSkills;
}

export function renderResumeDom(
  root: HTMLElement,
  data: ResumeData,
  app?: App
): void {
  root.empty();

  const tpl: TemplateId = data.templateId || "single";
  const paperClass =
    tpl === "classic"
      ? "re-paper re-classic"
      : tpl === "academic"
      ? "re-paper re-academic"
      : tpl === "timeline"
      ? "re-paper re-timeline"
      : tpl === "swiss"
      ? "re-paper re-swiss"
      : tpl === "twoCol"
      ? "re-paper re-two-col"
      : tpl === "leftRight"
      ? "re-paper re-leftright"
      : `re-paper re-${tpl}`;
  const paper = root.createDiv({ cls: paperClass });

  // 注入全局样式 CSS 变量（主题色 / 字号 / 行距 / 模块间距 / 页边距 / 字体 / 段间距）
  const gs = data.globalSettings ?? DEFAULT_GLOBAL_SETTINGS;
  for (const [k, v] of Object.entries(globalSettingsCssProps(gs))) {
    paper.style.setProperty(k, v);
  }
  // 调试：在 DOM 上暴露当前渲染顺序，便于排查顺序是否生效
  paper.setAttribute(
    "data-section-order",
    data.menuSections.filter((s) => s.visible).map((s) => s.type).join(",")
  );

  // 双栏 / LeftRight 走独立布局
  if (tpl === "twoCol") {
    renderTwoColDom(paper, data, app);
    return;
  }
  if (tpl === "leftRight") {
    renderLeftRightDom(paper, data, app);
    return;
  }

  const headerFn = pickHeader(tpl);
  const sectionFn = pickSection(tpl);
  const skillsFn = pickSkills(tpl);

  for (const sec of data.menuSections) {
    if (!sec.visible) continue;

    if (sec.type === "basic") {
      headerFn(paper, data, app);
      continue;
    }
    if (sec.type === "skills") {
      skillsFn(paper, data.skillContent);
    } else if (sec.type === "education") {
      sectionFn(paper, t("form.education"), data.education);
    } else if (sec.type === "experience") {
      sectionFn(paper, t("form.work"), data.experience);
    } else if (sec.type === "projects") {
      sectionFn(paper, t("form.project"), data.projects);
    } else if (sec.type === "selfEvaluation") {
      renderSelfEvaluationDom(paper, data, tpl);
    } else if (sec.type === "certificates") {
      renderCertificatesDom(paper, data, app, tpl);
    } else if (sec.type === "custom") {
      renderCustomDom(paper, sec, data, tpl);
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

/** 将普通文本简介转成安全的 HTML（每行一条，转义后输出） */
function detailsToHtml(details: string): string {
  const items = details
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => `<li>${esc(l)}</li>`)
    .join("");
  return items ? `<ul>${items}</ul>` : "";
}

function sectionHtml(title: string, entries: ResumeEntry[]): string {
  const items = visibleEntries(entries);
  if (!items.length) return "";
  const html = items
    .map((e) => {
      const timeStr = formatEntryTime(e);
      const top =
        `<div class="r-top"><span class="r-nm">${esc(e.org)}</span>` +
        (timeStr ? `<span class="r-dt">${esc(timeStr)}</span>` : "") +
        `</div>`;
      const subParts: string[] = [];
      if (e.title) subParts.push(e.title);
      if (e.degree) subParts.push(e.degree);
      if (e.gpa) subParts.push(`GPA ${e.gpa}`);
      const sub = subParts.length ? `<div class="r-sub">${esc(subParts.join(" · "))}</div>` : "";
      const details = e.details.trim() ? `<div class="r-details">${detailsToHtml(e.details)}</div>` : "";
      return `<div class="r-item">${top}${sub}${details}</div>`;
    })
    .join("");
  return `<h3 class="r-sec">${esc(title)}</h3>${html}`;
}

function customHtml(sec: MenuSection, data: ResumeData, tpl: TemplateId): string {
  const items = data.customData[sec.id];
  const cls = tpl === "classic" ? "r-sec r-sec-classic" : "r-sec";
  if (items && items.length) {
    const body = items
      .filter((it) => it.visible && (it.title.trim() || it.subtitle.trim() || it.description.trim()))
      .map((it) => {
        const top =
          `<div class="r-top"><span class="r-nm">${esc(it.title)}</span>` +
          (it.dateRange ? `<span class="r-dt">${esc(it.dateRange)}</span>` : "") +
          `</div>`;
        const sub = it.subtitle.trim() ? `<div class="r-sub">${esc(it.subtitle)}</div>` : "";
        const desc = it.description.trim() ? `<div class="r-details">${detailsToHtml(it.description)}</div>` : "";
        return `<div class="${tpl === "classic" ? "r-item r-item-classic" : "r-item"}">${top}${sub}${desc}</div>`;
      })
      .join("");
    if (!body) return "";
    return `<h3 class="${cls}">${esc(sec.title || t("form.customModule"))}</h3>${body}`;
  }
  if (!sec.content.trim()) return "";
  const title = sec.title || t("form.customModule");
  const lis = sec.content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `<li>${esc(l.trim())}</li>`)
    .join("");
  return `<h3 class="${cls}">${esc(title)}</h3><ul>${lis}</ul>`;
}

function selfEvaluationHtml(data: ResumeData): string {
  const text = data.selfEvaluationContent.trim();
  if (!text) return "";
  const items = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<li>${esc(l)}</li>`)
    .join("");
  return `<h3 class="r-sec">${esc(t("form.selfEvaluation"))}</h3>${items ? `<ul class="r-details">${items}</ul>` : ""}`;
}

function certificatesHtml(data: ResumeData, app?: App): string {
  const certs = (data.certificates || []).filter((c) => c.url && c.url.trim());
  if (!certs.length) return "";
  const imgs = certs
    .map((c) => {
      const url = app ? resolveAvatarUrl(app, c.url) : "";
      if (!url) return "";
      return `<img class="r-cert-img" src="${esc(url)}" style="width:${Math.max(10, Math.min(100, c.width || 100))}%;">`;
    })
    .filter(Boolean)
    .join("");
  if (!imgs) return "";
  return `<h3 class="r-sec">${esc(t("form.certificates"))}</h3><div class="r-cert-grid">${imgs}</div>`;
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
      const timeStr = formatEntryTime(e);
      const top =
        `<div class="r-top r-top-classic"><span class="r-nm">${esc(e.org)}</span>` +
        (timeStr ? `<span class="r-dt">${esc(timeStr)}</span>` : "") +
        `</div>`;
      const subParts: string[] = [];
      if (e.title) subParts.push(e.title);
      if (e.degree) subParts.push(e.degree);
      if (e.gpa) subParts.push(`GPA ${e.gpa}`);
      const sub = subParts.length ? `<div class="r-sub">${esc(subParts.join(" · "))}</div>` : "";
      const details = e.details.trim() ? `<div class="r-details">${detailsToHtml(e.details)}</div>` : "";
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

function skillsHtml(skills: string): string {
  const lines = splitSkills(skills);
  if (!lines.length) return "";
  return `<h3 class="r-sec">${esc(t("form.skills"))}</h3><ul class="r-skills-list">${lines
    .map((l) => `<li>${esc(l)}</li>`)
    .join("")}</ul>`;
}

/* ---------- Timeline / Swiss 模板导出 HTML ---------- */

function sectionHtmlTimeline(title: string, entries: ResumeEntry[]): string {
  const items = visibleEntries(entries);
  if (!items.length) return "";
  const html = items
    .map((e) => {
      const timeStr = formatEntryTime(e);
      const subParts: string[] = [];
      if (e.degree) subParts.push(e.degree);
      if (e.gpa) subParts.push(`GPA ${e.gpa}`);
      const sub = subParts.length ? `<div class="r-sub">${esc(subParts.join(" · "))}</div>` : "";
      const titleSpan = e.title ? `<span class="r-tl-title">${esc(e.title)}</span>` : "";
      const details = e.details.trim() ? `<div class="r-details">${detailsToHtml(e.details)}</div>` : "";
      return (
        `<div class="r-tl-item">` +
        `<div class="r-tl-time">${esc(timeStr || " ")}</div>` +
        `<div class="r-tl-dot"></div>` +
        `<div class="r-tl-body">` +
        `<div class="r-tl-head"><span class="r-nm">${esc(e.org)}</span>${titleSpan}</div>` +
        `${sub}${details}` +
        `</div></div>`
      );
    })
    .join("");
  return `<h3 class="r-sec r-sec-tl">${esc(title)}</h3><div class="r-tl-list">${html}</div>`;
}

function headerHtmlSwiss(data: ResumeData, app?: App): string {
  const avatarUrl = app ? resolveAvatarUrl(app, data.avatar) : "";
  const avatarStyle = avatarUrl ? computeAvatarStyle(data) : null;
  const avatar = avatarStyle
    ? `<img class="r-avatar" src="${esc(avatarUrl)}" style="width:${avatarStyle.width}px;height:${avatarStyle.height}px;border-radius:${avatarStyle.radius};">`
    : "";
  const role = data.role ? `<div class="r-swiss-role">${esc(data.role)}</div>` : "";
  const contacts = buildContactItems(data);
  const contactRow = contacts.length
    ? `<div class="r-swiss-contacts">${contacts
        .map((c) => contactItemHtml(c))
        .join(`<span class="r-swiss-sep">/</span>`)}</div>`
    : "";
  return `
    <div class="r-header-swiss">
      <div class="r-swiss-top">
        <div class="r-swiss-name-block">
          <div class="r-swiss-name">${esc(data.name || " ")}</div>
          ${role}
        </div>
        ${avatar}
      </div>
      ${contactRow}
    </div>
  `;
}

function sectionHtmlSwiss(title: string, entries: ResumeEntry[]): string {
  const items = visibleEntries(entries);
  if (!items.length) return "";
  const html = items
    .map((e) => {
      const timeStr = formatEntryTime(e);
      const top =
        `<div class="r-top r-top-swiss"><span class="r-nm">${esc(e.org)}</span>` +
        (timeStr ? `<span class="r-dt">${esc(timeStr)}</span>` : "") +
        `</div>`;
      const subParts: string[] = [];
      if (e.title) subParts.push(e.title);
      if (e.degree) subParts.push(e.degree);
      if (e.gpa) subParts.push(`GPA ${e.gpa}`);
      const sub = subParts.length ? `<div class="r-sub">${esc(subParts.join(" · "))}</div>` : "";
      const details = e.details.trim() ? `<div class="r-details">${detailsToHtml(e.details)}</div>` : "";
      return `<div class="r-item r-item-swiss">${top}${sub}${details}</div>`;
    })
    .join("");
  return `<h3 class="r-sec r-sec-swiss">${esc(title)}</h3>${html}`;
}

/* ---------- LeftRight / TwoCol 导出 HTML ---------- */

function leftRightHtml(data: ResumeData, app?: App): { html: string; noGrid: boolean } {
  const avatarUrl = app ? resolveAvatarUrl(app, data.avatar) : "";
  const avatarStyle = avatarUrl ? computeAvatarStyle(data) : null;
  const avatar = avatarStyle
    ? `<img class="r-avatar" src="${esc(avatarUrl)}" style="width:${avatarStyle.width}px;height:${avatarStyle.height}px;border-radius:${avatarStyle.radius};">`
    : "";
  const contacts = buildContactItems(data);
  const contactGrid = contacts.length
    ? `<div class="r-contact-grid">${contacts.map(contactItemHtml).join("")}</div>`
    : "";
  const left = `${avatar}${contactGrid}`;

  const sr = (title: string, entries: ResumeEntry[]) =>
    data.templateId === "classic"
      ? sectionHtmlClassic(title, entries)
      : data.templateId === "timeline"
      ? sectionHtmlTimeline(title, entries)
      : data.templateId === "swiss"
      ? sectionHtmlSwiss(title, entries)
      : sectionHtml(title, entries);
  const skr = () =>
    data.templateId === "classic" ? skillsHtmlClassic(data.skillContent) : skillsHtml(data.skillContent);

  const rightParts: string[] = [];
  rightParts.push(`<div class="r-name">${esc(data.name || " ")}</div>`);
  if (data.role) rightParts.push(`<div class="r-role">${esc(data.role)}</div>`);
  for (const sec of data.menuSections) {
    if (!sec.visible || sec.type === "basic") continue;
    if (sec.type === "skills") rightParts.push(skr());
    else if (sec.type === "education") rightParts.push(sr(t("form.education"), data.education));
    else if (sec.type === "experience") rightParts.push(sr(t("form.work"), data.experience));
    else if (sec.type === "projects") rightParts.push(sr(t("form.project"), data.projects));
    else if (sec.type === "selfEvaluation") rightParts.push(selfEvaluationHtml(data));
    else if (sec.type === "certificates") rightParts.push(certificatesHtml(data, app));
    else if (sec.type === "custom") rightParts.push(customHtml(sec, data, data.templateId));
  }
  const noGrid = !rightParts.filter((p) => p).length;
  const html = `<div class="r-col-left">${left}</div><div class="r-col-right">${rightParts.join("")}</div>`;
  return { html, noGrid };
}

function twoColHtml(data: ResumeData, app?: App): { html: string; noGrid: boolean } {
  const parts: string[] = [];
  if (data.menuSections.some((s) => s.visible && s.type === "basic")) {
    parts.push(
      data.templateId === "classic" ? headerHtmlClassic(data, app) : headerHtml(data, app)
    );
  }
  const left: string[] = [];
  const right: string[] = [];
  for (const sec of data.menuSections) {
    if (!sec.visible || sec.type === "basic") continue;
    let html = "";
    if (sec.type === "skills") html = data.templateId === "classic" ? skillsHtmlClassic(data.skillContent) : skillsHtml(data.skillContent);
    else if (sec.type === "education") html = data.templateId === "classic" ? sectionHtmlClassic(t("form.education"), data.education) : sectionHtml(t("form.education"), data.education);
    else if (sec.type === "experience") html = data.templateId === "classic" ? sectionHtmlClassic(t("form.work"), data.experience) : sectionHtml(t("form.work"), data.experience);
    else if (sec.type === "projects") html = data.templateId === "classic" ? sectionHtmlClassic(t("form.project"), data.projects) : sectionHtml(t("form.project"), data.projects);
    else if (sec.type === "selfEvaluation") html = selfEvaluationHtml(data);
    else if (sec.type === "certificates") html = certificatesHtml(data, app);
    else if (sec.type === "custom") html = customHtml(sec, data, data.templateId);
    if (html) (TWO_COL_LEFT.has(sec.type) ? left : right).push(html);
  }
  const noGrid = left.length === 0;
  if (!noGrid) parts.push(`<div class="r-col-left">${left.join("")}</div>`);
  parts.push(`<div class="r-col-right">${right.join("")}</div>`);
  return { html: parts.join(""), noGrid };
}

export function resumeToHtml(data: ResumeData, app?: App): string {
  const tpl: TemplateId = data.templateId || "single";

  // 双栏 / LeftRight 模板走独立布局
  if (tpl === "twoCol") {
    const { html, noGrid } = twoColHtml(data, app);
    const cls = noGrid ? "re-paper re-two-col re-two-col-nogrid" : "re-paper re-two-col";
    return `<div class="${cls}">${html}</div>`;
  }
  if (tpl === "leftRight") {
    const { html, noGrid } = leftRightHtml(data, app);
    const cls = noGrid ? "re-paper re-leftright re-leftright-nogrid" : "re-paper re-leftright";
    return `<div class="${cls}">${html}</div>`;
  }

  const cls =
    tpl === "classic"
      ? "re-paper re-classic"
      : tpl === "academic"
      ? "re-paper re-academic"
      : tpl === "timeline"
      ? "re-paper re-timeline"
      : tpl === "swiss"
      ? "re-paper re-swiss"
      : `re-paper re-${tpl}`;
  const parts: string[] = [`<div class="${cls}">`];

  for (const sec of data.menuSections) {
    if (!sec.visible) continue;

    if (sec.type === "basic") {
      if (tpl === "classic") parts.push(headerHtmlClassic(data, app));
      else if (tpl === "swiss") parts.push(headerHtmlSwiss(data, app));
      else parts.push(headerHtml(data, app));
      continue;
    }

    if (sec.type === "skills") {
      parts.push(tpl === "classic" ? skillsHtmlClassic(data.skillContent) : skillsHtml(data.skillContent));
    } else if (sec.type === "education") {
      parts.push(
        tpl === "classic"
          ? sectionHtmlClassic(t("form.education"), data.education)
          : tpl === "timeline"
          ? sectionHtmlTimeline(t("form.education"), data.education)
          : tpl === "swiss"
          ? sectionHtmlSwiss(t("form.education"), data.education)
          : sectionHtml(t("form.education"), data.education)
      );
    } else if (sec.type === "experience") {
      parts.push(
        tpl === "classic"
          ? sectionHtmlClassic(t("form.work"), data.experience)
          : tpl === "timeline"
          ? sectionHtmlTimeline(t("form.work"), data.experience)
          : tpl === "swiss"
          ? sectionHtmlSwiss(t("form.work"), data.experience)
          : sectionHtml(t("form.work"), data.experience)
      );
    } else if (sec.type === "projects") {
      parts.push(
        tpl === "classic"
          ? sectionHtmlClassic(t("form.project"), data.projects)
          : tpl === "timeline"
          ? sectionHtmlTimeline(t("form.project"), data.projects)
          : tpl === "swiss"
          ? sectionHtmlSwiss(t("form.project"), data.projects)
          : sectionHtml(t("form.project"), data.projects)
      );
    } else if (sec.type === "selfEvaluation") {
      parts.push(selfEvaluationHtml(data));
    } else if (sec.type === "certificates") {
      parts.push(certificatesHtml(data, app));
    } else if (sec.type === "custom") {
      parts.push(customHtml(sec, data, tpl));
    }
  }
  parts.push(`</div>`);
  return parts.join("");
}

/* 导出用独立样式（脱离 Obsidian 主题，打印友好）。
   主题色/字号/行距/模块间距/页边距由 globalSettingsCss() 输出的
   .re-paper{--r-*} 变量块控制，变量缺省值与这里的 fallback 保持一致。 */
export const RESUME_CSS = `
*{box-sizing:border-box;}
body{margin:0;font-family:var(--r-font-family, "PingFang SC","Microsoft YaHei",-apple-system,"Segoe UI",sans-serif);color:#222;}
@page{size:A4;margin:14mm;}
.re-paper{background:#fff;width:100%;max-width:720px;margin:0 auto;padding:var(--r-page-padding,30px 36px);min-height:900px;font-size:var(--r-font-size,13px);line-height:var(--r-line-height,1.5);}
.re-paper .r-details li{margin:calc(var(--r-para-spacing,4px)) 0;}

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
.re-paper .r-name{font-size:calc(var(--r-font-size,13px) * 2);font-weight:700;margin:0 0 2px;}
.re-paper .r-role{color:#666;font-size:1em;}
.re-paper .r-contact-grid{display:grid;grid-template-columns:repeat(2, minmax(0, auto));gap:8px 18px;font-size:0.92em;color:#555;}
.re-paper .r-header.r-layout-top .r-contact-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 22px;width:100%;}
.re-paper .r-header.r-layout-top .r-contact-item{flex:0 1 auto;white-space:nowrap;}
.re-paper .r-contact-item{display:flex;align-items:center;gap:5px;min-width:0;}
.re-paper .r-ci-icon{flex:none;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;}
.re-paper .r-ci-icon svg{width:14px;height:14px;display:block;}
.re-paper .r-ci-label{color:#888;flex:none;}
.re-paper .r-ci-value{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

.re-paper h3.r-sec{font-size:1.08em;letter-spacing:.04em;border-bottom:2px solid var(--r-theme,#7c5cff);padding-bottom:3px;margin:var(--r-sec-spacing,16px) 0 8px;}
.re-paper .r-item{margin-bottom:10px;}
.re-paper .r-item .r-top{display:flex;justify-content:space-between;font-size:1em;}
.re-paper .r-item .r-nm{font-weight:600;}
.re-paper .r-item .r-dt{color:#999;font-size:0.92em;}
.re-paper .r-item .r-sub{color:#555;font-size:0.96em;}
.re-paper ul{margin:3px 0 0;padding-left:18px;}
.re-paper ul li{font-size:0.96em;margin:2px 0;}
.re-paper .r-skills{font-size:0.96em;color:#555;}
.re-paper.re-two-col{display:grid;grid-template-columns:34% 64%;gap:20px;padding:var(--r-page-padding,26px 30px);align-items:start;}
.re-paper.re-two-col .r-header{grid-column:1/-1;}
.re-paper.re-two-col .r-col-left{background:#f3f0ff;background:color-mix(in srgb, var(--r-theme,#7c5cff) 8%, #fff);padding:12px;border-radius:8px;align-self:start;}
.re-paper.re-two-col .r-col-right{min-width:0;}
.re-paper.re-two-col h3.r-sec{border-bottom:1px solid var(--r-theme,#7c5cff);}
.re-paper.re-two-col.re-two-col-nogrid{grid-template-columns:1fr;}
.re-paper.re-academic{font-family:Georgia,"Songti SC",serif;}
.re-paper.re-academic .r-name{text-align:center;border-bottom:3px double #333;padding-bottom:6px;}

/* ===== Classic 模板（迁移自 magic-resume；刻意保留黑白气质，主题色不染标题线） ===== */
.re-paper.re-classic .r-header-classic{display:grid;align-items:center;gap:24px;margin-bottom:18px;}
.re-paper.re-classic .r-header.r-layout-left{grid-template-columns:auto 1fr auto;}
.re-paper.re-classic .r-header.r-layout-left .r-header-text{justify-self:start;}
.re-paper.re-classic .r-header.r-layout-right{grid-template-columns:1fr auto auto;}
.re-paper.re-classic .r-header.r-layout-right .r-contact-grid{order:1;}
.re-paper.re-classic .r-header.r-layout-right .r-header-text{order:2;justify-self:end;text-align:right;}
.re-paper.re-classic .r-header.r-layout-right .r-avatar{order:3;}
.re-paper.re-classic .r-header.r-layout-top{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;}
.re-paper.re-classic .r-avatar{width:88px;height:112px;object-fit:cover;border-radius:6px;border:1px solid #e0e0e0;flex:none;}
.re-paper.re-classic .r-name{font-size:calc(var(--r-font-size,13px) * 2);font-weight:700;margin:0 0 2px;color:#1a1a1a;}
.re-paper.re-classic .r-role{color:#555;font-size:1em;}
.re-paper.re-classic .r-contact-grid-classic{display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:6px 20px;font-size:0.92em;color:#444;}
.re-paper.re-classic .r-header.r-layout-top .r-contact-grid-classic{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 20px;width:100%;}
.re-paper.re-classic .r-cic-classic{display:flex;align-items:center;gap:6px;min-width:0;}
.re-paper.re-classic .r-cic-classic .r-ci-icon{width:14px;height:14px;flex:none;color:#222;display:inline-flex;align-items:center;justify-content:center;}
.re-paper.re-classic .r-cic-classic .r-ci-icon svg{width:14px;height:14px;display:block;}
.re-paper.re-classic .r-ci-label{color:#666;flex:none;}
.re-paper.re-classic .r-ci-value{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.re-paper.re-classic h3.r-sec-classic{font-size:1.08em;letter-spacing:.04em;border-bottom:2px solid #222;padding-bottom:3px;margin:var(--r-sec-spacing,16px) 0 8px;color:#1a1a1a;}
.re-paper.re-classic .r-item-classic{margin-bottom:10px;}
.re-paper.re-classic .r-item-classic .r-top-classic{display:flex;justify-content:space-between;font-size:1em;}
.re-paper.re-classic .r-item-classic .r-nm{font-weight:600;color:#1a1a1a;}
.re-paper.re-classic .r-item-classic .r-dt{color:#888;font-size:0.92em;}
.re-paper.re-classic .r-item-classic .r-sub{color:#555;font-size:0.96em;}
.re-paper.re-classic ul{margin:3px 0 0;padding-left:18px;}
.re-paper.re-classic ul li{font-size:0.96em;margin:2px 0;color:#333;}
.re-paper.re-classic .r-skills-list{margin:4px 0 0;padding-left:18px;}
.re-paper.re-classic .r-skills-list li{font-size:0.96em;margin:2px 0;color:#333;}

/* ===== Timeline 模板（参考 magic-resume 时间轴布局原生重写） ===== */
.re-paper.re-timeline .r-tl-list{position:relative;}
.re-paper.re-timeline .r-tl-item{position:relative;display:grid;grid-template-columns:88px 16px 1fr;column-gap:10px;padding-bottom:12px;}
.re-paper.re-timeline .r-tl-item::before{content:"";position:absolute;left:105px;top:8px;bottom:-4px;width:2px;background:#e5e1f2;background:color-mix(in srgb, var(--r-theme,#7c5cff) 18%, #fff);}
.re-paper.re-timeline .r-tl-item:last-child::before{display:none;}
.re-paper.re-timeline .r-tl-time{font-size:0.9em;color:#777;text-align:right;padding-top:2px;line-height:1.35;}
.re-paper.re-timeline .r-tl-dot{position:relative;}
.re-paper.re-timeline .r-tl-dot::after{content:"";position:absolute;left:50%;top:6px;transform:translateX(-50%);width:10px;height:10px;border-radius:50%;background:var(--r-theme,#7c5cff);border:2px solid #fff;box-shadow:0 0 0 2px color-mix(in srgb, var(--r-theme,#7c5cff) 45%, #fff);}
.re-paper.re-timeline .r-tl-body{min-width:0;}
.re-paper.re-timeline .r-tl-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;font-size:1em;}
.re-paper.re-timeline .r-tl-head .r-nm{font-weight:600;}
.re-paper.re-timeline .r-tl-title{color:#666;font-size:0.95em;}
.re-paper.re-timeline h3.r-sec-tl{border-bottom:1px solid var(--r-theme,#7c5cff);}

/* ===== Swiss 模板（瑞士网格风格原生重写：粗黑规则线 + 大字标题 + 主题色方块标记） ===== */
.re-paper.re-swiss .r-header-swiss{border-top:4px solid #111;padding-top:12px;margin-bottom:12px;}
.re-paper.re-swiss .r-swiss-top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;}
.re-paper.re-swiss .r-swiss-name-block{min-width:0;}
.re-paper.re-swiss .r-swiss-name{font-size:calc(var(--r-font-size,13px) * 2.6);font-weight:800;letter-spacing:.02em;line-height:1.05;color:#111;}
.re-paper.re-swiss .r-swiss-role{font-size:1.05em;color:#444;margin-top:3px;}
.re-paper.re-swiss .r-swiss-contacts{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:0.9em;color:#444;border-top:1px solid #111;margin-top:10px;padding-top:8px;}
.re-paper.re-swiss .r-swiss-sep{color:#bbb;}
.re-paper.re-swiss h3.r-sec-swiss{display:flex;align-items:center;gap:8px;border-top:2px solid #111;border-bottom:none;padding-top:6px;margin:var(--r-sec-spacing,16px) 0 6px;font-size:0.95em;letter-spacing:.12em;text-transform:uppercase;color:#111;}
.re-paper.re-swiss h3.r-sec-swiss::before{content:"";width:9px;height:9px;background:var(--r-theme,#7c5cff);flex:none;}
.re-paper.re-swiss .r-item-swiss{margin-bottom:10px;}
.re-paper.re-swiss .r-item-swiss .r-top-swiss{display:flex;justify-content:space-between;align-items:baseline;font-size:1em;}
.re-paper.re-swiss .r-item-swiss .r-nm{font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:#111;}
.re-paper.re-swiss .r-item-swiss .r-dt{color:#777;font-size:0.9em;}
.re-paper.re-swiss ul li{font-size:0.96em;margin:2px 0;color:#333;}

/* ===== LeftRight 模板（左：头像+联系；右：姓名+内容） ===== */
.re-paper.re-leftright{display:grid;grid-template-columns:30% 68%;gap:22px;align-items:start;}
.re-paper.re-leftright .r-col-left{position:sticky;top:0;align-self:start;}
.re-paper.re-leftright .r-col-right{min-width:0;}
.re-paper.re-leftright .r-avatar{width:100%;max-width:140px;height:auto;aspect-ratio:4/5;object-fit:cover;border-radius:8px;margin:0 auto 12px;display:block;}
.re-paper.re-leftright .r-col-left .r-contact-grid{grid-template-columns:1fr;gap:6px;}
.re-paper.re-leftright.re-leftright-nogrid{grid-template-columns:1fr;}
.re-paper.re-leftright.re-leftright-nogrid .r-col-left{display:none;}

/* ===== Modern 模板（干净留白 + 左侧主题色条） ===== */
.re-paper.re-modern .r-header{border-left:4px solid var(--r-theme,#2563eb);padding-left:14px;}
.re-paper.re-modern .r-name{color:var(--r-theme,#2563eb);}
.re-paper.re-modern h3.r-sec{border-bottom:none;border-left:3px solid var(--r-theme,#2563eb);padding-left:8px;}

/* ===== Minimalist 模板（极简：细发丝线 + 小号大写标题） ===== */
.re-paper.re-minimalist .r-name{font-weight:600;letter-spacing:.04em;}
.re-paper.re-minimalist h3.r-sec{border-bottom:1px solid #ddd;font-size:0.82em;letter-spacing:.18em;text-transform:uppercase;color:#444;font-weight:600;}
.re-paper.re-minimalist .r-item .r-top{border-bottom:1px dotted #eee;padding-bottom:3px;}

/* ===== Elegant 模板（衬线 + 精致分隔） ===== */
.re-paper.re-elegant{font-family:Georgia,"Songti SC",var(--r-font-family,serif);}
.re-paper.re-elegant .r-name{text-align:left;font-weight:600;letter-spacing:.06em;}
.re-paper.re-elegant h3.r-sec{border-bottom:1px solid var(--r-theme,#5b3a29);color:var(--r-theme,#5b3a29);font-style:italic;font-weight:600;}
.re-paper.re-elegant .r-header.r-layout-top{text-align:left;align-items:flex-start;}

/* ===== Creative 模板（活泼：主题色标题块 + 圆角卡片） ===== */
.re-paper.re-creative .r-header{border-radius:10px;background:color-mix(in srgb, var(--r-theme,#db2777) 10%, #fff);padding:14px 18px;}
.re-paper.re-creative .r-name{color:var(--r-theme,#db2777);}
.re-paper.re-creative h3.r-sec{background:var(--r-theme,#db2777);color:#fff;border:none;border-radius:4px;padding:4px 10px;display:inline-block;font-size:0.95em;}

/* ===== Editorial 模板（杂志风：大写标题 + 主题色方块标记） ===== */
.re-paper.re-editorial .r-name{font-weight:800;letter-spacing:.02em;}
.re-paper.re-editorial h3.r-sec{display:flex;align-items:center;gap:8px;border-bottom:none;border-top:2px solid var(--r-theme,#0f766e);padding-top:6px;font-size:0.92em;letter-spacing:.14em;text-transform:uppercase;color:var(--r-theme,#0f766e);}
.re-paper.re-editorial h3.r-sec::before{content:"";width:10px;height:10px;background:var(--r-theme,#0f766e);flex:none;}

/* ===== 证书作品（对齐 magic-resume 内置模块） ===== */
.re-paper .r-cert-grid{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;}
.re-paper .r-cert-img{max-width:150px;max-height:90px;width:auto;height:auto;object-fit:contain;border:1px solid #e5e5e5;border-radius:4px;background:#fff;}
`;
