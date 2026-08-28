// 导出模块共用工具函数

/** 将基础名中的路径分隔符与非法文件名字符替换为安全字符 */
export function safeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
