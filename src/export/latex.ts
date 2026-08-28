// LaTeX 导出：模板字符串生成（无需第三方库）

import { App, Notice } from "obsidian";
import { ResumeData, ResumeEntry, TemplateId, visibleEntries, formatEntryTime } from "../data/resume-model";
import { t } from "../i18n";
import { splitSkills } from "../render/template";

function escTex(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function entryTex(title: string, entries: ResumeEntry[], classic: boolean): string {
  const items = visibleEntries(entries);
  if (!items.length) return "";
  const head = classic
    ? `\\subsection*{${escTex(title)}}\n\\noindent\\rule{\\linewidth}{0.6pt}\n`
    : `\\subsection*{${escTex(title)}}`;
  const lines: string[] = [head];
  for (const e of items) {
    const timeStr = formatEntryTime(e);
    const top = timeStr
      ? `${escTex(e.org)} \\hfill \\textit{${escTex(timeStr)}}`
      : escTex(e.org);
    lines.push(top);
    const subParts: string[] = [];
    if (e.title) subParts.push(e.title);
    if (e.degree) subParts.push(e.degree);
    if (e.gpa) subParts.push("GPA " + e.gpa);
    if (subParts.length) lines.push(escTex(subParts.join(" · ")));
    if (e.details) {
      for (const line of e.details.split("\n")) {
        const trimmed = line.trim().replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
        if (trimmed) lines.push("\\quad\\textbullet\\; " + escTex(trimmed));
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Classic 模板：带标签的联系信息行 */
function classicContactTex(data: ResumeData): string {
  const c: string[] = [];
  if (data.employmentStatus) c.push(t("field.employmentStatus") + "：" + data.employmentStatus);
  if (data.email) c.push(t("field.email") + "：" + data.email);
  if (data.birthDate) c.push(t("field.birthDate") + "：" + data.birthDate);
  if (data.phone) c.push(t("field.phone") + "：" + data.phone);
  if (data.location) c.push(t("field.location") + "：" + data.location);
  for (const f of data.customFields) {
    if (!f.visible || !f.value) continue;
    c.push((f.showLabel && f.label ? f.label + "：" : "") + f.value);
  }
  if (!c.length) return "";
  return c.join("\\quad ") + "\\\\";
}

export async function exportLatex(
  app: App,
  data: ResumeData,
  baseName: string,
  template?: TemplateId
): Promise<void> {
  const classic = template === "classic";
  const bodyLines: string[] = [];

  for (const sec of data.sections) {
    if (!sec.visible) continue;

    if (sec.type === "basic") {
      bodyLines.push(`\\section*{${escTex(data.name || " ")}}`);
      if (data.role) bodyLines.push(`\\textbf{${escTex(data.role)}}\\\\`);
      if (classic) {
        const contact = classicContactTex(data);
        if (contact) bodyLines.push(contact);
      } else {
        if (data.phone || data.email) {
          const c: string[] = [];
          if (data.phone) c.push(t("field.phone") + "：" + data.phone);
          if (data.email) c.push(t("field.email") + "：" + data.email);
          bodyLines.push(c.join("\\quad "));
        }
      }
      continue;
    }

    if (sec.type === "skills") {
      if (!data.skills) continue;
      if (classic) {
        bodyLines.push(`\\subsection*{${escTex(t("form.skills"))}}`);
        bodyLines.push("\\noindent\\rule{\\linewidth}{0.6pt}");
        for (const line of data.skills.split("\n")) {
          if (line.trim()) bodyLines.push("\\quad\\textbullet\\; " + escTex(line.trim()));
        }
      } else {
        bodyLines.push(`\\subsection*{${escTex(t("form.skills"))}}`);
        for (const line of splitSkills(data.skills)) {
          bodyLines.push("\\quad\\textbullet\\; " + escTex(line));
        }
      }
    } else if (sec.type === "education") {
      bodyLines.push(entryTex(t("form.education"), data.education, classic));
    } else if (sec.type === "work") {
      bodyLines.push(entryTex(t("form.work"), data.work, classic));
    } else if (sec.type === "projects") {
      bodyLines.push(entryTex(t("form.project"), data.projects, classic));
    } else if (sec.type === "custom") {
      if (!sec.content.trim()) continue;
      if (classic) {
        bodyLines.push(`\\subsection*{${escTex(sec.title || t("form.customModule"))}}`);
        bodyLines.push("\\noindent\\rule{\\linewidth}{0.6pt}");
      } else {
        bodyLines.push(`\\subsection*{${escTex(sec.title || t("form.customModule"))}}`);
      }
      for (const line of sec.content.split("\n")) {
        if (line.trim()) bodyLines.push("\\quad\\textbullet\\; " + escTex(line.trim()));
      }
    }
  }

  const lines: string[] = [];
  lines.push("\\documentclass[a4paper,11pt]{article}");
  lines.push("\\usepackage[utf8]{inputenc}");
  lines.push("\\usepackage{CJKutf8}");
  lines.push("\\usepackage{hyperref}");
  lines.push("\\begin{document}");
  lines.push("\\begin{CJK}{UTF8}{gbsn}");
  lines.push(bodyLines.join("\n"));
  lines.push("\\end{CJK}");
  lines.push("\\end{document}");

  const tex = lines.join("\n");
  const path = `${baseName}.tex`;
  await app.vault.adapter.write(path, tex);
  new Notice(t("notice.exported", { name: path }));
}
