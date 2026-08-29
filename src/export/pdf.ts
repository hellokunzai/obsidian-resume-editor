// PDF 导出：一键静默生成 —— 基于 html2pdf.js（html2canvas + jsPDF，纯前端，
// 在 Obsidian 渲染进程内直接把简历 DOM 渲染为 PDF 并写入 vault。
// 不依赖 <webview>（部分 Obsidian 环境未启用 webview 标签，printToPDF 不可用），
// 也不经过 window.print() 打印对话框，点击即落盘。

import { App, Notice } from "obsidian";
import { ResumeData } from "../data/resume-model";
import { resumeToHtml, RESUME_CSS, globalSettingsCss } from "../render/template";
import { t } from "../i18n";
import { safeFileName } from "./utils";
import { computeOnePageScale, pageAvailableHeight } from "../utils/auto-one-page";
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
  // 宽度按纸张内容区设置，让 .re-paper（max-width:720px）居中排版与预览一致。
  const paperPx = paperSize === "Letter" ? 816 : 794; // 96dpi 下的页宽（px）
  const holder = document.createElement("div");
  holder.className = "re-pdf-capture";
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${paperPx}px;z-index:-1;background:#fff;`;
  holder.innerHTML = `<style>${RESUME_CSS}${globalSettingsCss(data.globalSettings)}</style>${body}`;
  document.body.appendChild(holder);

  const el = holder.querySelector(".re-paper") as HTMLElement | null;

  // 自动一页纸：内容超出单页可用高度时整体缩放（下限 90%）
  if (el && data.globalSettings && data.globalSettings.autoOnePage) {
    const avail = pageAvailableHeight(paperSize);
    const result = computeOnePageScale(el.scrollHeight, avail);
    if (result.scale < 1) {
      el.style.setProperty("transform-origin", "top left");
      el.style.setProperty("transform", `scale(${result.scale})`);
      holder.style.setProperty("overflow", "hidden");
      holder.style.setProperty("height", `${Math.round(el.offsetHeight * result.scale)}px`);
    }
    if (!result.fits) {
      new Notice(t("style.onePageOverflow"));
    }
  }

  try {
    if (!el) throw new Error(t("error.emptyExport"));
    new Notice(t("notice.exportingPdf"));

    const opt = {
      margin: 14, // mm，与 RESUME_CSS 的 @page margin:14mm 对齐
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
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
