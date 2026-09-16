// HTML 导出：拼接模板 HTML + 内联样式下载
//
// 本身几乎瞬时完成，进度上报只是为了和其他导出格式的交互保持一致；
// 写盘那一步依然要让出主线程，避免大文件写入时界面短暂无响应。

import { App, Notice } from "obsidian";
import { ResumeData } from "../data/resume-model";
import { resumeToHtml, RESUME_CSS, globalSettingsCss } from "../render/template";
import { t } from "../i18n";
import { yieldToUi } from "../utils/async-util";
import type { ProgressReporter } from "./progress";

export async function exportHtml(
  app: App,
  data: ResumeData,
  baseName: string,
  report?: ProgressReporter
): Promise<boolean> {
  try {
    report?.(0.3, t("progress.generating"));
    const body = resumeToHtml(data, app);
    const full =
      `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">` +
      `<title>${baseName}</title><style>${RESUME_CSS}${globalSettingsCss(data.globalSettings)}</style></head>` +
      `<body>${body}</body></html>`;

    report?.(0.8, t("progress.writing"));
    await yieldToUi();
    const path = `${baseName}.html`;
    await app.vault.adapter.write(path, full);
    report?.(1, t("progress.done"));
    new Notice(t("notice.exported", { name: path }));
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    new Notice(t("error.export", { msg }));
    return false;
  }
}
