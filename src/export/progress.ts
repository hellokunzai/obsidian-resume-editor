// 导出进度条：视图顶部一条 3px 通栏细条。
//
// 位置：挂在顶栏 `.re-toolbar` 上、`top: 100%` —— 也就是工具栏那一行的正下方。
// 这条带在两栏内容之上，原本就是空白（`.re-dual` 的 8px 内边距），所以：
//
//   1) 绝对定位，**不占布局**：出现和消失都不会把下面的表单/预览推一下；
//   2) pointer-events: none —— 不拦截任何鼠标/触摸事件；
//   3) 进度只用 transform 表达（确定态 scaleX、不定态 translateX 关键帧），
//      不碰 width/margin 这类触发布局的属性。渲染阶段主线程会被 html2canvas
//      独占，而声明式关键帧由合成线程驱动，此时条仍在跑，不会"死"在那里。
//
// 无可见文字（用户选定）：进度信息改由 aria-label / aria-valuenow 暴露给读屏，
// 因此 report() 的 label 参数仍然有用，不是死参数。

import { t } from "../i18n";

/** 进度上报。ratio 为 null 表示"不定进度"——该阶段内部无法量化，只能表示"仍在进行"。 */
export type ProgressReporter = (ratio: number | null, label: string) => void;

export class ExportProgress {
  private root: HTMLElement;
  private barEl: HTMLElement;
  private hideTimer: number | null = null;

  /** host 应为顶栏元素（`.re-toolbar`）：细条会挂到它的下沿。 */
  constructor(host: HTMLElement) {
    const root = host.createDiv({ cls: "re-progress" });
    root.setAttribute("role", "progressbar");
    root.setAttribute("aria-valuemin", "0");
    root.setAttribute("aria-valuemax", "100");
    root.setAttribute("aria-valuenow", "0");
    root.setAttribute("aria-label", t("progress.preparing"));
    this.root = root;

    this.barEl = root.createDiv({ cls: "re-progress-bar" });
  }

  /** 确定进度：ratio ∈ [0, 1]；ratio 为 null 时切到不定进度动画。 */
  report(ratio: number | null, label: string): void {
    this.root.setAttribute("aria-label", label);
    if (ratio === null) {
      // 不定进度下没有可播报的数值；摘掉 valuenow 比留个假的 0 诚实。
      this.root.classList.add("is-indeterminate");
      this.root.removeAttribute("aria-valuenow");
      return;
    }
    this.root.classList.remove("is-indeterminate");
    const clamped = Math.max(0, Math.min(1, ratio));
    this.setRatio(clamped);
    this.root.setAttribute("aria-valuenow", String(Math.round(clamped * 100)));
  }

  succeed(): void {
    this.root.classList.remove("is-indeterminate");
    this.root.classList.add("is-done");
    this.setRatio(1);
    this.root.setAttribute("aria-valuenow", "100");
    this.root.setAttribute("aria-label", t("progress.done"));
  }

  fail(): void {
    this.root.classList.remove("is-indeterminate");
    this.root.classList.add("is-failed");
    this.root.removeAttribute("aria-valuenow");
    this.root.setAttribute("aria-label", t("progress.failed"));
  }

  /** 移除细条。delayMs > 0 时先让完成/失败的颜色停留一会儿再消失。 */
  dispose(delayMs = 0): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (delayMs <= 0) {
      this.root.remove();
      return;
    }
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = null;
      this.root.remove();
    }, delayMs);
  }

  // 走 CSS 自定义属性，由 styles.css 的 .re-progress-bar 用 transform 消费。
  // 传 String(...) 而非字面量：静态样式检查只认字面量右值。
  private setRatio(ratio: number): void {
    this.barEl.style.setProperty("--re-progress", String(ratio));
  }
}
