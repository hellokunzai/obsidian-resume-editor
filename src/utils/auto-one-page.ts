// 自动一页纸：内容高度超出单页可用高度时，计算整体缩放比例。
// 纯函数、零依赖，预览与 PDF 导出共用（参考 magic-resume useAutoOnePage 的算法思路，原生重写）。

/** 缩放下限：低于该值说明内容实在塞不下，不再缩小（避免字太小不可读） */
export const AUTO_ONE_PAGE_MIN_SCALE = 0.9;

export interface OnePageResult {
  /** 应用的缩放比例，1 表示无需缩放 */
  scale: number;
  /** 内容是否能在下限内塞进一页 */
  fits: boolean;
}

/**
 * 计算一页纸缩放比例。
 * @param contentHeight 内容实际高度（px）
 * @param availableHeight 单页可用高度（px，已扣除上下页边距）
 * @param minScale 缩放下限，默认 0.9
 */
export function computeOnePageScale(
  contentHeight: number,
  availableHeight: number,
  minScale: number = AUTO_ONE_PAGE_MIN_SCALE
): OnePageResult {
  if (!isFinite(contentHeight) || !isFinite(availableHeight) || availableHeight <= 0) {
    return { scale: 1, fits: true };
  }
  if (contentHeight <= availableHeight) {
    return { scale: 1, fits: true };
  }
  const scale = availableHeight / contentHeight;
  if (scale < minScale) {
    return { scale: minScale, fits: false };
  }
  return { scale: Math.round(scale * 1000) / 1000, fits: true };
}

/* ---------- 纸张尺寸（96dpi 下的像素值，与 PDF 导出一致） ---------- */

export const PAPER_SIZE_PX: Record<"A4" | "Letter", { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
  Letter: { width: 816, height: 1056 },
};

/** PDF 导出页边距（mm），与 RESUME_CSS 的 @page margin 对齐 */
export const PDF_MARGIN_MM = 14;

/** mm -> px（96dpi） */
export function mmToPx(mm: number): number {
  return Math.round((mm * 96) / 25.4);
}

/** 单页可用高度 = 纸高 - 上下页边距 */
export function pageAvailableHeight(paperSize: "A4" | "Letter"): number {
  const px = mmToPx(PDF_MARGIN_MM);
  return PAPER_SIZE_PX[paperSize].height - px * 2;
}
