// DOCX 导出：使用 docx 库（纯 TS，无 eval / 无 jszip）

import { App, Notice } from "obsidian";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from "docx";
import { ResumeData, ResumeEntry, visibleEntries, formatEntryTime } from "../data/resume-model";
import { t } from "../i18n";
import { splitSkills } from "../render/template";

function entryParagraphs(title: string, entries: ResumeEntry[]): Paragraph[] {
  const out: Paragraph[] = [];
  const items = visibleEntries(entries);
  if (!items.length) return out;
  out.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
  for (const e of items) {
    const runs: TextRun[] = [new TextRun({ text: e.org, bold: true })];
    const timeStr = formatEntryTime(e);
    if (timeStr) runs.push(new TextRun({ text: "  " + timeStr, italics: true }));
    out.push(new Paragraph({ children: runs }));
    const subParts: string[] = [];
    if (e.title) subParts.push(e.title);
    if (e.degree) subParts.push(e.degree);
    if (e.gpa) subParts.push("GPA " + e.gpa);
    if (subParts.length) out.push(new Paragraph({ text: subParts.join(" · ") }));
    if (e.details) {
      for (const line of e.details.split("\n")) {
        const trimmed = line.trim().replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
        if (trimmed) {
          out.push(
            new Paragraph({ text: "• " + trimmed, bullet: { level: 0 } })
          );
        }
      }
    }
  }
  return out;
}

/** Classic 模板：章节标题带下边框 */
function classicHeading(title: string): Paragraph {
  return new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_1,
    border: {
      bottom: { color: "888888", space: 1, style: BorderStyle.SINGLE, size: 6 },
    },
    spacing: { before: 200, after: 80 },
  });
}

function classicEntryParagraphs(title: string, entries: ResumeEntry[]): Paragraph[] {
  const out: Paragraph[] = [];
  const items = visibleEntries(entries);
  if (!items.length) return out;
  out.push(classicHeading(title));
  for (const e of items) {
    const runs: TextRun[] = [new TextRun({ text: e.org, bold: true })];
    const timeStr = formatEntryTime(e);
    if (timeStr) runs.push(new TextRun({ text: "  " + timeStr, italics: true }));
    out.push(new Paragraph({ children: runs }));
    const subParts: string[] = [];
    if (e.title) subParts.push(e.title);
    if (e.degree) subParts.push(e.degree);
    if (e.gpa) subParts.push("GPA " + e.gpa);
    if (subParts.length) out.push(new Paragraph({ text: subParts.join(" · ") }));
    if (e.details) {
      for (const line of e.details.split("\n")) {
        const trimmed = line.trim().replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
        if (trimmed) {
          out.push(
            new Paragraph({ text: "• " + trimmed, bullet: { level: 0 } })
          );
        }
      }
    }
  }
  return out;
}

/** Classic 模板：带标签的联系信息行 */
function classicContactLine(data: ResumeData): Paragraph | null {
  const c: string[] = [];
  if (data.employmentStatus) c.push(t("field.employmentStatus") + "：" + data.employmentStatus);
  if (data.email) c.push(t("field.email") + "：" + data.email);
  if (data.birthDate) c.push(t("field.birthDate") + "：" + data.birthDate);
  if (data.phone) c.push(t("field.phone") + "：" + data.phone);
  if (data.location) c.push(t("field.location") + "：" + data.location);
  for (const f of data.customFields) {
    if (!f.visible || !f.value) continue;
    c.push((f.showLabel && f.label ? f.label + "：" : "") + f.value);
  }
  if (!c.length) return null;
  return new Paragraph({ text: c.join("    "), spacing: { after: 120 } });
}

export async function exportDocx(
  app: App,
  data: ResumeData,
  baseName: string
): Promise<void> {
  const classic = data.templateId === "classic";
  const children: Paragraph[] = [];

  for (const sec of data.menuSections) {
    if (!sec.visible) continue;

    if (sec.type === "basic") {
      children.push(new Paragraph({ text: data.name || " ", heading: HeadingLevel.TITLE }));
      if (data.role) children.push(new Paragraph({ children: [new TextRun({ text: data.role, italics: true })] }));
      if (classic) {
        const contact = classicContactLine(data);
        if (contact) children.push(contact);
      } else {
        if (data.phone || data.email) {
          const c: string[] = [];
          if (data.phone) c.push(t("field.phone") + "：" + data.phone);
          if (data.email) c.push(t("field.email") + "：" + data.email);
          children.push(new Paragraph({ text: c.join("    ") }));
        }
      }
      continue;
    }

    if (sec.type === "skills") {
      if (!data.skillContent) continue;
      if (classic) {
        children.push(classicHeading(t("form.skills")));
        for (const line of data.skillContent.split("\n")) {
          if (line.trim()) children.push(new Paragraph({ text: "• " + line.trim(), bullet: { level: 0 } }));
        }
      } else {
        children.push(new Paragraph({ text: t("form.skills"), heading: HeadingLevel.HEADING_1 }));
        for (const line of splitSkills(data.skillContent)) {
          children.push(new Paragraph({ text: "• " + line, bullet: { level: 0 } }));
        }
      }
    } else if (sec.type === "education") {
      children.push(...(classic ? classicEntryParagraphs : entryParagraphs)(t("form.education"), data.education));
    } else if (sec.type === "experience") {
      children.push(...(classic ? classicEntryParagraphs : entryParagraphs)(t("form.work"), data.experience));
    } else if (sec.type === "projects") {
      children.push(...(classic ? classicEntryParagraphs : entryParagraphs)(t("form.project"), data.projects));
    } else if (sec.type === "custom") {
      if (!sec.content.trim()) continue;
      if (classic) {
        children.push(classicHeading(sec.title || t("form.customModule")));
        for (const line of sec.content.split("\n")) {
          if (line.trim()) children.push(new Paragraph({ text: "• " + line.trim(), bullet: { level: 0 } }));
        }
      } else {
        children.push(new Paragraph({ text: sec.title || t("form.customModule"), heading: HeadingLevel.HEADING_1 }));
        for (const line of sec.content.split("\n")) {
          if (line.trim()) children.push(new Paragraph({ text: "• " + line.trim(), bullet: { level: 0 } }));
        }
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const ab = await blob.arrayBuffer();
  const path = `${baseName}.docx`;
  await app.vault.adapter.writeBinary(path, ab);
  new Notice(t("notice.exported", { name: path }));
}
