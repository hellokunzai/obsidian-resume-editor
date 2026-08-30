// DOCX 导出：基于零依赖的纯 OOXML 生成（src/export/docx-core.ts）。
//
// 本文件是 Obsidian 环境适配器，仅负责两件事：
//   1. 把 vault 内 / 网络图片读取为 Uint8Array（通过 docx-core 的 ImageLoader 回调注入）
//   2. 把生成的 Uint8Array 写入 .docx 文件
//
// 不包含任何 eval / new Function / 第三方打包器的反射代码，满足社区市场安全扫描。

import { App, Notice, requestUrl, TFile } from "obsidian";
import { renderResumeDocx, type ImageLoader, type LoadedImage } from "./docx-core";
import { ResumeData } from "../data/resume-model";
import { t } from "../i18n";

type ImageExt = "png" | "jpg" | "gif" | "bmp";

function normalizeImageExt(ext: string): ImageExt | null {
  const e = ext.toLowerCase();
  if (e === "jpeg") return "jpg";
  if (e === "png" || e === "jpg" || e === "gif" || e === "bmp") return e;
  return null;
}

function toUint8Array(buf: ArrayBuffer): Uint8Array {
  return new Uint8Array(buf);
}

async function loadImage(app: App, path: string): Promise<LoadedImage | null> {
  const trimmed = path.trim();
  if (!trimmed) return null;
  const ext = normalizeImageExt(trimmed.split(".").pop() ?? "");

  // 网络图片：尝试下载
  if (/^https?:\/\//i.test(trimmed)) {
    if (!ext) return null;
    try {
      const res = await requestUrl({ url: trimmed, method: "GET" });
      const buf = res.arrayBuffer;
      if (buf && buf.byteLength) return { data: toUint8Array(buf), ext };
    } catch {
      // 下载失败时降级为无头像导出，不影响整体
    }
    return null;
  }

  // vault 内图片
  const p = trimmed.replace(/\\/g, "/");
  const f = app.vault.getAbstractFileByPath(p);
  if (!(f instanceof TFile)) return null;
  const fileExt = normalizeImageExt(f.extension);
  if (!fileExt) return null;
  try {
    const buf = await app.vault.adapter.readBinary(f.path);
    return { data: toUint8Array(buf), ext: fileExt };
  } catch {
    return null;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // zipStore 用 new Uint8Array(total) 分配，buffer 恰好是完整数据；
  // 用 slice 取出独立 ArrayBuffer，类型稳定且避免共享底层 buffer。
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function exportDocx(
  app: App,
  data: ResumeData,
  baseName: string
): Promise<void> {
  try {
    const loader: ImageLoader = (path) => loadImage(app, path);
    const bytes = await renderResumeDocx(data, loader);
    const ab = toArrayBuffer(bytes);
    const path = `${baseName}.docx`;
    await app.vault.adapter.writeBinary(path, ab);
    new Notice(t("notice.exported", { name: path }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    new Notice(t("error.export", { msg }));
    console.error("DOCX export failed", err);
  }
}
