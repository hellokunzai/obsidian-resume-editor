// 简历数据模型 + Markdown 正文读写

import { App, TFile } from "obsidian";

export type TemplateId = "single" | "twoCol" | "academic";
export type ResumeLayout = "left" | "top" | "right";

/** 模块类型：内置固定模块 + 用户自定义模块 */
export type SectionType =
  | "basic"
  | "education"
  | "work"
  | "projects"
  | "skills"
  | "custom";

export interface ResumeEntry {
  org: string;
  title: string;
  time: string;
  details: string;
}

export interface ResumeCustomField {
  icon: string;
  label: string;
  value: string;
  showLabel: boolean;
  visible: boolean;
}

/** 模块配置：控制顺序与预览/导出的可见性 */
export interface ResumeSection {
  /** 唯一标识。内置模块用 type；自定义模块用随机 id */
  id: string;
  type: SectionType;
  /** 是否在预览与导出时显示 */
  visible: boolean;
  /** 自定义模块标题（仅 custom 类型生效） */
  title: string;
  /** 自定义模块正文（仅 custom 类型生效，每行一条） */
  content: string;
}

/** 内置模块的默认标题 key（用于 i18n） */
export const SECTION_TITLE_KEY: Record<Exclude<SectionType, "custom">, string> = {
  basic: "form.basic",
  education: "form.education",
  work: "form.work",
  projects: "form.project",
  skills: "form.skills",
};

export const DEFAULT_SECTIONS: ResumeSection[] = [
  { id: "basic", type: "basic", visible: true, title: "", content: "" },
  { id: "education", type: "education", visible: true, title: "", content: "" },
  { id: "work", type: "work", visible: true, title: "", content: "" },
  { id: "projects", type: "projects", visible: true, title: "", content: "" },
  { id: "skills", type: "skills", visible: true, title: "", content: "" },
];

export interface ResumeData {
  name: string;
  role: string;
  phone: string;
  email: string;
  layout: ResumeLayout;
  avatar: string;
  customFields: ResumeCustomField[];
  education: ResumeEntry[];
  work: ResumeEntry[];
  projects: ResumeEntry[];
  skills: string;
  sections: ResumeSection[];
}

export const RESUME_MARK = "resume";
export const RESUME_MARKER = "<!-- obsidian-resume-editor -->";
export const RESUME_MARKER_OPEN = "<!-- obsidian-resume-editor";

export const DEFAULT_RESUME: ResumeData = {
  name: "",
  role: "",
  phone: "",
  email: "",
  layout: "left",
  avatar: "",
  customFields: [],
  education: [],
  work: [],
  projects: [],
  skills: "",
  sections: [...DEFAULT_SECTIONS.map((s) => ({ ...s }))],
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

function asCustomField(raw: unknown): ResumeCustomField {
  const empty = { icon: "", label: "", value: "", showLabel: true, visible: true };
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      icon: typeof o.icon === "string" ? o.icon : "",
      label: typeof o.label === "string" ? o.label : "",
      value: typeof o.value === "string" ? o.value : "",
      showLabel: typeof o.showLabel === "boolean" ? o.showLabel : true,
      visible: typeof o.visible === "boolean" ? o.visible : true,
    };
  }
  return empty;
}

function asCustomFields(raw: unknown): ResumeCustomField[] {
  if (Array.isArray(raw)) return raw.map(asCustomField);
  return [];
}

function isLayout(v: unknown): v is ResumeLayout {
  return v === "left" || v === "top" || v === "right";
}

export function parseResume(
  fm: Record<string, unknown> | undefined | null
): ResumeData {
  if (!fm) return { ...DEFAULT_RESUME };
  const layout = isLayout(fm.layout) ? fm.layout : DEFAULT_RESUME.layout;

  let sections: ResumeSection[];
  const rawSections = Array.isArray(fm.sections)
    ? (fm.sections.map(asSection).filter(Boolean) as ResumeSection[])
    : [];
  if (rawSections.length) {
    const seen = new Set<string>();
    const dedup: ResumeSection[] = [];
    for (const s of rawSections) {
      if (s.type !== "custom") {
        if (seen.has(s.type)) continue;
        seen.add(s.type);
      }
      dedup.push(s);
    }
    if (!dedup.some((s) => s.type === "basic")) {
      dedup.unshift({ id: "basic", type: "basic", visible: true, title: "", content: "" });
    }
    sections = dedup;
  } else {
    sections = DEFAULT_SECTIONS.map((s) => ({ ...s }));
  }

  return {
    name: typeof fm.name === "string" ? fm.name : "",
    role: typeof fm.role === "string" ? fm.role : "",
    phone: typeof fm.phone === "string" ? fm.phone : "",
    email: typeof fm.email === "string" ? fm.email : "",
    layout,
    avatar: typeof fm.avatar === "string" ? fm.avatar : "",
    customFields: asCustomFields(fm.customFields),
    education: asEntries(fm.education),
    work: asEntries(fm.work),
    projects: asEntries(fm.projects),
    skills: typeof fm.skills === "string" ? fm.skills : "",
    sections,
  };
}

function cloneEntry(e: ResumeEntry): ResumeEntry {
  return { org: e.org, title: e.title, time: e.time, details: e.details };
}

function cloneCustomField(f: ResumeCustomField): ResumeCustomField {
  return { icon: f.icon, label: f.label, value: f.value, showLabel: f.showLabel, visible: f.visible };
}

function asSection(raw: unknown): ResumeSection | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = o.type;
  const allowed: SectionType[] = ["basic", "education", "work", "projects", "skills", "custom"];
  if (typeof type !== "string" || !allowed.includes(type as SectionType)) return null;
  const visible = typeof o.visible === "boolean" ? o.visible : true;
  const title = typeof o.title === "string" ? o.title : "";
  const content = typeof o.content === "string" ? o.content : "";
  const id = typeof o.id === "string" && o.id ? o.id : (type as string);
  return { id, type: type as SectionType, visible, title, content };
}

export function toFrontmatter(data: ResumeData): Record<string, unknown> {
  const sections = data.sections.map((s) => {
    const base: Record<string, unknown> = { id: s.id, type: s.type, visible: s.visible };
    if (s.type === "custom") {
      base.title = s.title;
      base.content = s.content;
    }
    return base;
  });
  return {
    [RESUME_MARK]: true,
    name: data.name,
    role: data.role,
    phone: data.phone,
    email: data.email,
    layout: data.layout,
    avatar: data.avatar,
    sections,
    customFields: data.customFields.map(cloneCustomField),
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

function serializeConfig(data: ResumeData): string {
  const cfJson = JSON.stringify(data.customFields);
  return [
    "<!-- obsidian-resume-editor",
    `layout: ${data.layout}`,
    `avatar: ${data.avatar}`,
    `customFields: ${cfJson}`,
    "-->",
  ].join("\n");
}

function parseConfig(content: string): Partial<ResumeData> {
  const cfg: Partial<ResumeData> = {};
  const m = content.match(/<!--\s*obsidian-resume-editor\s*\n([\s\S]*?)\n\s*-->/);
  if (!m) return cfg;

  for (const line of m[1].split("\n")) {
    const layoutMatch = line.match(/^layout:\s*(.*)$/);
    if (layoutMatch) {
      const v = layoutMatch[1].trim();
      if (isLayout(v)) cfg.layout = v;
    }
    const avatarMatch = line.match(/^avatar:\s*(.*)$/);
    if (avatarMatch) cfg.avatar = avatarMatch[1].trim();
    const cfMatch = line.match(/^customFields:\s*(\[.*\])\s*$/);
    if (cfMatch) {
      try {
        cfg.customFields = asCustomFields(JSON.parse(cfMatch[1]));
      } catch {
        cfg.customFields = [];
      }
    }
  }
  return cfg;
}

export function serializeResumeMarkdown(data: ResumeData): string {
  const lines: string[] = [serializeConfig(data), ""];

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
  const cfg = parseConfig(content);
  if (cfg.layout) data.layout = cfg.layout;
  if (cfg.avatar !== undefined) data.avatar = cfg.avatar;
  if (cfg.customFields) data.customFields = cfg.customFields;

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
  return content.includes(RESUME_MARKER_OPEN) || content.includes(RESUME_MARKER);
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
