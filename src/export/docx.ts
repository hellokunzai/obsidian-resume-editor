// DOCX 导出：使用 docx 库（纯 TS，无 eval / 无 jszip）
// 本文件按 templateId 渲染带版式的 DOCX，尽量对齐预览样式：
// - twoCol / leftRight 用表格实现分栏
// - 主题色应用于标题下划线与侧边栏背景
// - 支持头像、自定义联系方式、所有模块类型
// - 字号 / 间距跟随 globalSettings

import { App, Notice, requestUrl, TFile } from "obsidian";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  Table,
  TableCell,
  TableRow,
  WidthType,
  ShadingType,
  AlignmentType,
  VerticalAlign,
  ImageRun,
  convertInchesToTwip,
} from "docx";
import {
  ResumeData,
  ResumeEntry,
  visibleEntries,
  formatEntryTime,
  ResumeLayout,
  CustomItem,
  MenuSection,
  SectionType,
  computeAvatarStyle,
} from "../data/resume-model";
import { t } from "../i18n";
import { splitSkills } from "../render/template";
import { contactIconPng } from "../ui/contact-icons";

/* ---------- 单位换算 ---------- */

const PX_PER_EMU = 9525;
const TWIP_PER_PX = 15; // 1 px ≈ 15 twip（96 dpi 下 1 twip = 1/20 pt ≈ 0.75 px）

function pxToEmu(px: number): number {
  return Math.round(px * PX_PER_EMU);
}

function pxToTwip(px: number): number {
  return Math.round(px * TWIP_PER_PX);
}

function pxToHalfPt(px: number): number {
  // 1 pt = 1.333 px，half-point = pt * 2
  return Math.round((px * 3) / 2);
}

function hexColor(color: string): string {
  return color.replace(/^#/, "").toUpperCase();
}

function whiteOrBlackOn(color: string): "FFFFFF" | "000000" {
  const c = color.replace(/^#/, "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // 感知亮度
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 160 ? "000000" : "FFFFFF";
}

/* ---------- 样式构造 ---------- */

function runFont(gs: ResumeData["globalSettings"]): string | { ascii: string; hAnsi: string; eastAsia: string } {
  const f = gs?.fontFamily;
  if (f && f.trim()) {
    // 取 CSS font stack 的第一个字体，并分别设置 ascii / hAnsi / eastAsia，
    // 避免 Word 把整个逗号分隔字符串当成单个字体名。
    const first = f.split(",")[0].trim().replace(/^["']|["']$/g, "");
    return { ascii: first, hAnsi: first, eastAsia: first };
  }
  return { ascii: "Segoe UI", hAnsi: "Segoe UI", eastAsia: "Microsoft YaHei" };
}

function baseRunProps(data: ResumeData): Partial<ConstructorParameters<typeof TextRun>[0]> {
  const gs = data.globalSettings;
  const size = gs?.baseFontSize ?? 13;
  return {
    font: runFont(gs),
    size: pxToHalfPt(size),
    color: "222222",
  };
}

function sectionHeading(data: ResumeData, title: string, dark = false): Paragraph {
  const gs = data.globalSettings;
  const theme = hexColor(gs?.themeColor ?? "#7c5cff");
  const size = gs?.baseFontSize ?? 13;
  const isClassic = data.templateId === "classic";
  return new Paragraph({
    children: [
      new TextRun({
        text: title,
        bold: true,
        font: runFont(gs),
        size: pxToHalfPt(size * 1.15),
        color: dark ? "FFFFFF" : (isClassic ? "1A1A1A" : theme),
      }),
    ],
    border: {
      bottom: {
        color: dark ? "FFFFFF" : (isClassic ? "222222" : theme),
        space: 1,
        style: BorderStyle.SINGLE,
        size: 8,
      },
    },
    spacing: {
      before: pxToTwip(gs?.sectionSpacing ?? 16),
      after: pxToTwip(8),
    },
  });
}

function plainHeading(data: ResumeData, title: string): Paragraph {
  const gs = data.globalSettings;
  const size = gs?.baseFontSize ?? 13;
  return new Paragraph({
    children: [
      new TextRun({
        text: title,
        bold: true,
        font: runFont(gs),
        size: pxToHalfPt(size * 1.15),
        color: "FFFFFF",
      }),
    ],
    spacing: { before: pxToTwip(18), after: pxToTwip(8) },
  });
}

function bodyParagraph(
  data: ResumeData,
  text: string,
  opts: { bold?: boolean; italics?: boolean; color?: string; spacing?: { before?: number; after?: number }; dark?: boolean } = {}
): Paragraph {
  const gs = data.globalSettings;
  const size = gs?.baseFontSize ?? 13;
  const dark = opts.dark ?? false;
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italics,
        font: runFont(gs),
        size: pxToHalfPt(size),
        color: opts.color ?? (dark ? "F5F5F5" : "222222"),
      }),
    ],
    spacing: {
      before: pxToTwip(opts.spacing?.before ?? 0),
      after: pxToTwip(opts.spacing?.after ?? gs?.paragraphSpacing ?? 4),
    },
  });
}

function bulletParagraph(data: ResumeData, text: string, dark = false): Paragraph {
  const gs = data.globalSettings;
  const size = gs?.baseFontSize ?? 13;
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: runFont(gs),
        size: pxToHalfPt(size),
        color: dark ? "F5F5F5" : "333333",
      }),
    ],
    bullet: { level: 0 },
    spacing: { after: pxToTwip(gs?.paragraphSpacing ?? 4) },
  });
}

function entryTopParagraph(data: ResumeData, e: ResumeEntry, dark = false): Paragraph {
  const gs = data.globalSettings;
  const size = gs?.baseFontSize ?? 13;
  const runs: TextRun[] = [
    new TextRun({
      text: e.org,
      bold: true,
      font: runFont(gs),
      size: pxToHalfPt(size * 1.02),
      color: dark ? "FFFFFF" : "1A1A1A",
    }),
  ];
  const timeStr = formatEntryTime(e);
  if (timeStr) {
    runs.push(
      new TextRun({
        text: "  " + timeStr,
        italics: true,
        font: runFont(gs),
        size: pxToHalfPt(size * 0.92),
        color: dark ? "DDDDDD" : "777777",
      })
    );
  }
  return new Paragraph({
    children: runs,
    spacing: { after: pxToTwip(2) },
  });
}

function entrySubParagraph(data: ResumeData, e: ResumeEntry, dark = false): Paragraph | null {
  const parts: string[] = [];
  if (e.title) parts.push(e.title);
  if (e.degree) parts.push(e.degree);
  if (e.gpa) parts.push("GPA " + e.gpa);
  if (!parts.length) return null;
  return bodyParagraph(data, parts.join(" · "), { color: dark ? "E5E5E5" : "555555", spacing: { after: 2 }, dark });
}

function entryDetailParagraphs(data: ResumeData, details: string, dark = false): Paragraph[] {
  const out: Paragraph[] = [];
  for (const line of details.split("\n")) {
    const trimmed = line.trim().replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
    if (trimmed) out.push(bulletParagraph(data, trimmed, dark));
  }
  return out;
}

function entryParagraphs(data: ResumeData, entries: ResumeEntry[], dark = false): Paragraph[] {
  const out: Paragraph[] = [];
  for (const e of visibleEntries(entries)) {
    out.push(entryTopParagraph(data, e, dark));
    const sub = entrySubParagraph(data, e, dark);
    if (sub) out.push(sub);
    if (e.details) out.push(...entryDetailParagraphs(data, e.details, dark));
  }
  return out;
}

/* ---------- 联系信息 ---------- */

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

type IconMap = Record<string, ArrayBuffer>;

async function loadContactIcons(items: ContactItem[]): Promise<IconMap> {
  const map: IconMap = {};
  for (const item of items) {
    if (map[item.iconKey]) continue;
    const buf = await contactIconPng(item.iconKey, 14);
    if (buf) map[item.iconKey] = buf;
  }
  return map;
}

function iconImageRun(buf: ArrayBuffer, size = 14): ImageRun {
  // docx 的 ImageRun transformation 使用像素单位，库内部再换算成 EMU
  return new ImageRun({
    data: buf,
    transformation: { width: size, height: size },
  });
}

function contactParagraphs(data: ResumeData, iconMap: IconMap, dark = false): Paragraph[] {
  const items = buildContactItems(data);
  const out: Paragraph[] = [];
  const gs = data.globalSettings;
  const size = gs?.baseFontSize ?? 13;
  const color = dark ? "FFFFFF" : "444444";
  for (const item of items) {
    const text = item.showLabel && item.label ? `${item.label}：${item.value}` : item.value;
    const children: (TextRun | ImageRun)[] = [];
    const iconBuf = iconMap[item.iconKey];
    if (iconBuf) {
      children.push(iconImageRun(iconBuf, 14));
      children.push(new TextRun({ text: "  ", size: pxToHalfPt(size * 0.92) }));
    } else {
      children.push(
        new TextRun({
          text: contactIconSymbol(item.iconKey) + " ",
          font: "Segoe UI Emoji",
          size: pxToHalfPt(size * 0.92),
          color,
        })
      );
    }
    children.push(
      new TextRun({
        text,
        font: runFont(gs),
        size: pxToHalfPt(size * 0.92),
        color,
      })
    );
    out.push(new Paragraph({ children, spacing: { after: pxToTwip(4) } }));
  }
  return out;
}

/* ---------- 头像 ---------- */

type ImageExt = "png" | "jpg" | "gif" | "bmp";

function normalizeImageExt(ext: string): ImageExt | null {
  const e = ext.toLowerCase();
  if (e === "jpeg") return "jpg";
  if (e === "png" || e === "jpg" || e === "gif" || e === "bmp") return e;
  return null;
}

async function loadAvatarImage(app: App, avatarPath: string): Promise<{ buffer: ArrayBuffer; ext: ImageExt } | null> {
  if (!avatarPath) return null;
  const trimmed = avatarPath.trim();
  if (!trimmed) return null;

  const ext = normalizeImageExt(trimmed.split(".").pop() ?? "");

  // 网络图片：尝试下载
  if (/^https?:\/\//i.test(trimmed)) {
    if (!ext) return null;
    try {
      const res = await requestUrl({ url: trimmed, method: "GET" });
      const buf = res.arrayBuffer;
      if (buf && buf.byteLength) return { buffer: buf, ext };
    } catch {
      // ignore
    }
    return null;
  }

  // vault 内图片
  const path = trimmed.replace(/\\/g, "/");
  const f = app.vault.getAbstractFileByPath(path);
  if (!(f instanceof TFile)) return null;
  const fileExt = normalizeImageExt(f.extension);
  if (!fileExt) return null;
  try {
    const buf = await app.vault.adapter.readBinary(f.path);
    return { buffer: buf, ext: fileExt };
  } catch {
    return null;
  }
}

function avatarImageRun(data: ResumeData, buffer: ArrayBuffer): ImageRun {
  const st = computeAvatarStyle(data);
  // docx 的 ImageRun transformation 使用像素单位，库内部再换算成 EMU
  return new ImageRun({
    data: buffer,
    transformation: { width: st.width, height: st.height },
  });
}

/* ---------- 模块渲染 ---------- */

function sectionParagraphs(data: ResumeData, title: string, entries: ResumeEntry[], dark = false): Paragraph[] {
  const items = visibleEntries(entries);
  if (!items.length) return [];
  const out: Paragraph[] = [sectionHeading(data, title, dark)];
  out.push(...entryParagraphs(data, items, dark));
  return out;
}

function skillsParagraphs(data: ResumeData, dark = false): Paragraph[] {
  const lines = splitSkills(data.skillContent);
  if (!lines.length) return [];
  const out: Paragraph[] = [sectionHeading(data, t("form.skills"), dark)];
  for (const line of lines) out.push(bulletParagraph(data, line, dark));
  return out;
}

function selfEvaluationParagraphs(data: ResumeData, dark = false): Paragraph[] {
  const text = data.selfEvaluationContent.trim();
  if (!text) return [];
  const out: Paragraph[] = [sectionHeading(data, t("form.selfEvaluation"), dark)];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) out.push(bulletParagraph(data, trimmed, dark));
  }
  return out;
}

function customItemParagraphs(data: ResumeData, item: CustomItem, dark = false): Paragraph[] {
  const out: Paragraph[] = [];
  const gs = data.globalSettings;
  const size = gs?.baseFontSize ?? 13;
  const runs: TextRun[] = [
    new TextRun({
      text: item.title,
      bold: true,
      font: runFont(gs),
      size: pxToHalfPt(size * 1.02),
      color: dark ? "FFFFFF" : "1A1A1A",
    }),
  ];
  if (item.dateRange) {
    runs.push(
      new TextRun({
        text: "  " + item.dateRange,
        italics: true,
        font: runFont(gs),
        size: pxToHalfPt(size * 0.92),
        color: dark ? "DDDDDD" : "777777",
      })
    );
  }
  out.push(new Paragraph({ children: runs, spacing: { after: pxToTwip(2) } }));
  if (item.subtitle.trim()) {
    out.push(bodyParagraph(data, item.subtitle, { color: dark ? "E5E5E5" : "555555", spacing: { after: 2 }, dark }));
  }
  if (item.description.trim()) {
    out.push(...entryDetailParagraphs(data, item.description, dark));
  }
  return out;
}

function customParagraphs(data: ResumeData, sec: MenuSection, dark = false): Paragraph[] {
  const items = data.customData[sec.id];
  if (items && items.length) {
    const visible = items.filter((it) => it.visible && (it.title.trim() || it.subtitle.trim() || it.description.trim()));
    if (!visible.length) return [];
    const out: Paragraph[] = [sectionHeading(data, sec.title || t("form.customModule"), dark)];
    for (const it of visible) out.push(...customItemParagraphs(data, it, dark));
    return out;
  }
  if (!sec.content.trim()) return [];
  const out: Paragraph[] = [sectionHeading(data, sec.title || t("form.customModule"), dark)];
  for (const line of sec.content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) out.push(bulletParagraph(data, trimmed, dark));
  }
  return out;
}

function certificatesParagraphs(data: ResumeData, app: App, dark = false): Paragraph[] {
  const certs = (data.certificates || []).filter((c) => c.url && c.url.trim() && c.visible !== false);
  if (!certs.length) return [];
  const out: Paragraph[] = [sectionHeading(data, t("form.certificates"), dark)];
  for (const c of certs) {
    const img = loadAvatarImage(app, c.url);
    // 证书图片异步加载较复杂，先以文字占位；避免阻塞整体导出
    out.push(bodyParagraph(data, c.url, { color: dark ? "E5E5E5" : "555555", spacing: { after: 2 }, dark }));
  }
  return out;
}

function renderSectionInto(
  data: ResumeData,
  sec: MenuSection,
  app: App,
  dark = false
): Paragraph[] {
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
      return certificatesParagraphs(data, app, dark);
    case "custom":
      return customParagraphs(data, sec, dark);
    default:
      return [];
  }
}

/* ---------- 单栏 / 经典 / 现代等通用布局 ---------- */

async function buildSingleColumnDocument(data: ResumeData, app: App): Promise<Document> {
  const gs = data.globalSettings;
  const theme = hexColor(gs?.themeColor ?? "#7c5cff");
  const size = gs?.baseFontSize ?? 13;
  const children: Paragraph[] = [];

  // 头部：姓名 + 职位 + 联系方式
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.name || " ",
          bold: true,
          font: runFont(gs),
          size: pxToHalfPt(size * 2.2),
          color: data.templateId === "classic" ? "1A1A1A" : theme,
        }),
      ],
      spacing: { after: pxToTwip(4) },
    })
  );

  if (data.role) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.role,
            italics: true,
            font: runFont(gs),
            size: pxToHalfPt(size * 1.05),
            color: "555555",
          }),
        ],
        spacing: { after: pxToTwip(6) },
      })
    );
  }

  const contactItems = buildContactItems(data);
  const iconMap = await loadContactIcons(contactItems);
  const contacts = contactParagraphs(data, iconMap);
  if (contacts.length) children.push(...contacts);

  // 模块
  for (const sec of data.menuSections) {
    if (!sec.visible || sec.type === "basic") continue;
    children.push(...renderSectionInto(data, sec, app));
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip((gs?.pagePadding ?? 30) / 96),
              right: convertInchesToTwip((gs?.pagePadding ?? 30) / 96),
              bottom: convertInchesToTwip((gs?.pagePadding ?? 30) / 96),
              left: convertInchesToTwip((gs?.pagePadding ?? 30) / 96),
            },
          },
        },
        children,
      },
    ],
  });
}

/* ---------- 双栏布局（左侧边栏：头像 / 姓名 / 联系 / 教育；右侧：其余） ---------- */

async function buildTwoColDocument(data: ResumeData, app: App): Promise<Document> {
  const gs = data.globalSettings;
  const theme = hexColor(gs?.themeColor ?? "#7c5cff");
  const textColor = whiteOrBlackOn(theme);
  const size = gs?.baseFontSize ?? 13;

  const leftChildren: Paragraph[] = [];
  const rightChildren: Paragraph[] = [];

  // 左侧：头像
  const avatar = await loadAvatarImage(app, data.avatar);
  if (avatar) {
    leftChildren.push(
      new Paragraph({
        children: [avatarImageRun(data, avatar.buffer)],
        alignment: AlignmentType.CENTER,
        spacing: { after: pxToTwip(14) },
      })
    );
  }

  // 左侧：姓名 + 职位
  leftChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.name || " ",
          bold: true,
          font: runFont(gs),
          size: pxToHalfPt(size * 1.8),
          color: textColor,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: pxToTwip(2) },
    })
  );
  if (data.role) {
    leftChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.role,
            font: runFont(gs),
            size: pxToHalfPt(size),
            color: textColor,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: pxToTwip(12) },
      })
    );
  }

  // 左侧：联系方式
  const contactItems = buildContactItems(data);
  const iconMap = await loadContactIcons(contactItems);
  const contacts = contactParagraphs(data, iconMap, true);
  if (contacts.length) leftChildren.push(...contacts);

  // 右侧：模块（education 归入左侧，其余进右侧；basic 不渲染）
  for (const sec of data.menuSections) {
    if (!sec.visible || sec.type === "basic") continue;
    const isLeft = sec.type === "education";
    const paragraphs = renderSectionInto(data, sec, app, isLeft);
    if (isLeft) {
      if (paragraphs.length) leftChildren.push(...paragraphs);
    } else {
      rightChildren.push(...paragraphs);
    }
  }

  // 左侧为空时避免空单元格异常
  if (!leftChildren.length) leftChildren.push(new Paragraph({ text: "" }));
  if (!rightChildren.length) rightChildren.push(new Paragraph({ text: "" }));

  const noLeft =
    !avatar &&
    !data.name &&
    !data.role &&
    !contacts.length &&
    !data.education.filter((e) => e.visible !== false).length;

  if (noLeft) {
    return buildSingleColumnDocument(data, app);
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            shading: { fill: theme, type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.TOP,
            margins: {
              top: convertInchesToTwip(0.25),
              right: convertInchesToTwip(0.18),
              bottom: convertInchesToTwip(0.25),
              left: convertInchesToTwip(0.18),
            },
            children: leftChildren,
          }),
          new TableCell({
            width: { size: 66, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.TOP,
            margins: {
              top: convertInchesToTwip(0.25),
              right: convertInchesToTwip(0.22),
              bottom: convertInchesToTwip(0.25),
              left: convertInchesToTwip(0.22),
            },
            children: rightChildren,
          }),
        ],
      }),
    ],
  });

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0),
              right: convertInchesToTwip(0),
              bottom: convertInchesToTwip(0),
              left: convertInchesToTwip(0),
            },
          },
        },
        children: [table],
      },
    ],
  });
}

/* ---------- 左右分栏布局（左侧：头像+联系；右侧：姓名+内容） ---------- */

async function buildLeftRightDocument(data: ResumeData, app: App): Promise<Document> {
  const gs = data.globalSettings;
  const size = gs?.baseFontSize ?? 13;

  const leftChildren: Paragraph[] = [];
  const rightChildren: Paragraph[] = [];

  const avatar = await loadAvatarImage(app, data.avatar);
  if (avatar) {
    leftChildren.push(
      new Paragraph({
        children: [avatarImageRun(data, avatar.buffer)],
        alignment: AlignmentType.CENTER,
        spacing: { after: pxToTwip(10) },
      })
    );
  }

  const contactItems = buildContactItems(data);
  const iconMap = await loadContactIcons(contactItems);
  const contacts = contactParagraphs(data, iconMap);
  if (contacts.length) leftChildren.push(...contacts);

  rightChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.name || " ",
          bold: true,
          font: runFont(gs),
          size: pxToHalfPt(size * 2.2),
          color: "1A1A1A",
        }),
      ],
      spacing: { after: pxToTwip(2) },
    })
  );
  if (data.role) {
    rightChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.role,
            italics: true,
            font: runFont(gs),
            size: pxToHalfPt(size * 1.05),
            color: "555555",
          }),
        ],
        spacing: { after: pxToTwip(10) },
      })
    );
  }

  for (const sec of data.menuSections) {
    if (!sec.visible || sec.type === "basic") continue;
    rightChildren.push(...renderSectionInto(data, sec, app));
  }

  if (!leftChildren.length) leftChildren.push(new Paragraph({ text: "" }));
  if (!rightChildren.length) rightChildren.push(new Paragraph({ text: "" }));

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.TOP,
            margins: {
              top: convertInchesToTwip(0.2),
              right: convertInchesToTwip(0.18),
              bottom: convertInchesToTwip(0.2),
              left: convertInchesToTwip(0.18),
            },
            children: leftChildren,
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.TOP,
            margins: {
              top: convertInchesToTwip(0.2),
              right: convertInchesToTwip(0.22),
              bottom: convertInchesToTwip(0.2),
              left: convertInchesToTwip(0.22),
            },
            children: rightChildren,
          }),
        ],
      }),
    ],
  });

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip((gs?.pagePadding ?? 30) / 96),
              right: convertInchesToTwip((gs?.pagePadding ?? 30) / 96),
              bottom: convertInchesToTwip((gs?.pagePadding ?? 30) / 96),
              left: convertInchesToTwip((gs?.pagePadding ?? 30) / 96),
            },
          },
        },
        children: [table],
      },
    ],
  });
}

/* ---------- 入口 ---------- */

export async function exportDocx(
  app: App,
  data: ResumeData,
  baseName: string
): Promise<void> {
  try {
    let doc: Document;
    if (data.templateId === "twoCol") {
      doc = await buildTwoColDocument(data, app);
    } else if (data.templateId === "leftRight") {
      doc = await buildLeftRightDocument(data, app);
    } else {
      doc = await buildSingleColumnDocument(data, app);
    }

    const blob = await Packer.toBlob(doc);
    const ab = await blob.arrayBuffer();
    const path = `${baseName}.docx`;
    await app.vault.adapter.writeBinary(path, ab);
    new Notice(t("notice.exported", { name: path }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    new Notice(t("error.export", { msg }));
    console.error("DOCX export failed", err);
  }
}
