// 简历数据模型 + frontmatter 读写

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

export function readResume(app: App, file: TFile): ResumeData | null {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  if (!isResumeFrontmatter(fm)) return null;
  return parseResume(fm);
}

export async function writeResume(
  app: App,
  file: TFile,
  data: ResumeData
): Promise<void> {
  await app.fileManager.processFrontMatter(file, (fm) => {
    const next = toFrontmatter(data);
    for (const [k, v] of Object.entries(next)) {
      fm[k] = v;
    }
    return fm;
  });
}
