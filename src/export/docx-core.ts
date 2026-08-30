// DOCX 导出核心：纯 OOXML + store 模式 ZIP 生成（零运行时依赖，无 eval / 无 new Function）。
//
// 该模块不依赖 Obsidian，所有与 Obsidian 的交互（图片读取）通过 loadImage 回调注入，
// 因此可在 Node 环境中单独单测（见构建验证脚本）。
//
// 文档结构（OOXML / WordprocessingML）：
//   [Content_Types].xml
//   _rels/.rels
//   word/document.xml
//   word/_rels/document.xml.rels  (引用 styles + 可能的图片)
//   word/styles.xml
//   word/media/image1.{ext}       (仅当存在头像图片)
//   docProps/core.xml
//   docProps/app.xml

import {
  ResumeData,
  ResumeEntry,
  CustomItem,
  MenuSection,
  SectionType,
  computeAvatarStyle,
  visibleEntries,
  formatEntryTime,
} from "../data/resume-model";
import { t } from "../i18n";
import { splitSkills } from "../render/template";

/* =========================================================================
 * 单位换算（与旧 docx 库保持一致）
 * ====================================================================== */

const PX_PER_TWIP = 15; // 96dpi 下 1px ≈ 15 twip
const EMU_PER_PX = 9525; // 1px = 9525 EMU

function pxToTwip(px: number): number {
  return Math.round(px * PX_PER_TWIP);
}
function pxToHalfPt(px: number): number {
  return Math.round((px * 3) / 2);
}
function pxToEmu(px: number): number {
  return Math.round(px * EMU_PER_PX);
}
function inchesToTwip(inches: number): number {
  return Math.round(inches * 1440);
}

/* =========================================================================
 * XML / 文本转义
 * ====================================================================== */

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* =========================================================================
 * 颜色 / 字体
 * ====================================================================== */

function hexColor(color: string): string {
  return color.replace(/^#/, "").toUpperCase();
}

function whiteOrBlackOn(color: string): "FFFFFF" | "000000" {
  const c = color.replace(/^#/, "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 160 ? "000000" : "FFFFFF";
}

type FontSpec = { ascii: string; hAnsi: string; eastAsia: string };

function runFont(gs: ResumeData["globalSettings"]): FontSpec {
  const f = gs?.fontFamily;
  if (f && f.trim()) {
    const first = f
      .split(",")[0]
      .trim()
      .replace(/^["']|["']$/g, "");
    return { ascii: first, hAnsi: first, eastAsia: first };
  }
  return { ascii: "Segoe UI", hAnsi: "Segoe UI", eastAsia: "Microsoft YaHei" };
}

/* =========================================================================
 * Run / Paragraph 构造
 * ====================================================================== */

interface RunOpts {
  bold?: boolean;
  italics?: boolean;
  color?: string;
  sizeHalfPt?: number;
  font?: FontSpec;
}

function runXml(text: string, o: RunOpts): string {
  const rpr: string[] = [];
  if (o.bold) rpr.push("<w:b/>");
  if (o.italics) rpr.push("<w:i/>");
  if (o.color) rpr.push(`<w:color w:val="${xmlEscape(o.color)}"/>`);
  if (o.sizeHalfPt) rpr.push(`<w:sz w:val="${o.sizeHalfPt}"/>`);
  if (o.font) {
    const f = o.font;
    rpr.push(
      `<w:rFonts w:ascii="${xmlEscape(f.ascii)}" w:hAnsi="${xmlEscape(f.hAnsi)}" w:eastAsia="${xmlEscape(f.eastAsia)}"/>`
    );
  }
  const rprXml = rpr.length ? `<w:rPr>${rpr.join("")}</w:rPr>` : "";
  return `<w:r>${rprXml}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

interface ParaOpts {
  align?: "center" | "left" | "right";
  beforeTwip?: number;
  afterTwip?: number;
  borderColor?: string;
  indentLeftTwip?: number;
}

function paraXml(childrenXml: string, o: ParaOpts): string {
  const ppr: string[] = [];
  if (o.align) ppr.push(`<w:jc w:val="${o.align}"/>`);
  if (o.indentLeftTwip) ppr.push(`<w:ind w:left="${o.indentLeftTwip}"/>`);
  if (o.borderColor) {
    ppr.push(
      `<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="${xmlEscape(o.borderColor)}"/></w:pBdr>`
    );
  }
  const spacing: string[] = [];
  if (o.beforeTwip != null) spacing.push(`w:before="${o.beforeTwip}"`);
  if (o.afterTwip != null) spacing.push(`w:after="${o.afterTwip}"`);
  if (spacing.length) ppr.push(`<w:spacing ${spacing.join(" ")}/>`);
  const pprXml = ppr.length ? `<w:pPr>${ppr.join("")}</w:pPr>` : "";
  return `<w:p>${pprXml}${childrenXml}</w:p>`;
}

/* =========================================================================
 * 文本块构造（对齐旧 docx 库的视觉规格）
 * ====================================================================== */

function baseSize(data: ResumeData): number {
  return data.globalSettings?.baseFontSize ?? 13;
}

function sectionHeading(data: ResumeData, title: string, dark = false): string {
  const gs = data.globalSettings;
  const theme = hexColor(gs?.themeColor ?? "#7c5cff");
  const size = baseSize(data);
  const isClassic = data.templateId === "classic";
  const color = dark ? "FFFFFF" : isClassic ? "1A1A1A" : theme;
  const borderColor = dark ? "FFFFFF" : isClassic ? "222222" : theme;
  const run = runXml(title, {
    bold: true,
    color,
    sizeHalfPt: pxToHalfPt(size * 1.15),
    font: runFont(gs),
  });
  return paraXml(run, {
    beforeTwip: pxToTwip(gs?.sectionSpacing ?? 16),
    afterTwip: pxToTwip(8),
    borderColor,
  });
}

interface BodyOpts {
  bold?: boolean;
  italics?: boolean;
  color?: string;
  spacing?: { before?: number; after?: number };
  dark?: boolean;
}

function bodyParagraph(data: ResumeData, text: string, opts: BodyOpts = {}): string {
  const gs = data.globalSettings;
  const size = baseSize(data);
  const dark = opts.dark ?? false;
  const run = runXml(text, {
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color ?? (dark ? "F5F5F5" : "222222"),
    sizeHalfPt: pxToHalfPt(size),
    font: runFont(gs),
  });
  return paraXml(run, {
    beforeTwip: pxToTwip(opts.spacing?.before ?? 0),
    afterTwip: pxToTwip(opts.spacing?.after ?? gs?.paragraphSpacing ?? 4),
  });
}

function bulletParagraph(data: ResumeData, text: string, dark = false): string {
  const gs = data.globalSettings;
  const size = baseSize(data);
  const run = runXml("•  " + text, {
    sizeHalfPt: pxToHalfPt(size),
    color: dark ? "F5F5F5" : "333333",
    font: runFont(gs),
  });
  return paraXml(run, {
    beforeTwip: 0,
    afterTwip: pxToTwip(gs?.paragraphSpacing ?? 4),
    indentLeftTwip: 360,
  });
}

function entryTopParagraph(data: ResumeData, e: ResumeEntry, dark = false): string {
  const gs = data.globalSettings;
  const size = baseSize(data);
  const runs: string[] = [
    runXml(e.org, {
      bold: true,
      sizeHalfPt: pxToHalfPt(size * 1.02),
      color: dark ? "FFFFFF" : "1A1A1A",
      font: runFont(gs),
    }),
  ];
  const timeStr = formatEntryTime(e);
  if (timeStr) {
    runs.push(
      runXml("  " + timeStr, {
        italics: true,
        sizeHalfPt: pxToHalfPt(size * 0.92),
        color: dark ? "DDDDDD" : "777777",
        font: runFont(gs),
      })
    );
  }
  return paraXml(runs.join(""), { afterTwip: pxToTwip(2) });
}

function entrySubParagraph(data: ResumeData, e: ResumeEntry, dark = false): string | null {
  const parts: string[] = [];
  if (e.title) parts.push(e.title);
  if (e.degree) parts.push(e.degree);
  if (e.gpa) parts.push("GPA " + e.gpa);
  if (!parts.length) return null;
  return bodyParagraph(data, parts.join(" · "), {
    color: dark ? "E5E5E5" : "555555",
    spacing: { after: 2 },
    dark,
  });
}

function entryDetailParagraphs(data: ResumeData, details: string, dark = false): string[] {
  const out: string[] = [];
  for (const line of details.split("\n")) {
    const trimmed = line.trim().replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
    if (trimmed) out.push(bulletParagraph(data, trimmed, dark));
  }
  return out;
}

function entryParagraphs(data: ResumeData, entries: ResumeEntry[], dark = false): string[] {
  const out: string[] = [];
  for (const e of visibleEntries(entries)) {
    out.push(entryTopParagraph(data, e, dark));
    const sub = entrySubParagraph(data, e, dark);
    if (sub) out.push(sub);
    if (e.details) out.push(...entryDetailParagraphs(data, e.details, dark));
  }
  return out;
}

/* =========================================================================
 * 联系信息（使用 Unicode 符号前缀，避免内嵌多张图标图片）
 * ====================================================================== */

interface ContactItem {
  iconKey: string;
  label: string;
  value: string;
  showLabel: boolean;
}

const BASIC_FIELD_ICON_KEY: Record<string, string> = {
  phone: "phone",
  email: "mail",
  employmentStatus: "employmentStatus",
  location: "location",
  birthDate: "birthDate",
};

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
    items.push({
      iconKey: cf.icon || "link",
      label: cf.label,
      value: cf.value,
      showLabel: cf.showLabel,
    });
  }
  return items;
}

function contactIconSymbol(iconKey: string): string {
  const map: Record<string, string> = {
    phone: "☏",
    mail: "✉",
    location: "📍",
    birthDate: "📅",
    employmentStatus: "💼",
    link: "🔗",
    globe: "🌐",
    github: "⌘",
    briefcase: "💼",
    award: "🏆",
    book: "📖",
    "map-pin": "📍",
    calendar: "📅",
    star: "★",
    heart: "♥",
    flag: "⚑",
    zap: "⚡",
  };
  return map[iconKey] ?? "•";
}

function contactParagraphs(data: ResumeData, dark = false): string[] {
  const items = buildContactItems(data);
  const gs = data.globalSettings;
  const size = baseSize(data);
  const color = dark ? "FFFFFF" : "444444";
  return items.map((item) => {
    const text = item.showLabel && item.label ? `${item.label}：${item.value}` : item.value;
    const run = runXml(contactIconSymbol(item.iconKey) + "  " + text, {
      sizeHalfPt: pxToHalfPt(size * 0.92),
      color,
      font: runFont(gs),
    });
    return paraXml(run, { afterTwip: pxToTwip(4) });
  });
}

/* =========================================================================
 * 模块渲染
 * ====================================================================== */

function sectionParagraphs(data: ResumeData, title: string, entries: ResumeEntry[], dark = false): string[] {
  const items = visibleEntries(entries);
  if (!items.length) return [];
  const out: string[] = [sectionHeading(data, title, dark)];
  out.push(...entryParagraphs(data, items, dark));
  return out;
}

function skillsParagraphs(data: ResumeData, dark = false): string[] {
  const lines = splitSkills(data.skillContent);
  if (!lines.length) return [];
  const out: string[] = [sectionHeading(data, t("form.skills"), dark)];
  for (const line of lines) out.push(bulletParagraph(data, line, dark));
  return out;
}

function selfEvaluationParagraphs(data: ResumeData, dark = false): string[] {
  const text = data.selfEvaluationContent.trim();
  if (!text) return [];
  const out: string[] = [sectionHeading(data, t("form.selfEvaluation"), dark)];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) out.push(bulletParagraph(data, trimmed, dark));
  }
  return out;
}

function customItemParagraphs(data: ResumeData, item: CustomItem, dark = false): string[] {
  const gs = data.globalSettings;
  const size = baseSize(data);
  const runs: string[] = [
    runXml(item.title, {
      bold: true,
      sizeHalfPt: pxToHalfPt(size * 1.02),
      color: dark ? "FFFFFF" : "1A1A1A",
      font: runFont(gs),
    }),
  ];
  if (item.dateRange) {
    runs.push(
      runXml("  " + item.dateRange, {
        italics: true,
        sizeHalfPt: pxToHalfPt(size * 0.92),
        color: dark ? "DDDDDD" : "777777",
        font: runFont(gs),
      })
    );
  }
  const out: string[] = [paraXml(runs.join(""), { afterTwip: pxToTwip(2) })];
  if (item.subtitle.trim()) {
    out.push(
      bodyParagraph(data, item.subtitle, { color: dark ? "E5E5E5" : "555555", spacing: { after: 2 }, dark })
    );
  }
  if (item.description.trim()) {
    out.push(...entryDetailParagraphs(data, item.description, dark));
  }
  return out;
}

function customParagraphs(data: ResumeData, sec: MenuSection, dark = false): string[] {
  const items = data.customData[sec.id];
  if (items && items.length) {
    const visible = items.filter(
      (it) => it.visible && (it.title.trim() || it.subtitle.trim() || it.description.trim())
    );
    if (!visible.length) return [];
    const out: string[] = [sectionHeading(data, sec.title || t("form.customModule"), dark)];
    for (const it of visible) out.push(...customItemParagraphs(data, it, dark));
    return out;
  }
  if (!sec.content.trim()) return [];
  const out: string[] = [sectionHeading(data, sec.title || t("form.customModule"), dark)];
  for (const line of sec.content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) out.push(bulletParagraph(data, trimmed, dark));
  }
  return out;
}

function certificatesParagraphs(data: ResumeData, dark = false): string[] {
  const certs = (data.certificates || []).filter((c) => c.url && c.url.trim() && c.visible !== false);
  if (!certs.length) return [];
  const out: string[] = [sectionHeading(data, t("form.certificates"), dark)];
  for (const c of certs) {
    // 证书图片异步加载较复杂，以文字占位（与旧实现一致）
    out.push(
      bodyParagraph(data, c.url, { color: dark ? "E5E5E5" : "555555", spacing: { after: 2 }, dark })
    );
  }
  return out;
}

function renderSectionInto(data: ResumeData, sec: MenuSection, dark = false): string[] {
  switch (sec.type) {
    case "skills":
      return skillsParagraphs(data, dark);
    case "education":
      return sectionParagraphs(data, t("form.education"), data.education, dark);
    case "experience":
      return sectionParagraphs(data, t("form.work"), data.experience, dark);
    case "projects":
      return sectionParagraphs(data, t("form.project"), data.projects, dark);
    case "selfEvaluation":
      return selfEvaluationParagraphs(data, dark);
    case "certificates":
      return certificatesParagraphs(data, dark);
    case "custom":
      return customParagraphs(data, sec, dark);
    default:
      return [];
  }
}

/* =========================================================================
 * 头像 DrawingML
 * ====================================================================== */

function avatarDrawingXml(widthPx: number, heightPx: number, rId: string): string {
  const cx = pxToEmu(widthPx);
  const cy = pxToEmu(heightPx);
  const drawing = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="Avatar"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="avatar"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${xmlEscape(rId)}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  return paraXml(drawing, { align: "center", afterTwip: pxToTwip(14) });
}

/* =========================================================================
 * 布局：单栏 / 双栏 / 左右分栏
 * ====================================================================== */

export interface LoadedImage {
  data: Uint8Array;
  ext: "png" | "jpg" | "gif" | "bmp";
}

function nameParagraph(data: ResumeData, dark: boolean, color: string): string {
  const gs = data.globalSettings;
  const size = baseSize(data);
  const run = runXml(data.name || " ", {
    bold: true,
    color,
    sizeHalfPt: pxToHalfPt(size * 2.2),
    font: runFont(gs),
  });
  return paraXml(run, { afterTwip: pxToTwip(4) });
}

function roleParagraph(data: ResumeData, dark: boolean, color: string): string {
  const gs = data.globalSettings;
  const size = baseSize(data);
  const run = runXml(data.role, {
    italics: true,
    color,
    sizeHalfPt: pxToHalfPt(size * 1.05),
    font: runFont(gs),
  });
  return paraXml(run, { afterTwip: pxToTwip(6) });
}

function singleColumnBlocks(data: ResumeData): string {
  const gs = data.globalSettings;
  const theme = hexColor(gs?.themeColor ?? "#7c5cff");
  const nameColor = data.templateId === "classic" ? "1A1A1A" : theme;

  const blocks: string[] = [];
  blocks.push(nameParagraph(data, false, nameColor));
  if (data.role) blocks.push(roleParagraph(data, false, "555555"));
  const contacts = contactParagraphs(data);
  if (contacts.length) blocks.push(...contacts);

  for (const sec of data.menuSections) {
    if (!sec.visible || sec.type === "basic") continue;
    blocks.push(...renderSectionInto(data, sec));
  }
  return blocks.join("");
}

interface TableMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function tcMarXml(m: TableMargins): string {
  return `<w:tcMar><w:top w:w="${inchesToTwip(m.top)}" w:type="dxa"/><w:left w:w="${inchesToTwip(m.left)}" w:type="dxa"/><w:bottom w:w="${inchesToTwip(m.bottom)}" w:type="dxa"/><w:right w:w="${inchesToTwip(m.right)}" w:type="dxa"/></w:tcMar>`;
}

function tableXml(
  leftBlocks: string,
  rightBlocks: string,
  leftPct: number,
  rightPct: number,
  leftShaded: boolean,
  theme: string,
  leftMar: TableMargins,
  rightMar: TableMargins
): string {
  const leftW = leftPct * 50; // pct 类型：100% = 5000，故 30% = 1500
  const rightW = rightPct * 50;
  const leftTcPr = `<w:tcPr><w:tcW w:w="${leftW}" w:type="pct"/>${
    leftShaded ? `<w:shd w:val="clear" w:color="auto" w:fill="${xmlEscape(theme)}"/>` : ""
  }<w:vAlign w:val="top"/>${tcMarXml(leftMar)}</w:tcPr>`;
  const rightTcPr = `<w:tcPr><w:tcW w:w="${rightW}" w:type="pct"/><w:vAlign w:val="top"/>${tcMarXml(rightMar)}</w:tcPr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/><w:left w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/><w:right w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${leftW}"/><w:gridCol w:w="${rightW}"/></w:tblGrid><w:tr><w:tc>${leftTcPr}${leftBlocks}</w:tc><w:tc>${rightTcPr}${rightBlocks}</w:tc></w:tr></w:tbl>`;
}

function twoColBlocks(data: ResumeData, avatarDrawing: string): string {
  const gs = data.globalSettings;
  const theme = hexColor(gs?.themeColor ?? "#7c5cff");
  const textColor = whiteOrBlackOn(theme);

  const leftChildren: string[] = [];
  const rightChildren: string[] = [];

  if (avatarDrawing) leftChildren.push(avatarDrawing);
  leftChildren.push(nameParagraph(data, true, textColor));
  if (data.role) leftChildren.push(roleParagraph(data, true, textColor));
  const contacts = contactParagraphs(data, true);
  if (contacts.length) leftChildren.push(...contacts);

  for (const sec of data.menuSections) {
    if (!sec.visible || sec.type === "basic") continue;
    const isLeft = sec.type === "education";
    const paragraphs = renderSectionInto(data, sec, isLeft);
    if (isLeft) {
      if (paragraphs.length) leftChildren.push(...paragraphs);
    } else {
      rightChildren.push(...paragraphs);
    }
  }

  if (!leftChildren.length) leftChildren.push(paraXml("", {}));
  if (!rightChildren.length) rightChildren.push(paraXml("", {}));

  const noLeft =
    !avatarDrawing &&
    !data.name &&
    !data.role &&
    !contacts.length &&
    !data.education.filter((e) => e.visible !== false).length;
  if (noLeft) return singleColumnBlocks(data);

  return tableXml(
    leftChildren.join(""),
    rightChildren.join(""),
    34,
    66,
    true,
    theme,
    { top: 0.28, right: 0.22, bottom: 0.28, left: 0.3 },
    { top: 0.28, right: 0.28, bottom: 0.28, left: 0.28 }
  );
}

function leftRightBlocks(data: ResumeData, avatarDrawing: string): string {
  const leftChildren: string[] = [];
  const rightChildren: string[] = [];

  if (avatarDrawing) leftChildren.push(avatarDrawing);
  const contacts = contactParagraphs(data);
  if (contacts.length) leftChildren.push(...contacts);

  rightChildren.push(nameParagraph(data, false, "1A1A1A"));
  if (data.role) rightChildren.push(roleParagraph(data, false, "555555"));

  for (const sec of data.menuSections) {
    if (!sec.visible || sec.type === "basic") continue;
    rightChildren.push(...renderSectionInto(data, sec));
  }

  if (!leftChildren.length) leftChildren.push(paraXml("", {}));
  if (!rightChildren.length) rightChildren.push(paraXml("", {}));

  return tableXml(
    leftChildren.join(""),
    rightChildren.join(""),
    30,
    70,
    false,
    "",
    { top: 0.25, right: 0.22, bottom: 0.25, left: 0.28 },
    { top: 0.25, right: 0.28, bottom: 0.25, left: 0.28 }
  );
}

/* =========================================================================
 * 文档装配 + ZIP（store 模式，无压缩）
 * ====================================================================== */

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";

const IMG_CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
};

function sectPrXml(pagePaddingPx: number): string {
  const m = inchesToTwip(pagePaddingPx / 96);
  return `<w:sectPr><w:pgMar w:top="${m}" w:right="${m}" w:bottom="${m}" w:left="${m}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
}

function documentXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}" xmlns:wp="${WP_NS}" xmlns:a="${A_NS}" xmlns:pic="${PIC_NS}"><w:body>${body}</w:body></w:document>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W_NS}"><w:docDefaults><w:rPrDefault><w:rPr/></w:rPrDefault><w:pPrDefault><w:pPr/></w:pPrDefault></w:docDefaults></w:styles>`;
}

function contentTypesXml(imageExt: string | null): string {
  const imgDefault = imageExt
    ? `<Default Extension="${imageExt}" ContentType="${IMG_CONTENT_TYPE[imageExt]}"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${CT_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imgDefault}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function rootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="${REL_NS}/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${R_NS}/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function docRelsXml(imageExt: string | null): string {
  const imgRel = imageExt
    ? `<Relationship Id="rIdImg" Type="${R_NS}/image" Target="media/image1.${imageExt}"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${REL_NS}"><Relationship Id="rIdStyles" Type="${R_NS}/styles" Target="styles.xml"/>${imgRel}</Relationships>`;
}

function corePropsXml(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(title)}</dc:title><dc:creator>Obsidian Resume Editor</dc:creator></cp:coreProperties>`;
}

function appPropsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Obsidian Resume Editor</Application></Properties>`;
}

/* ----- store 模式 ZIP 写入（CRC32，无依赖） ----- */

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function zipStore(files: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const localOffset = offset; // 该文件本地头在归档中的起始偏移

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0, true);
    lh.setUint16(8, 0, true); // method 0 = store
    lh.setUint16(10, 0, true);
    lh.setUint16(12, 0, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, f.data.length, true);
    lh.setUint32(22, f.data.length, true);
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true);
    locals.push(new Uint8Array(lh.buffer), nameBytes, f.data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, 0, true);
    ch.setUint16(14, 0, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, f.data.length, true);
    ch.setUint32(24, f.data.length, true);
    ch.setUint16(28, nameBytes.length, true);
    ch.setUint16(30, 0, true);
    ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true);
    ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true);
    ch.setUint32(42, localOffset, true); // 关键：指向本文件本地头偏移（32 位）
    centrals.push(new Uint8Array(ch.buffer), nameBytes);

    offset += 30 + nameBytes.length + f.data.length;
  }

  let centralSize = 0;
  for (const c of centrals) centralSize += c.length;

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true); // 单盘归档：含中央目录的磁盘号 = 0
  eocd.setUint16(8, files.length, true); // 本磁盘上的中央目录记录数
  eocd.setUint16(10, files.length, true); // 中央目录总记录数
  eocd.setUint32(12, centralSize, true); // 中央目录大小
  eocd.setUint32(16, offset, true); // 中央目录起始偏移
  eocd.setUint16(20, 0, true); // 注释长度

  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of locals) {
    out.set(c, pos);
    pos += c.length;
  }
  for (const c of centrals) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(new Uint8Array(eocd.buffer), pos);
  return out;
}

/* =========================================================================
 * 对外主入口（纯逻辑，图片加载通过回调注入）
 * ====================================================================== */

export type ImageLoader = (path: string) => Promise<LoadedImage | null>;

export async function renderResumeDocx(
  data: ResumeData,
  loadImage: ImageLoader
): Promise<Uint8Array> {
  let image: LoadedImage | null = null;
  let avatarDrawing = "";

  if (data.avatar && data.avatar.trim()) {
    const loaded = await loadImage(data.avatar.trim());
    if (loaded) {
      image = loaded;
      const st = computeAvatarStyle(data);
      avatarDrawing = avatarDrawingXml(st.width, st.height, "rIdImg");
    }
  }

  let body: string;
  if (data.templateId === "twoCol") {
    body = twoColBlocks(data, avatarDrawing);
  } else if (data.templateId === "leftRight") {
    body = leftRightBlocks(data, avatarDrawing);
  } else {
    body = singleColumnBlocks(data);
  }

  body += sectPrXml(data.globalSettings?.pagePadding ?? 30);
  const imageExt = image ? image.ext : null;

  const files: ZipEntry[] = [
    { name: "[Content_Types].xml", data: new TextEncoder().encode(contentTypesXml(imageExt)) },
    { name: "_rels/.rels", data: new TextEncoder().encode(rootRelsXml()) },
    { name: "word/document.xml", data: new TextEncoder().encode(documentXml(body)) },
    { name: "word/styles.xml", data: new TextEncoder().encode(stylesXml()) },
    { name: "word/_rels/document.xml.rels", data: new TextEncoder().encode(docRelsXml(imageExt)) },
    { name: "docProps/core.xml", data: new TextEncoder().encode(corePropsXml(data.title || data.name || "Resume")) },
    { name: "docProps/app.xml", data: new TextEncoder().encode(appPropsXml()) },
  ];
  if (image) {
    files.push({ name: `word/media/image1.${image.ext}`, data: image.data });
  }

  return zipStore(files);
}
