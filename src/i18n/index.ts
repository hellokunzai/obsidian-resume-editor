// i18n 国际化模块
// 所有用户可见文本必须通过 t() 函数获取，禁止硬编码字符串。

import { moment } from "obsidian";

const locale = moment.locale(); // "en", "zh-cn", "ja", "de" 等

const translations: Record<string, Record<string, string>> = {
  en: {
    "command.openEditor": "Open Resume Editor",
    "command.newResume": "New resume note",
    "command.markResume": "Mark current note as resume",
    "command.exportPdf": "Export resume as PDF",
    "command.exportHtml": "Export resume as HTML",
    "command.exportDocx": "Export resume as DOCX",
    "command.exportLatex": "Export resume as LaTeX",
    "command.atsCheck": "Run ATS pre-check",

    "ribbon.tooltip": "Resume Editor",
    "view.title": "Resume Editor",

    "settings.title": "Resume Editor Settings",
    "settings.template.name": "Default template",
    "settings.template.desc": "Template applied when opening a resume note",
    "settings.paper.name": "PDF paper size",
    "settings.paper.desc": "A4 or Letter",
    "settings.ai.heading": "AI polish",
    "settings.ai.enable.name": "Enable AI polish",
    "settings.ai.enable.desc": "Requires network and an API key (disclosed in README)",
    "settings.ai.endpoint.name": "API endpoint",
    "settings.ai.key.name": "API key",
    "settings.ai.model.name": "Model",
    "settings.resumeDir.heading": "Resume directory",
    "settings.resumeDir.dir.name": "Resume directory",
    "settings.resumeDir.dir.desc":
      "Vault-relative path. Markdown files in this folder are automatically treated as resumes. Leave empty to disable.",
    "settings.resumeDir.dir.placeholder": "e.g. _resumes (leave empty to disable)",
    "settings.autoSave.name": "Auto save",
    "settings.autoSave.desc": "Automatically save changes after you stop typing",

    "notice.pickedFolder": "Resume directory set to: {{path}}",
    "notice.saved": "Saved: {{name}}",

    "form.basic": "Basic info",
    "form.education": "Education",
    "form.work": "Work experience",
    "form.project": "Projects",
    "form.skills": "Skills",
    "field.name": "Name",
    "field.role": "Target role",
    "field.phone": "Phone",
    "field.email": "Email",
    "field.school": "School",
    "field.major": "Major / Degree",
    "field.time": "Time",
    "field.company": "Company",
    "field.projectName": "Project",
    "field.position": "Position",
    "field.details": "Description (one per line)",
    "field.skills": "Skills (comma separated)",
    "btn.save": "Save",
    "btn.addEducation": "Add education",
    "btn.addWork": "Add work",
    "btn.addProject": "Add project",

    "template.single": "Single column",
    "template.twoCol": "Two columns",
    "template.academic": "Academic",

    "export.pdf": "Export PDF",
    "export.html": "Export HTML",
    "export.docx": "Export DOCX",
    "export.latex": "Export LaTeX",

    "notice.exported": "Exported: {{name}}",
    "notice.noActive": "No active file",
    "notice.notResume": "Current note is not a resume note. Use 'Mark as resume' first.",
    "notice.created": "Resume note created: {{name}}",
    "notice.marked": "Marked '{{name}}' as a resume note",
    "notice.atsDone": "ATS pre-check done: {{score}}/100",
    "error.export": "Export failed: {{msg}}",
    "error.noKey": "AI polish needs an API key in settings",
    "ats.run": "Run ATS pre-check",
    "ats.title": "ATS pre-check",
  },
  "zh-cn": {
    "command.openEditor": "打开简历编辑器",
    "command.newResume": "新建简历笔记",
    "command.markResume": "标记当前笔记为简历",
    "command.exportPdf": "导出简历为 PDF",
    "command.exportHtml": "导出简历为 HTML",
    "command.exportDocx": "导出简历为 DOCX",
    "command.exportLatex": "导出简历为 LaTeX",
    "command.atsCheck": "运行 ATS 预检",

    "ribbon.tooltip": "简历编辑器",
    "view.title": "简历编辑器",

    "settings.title": "简历编辑器设置",
    "settings.template.name": "默认模板",
    "settings.template.desc": "打开简历笔记时套用的模板",
    "settings.paper.name": "PDF 纸张尺寸",
    "settings.paper.desc": "A4 或信纸",
    "settings.ai.heading": "AI 润色",
    "settings.ai.enable.name": "启用 AI 润色",
    "settings.ai.enable.desc": "需要网络与 API Key（已在 README 披露）",
    "settings.ai.endpoint.name": "API 地址",
    "settings.ai.key.name": "API Key",
    "settings.ai.model.name": "模型",
    "settings.resumeDir.heading": "简历目录",
    "settings.resumeDir.dir.name": "简历目录",
    "settings.resumeDir.dir.desc":
      "vault 内的相对路径。该目录下的 Markdown 文件会被自动识别为简历；留空则不启用。",
    "settings.resumeDir.dir.placeholder": "例如 _resumes（留空则不启用）",
    "settings.autoSave.name": "自动保存",
    "settings.autoSave.desc": "停止输入后自动保存修改",

    "notice.pickedFolder": "简历目录已设置为：{{path}}",
    "notice.saved": "已保存：{{name}}",

    "form.basic": "基本信息",
    "form.education": "教育经历",
    "form.work": "工作经历",
    "form.project": "项目经历",
    "form.skills": "技能",
    "field.name": "姓名",
    "field.role": "求职意向",
    "field.phone": "电话",
    "field.email": "邮箱",
    "field.school": "学校",
    "field.major": "专业 / 学历",
    "field.time": "时间",
    "field.company": "公司",
    "field.projectName": "项目名称",
    "field.position": "职位",
    "field.details": "描述（每行一条）",
    "field.skills": "技能（逗号分隔）",
    "btn.save": "保存",
    "btn.addEducation": "添加教育",
    "btn.addWork": "添加工作",
    "btn.addProject": "添加项目",

    "template.single": "单栏",
    "template.twoCol": "双栏",
    "template.academic": "学术",

    "export.pdf": "导出 PDF",
    "export.html": "导出 HTML",
    "export.docx": "导出 DOCX",
    "export.latex": "导出 LaTeX",

    "notice.exported": "已导出：{{name}}",
    "notice.noActive": "没有打开的笔记",
    "notice.notResume": "当前笔记不是简历笔记，请先用「标记为简历」。",
    "notice.created": "已创建简历笔记：{{name}}",
    "notice.marked": "已将「{{name}}」标记为简历笔记",
    "notice.atsDone": "ATS 预检完成：{{score}}/100",
    "error.export": "导出失败：{{msg}}",
    "error.noKey": "AI 润色需要在设置中填写 API Key",
    "ats.run": "运行 ATS 预检",
    "ats.title": "ATS 预检",
  },
};

const strings = translations[locale] ?? translations["en"];

export function t(key: string, params?: Record<string, string>): string {
  let text = strings[key] ?? translations["en"][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp("{{" + k + "}}", "g"), v);
    }
  }
  return text;
}
