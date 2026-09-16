// PDF 导出：一键静默生成 —— 基于 html2pdf.js（html2canvas + jsPDF，纯前端，
// 在 Obsidian 渲染进程内直接把简历 DOM 渲染为 PDF 并写入 vault。
// 不依赖 <webview>（部分 Obsidian 环境未启用 webview 标签，printToPDF 不可用），
// 也不经过 window.print() 打印对话框，点击即落盘。
//
// 异步化说明：
//   html2canvas 的渲染循环在库内部，是单次同步计算，**无法切分也无法中断**。
//   因此这里做的是——把整条链路拆成「容器 → 画布 → PDF → 写盘」若干阶段，
//   阶段之间让出主线程并上报进度，让界面始终有机会重绘和响应输入；
//   渲染/编码这两段长阻塞期间用不定进度动画兜住。
//   拆分不会重复渲染：实测 toPdf() 复用 toCanvas() 产出的画布，
//   且拆分产物与一次性 outputPdf('blob') 的字节数完全一致。

import { App, Notice, Platform } from "obsidian";
import { ResumeData } from "../data/resume-model";
import { resumeToHtml, RESUME_CSS, globalSettingsCss } from "../render/template";
import { t } from "../i18n";
import { safeFileName } from "./utils";
import { settleUi, yieldToUi } from "../utils/async-util";
import type { ProgressReporter } from "./progress";
import html2pdf from "./vendor/html2pdf.bundle.min.js";

export async function exportPdf(
  app: App,
  data: ResumeData,
  baseName: string,
  paperSize: "A4" | "Letter",
  report?: ProgressReporter
): Promise<boolean> {
  const name = safeFileName(baseName);
  report?.(0.04, t("progress.preparing"));
  await yieldToUi();

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

    // 渲染前先把进度文案绘制出去，否则接下来的同步渲染会让用户什么都看不到。
    report?.(null, t("progress.rendering"));
    await settleUi();

    const worker = html2pdf().set(opt).from(el);
    await worker.toCanvas().get("canvas");

    // 分页 + JPEG 编码同样是整段同步计算，只能标记为进行中。
    report?.(null, t("progress.encoding"));
    await settleUi();
    const pdf = await worker.toPdf().get("pdf");
    const blob = pdf.output("blob") as Blob;

    report?.(0.9, t("progress.writing"));
    await yieldToUi();
    const ab = await blob.arrayBuffer();
    const path = `${name}.pdf`;
    await app.vault.adapter.writeBinary(path, ab);
    report?.(1, t("progress.done"));
    new Notice(t("notice.exported", { name: path }));
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    new Notice(t("error.export", { msg }));
    return false;
  } finally {
    holder.remove();
  }
}
