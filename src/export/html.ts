// HTML 导出：拼接模板 HTML + 内联样式下载

import { App, Notice } from "obsidian";
import { ResumeData, TemplateId } from "../data/resume-model";
import { resumeToHtml, RESUME_CSS } from "../render/template";
import { t } from "../i18n";

export async function exportHtml(
  app: App,
  data: ResumeData,
  template: TemplateId,
  baseName: string
): Promise<void> {
  const body = resumeToHtml(data, template);
  const full =
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">` +
    `<title>${baseName}</title><style>${RESUME_CSS}</style></head>` +
    `<body>${body}</body></html>`;
  const path = `${baseName}.html`;
  await app.vault.adapter.write(path, full);
  new Notice(t("notice.exported", { name: path }));
}
