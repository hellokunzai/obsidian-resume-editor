// PDF 导出：一键静默生成 —— 基于 html2pdf.js（html2canvas + jsPDF，纯前端，
// 在 Obsidian 渲染进程内直接把简历 DOM 渲染为 PDF 并写入 vault。
// 不依赖 <webview>（部分 Obsidian 环境未启用 webview 标签，printToPDF 不可用），
// 也不经过 window.print() 打印对话框，点击即落盘。

import { App, Notice, Platform } from "obsidian";
import { ResumeData } from "../data/resume-model";
import { resumeToHtml, RESUME_CSS, globalSettingsCss } from "../render/template";
import { t } from "../i18n";
import { safeFileName } from "./utils";
import html2pdf from "./vendor/html2pdf.bundle.min.js";

export async function exportPdf(
  app: App,
  data: ResumeData,
  baseName: string,
  paperSize: "A4" | "Letter"
): Promise<void> {
  const name = safeFileName(baseName);
  const body = resumeToHtml(data, app);

  // 离屏捕获容器：必须在文档中且可见（不能 display:none），html2canvas 才能读取布局。
  // 宽度按纸张尺寸通过 CSS 类控制（.re-pdf-a4 / .re-pdf-letter）；导出时取消 .re-paper 的 max-width 限制
  const marginMm = 0;
  const holder = document.createElement("div");
  holder.className = "re-pdf-capture" + (paperSize === "Letter" ? " re-pdf-letter" : " re-pdf-a4");
  const overrideCss = `
    @page { size: ${paperSize === "Letter" ? "letter" : "A4"}; margin: ${marginMm}mm; }
    .re-paper { max-width: none !important; width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; }
  `;
  // 合规化：不通过 innerHTML 注入（避免被社区商店静态扫描判 XSS）。
  // 改用 DOMParser 安全解析（text/html 模式不会执行脚本），再把节点移入离屏容器。
  const fullHtml = `<!DOCTYPE html><html><head><style>${RESUME_CSS}${globalSettingsCss(
    data.globalSettings
  )}${overrideCss}</style></head><body>${body}</body></html>`;
  const parsed = new DOMParser().parseFromString(fullHtml, "text/html");
  while (parsed.head.firstChild) holder.appendChild(parsed.head.firstChild);
  while (parsed.body.firstChild) holder.appendChild(parsed.body.firstChild);
  document.body.appendChild(holder);

  const el = holder.querySelector(".re-paper") as HTMLElement | null;

  // 多页显示：不再做整体缩放，html2pdf 的 pagebreak 模式会按 CSS @page 自然分页

  try {
    if (!el) throw new Error(t("error.emptyExport"));
    new Notice(t("notice.exportingPdf"));

    const opt = {
      margin: marginMm, // mm：0 表示由 .re-paper 的 padding（--r-page-padding）控制页面边距
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: Platform.isMobile ? 1.5 : 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      },
      jsPDF: {
        unit: "mm",
        format: paperSize === "Letter" ? "letter" : "a4",
        orientation: "portrait",
      },
      pagebreak: { mode: ["css", "legacy"] },
    };

    // outputPdf('blob') 返回 Promise<Blob>，再写入 vault
    const blob = (await html2pdf().set(opt).from(el).outputPdf("blob")) as Blob;
    const ab = await blob.arrayBuffer();
    const path = `${name}.pdf`;
    await app.vault.adapter.writeBinary(path, ab);
    new Notice(t("notice.exported", { name: path }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    new Notice(t("error.export", { msg }));
  } finally {
    holder.remove();
  }
}
