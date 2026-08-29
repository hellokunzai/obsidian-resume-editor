// 联系信息与自定义字段图标库（lucide 风格内联 SVG，离线可用）
// 预览通过 Obsidian addIcon + setIcon 注入；导出 HTML 直接内联 svg 字符串。

import { addIcon } from "obsidian";

const SVG_OPEN =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
const SVG_CLOSE = `</svg>`;

function svg(inner: string): string {
  return SVG_OPEN + inner + SVG_CLOSE;
}

/** 固定联系信息图标（ employmentStatus / email / birthDate / phone / location ） */
const FIXED_CONTACT_ICONS: Record<string, string> = {
  phone: svg(
    `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>`
  ),
  mail: svg(
    `<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>`
  ),
  location: svg(
    `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>`
  ),
  birthDate: svg(
    `<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>`
  ),
  employmentStatus: svg(
    `<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`
  ),
};

/** 自定义字段可选图标 */
const CUSTOM_FIELD_ICON_SVGS: Record<string, string> = {
  link: svg(
    `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`
  ),
  globe: svg(
    `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`
  ),
  github: svg(
    `<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>`
  ),
  briefcase: svg(
    `<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`
  ),
  award: svg(
    `<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>`
  ),
  book: svg(
    `<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>`
  ),
  "map-pin": svg(
    `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>`
  ),
  calendar: svg(
    `<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>`
  ),
  star: svg(
    `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`
  ),
  heart: svg(
    `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>`
  ),
  flag: svg(
    `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>`
  ),
  zap: svg(
    `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`
  ),
};

/** 合并后的图标 key -> 完整 SVG 字符串（用于导出 HTML 内联） */
export const CONTACT_ICONS: Record<string, string> = {
  ...FIXED_CONTACT_ICONS,
  ...CUSTOM_FIELD_ICON_SVGS,
};

/** 自定义字段默认图标 key */
export const DEFAULT_CUSTOM_FIELD_ICON = "link";

/** 自定义字段可选图标 key 列表（按选择器展示顺序） */
export const CUSTOM_FIELD_ICON_KEYS = Object.keys(CUSTOM_FIELD_ICON_SVGS);

/** 注册为 Obsidian 图标，供预览 setIcon 使用 */
export function registerContactIcons(): void {
  for (const [key, svgStr] of Object.entries(CONTACT_ICONS)) {
    addIcon("re-c-" + key, svgStr);
  }
}

/** 预览用：取已注册的图标 id */
export function contactIconId(key: string): string {
  return "re-c-" + (CONTACT_ICONS[key] ? key : DEFAULT_CUSTOM_FIELD_ICON);
}

/** 导出 HTML 用：取原始 SVG 字符串 */
export function contactIconSvg(key: string): string {
  return CONTACT_ICONS[key] ?? CONTACT_ICONS[DEFAULT_CUSTOM_FIELD_ICON];
}

/** 规范化自定义字段图标值：空值/无效值回退到默认图标 */
export function normalizeCustomFieldIcon(value: string | undefined): string {
  if (!value) return DEFAULT_CUSTOM_FIELD_ICON;
  // 兼容旧数据：若存储的是已注册的完整 id（如 re-c-github）
  const key = value.replace(/^re-c-/, "");
  if (CONTACT_ICONS[key]) return key;
  return DEFAULT_CUSTOM_FIELD_ICON;
}

/** 将图标 SVG 渲染为 PNG ArrayBuffer，用于 DOCX 内嵌；失败时返回 null */
export async function contactIconPng(key: string, size = 16): Promise<ArrayBuffer | null> {
  const svg = CONTACT_ICONS[key] ?? CONTACT_ICONS[DEFAULT_CUSTOM_FIELD_ICON];
  if (typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(null);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);
        blob
          .arrayBuffer()
          .then(resolve)
          .catch(() => resolve(null));
      }, "image/png");
    };
    img.onerror = () => resolve(null);
    try {
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    } catch {
      resolve(null);
    }
  });
}
