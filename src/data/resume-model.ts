// 简历数据模型 + Markdown 正文读写

import { App, TFile } from "obsidian";

export type TemplateId = "single" | "twoCol" | "academic";

export interface ResumeEntry {
  org: string;
  title: string;
  time: string;
  details: string;
}

export interface ResumeData {
  name: string;
  role: string;
  phone: string;
  email: string;
  education: ResumeEntry[];
  work: ResumeEntry[];
  projects: ResumeEntry[];
  skills: string;
}

export const RESUME_MARK = "resume";
export const RESUME_MARKER = "<!-- obsidian-resume-editor -->";

export const DEFAULT_RESUME: ResumeData = {
  name: "",
  role: "",
  phone: "",
  email: "",
  education: [],
  work: [],
  projects: [],
  skills: "",
};

export function isResumeFrontmatter(
  fm: Record<string, unknown> | undefined | null
): boolean {
  return !!fm && fm[RESUME_MARK] === true;
}

function asEntry(raw: unknown): ResumeEntry {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      org: typeof o.org === "string" ? o.org : "",
      title: typeof o.title === "string" ? o.title : "",
      time: typeof o.time === "string" ? o.time : "",
      details: typeof o.details === "string" ? o.details : "",
    };
  }
  return { org: "", title: "", time: "", details: "" };
}

function asEntries(raw: unknown): ResumeEntry[] {
  if (Array.isArray(raw)) return raw.map(asEntry);
  return [];
}

export function parseResume(
  fm: Record<string, unknown> | undefined | null
): ResumeData {
  if (!fm) return { ...DEFAULT_RESUME };
  return {
    name: typeof fm.name === "string" ? fm.name : "",
    role: typeof fm.role === "string" ? fm.role : "",
    phone: typeof fm.phone === "string" ? fm.phone : "",
    email: typeof fm.email === "string" ? fm.email : "",
    education: asEntries(fm.education),
    work: asEntries(fm.work),
    projects: asEntries(fm.projects),
    skills: typeof fm.skills === "string" ? fm.skills : "",
  };
}

function cloneEntry(e: ResumeEntry): ResumeEntry {
  return { org: e.org, title: e.title, time: e.time, details: e.details };
}

export function toFrontmatter(data: ResumeData): Record<string, unknown> {
  return {
    [RESUME_MARK]: true,
    name: data.name,
    role: data.role,
    phone: data.phone,
    email: data.email,
    education: data.education.map(cloneEntry),
    work: data.work.map(cloneEntry),
    projects: data.projects.map(cloneEntry),
    skills: data.skills,
  };
}

function normalizeDir(dir: string): string {
  return dir.trim().replace(/\/+$/, "");
}

export function isInResumeDir(filePath: string, dir: string): boolean {
  const d = normalizeDir(dir);
  if (!d) return false;
  const p = filePath.replace(/\/+$/, "");
  return p === d || p.startsWith(d + "/");
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function escapeMarkdown(text: string): string {
  return text.replace(/\*/g, "\\*").replace(/_/g, "\\_");
}

function formatDetails(details: string): string {
  if (!details.trim()) return "";
  return details
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `- ${escapeMarkdown(line)}`)
    .join("\n");
}

function parseDetails(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const detailLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("### ")) break;
    if (line.startsWith("## ")) break;
    if (line.startsWith("# ")) break;
    if (line.startsWith("- ")) {
      detailLines.push(line.slice(2));
    } else {
      detailLines.push(line);
    }
  }
  return detailLines.join("\n");
}

function parseEntry(line: string): ResumeEntry | null {
  const m = line.match(/^###\s+(.+)$/);
  if (!m) return null;
  const parts = m[1].split("|").map((s) => s.trim());
  return {
    org: parts[0] ?? "",
    title: parts[1] ?? "",
    time: parts[2] ?? "",
    details: "",
  };
}

export function serializeResumeMarkdown(data: ResumeData): string {
  const lines: string[] = [RESUME_MARKER, ""];

  lines.push(`# ${escapeMarkdown(data.name || "未命名")}`);
  lines.push("");
  lines.push(`**意向岗位：** ${escapeMarkdown(data.role)}  `);
  lines.push(`**电话：** ${escapeMarkdown(data.phone)}  `);
  lines.push(`**邮箱：** ${escapeMarkdown(data.email)}`);
  lines.push("");

  const sections: { title: string; items: ResumeEntry[] }[] = [
    { title: "教育经历", items: data.education },
    { title: "工作经历", items: data.work },
    { title: "项目经历", items: data.projects },
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    if (section.items.length === 0) {
      lines.push("（暂无）");
      lines.push("");
      continue;
    }
    for (const item of section.items) {
      const header = [item.org, item.title, item.time]
        .filter((s) => s.length > 0)
        .join(" | ");
      lines.push(`### ${escapeMarkdown(header || "未填写")}`);
      lines.push("");
      const details = formatDetails(item.details);
      if (details) {
        lines.push(details);
        lines.push("");
      }
    }
  }

  lines.push("## 技能");
  lines.push("");
  lines.push(escapeMarkdown(data.skills) || "（暂无）");
  lines.push("");

  return lines.join("\n");
}

export function parseResumeMarkdown(content: string): ResumeData {
  const data: ResumeData = { ...DEFAULT_RESUME };
  const body = stripFrontmatter(content).trim();
  if (!body) return data;

  const lines = body.split("\n");
  let i = 0;

  // # name
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("# ") && !line.startsWith("## ")) {
      data.name = line.slice(2).trim();
      i++;
      break;
    }
    i++;
  }

  // 基础信息
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("## ")) break;

    const roleMatch = line.match(/\*\*意向岗位：\*\*\s*(.*)$/);
    if (roleMatch) data.role = roleMatch[1].trim();

    const phoneMatch = line.match(/\*\*电话：\*\*\s*(.*)$/);
    if (phoneMatch) data.phone = phoneMatch[1].trim();

    const emailMatch = line.match(/\*\*邮箱：\*\*\s*(.*)$/);
    if (emailMatch) data.email = emailMatch[1].trim();

    i++;
  }

  // 各 section
  let currentSection: "education" | "work" | "projects" | "skills" | null = null;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      if (title === "教育经历") currentSection = "education";
      else if (title === "工作经历") currentSection = "work";
      else if (title === "项目经历") currentSection = "projects";
      else if (title === "技能") currentSection = "skills";
      else currentSection = null;
      i++;
      continue;
    }

    if (currentSection === "skills") {
      if (line.startsWith("#")) break;
      if (!data.skills && line && line !== "（暂无）") {
        data.skills = line;
      } else if (line && line !== "（暂无）") {
        data.skills += "\n" + line;
      }
      i++;
      continue;
    }

    if (
      currentSection &&
      line.startsWith("### ")
    ) {
      const entry = parseEntry(line);
      if (entry) {
        i++;
        const detailStart = i;
        while (i < lines.length) {
          const next = lines[i].trim();
          if (next.startsWith("### ") || next.startsWith("## ") || next.startsWith("# ")) break;
          i++;
        }
        entry.details = parseDetails(lines.slice(detailStart, i).join("\n"));
        data[currentSection].push(entry);
      }
      continue;
    }

    i++;
  }

  return data;
}

export function isResumeMarkdownContent(content: string): boolean {
  return content.includes(RESUME_MARKER);
}

export function isResumeFile(
  app: App,
  file: TFile,
  resumeDir: string
): boolean {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  if (isResumeFrontmatter(fm)) return true;
  if (isInResumeDir(file.path, resumeDir)) return true;
  return false;
}

export async function readResume(
  app: App,
  file: TFile,
  resumeDir?: string
): Promise<ResumeData | null> {
  // 兼容旧 frontmatter 数据
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  if (isResumeFrontmatter(fm)) {
    return parseResume(fm);
  }

  // 仅在简历目录下或带标记的文件才解析 Markdown
  const inDir = resumeDir ? isInResumeDir(file.path, resumeDir) : false;
  if (!inDir && !isResumeFile(app, file, resumeDir ?? "")) {
    return null;
  }

  const content = await app.vault.cachedRead(file);
  return parseResumeMarkdown(content);
}

export async function writeResume(
  app: App,
  file: TFile,
  data: ResumeData
): Promise<void> {
  const content = serializeResumeMarkdown(data);
  await app.vault.modify(file, content);
}

export function createResumeMarkdown(data?: ResumeData): string {
  return serializeResumeMarkdown(data ?? { ...DEFAULT_RESUME });
}
