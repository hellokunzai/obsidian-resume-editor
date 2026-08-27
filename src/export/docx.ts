// DOCX 导出：使用 docx 库（纯 TS，无 eval / 无 jszip）

import { App, Notice } from "obsidian";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { ResumeData, ResumeEntry } from "../data/resume-model";
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

export async function exportDocx(
  app: App,
  data: ResumeData,
  baseName: string
): Promise<void> {
  const children: Paragraph[] = [];
  children.push(new Paragraph({ text: data.name || " ", heading: HeadingLevel.TITLE }));
  if (data.role) children.push(new Paragraph({ children: [new TextRun({ text: data.role, italics: true })] }));
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

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const ab = await blob.arrayBuffer();
  const path = `${baseName}.docx`;
  await app.vault.adapter.writeBinary(path, ab);
  new Notice(t("notice.exported", { name: path }));
}
