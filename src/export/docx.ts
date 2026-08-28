// DOCX 导出：使用 docx 库（纯 TS，无 eval / 无 jszip）

import { App, Notice } from "obsidian";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from "docx";
import { ResumeData, ResumeEntry, TemplateId } from "../data/resume-model";
import { t } from "../i18n";

function entryParagraphs(title: string, entries: ResumeEntry[]): Paragraph[] {
  const out: Paragraph[] = [];
  if (!entries.length) return out;
  out.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
  for (const e of entries) {
    const runs: TextRun[] = [new TextRun({ text: e.org, bold: true })];
    if (e.time) runs.push(new TextRun({ text: "  " + e.time, italics: true }));
    out.push(new Paragraph({ children: runs }));
    if (e.title) out.push(new Paragraph({ text: e.title }));
    if (e.details) {
      for (const line of e.details.split("\n")) {
        if (line.trim()) {
          out.push(
            new Paragraph({ text: "• " + line.trim(), bullet: { level: 0 } })
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
  if (!entries.length) return out;
  out.push(classicHeading(title));
  for (const e of entries) {
    const runs: TextRun[] = [new TextRun({ text: e.org, bold: true })];
    if (e.time) runs.push(new TextRun({ text: "  " + e.time, italics: true }));
    out.push(new Paragraph({ children: runs }));
    if (e.title) out.push(new Paragraph({ text: e.title }));
    if (e.details) {
      for (const line of e.details.split("\n")) {
        if (line.trim()) {
          out.push(
            new Paragraph({ text: "• " + line.trim(), bullet: { level: 0 } })
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
  baseName: string,
  template?: TemplateId
): Promise<void> {
  const classic = template === "classic";
  const children: Paragraph[] = [];
  children.push(new Paragraph({ text: data.name || " ", heading: HeadingLevel.TITLE }));
  if (data.role) children.push(new Paragraph({ children: [new TextRun({ text: data.role, italics: true })] }));

  if (classic) {
    const contact = classicContactLine(data);
    if (contact) children.push(contact);
    children.push(...classicEntryParagraphs(t("form.education"), data.education));
    children.push(...classicEntryParagraphs(t("form.work"), data.work));
    children.push(...classicEntryParagraphs(t("form.project"), data.projects));
    if (data.skills) {
      children.push(classicHeading(t("form.skills")));
      for (const line of data.skills.split("\n")) {
        if (line.trim()) children.push(new Paragraph({ text: "• " + line.trim(), bullet: { level: 0 } }));
      }
    }
  } else {
    if (data.phone || data.email) {
      const c: string[] = [];
      if (data.phone) c.push(t("field.phone") + "：" + data.phone);
      if (data.email) c.push(t("field.email") + "：" + data.email);
      children.push(new Paragraph({ text: c.join("    ") }));
    }
    children.push(...entryParagraphs(t("form.education"), data.education));
    children.push(...entryParagraphs(t("form.work"), data.work));
    children.push(...entryParagraphs(t("form.project"), data.projects));
    if (data.skills) {
      children.push(new Paragraph({ text: t("form.skills") + "：" + data.skills }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const ab = await blob.arrayBuffer();
  const path = `${baseName}.docx`;
  await app.vault.adapter.writeBinary(path, ab);
  new Notice(t("notice.exported", { name: path }));
}
