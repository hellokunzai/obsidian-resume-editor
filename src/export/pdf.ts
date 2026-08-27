// PDF 导出：隐藏 <webview> 渲染后调用 Electron printToPDF（桌面端，isDesktopOnly: true）

import { App, Notice } from "obsidian";
import { ResumeData, TemplateId } from "../data/resume-model";
import { resumeToHtml, RESUME_CSS } from "../render/template";
import { t } from "../i18n";

interface PrintToPdfOptions {
  pageSize?: string;
  printBackground?: boolean;
  landscape?: boolean;
  margins?: { top: string; bottom: string; left: string; right: string };
}

interface WebviewLike extends HTMLElement {
  srcdoc: string;
  printToPDF(options: PrintToPdfOptions): Promise<Uint8Array>;
}

export async function exportPdf(
  app: App,
  data: ResumeData,
  template: TemplateId,
  baseName: string,
  paperSize: "A4" | "Letter"
): Promise<void> {
  const body = resumeToHtml(data, template, app);
  const html =
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">` +
    `<title>${baseName}</title><style>${RESUME_CSS}</style></head>` +
    `<body>${body}</body></html>`;

  const wv = document.createElement("webview") as unknown as WebviewLike;
  wv.style.position = "fixed";
  wv.style.right = "0";
  wv.style.bottom = "0";
  wv.style.width = "0";
  wv.style.height = "0";
  wv.style.opacity = "0";
  wv.srcdoc = html;
  document.body.appendChild(wv);

  try {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => resolve();
      (wv as unknown as {
        addEventListener(type: string, cb: () => void): void;
      }).addEventListener("dom-ready", onReady);
      setTimeout(() => reject(new Error("webview timeout")), 15000);
    });

    const buf = await wv.printToPDF({
      pageSize: paperSize,
      printBackground: true,
      landscape: false,
      margins: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    });

    const ab = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength
    ) as ArrayBuffer;
    const path = `${baseName}.pdf`;
    await app.vault.adapter.writeBinary(path, ab);
    new Notice(t("notice.exported", { name: path }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    new Notice(t("error.export", { msg }));
  } finally {
    wv.remove();
  }
}
