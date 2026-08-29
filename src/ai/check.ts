// AI 简历体检：把整份简历序列化后发给 AI，返回结构化问题列表（JSON）
// 复用 polish.ts 同一套 OpenAI 兼容接口与 Bearer 认证（需网络与 API Key，已在 README 披露）

import { requestUrl } from "obsidian";
import { ResumeEditorSettings } from "../settings/SettingsTab";
import {
  ResumeData,
  ResumeEntry,
  visibleEntries,
  formatEntryTime,
} from "../data/resume-model";
import { t } from "../i18n";

export type CheckSeverity = "high" | "medium" | "low";

/** 一条体检问题：field 为定位键（basic / skills / education / work / projects，或 education.0 带序号） */
export interface CheckIssue {
  field: string;
  severity: CheckSeverity;
  message: string;
  suggestion: string;
}

const SEVERITIES: CheckSeverity[] = ["high", "medium", "low"];

/** 计算当前简历允许的 field 定位键集合（作为 AI 输出约束） */
function allowedFields(data: ResumeData): string[] {
  const out: string[] = ["basic", "skills"];
  const add = (key: string, entries: ResumeEntry[]): void => {
    out.push(key);
    entries.forEach((_, i) => out.push(`${key}.${i}`));
  };
  add("education", data.education);
  add("work", data.work);
  add("projects", data.projects);
  return out;
}

/** 简历 -> 带 field 标记的纯文本（发给 AI 的输入，同时用于构造 prompt 中的字段说明） */
function serializeForCheck(data: ResumeData): string {
  const lines: string[] = [];
  const contacts = [
    data.phone && `电话: ${data.phone}`,
    data.email && `邮箱: ${data.email}`,
    data.location && `所在地: ${data.location}`,
    data.employmentStatus && `在职状态: ${data.employmentStatus}`,
    ...data.customFields.filter((f) => f.visible && f.value).map((f) => `${f.label}: ${f.value}`),
  ].filter(Boolean) as string[];

  lines.push("[basic 基本信息]");
  if (data.name) lines.push(`姓名: ${data.name}`);
  if (data.role) lines.push(`求职意向: ${data.role}`);
  for (const c of contacts) lines.push(c);

  const section = (key: string, title: string, entries: ResumeEntry[]): void => {
    const items = visibleEntries(entries);
    if (!items.length) return;
    lines.push("", `[${key} ${title}]`);
    items.forEach((e) => {
      const head = [e.org, e.title, e.degree, e.gpa && `GPA ${e.gpa}`, formatEntryTime(e)]
        .filter(Boolean)
        .join(" | ");
      lines.push(head);
      for (const line of e.details.split("\n")) {
        if (line.trim()) lines.push(`- ${line.trim()}`);
      }
    });
  };

  section("education", "教育经历", data.education);
  section("work", "工作经历", data.work);
  section("projects", "项目经历", data.projects);

  if (data.skills.trim()) {
    lines.push("", "[skills 专业技能]");
    lines.push(data.skills.trim());
  }

  return lines.join("\n");
}

/** 从模型回复中稳健提取 JSON 数组（容忍 ```json 代码块与前后多余文本） */
function parseIssues(raw: string): CheckIssue[] {
  const text = raw.replace(/```(?:json)?/gi, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: CheckIssue[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const field = typeof obj.field === "string" ? obj.field.trim() : "";
    const message = typeof obj.message === "string" ? obj.message.trim() : "";
    if (!field || !message) continue;
    const sev = typeof obj.severity === "string" && SEVERITIES.includes(obj.severity as CheckSeverity)
      ? (obj.severity as CheckSeverity)
      : "medium";
    const suggestion = typeof obj.suggestion === "string" ? obj.suggestion.trim() : "";
    out.push({ field, severity: sev, message, suggestion });
  }
  return out;
}

export async function checkResume(
  data: ResumeData,
  settings: ResumeEditorSettings
): Promise<CheckIssue[]> {
  const fields = allowedFields(data);
  const prompt =
    "你是一名资深简历顾问与 ATS 专家。请审查下面这份简历，找出具体问题，包括但不限于：" +
    "描述缺少量化成果、动词软弱（负责/参与）、内容冗长重复、表达不专业或有错别字、" +
    "时间线缺失或矛盾、与目标岗位无关的内容、ATS 不友好表述。\n\n" +
    `只能使用以下 field 定位键: ${fields.join(", ")}\n` +
    '严格返回 JSON 数组（不要任何解释文字），每项格式: ' +
    '{"field":"定位键","severity":"high|medium|low","message":"问题描述","suggestion":"修改建议"}\n' +
    "severity: high=明显减分项, medium=建议改进, low=锦上添花。最多返回 15 条，按严重度排序。" +
    "没有问题时返回 []。\n\n---\n" +
    serializeForCheck(data);

  const resp = await requestUrl({
    url: settings.aiEndpoint,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.aiKey}`,
    },
    body: JSON.stringify({
      model: settings.aiModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });

  const json = resp.json;
  const content =
    json && json.choices && json.choices[0] && json.choices[0].message
      ? json.choices[0].message.content
      : "";
  const issues = parseIssues(String(content ?? ""));
  if (!content || (!issues.length && !String(content).trim().startsWith("["))) {
    // 模型没按格式回复且解析不到任何问题：视为解析失败，交由上层提示
    throw new Error(t("check.notice.parseError"));
  }
  return issues;
}
