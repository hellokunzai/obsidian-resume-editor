// LaTeX 导出：模板字符串生成（无需第三方库）

import { App, Notice } from "obsidian";
import { ResumeData, ResumeEntry, TemplateId } from "../data/resume-model";
import { t } from "../i18n";

function escTex(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function entryTex(title: string, entries: ResumeEntry[], classic: boolean): string {
  if (!entries.length) return "";
  const head = classic
    ? `\\subsection*{${escTex(title)}}\n\\noindent\\rule{\\linewidth}{0.6pt}\n`
    : `\\subsection*{${escTex(title)}}`;
  const lines: string[] = [head];
  for (const e of entries) {
    const top = e.time
      ? `${escTex(e.org)} \\hfill \\textit{${escTex(e.time)}}`
      : escTex(e.org);
    lines.push(top);
    if (e.title) lines.push(escTex(e.title));
    if (e.details) {
      for (const line of e.details.split("\n")) {
        if (line.trim()) lines.push("\\quad\\textbullet\\; " + escTex(line.trim()));
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
  const lines: string[] = [];
  lines.push("\\documentclass[a4paper,11pt]{article}");
  lines.push("\\usepackage[utf8]{inputenc}");
  lines.push("\\usepackage{CJKutf8}");
  lines.push("\\usepackage{hyperref}");
  lines.push("\\begin{document}");
  lines.push("\\begin{CJK}{UTF8}{gbsn}");
  lines.push(`\\section*{${escTex(data.name || " ")}}`);
  if (data.role) lines.push(`\\textbf{${escTex(data.role)}}\\\\`);
  if (classic) {
    const contact = classicContactTex(data);
    if (contact) lines.push(contact);
  } else {
    if (data.phone || data.email) {
      const c: string[] = [];
      if (data.phone) c.push(t("field.phone") + "：" + data.phone);
      if (data.email) c.push(t("field.email") + "：" + data.email);
      lines.push(c.join("\\quad "));
    }
  }
  lines.push("");
  lines.push(entryTex(t("form.education"), data.education, classic));
  lines.push(entryTex(t("form.work"), data.work, classic));
  lines.push(entryTex(t("form.project"), data.projects, classic));
  if (data.skills) {
    if (classic) {
      lines.push(`\\subsection*{${escTex(t("form.skills"))}}`);
      lines.push("\\noindent\\rule{\\linewidth}{0.6pt}");
      for (const line of data.skills.split("\n")) {
        if (line.trim()) lines.push("\\quad\\textbullet\\; " + escTex(line.trim()));
      }
    } else {
      lines.push("\\noindent\\textbf{" + escTex(t("form.skills")) + "}：" + escTex(data.skills));
    }
  }
  lines.push("\\end{CJK}");
  lines.push("\\end{document}");

  const tex = lines.join("\n");
  const path = `${baseName}.tex`;
  await app.vault.adapter.write(path, tex);
  new Notice(t("notice.exported", { name: path }));
}
