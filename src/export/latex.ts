// LaTeX 导出：模板字符串生成（无需第三方库）

import { App, Notice } from "obsidian";
import { ResumeData, ResumeEntry } from "../data/resume-model";
import { t } from "../i18n";

function escTex(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function entryTex(title: string, entries: ResumeEntry[]): string {
  if (!entries.length) return "";
  const lines: string[] = [`\\subsection*{${escTex(title)}}`];
  for (const e of entries) {
    const head = e.time
      ? `${escTex(e.org)} \\hfill \\textit{${escTex(e.time)}}`
      : escTex(e.org);
    lines.push(head);
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

export async function exportLatex(
  app: App,
  data: ResumeData,
  baseName: string
): Promise<void> {
  const lines: string[] = [];
  lines.push("\\documentclass[a4paper,11pt]{article}");
  lines.push("\\usepackage[utf8]{inputenc}");
  lines.push("\\usepackage{CJKutf8}");
  lines.push("\\usepackage{hyperref}");
  lines.push("\\begin{document}");
  lines.push("\\begin{CJK}{UTF8}{gbsn}");
  lines.push(`\\section*{${escTex(data.name || " ")}}`);
  if (data.role) lines.push(`\\textbf{${escTex(data.role)}}\\\\`);
  if (data.phone || data.email) {
    const c: string[] = [];
    if (data.phone) c.push(t("field.phone") + "：" + data.phone);
    if (data.email) c.push(t("field.email") + "：" + data.email);
    lines.push(c.join("\\quad "));
  }
  lines.push("");
  lines.push(entryTex(t("form.education"), data.education));
  lines.push(entryTex(t("form.work"), data.work));
  lines.push(entryTex(t("form.project"), data.projects));
  if (data.skills) lines.push("\\noindent\\textbf{" + escTex(t("form.skills")) + "}：" + escTex(data.skills));
  lines.push("\\end{CJK}");
  lines.push("\\end{document}");

  const tex = lines.join("\n");
  const path = `${baseName}.tex`;
  await app.vault.adapter.write(path, tex);
  new Notice(t("notice.exported", { name: path }));
}
