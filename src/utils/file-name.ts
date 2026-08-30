// 生成不冲突的新简历文件名
import { Vault } from "obsidian";

const DEFAULT_RESUME_BASENAME = "新建简历";

export function uniqueResumeBasename(vault: Vault, dir: string = ""): string {
  const normalizedDir = dir.trim().replace(/\/+$/, "");
  const fullPath = (name: string) => (normalizedDir ? `${normalizedDir}/${name}` : name);

  let candidate = DEFAULT_RESUME_BASENAME;
  let index = 1;
  while (vault.getAbstractFileByPath(fullPath(candidate))) {
    candidate = `${DEFAULT_RESUME_BASENAME} ${index}`;
    index++;
  }
  return candidate;
}
