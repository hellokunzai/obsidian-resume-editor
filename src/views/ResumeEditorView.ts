// 双栏表单视图：左结构化表单、右实时预览（createEl 构造，禁用 innerHTML）

import { ItemView, WorkspaceLeaf, Notice, TFile } from "obsidian";
import type ResumeEditorPlugin from "../main";
import {
  ResumeData,
  ResumeEntry,
  TemplateId,
  DEFAULT_RESUME,
  readResume,
  writeResume,
} from "../data/resume-model";
import { renderResumeDom } from "../render/template";
import { t } from "../i18n";
import { exportPdf } from "../export/pdf";
import { exportHtml } from "../export/html";
import { exportDocx } from "../export/docx";
import { exportLatex } from "../export/latex";

export const VIEW_TYPE_RESUME = "resume-editor-view";

interface SectionCfg {
  org: string;
  title: string;
  time: string;
  details: string;
}

const SECTION_LABELS: Record<string, SectionCfg> = {
  education: {
    org: "field.school",
    title: "field.major",
    time: "field.time",
    details: "field.details",
  },
  work: {
    org: "field.company",
    title: "field.position",
    time: "field.time",
    details: "field.details",
  },
  projects: {
    org: "field.projectName",
    title: "field.role",
    time: "field.time",
    details: "field.details",
  },
};

export class ResumeEditorView extends ItemView {
  plugin: ResumeEditorPlugin;
  private model: ResumeData = { ...DEFAULT_RESUME };
  private currentFile: TFile | null = null;
  private formBody!: HTMLElement;
  private previewPaper!: HTMLElement;
  private atsBox!: HTMLElement;
  private saveTimer: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ResumeEditorPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_RESUME;
  }

  getDisplayText(): string {
    return t("view.title");
  }

  getIcon(): string {
    return "file-text";
  }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.createDiv({ cls: "review-editor-root" });
    const shell = root.querySelector(
      ".review-editor-root"
    ) as HTMLElement;

    // 顶栏
    const header = shell.createDiv({ cls: "re-header" });
    header.createEl("div", { cls: "re-title", text: t("view.title") });

    const tplSwitch = header.createDiv({ cls: "re-tpl-switch" });
    (["single", "twoCol", "academic"] as TemplateId[]).forEach((id) => {
      const chip = tplSwitch.createEl("span", {
        cls: "re-tpl-chip" + (this.plugin.settings.template === id ? " re-on" : ""),
        text: t("template." + (id === "twoCol" ? "twoCol" : id === "academic" ? "academic" : "single")),
      });
      chip.addEventListener("click", () => this.switchTemplate(id));
    });

    const btnPdf = header.createEl("button", { cls: "re-btn re-primary", text: t("export.pdf") });
    btnPdf.addEventListener("click", () => this.doExport("pdf"));
    const btnHtml = header.createEl("button", { cls: "re-btn", text: t("export.html") });
    btnHtml.addEventListener("click", () => this.doExport("html"));
    const btnDocx = header.createEl("button", { cls: "re-btn", text: t("export.docx") });
    btnDocx.addEventListener("click", () => this.doExport("docx"));
    const btnLatex = header.createEl("button", { cls: "re-btn", text: t("export.latex") });
    btnLatex.addEventListener("click", () => this.doExport("latex"));

    const btnSave = header.createEl("button", { cls: "re-btn re-primary", text: t("btn.save") });
    btnSave.addEventListener("click", () => this.saveNow());

    // 双栏
    const dual = shell.createDiv({ cls: "re-dual" });

    const formPane = dual.createDiv({ cls: "re-pane" });
    formPane.createDiv({ cls: "re-pane-head", text: t("form.basic") });
    this.formBody = formPane.createDiv({ cls: "re-pane-body" });
    this.formBody.addEventListener("input", () => this.syncFromForm());

    const atsWrap = formPane.createDiv({ cls: "re-ats" });
    atsWrap.createEl("div", { cls: "re-ats-score", text: "—" });
    this.atsBox = atsWrap;

    const previewPane = dual.createDiv({ cls: "re-pane" });
    previewPane.createDiv({ cls: "re-pane-head", text: t("view.title") });
    const scroll = previewPane.createDiv({ cls: "re-preview-scroll" });
    this.previewPaper = scroll.createDiv();

    // 监听活动文件变化
    this.registerEvent(
      this.app.workspace.on("file-open", () => void this.loadActive())
    );

    void this.loadActive();
  }

  async onClose(): Promise<void> {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
  }

  private async loadActive(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    this.currentFile = file ?? null;
    if (file) {
      const data = await readResume(this.app, file, this.plugin.settings.resumeDir);
      if (data) {
        this.model = data;
        this.renderForm();
        this.renderPreview();
        this.updateAts();
        return;
      }
    }
    this.renderForm();
    this.renderPreview();
    this.updateAts();
  }

  private switchTemplate(id: TemplateId): void {
    this.plugin.settings.template = id;
    void this.plugin.saveSettings();
    this.contentEl
      .querySelectorAll(".re-tpl-chip")
      .forEach((c) => c.removeClass("re-on"));
    const chips = this.contentEl.querySelectorAll(".re-tpl-chip");
    chips.forEach((c, i) => {
      const order: TemplateId[] = ["single", "twoCol", "academic"];
      if (order[i] === id) c.addClass("re-on");
    });
    this.renderPreview();
  }

  private renderForm(): void {
    const b = this.formBody;
    b.empty();

    // 基本信息
    const basic = b.createEl("details", { cls: "re-sect", attr: { open: "" } });
    basic.createEl("summary", { text: t("form.basic") });
    const basicBody = basic.createDiv({ cls: "re-sect-body" });
    this.basicField(basicBody, "field.name", "name", this.model.name);
    this.basicField(basicBody, "field.role", "role", this.model.role);
    this.rowField(basicBody, "field.phone", "phone", this.model.phone, "field.email", "email", this.model.email);

    // 教育 / 工作 / 项目
    this.sectionBlock(b, "education", t("form.education"), this.model.education, t("btn.addEducation"));
    this.sectionBlock(b, "work", t("form.work"), this.model.work, t("btn.addWork"));
    this.sectionBlock(b, "projects", t("form.project"), this.model.projects, t("btn.addProject"));

    // 技能
    const sk = b.createEl("details", { cls: "re-sect", attr: { open: "" } });
    sk.createEl("summary", { text: t("form.skills") });
    const skBody = sk.createDiv({ cls: "re-sect-body" });
    this.basicField(skBody, "field.skills", "skills", this.model.skills, true);
  }

  private basicField(
    parent: HTMLElement,
    labelKey: string,
    key: string,
    value: string,
    multiline = false
  ): void {
    const wrap = parent.createDiv({ cls: "re-field" });
    wrap.createEl("span", { text: t(labelKey) });
    if (multiline) {
      const ta = wrap.createEl("textarea", {
        cls: "re-textarea",
        attr: { "data-basic": key },
      });
      ta.value = value;
    } else {
      const inp = wrap.createEl("input", {
        cls: "re-input",
        attr: { "data-basic": key },
      });
      inp.value = value;
    }
  }

  private rowField(
    parent: HTMLElement,
    l1: string,
    k1: string,
    v1: string,
    l2: string,
    k2: string,
    v2: string
  ): void {
    const row = parent.createDiv({ cls: "re-row" });
    this.basicField(row, l1, k1, v1);
    this.basicField(row, l2, k2, v2);
  }

  private sectionBlock(
    parent: HTMLElement,
    section: string,
    title: string,
    entries: ResumeEntry[],
    addLabel: string
  ): void {
    const det = parent.createEl("details", { cls: "re-sect", attr: { open: "" } });
    det.createEl("summary", { text: title });
    const body = det.createDiv({ cls: "re-sect-body", attr: { "data-section-body": section } });
    entries.forEach((e) => this.buildEntry(body, section, e));
    const add = body.createEl("button", { cls: "re-btn", text: "+ " + addLabel });
    add.addEventListener("click", () => {
      this.buildEntry(body, section, { org: "", title: "", time: "", details: "" });
      // 把新增按钮移到末尾
      body.appendChild(add);
      this.syncFromForm();
    });
  }

  private buildEntry(parent: HTMLElement, section: string, e: ResumeEntry): void {
    const cfg = SECTION_LABELS[section];
    const entry = parent.createDiv({ cls: "re-entry", attr: { "data-section": section } });
    const rm = entry.createEl("button", { cls: "re-rm", text: "✕" });
    rm.addEventListener("click", () => {
      entry.remove();
      this.syncFromForm();
    });
    this.entryField(entry, cfg.org, "org", e.org);
    this.entryField(entry, cfg.title, "title", e.title);
    this.entryField(entry, cfg.time, "time", e.time);
    this.entryField(entry, cfg.details, "details", e.details, true);
  }

  private entryField(
    parent: HTMLElement,
    labelKey: string,
    key: string,
    value: string,
    multiline = false
  ): void {
    const wrap = parent.createDiv({ cls: "re-field" });
    wrap.createEl("span", { text: t(labelKey) });
    if (multiline) {
      const ta = wrap.createEl("textarea", {
        cls: "re-textarea",
        attr: { "data-key": key },
      });
      ta.value = value;
    } else {
      const inp = wrap.createEl("input", {
        cls: "re-input",
        attr: { "data-key": key },
      });
      inp.value = value;
    }
  }

  private syncFromForm(): void {
    const b = this.formBody;
    const get = (sel: string): string =>
      ((b.querySelector(sel) as HTMLInputElement | null)?.value ?? "");
    const data: ResumeData = {
      name: get('[data-basic="name"]'),
      role: get('[data-basic="role"]'),
      phone: get('[data-basic="phone"]'),
      email: get('[data-basic="email"]'),
      skills: get('[data-basic="skills"]'),
      education: this.readEntries("education"),
      work: this.readEntries("work"),
      projects: this.readEntries("projects"),
    };
    this.model = data;
    this.renderPreview();
    this.updateAts();
    this.scheduleSave();
  }

  private readEntries(section: string): ResumeEntry[] {
    const out: ResumeEntry[] = [];
    this.formBody
      .querySelectorAll(`.re-entry[data-section="${section}"]`)
      .forEach((node) => {
        const el = node as HTMLElement;
        const v = (s: string): string =>
          ((el.querySelector(`[data-key="${s}"]`) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "");
        out.push({ org: v("org"), title: v("title"), time: v("time"), details: v("details") });
      });
    return out;
  }

  private renderPreview(): void {
    renderResumeDom(this.previewPaper, this.model, this.plugin.settings.template);
  }

  private scheduleSave(): void {
    if (!this.plugin.settings.autoSave) return;
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.persist();
    }, 600);
  }

  private saveNow(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    void this.persist();
  }

  private isModelEmpty(): boolean {
    const m = this.model;
    return (
      !m.name &&
      !m.role &&
      !m.phone &&
      !m.email &&
      !m.skills &&
      m.education.length === 0 &&
      m.work.length === 0 &&
      m.projects.length === 0
    );
  }

  private async createResumeInDir(dir: string): Promise<TFile | null> {
    try {
      const normalizedDir = dir.trim().replace(/\/+$/, "");
      if (!this.app.vault.getAbstractFileByPath(normalizedDir)) {
        try {
          await this.app.vault.createFolder(normalizedDir);
        } catch {
          // 目录可能已存在，忽略
        }
      }
      const name = "简历-" + new Date().toISOString().slice(0, 10);
      const path = `${normalizedDir}/${name}.md`;
      const file = await this.app.vault.create(
        path,
        "---\nresume: true\n---\n\n"
      );
      // 先把当前表单数据写进去，再打开，避免打开后加载空数据
      await writeResume(this.app, file, this.model);
      await this.app.workspace.getLeaf(false).openFile(file);
      return file;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(t("error.export", { msg }));
      return null;
    }
  }

  private async persist(): Promise<void> {
    // 没有当前文件时，若设置了简历目录且内容非空，则在目录下新建文件
    if (!this.currentFile) {
      const dir = (this.plugin.settings.resumeDir ?? "").trim();
      if (!dir) {
        new Notice(t("notice.noActive"));
        return;
      }
      if (this.isModelEmpty()) {
        // 自动保存模式下空内容不创建文件，避免无输入时自动生成
        return;
      }
      const file = await this.createResumeInDir(dir);
      if (!file) return;
      this.currentFile = file;
      new Notice(t("notice.created", { name: file.basename }));
      return;
    }

    try {
      await writeResume(this.app, this.currentFile, this.model);
      new Notice(t("notice.saved", { name: this.currentFile.basename }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(t("error.export", { msg }));
    }
  }

  private updateAts(): void {
    const checks: { ok: boolean; text: string }[] = [];
    const m = this.model;
    checks.push({ ok: !!m.name, text: t("field.name") });
    checks.push({ ok: m.education.length > 0, text: t("form.education") });
    checks.push({ ok: m.work.length > 0, text: t("form.work") });
    const hasNumber = [...m.work, ...m.projects].some((e) =>
      /\d/.test(e.details)
    );
    checks.push({ ok: hasNumber, text: t("field.details") });
    const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
    const scoreEl = this.atsBox.querySelector(".re-ats-score");
    if (scoreEl) scoreEl.textContent = String(score);
    // 清理旧清单（保留 score 节点）
    this.atsBox.querySelectorAll(".re-check").forEach((n) => n.remove());
    for (const c of checks) {
      const row = this.atsBox.createDiv({ cls: "re-check " + (c.ok ? "re-ok" : "re-bad") });
      row.createDiv({ cls: "re-ic", text: c.ok ? "✓" : "!" });
      row.createDiv({ cls: "re-txt", text: c.text });
    }
  }

  private baseName(): string {
    if (this.currentFile) return this.currentFile.basename;
    return "resume";
  }

  doExport(kind: "pdf" | "html" | "docx" | "latex"): void {
    if (!this.currentFile) {
      new Notice(t("notice.noActive"));
      return;
    }
    const base = this.baseName();
    const data = this.model;
    const tpl = this.plugin.settings.template;
    const paper = this.plugin.settings.paperSize;
    switch (kind) {
      case "pdf":
        void exportPdf(this.app, data, tpl, base, paper);
        break;
      case "html":
        void exportHtml(this.app, data, tpl, base);
        break;
      case "docx":
        void exportDocx(this.app, data, base);
        break;
      case "latex":
        void exportLatex(this.app, data, base);
        break;
    }
  }
}
