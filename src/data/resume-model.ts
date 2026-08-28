// 简历数据模型 + Markdown 正文读写

import { App, TFile } from "obsidian";

export type TemplateId = "single" | "twoCol" | "academic" | "classic";
export type ResumeLayout = "left" | "top" | "right";

/** 头像宽高比选项 */
export type AvatarRatio = "1:1" | "4:5" | "3:4";
/** 头像圆角样式 */
export type AvatarRadius = "none" | "sm" | "md" | "lg";

export const AVATAR_RATIO_OPTIONS: AvatarRatio[] = ["1:1", "4:5", "3:4"];
export const AVATAR_RADIUS_OPTIONS: AvatarRadius[] = ["none", "sm", "md", "lg"];

/** 根据简历数据计算头像的渲染尺寸与圆角，供编辑视图与导出渲染共用 */
export function computeAvatarStyle(data: ResumeData): {
  width: number;
  height: number;
  radius: string;
} {
  const size =
    typeof data.avatarSize === "number" && isFinite(data.avatarSize)
      ? Math.min(240, Math.max(40, Math.round(data.avatarSize)))
      : 90;
  const ratio = AVATAR_RATIO_OPTIONS.includes(data.avatarAspectRatio)
    ? data.avatarAspectRatio
    : "4:5";
  const [aw, ah] = ratio.split(":").map(Number);
  const width = size;
  const height = aw && ah ? Math.round((size * ah) / aw) : size;
  const radiusMap: Record<AvatarRadius, string> = {
    none: "0",
    sm: "6px",
    md: "14px",
    lg: "999px",
  };
  const radiusKey = AVATAR_RADIUS_OPTIONS.includes(data.avatarRadius)
    ? data.avatarRadius
    : "sm";
  return { width, height, radius: radiusMap[radiusKey] };
}

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
  /** 学历（教育经历用） */
  degree: string;
  /** GPA（教育经历用） */
  gpa: string;
  /** 开始时间 */
  startTime: string;
  /** 结束时间 */
  endTime: string;
  /** 是否至今 */
  current: boolean;
  /** 旧版单一时间字段，读取旧数据时兼容 */
  time: string;
  /** 简介（Markdown） */
  details: string;
  /** 该条目是否在预览/导出中显示 */
  visible?: boolean;
  /** 该条目在左侧编辑区是否折叠 */
  collapsed?: boolean;
}

export interface ResumeCustomField {
  icon: string;
  label: string;
  value: string;
  showLabel: boolean;
  visible: boolean;
}

/** 可配置的基础字段：控制顺序与预览/导出可见性 */
export interface BasicFieldConfig {
  key: string;
  visible: boolean;
}

/** 可调整顺序/显示/删除的基础字段 key 集合（姓名、职位固定，不参与） */
export const BASIC_FIELD_KEYS = ["phone", "email", "employmentStatus", "location", "birthDate"] as const;

export const DEFAULT_BASIC_FIELDS: BasicFieldConfig[] = BASIC_FIELD_KEYS.map((key) => ({ key, visible: true }));

/** 模块配置：控制顺序、预览/导出可见性与编辑区折叠 */
export interface ResumeSection {
  /** 唯一标识。内置模块用 type；自定义模块用随机 id */
  id: string;
  type: SectionType;
  /** 是否在右侧预览与导出时显示 */
  visible: boolean;
  /** 左侧编辑区是否折叠 */
  collapsed: boolean;
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
  { id: "basic", type: "basic", visible: true, collapsed: false, title: "", content: "" },
  { id: "education", type: "education", visible: true, collapsed: true, title: "", content: "" },
  { id: "work", type: "work", visible: true, collapsed: true, title: "", content: "" },
  { id: "projects", type: "projects", visible: true, collapsed: true, title: "", content: "" },
  { id: "skills", type: "skills", visible: true, collapsed: true, title: "", content: "" },
];

export interface ResumeData {
  name: string;
  role: string;
  phone: string;
  email: string;
  /** 在职状态，如「离职」「在职」 */
  employmentStatus: string;
  /** 所在地 */
  location: string;
  /** 出生年月 */
  birthDate: string;
  layout: ResumeLayout;
  avatar: string;
  /** 头像尺寸（像素，作为宽度基准） */
  avatarSize: number;
  /** 头像宽高比 */
  avatarAspectRatio: AvatarRatio;
  /** 头像圆角样式 */
  avatarRadius: AvatarRadius;
  basicFields: BasicFieldConfig[];
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
  employmentStatus: "",
  location: "",
  birthDate: "",
  layout: "left",
  avatar: "",
  avatarSize: 90,
  avatarAspectRatio: "4:5",
  avatarRadius: "sm",
  basicFields: DEFAULT_BASIC_FIELDS.map((f) => ({ ...f })),
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
    const time = typeof o.time === "string" ? o.time : "";
    let startTime = typeof o.startTime === "string" ? o.startTime : "";
    let endTime = typeof o.endTime === "string" ? o.endTime : "";
    // 旧数据只有 time：尝试把 "2013/09 - 2017/06" 这类拆成 start/end
    if (!startTime && !endTime && time) {
      const parts = time.split(/\s*[~-]\s*/);
      startTime = parts[0]?.trim() ?? "";
      endTime = parts[1]?.trim() ?? "";
    }
    return {
      org: typeof o.org === "string" ? o.org : "",
      title: typeof o.title === "string" ? o.title : "",
      degree: typeof o.degree === "string" ? o.degree : "",
      gpa: typeof o.gpa === "string" ? o.gpa : "",
      startTime,
      endTime,
      current: typeof o.current === "boolean" ? o.current : false,
      time,
      details: typeof o.details === "string" ? o.details : "",
      visible: typeof o.visible === "boolean" ? o.visible : true,
      collapsed: typeof o.collapsed === "boolean" ? o.collapsed : false,
    };
  }
  return {
    org: "",
    title: "",
    degree: "",
    gpa: "",
    startTime: "",
    endTime: "",
    current: false,
    time: "",
    details: "",
    visible: true,
    collapsed: false,
  };
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

function asBasicField(raw: unknown): BasicFieldConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const key = typeof o.key === "string" ? o.key : "";
  if (!BASIC_FIELD_KEYS.includes(key as (typeof BASIC_FIELD_KEYS)[number])) return null;
  return { key, visible: typeof o.visible === "boolean" ? o.visible : true };
}

function asBasicFields(raw: unknown): BasicFieldConfig[] {
  if (!Array.isArray(raw)) return [];
  const out: BasicFieldConfig[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const f = asBasicField(item);
    if (!f || seen.has(f.key)) continue;
    seen.add(f.key);
    out.push(f);
  }
  return out;
}

function isLayout(v: unknown): v is ResumeLayout {
  return v === "left" || v === "top" || v === "right";
}

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return fallback;
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
      dedup.unshift({ id: "basic", type: "basic", visible: true, collapsed: false, title: "", content: "" });
    }
    sections = dedup;
  } else {
    sections = DEFAULT_SECTIONS.map((s) => ({ ...s }));
  }

  const rawBasicFields = asBasicFields(fm.basicFields);
  const basicFields = rawBasicFields.length
    ? rawBasicFields
    : DEFAULT_BASIC_FIELDS.map((f) => ({ ...f }));

  return {
    name: typeof fm.name === "string" ? fm.name : "",
    role: typeof fm.role === "string" ? fm.role : "",
    phone: typeof fm.phone === "string" ? fm.phone : "",
    email: typeof fm.email === "string" ? fm.email : "",
    employmentStatus: typeof fm.employmentStatus === "string" ? fm.employmentStatus : "",
    location: typeof fm.location === "string" ? fm.location : "",
    birthDate: typeof fm.birthDate === "string" ? fm.birthDate : "",
    layout,
    avatar: typeof fm.avatar === "string" ? fm.avatar : "",
    avatarSize: asNumber(fm.avatarSize, DEFAULT_RESUME.avatarSize),
    avatarAspectRatio: AVATAR_RATIO_OPTIONS.includes(fm.avatarAspectRatio as AvatarRatio)
      ? (fm.avatarAspectRatio as AvatarRatio)
      : DEFAULT_RESUME.avatarAspectRatio,
    avatarRadius: AVATAR_RADIUS_OPTIONS.includes(fm.avatarRadius as AvatarRadius)
      ? (fm.avatarRadius as AvatarRadius)
      : DEFAULT_RESUME.avatarRadius,
    basicFields,
    customFields: asCustomFields(fm.customFields),
    education: asEntries(fm.education),
    work: asEntries(fm.work),
    projects: asEntries(fm.projects),
    skills: typeof fm.skills === "string" ? fm.skills : "",
    sections,
  };
}

/** 过滤出在预览/导出中应显示的条目 */
export function visibleEntries(entries: ResumeEntry[]): ResumeEntry[] {
  return entries.filter((e) => e.visible !== false);
}

/** 组合 startTime/endTime/current 为展示时间，回退旧 time 字段 */
export function formatEntryTime(e: ResumeEntry): string {
  if (e.startTime || e.endTime || e.current) {
    const end = e.current ? "至今" : e.endTime;
    if (e.startTime && end) return `${e.startTime} - ${end}`;
    if (e.startTime) return `${e.startTime} - 至今`;
    return end || "";
  }
  return e.time;
}

function cloneEntry(e: ResumeEntry): ResumeEntry {
  return {
    org: e.org,
    title: e.title,
    degree: e.degree ?? "",
    gpa: e.gpa ?? "",
    startTime: e.startTime ?? "",
    endTime: e.endTime ?? "",
    current: e.current ?? false,
    time: e.time ?? "",
    details: e.details,
    visible: e.visible ?? true,
    collapsed: e.collapsed ?? false,
  };
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
  const collapsed = typeof o.collapsed === "boolean" ? o.collapsed : false;
  const title = typeof o.title === "string" ? o.title : "";
  const content = typeof o.content === "string" ? o.content : "";
  const id = typeof o.id === "string" && o.id ? o.id : (type as string);
  return { id, type: type as SectionType, visible, collapsed, title, content };
}

export function toFrontmatter(data: ResumeData): Record<string, unknown> {
  const sections = data.sections.map((s) => {
    const base: Record<string, unknown> = { id: s.id, type: s.type, visible: s.visible, collapsed: s.collapsed };
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
    employmentStatus: data.employmentStatus,
    location: data.location,
    birthDate: data.birthDate,
    layout: data.layout,
    avatar: data.avatar,
    avatarSize: data.avatarSize,
    avatarAspectRatio: data.avatarAspectRatio,
    avatarRadius: data.avatarRadius,
    basicFields: data.basicFields.map((f) => ({ ...f })),
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
  // details 现在直接保存 Markdown，不再自动加列表符号
  return details.trim();
}

function parseDetails(text: string): string {
  const lines = text.split("\n");
  const detailLines: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("### ")) break;
    if (line.startsWith("## ")) break;
    if (line.startsWith("# ")) break;
    detailLines.push(raw);
  }
  return detailLines.join("\n").trim();
}

function parseEntry(line: string): ResumeEntry | null {
  const m = line.match(/^###\s+(.+)$/);
  if (!m) return null;
  const parts = m[1].split("|").map((s) => s.trim());

  // 旧格式兼容：org | title | time
  if (parts.length <= 3) {
    const time = parts[2] ?? "";
    let startTime = "";
    let endTime = "";
    if (time) {
      const segments = time.split(/\s*[~-]\s*/);
      startTime = segments[0]?.trim() ?? "";
      endTime = segments[1]?.trim() ?? "";
    }
    return {
      org: parts[0] ?? "",
      title: parts[1] ?? "",
      degree: "",
      gpa: "",
      startTime,
      endTime,
      current: false,
      time,
      details: "",
    };
  }

  // 新格式：org | title | degree | gpa | startTime | endTime | current
  const current = parts[6] === "至今" || parts[6] === "current" || parts[6] === "true";
  return {
    org: parts[0] ?? "",
    title: parts[1] ?? "",
    degree: parts[2] ?? "",
    gpa: parts[3] ?? "",
    startTime: parts[4] ?? "",
    endTime: current ? "" : (parts[5] ?? ""),
    current,
    time: "",
    details: "",
  };
}

function serializeConfig(data: ResumeData): string {
  const cfJson = JSON.stringify(data.customFields);
  const bfJson = JSON.stringify(data.basicFields);
  return [
    "<!-- obsidian-resume-editor",
    `layout: ${data.layout}`,
    `avatar: ${data.avatar}`,
    `avatarSize: ${data.avatarSize}`,
    `avatarAspectRatio: ${data.avatarAspectRatio}`,
    `avatarRadius: ${data.avatarRadius}`,
    `employmentStatus: ${data.employmentStatus}`,
    `location: ${data.location}`,
    `birthDate: ${data.birthDate}`,
    `basicFields: ${bfJson}`,
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
    const sizeMatch = line.match(/^avatarSize:\s*(.*)$/);
    if (sizeMatch) {
      const n = Number(sizeMatch[1].trim());
      if (isFinite(n)) cfg.avatarSize = n;
    }
    const ratioMatch = line.match(/^avatarAspectRatio:\s*(.*)$/);
    if (ratioMatch) {
      const v = ratioMatch[1].trim();
      if (AVATAR_RATIO_OPTIONS.includes(v as AvatarRatio)) cfg.avatarAspectRatio = v as AvatarRatio;
    }
    const radiusMatch = line.match(/^avatarRadius:\s*(.*)$/);
    if (radiusMatch) {
      const v = radiusMatch[1].trim();
      if (AVATAR_RADIUS_OPTIONS.includes(v as AvatarRadius)) cfg.avatarRadius = v as AvatarRadius;
    }
    const esMatch = line.match(/^employmentStatus:\s*(.*)$/);
    if (esMatch) cfg.employmentStatus = esMatch[1].trim();
    const locMatch = line.match(/^location:\s*(.*)$/);
    if (locMatch) cfg.location = locMatch[1].trim();
    const bdMatch = line.match(/^birthDate:\s*(.*)$/);
    if (bdMatch) cfg.birthDate = bdMatch[1].trim();
    const bfMatch = line.match(/^basicFields:\s*(\[.*\])\s*$/);
    if (bfMatch) {
      try {
        cfg.basicFields = asBasicFields(JSON.parse(bfMatch[1]));
      } catch {
        cfg.basicFields = [];
      }
    }
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
      const currentFlag = item.current ? "至今" : "";
      const header = [item.org, item.title, item.degree, item.gpa, item.startTime, item.endTime, currentFlag]
        .map((s) => s.trim())
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
  if (cfg.avatarSize !== undefined) data.avatarSize = cfg.avatarSize;
  if (cfg.avatarAspectRatio !== undefined) data.avatarAspectRatio = cfg.avatarAspectRatio;
  if (cfg.avatarRadius !== undefined) data.avatarRadius = cfg.avatarRadius;
  if (cfg.employmentStatus !== undefined) data.employmentStatus = cfg.employmentStatus;
  if (cfg.location !== undefined) data.location = cfg.location;
  if (cfg.birthDate !== undefined) data.birthDate = cfg.birthDate;
  if (cfg.basicFields && cfg.basicFields.length) data.basicFields = cfg.basicFields;
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
