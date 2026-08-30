// 双栏表单视图：左结构化表单、右实时预览（createEl 构造，禁用 innerHTML）

import {
  ItemView,
  WorkspaceLeaf,
  Notice,
  TFile,
  App,
  FuzzySuggestModal,
  setIcon,
  Platform,
} from "obsidian";
import type ResumeEditorPlugin from "../main";
import {
  ResumeData,
  ResumeEntry,
  ResumeCustomField,
  Certificate,
  ResumeLayout,
  SectionType,
  MenuSection,
  SECTION_TITLE_KEY,
  TemplateId,
  DEFAULT_RESUME,
  readResume,
  writeResume,
  isResumeExt,
  RESUME_EXT,
  AvatarRatio,
  AvatarRadius,
  AVATAR_RATIO_OPTIONS,
  AVATAR_RADIUS_OPTIONS,
  computeAvatarStyle,
  BasicFieldConfig,
  BASIC_FIELD_KEYS,
  formatEntryTime,
  GlobalSettings,
  THEME_COLORS,
  DEFAULT_GLOBAL_SETTINGS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  SECTION_SPACING_MIN,
  SECTION_SPACING_MAX,
  PAGE_PADDING_MIN,
  PAGE_PADDING_MAX,
} from "../data/resume-model";
import { renderResumeDom, resolveAvatarUrl } from "../render/template";
import { TEMPLATE_IDS } from "../render/templates/registry";
import { t } from "../i18n";
import {
  CUSTOM_FIELD_ICON_KEYS,
  DEFAULT_CUSTOM_FIELD_ICON,
  contactIconId,
  normalizeCustomFieldIcon,
} from "../ui/contact-icons";
import { exportPdf } from "../export/pdf";
import { exportHtml } from "../export/html";
import { exportDocx } from "../export/docx";
import { exportLatex } from "../export/latex";
import { PAPER_SIZE_PX } from "../utils/auto-one-page";

export const VIEW_TYPE_RESUME = "resume-editor-view";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);

class ImagePickerModal extends FuzzySuggestModal<TFile> {
  private onPick: (file: TFile) => void;

  constructor(app: App, onPick: (file: TFile) => void) {
    super(app);
    this.onPick = onPick;
    this.setPlaceholder(t("btn.chooseImage"));
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles().filter((file) =>
      IMAGE_EXTENSIONS.has(file.extension.toLowerCase())
    );
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onPick(file);
  }
}

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
  experience: {
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

const AVATAR_RATIO_LABEL_KEYS: Record<string, string> = {
  "1:1": "avatar.ratio.square",
  "4:5": "avatar.ratio.portrait45",
  "3:4": "avatar.ratio.portrait34",
};

const AVATAR_RADIUS_LABEL_KEYS: Record<string, string> = {
  none: "avatar.radius.none",
  sm: "avatar.radius.sm",
  md: "avatar.radius.md",
  lg: "avatar.radius.lg",
};

export class ResumeEditorView extends ItemView {
  plugin: ResumeEditorPlugin;
  private model: ResumeData = { ...DEFAULT_RESUME };
  private currentFile: TFile | null = null;
  private formBody!: HTMLElement;
  private sectionList!: HTMLElement;
  private previewPaper!: HTMLElement;
  private previewStatus!: HTMLElement;
  private saveTimer: number | null = null;
  private activeIconPicker: HTMLElement | null = null;
  private dragEl: HTMLElement | null = null;
  private basicFieldDragEl: HTMLElement | null = null;
  private entryDragEl: HTMLElement | null = null;
  private certDragEl: HTMLElement | null = null;

  // 移动端适配状态
  private isMobile = false;
  private activePane: "form" | "preview" = "form";
  private formPane!: HTMLElement;
  private previewPane!: HTMLElement;
  private paneToggleBtn: HTMLElement | null = null;
  private paneToggleIcon: HTMLElement | null = null;
  private paneToggleLabel: HTMLElement | null = null;
  // 移动端多行文本框放大编辑层（方案 A）
  private textareaZoomOverlay: HTMLElement | null = null;
  private textareaZoomKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private textareaZoomVVHandler: (() => void) | null = null;
  private textareaZoomOriginal: HTMLTextAreaElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ResumeEditorPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_RESUME;
  }

  getDisplayText(): string {
    return this.currentFile?.basename || t("view.title");
  }

  getIcon(): string {
    return "file-text";
  }

  getState(): Record<string, unknown> {
    return {
      file: this.currentFile?.path,
    };
  }

  async setState(state: Record<string, unknown>): Promise<void> {
    if (state.file && typeof state.file === "string") {
      const file = this.app.vault.getAbstractFileByPath(state.file);
      if (file instanceof TFile) {
        await this.loadFile(file);
        return;
      }
    }
    // 兜底：尝试从当前激活文件加载（兼容 Obsidian 不同调用路径）
    await this.loadActive();
  }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.createDiv({ cls: "review-editor-root" });
    const shell = root.querySelector(
      ".review-editor-root"
    ) as HTMLElement;

    // 移动端判定：手机 + 平板走单栏（默认编辑页 + 单按钮切换）
    this.isMobile = Platform.isMobile;
    if (this.isMobile) shell.addClass("re-mobile");

    // 顶栏
    const header = shell.createDiv({ cls: "re-header" });
    header.createEl("div", { cls: "re-title", text: t("view.title") });

    // 移动端：在顶栏最左注入「编辑/预览」单按钮切换（方案 A）
    if (this.isMobile) {
      this.paneToggleBtn = header.createEl("button", {
        cls: "re-pane-toggle",
        attr: { type: "button" },
      });
      this.paneToggleIcon = this.paneToggleBtn.createSpan({ cls: "re-pane-toggle-icon" });
      this.paneToggleLabel = this.paneToggleBtn.createSpan({ cls: "re-pane-toggle-label" });
      this.paneToggleBtn.addEventListener("click", () =>
        this.setActivePane(this.activePane === "form" ? "preview" : "form")
      );
      // 置于标题之前（移动端标题隐藏，按钮即最左）
      header.insertBefore(this.paneToggleBtn, header.firstChild);
    }

    // 模板下拉选择（放在 header 右侧，与导出按钮同行）
    const tplWrap = header.createDiv({ cls: "re-tpl-select-wrap" });
    tplWrap.createEl("span", { cls: "re-tpl-select-label", text: t("template.label") });
    const tplSelect = tplWrap.createEl("select", { cls: "re-select re-tpl-select", attr: { "data-tpl-select": "" } });
    for (const id of TEMPLATE_IDS) {
      tplSelect.createEl("option", { value: id, text: t("template." + id) });
    }
    tplSelect.addEventListener("change", () => this.switchTemplate(tplSelect.value as TemplateId));

    // 导出下拉菜单
    const exportWrap = header.createDiv({ cls: "re-export-wrap" });
    const exportBtn = exportWrap.createEl("button", {
      cls: "re-btn re-export-btn",
      attr: { type: "button", "aria-label": t("btn.export") },
    });
    exportBtn.createSpan({ text: t("btn.export") });
    setIcon(exportBtn, "re-download");
    exportBtn.addEventListener("click", () => this.openExportMenu(exportBtn, exportWrap));

    const btnSave = header.createEl("button", {
      cls: "re-btn",
      attr: { "aria-label": t("btn.save") },
    });
    const saveIcon = btnSave.createSpan({ cls: "re-btn-icon-mobile" });
    setIcon(saveIcon, "save");
    btnSave.createSpan({ cls: "re-btn-label", text: t("btn.save") });
    btnSave.addEventListener("click", () => this.saveNow());

    // 双栏
    const dual = shell.createDiv({ cls: "re-dual" });

    this.formPane = dual.createDiv({ cls: "re-pane" });
    this.formBody = this.formPane.createDiv({ cls: "re-pane-body" });
    this.formBody.addEventListener("input", () => this.syncFromForm());

    this.previewPane = dual.createDiv({ cls: "re-pane" });
    const scroll = this.previewPane.createDiv({ cls: "re-preview-scroll" });
    this.previewPaper = scroll.createDiv({ cls: "re-preview-holder" });
    this.previewStatus = scroll.createDiv({ cls: "re-preview-status" });

    // 监听活动文件变化
    this.registerEvent(
      this.app.workspace.on("file-open", () => void this.loadActive())
    );

    // 移动端：监听窗口/方向变化，切到预览时重算 A4 缩放
    if (this.isMobile) {
      this.registerDomEvent(window, "resize", () => {
        if (this.activePane === "preview") this.applyPreviewFit();
      });
    }

    // 默认进入编辑页（移动端单栏 + 切换由 CSS .re-active 控制显隐）
    this.activePane = "form";
    this.setActivePane("form");

    void this.loadActive();
  }

  async onClose(): Promise<void> {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.closeTextareaZoom();
  }

  private async loadFile(file: TFile): Promise<void> {
    this.currentFile = file;
    const data = await readResume(this.app, file);
    if (data) {
      this.model = data;
    } else {
      this.model = { ...DEFAULT_RESUME };
    }
    this.renderForm();
    this.renderPreview();
    // 刷新标签页标题，让 tab 显示文件名而非固定的"简历编辑器"
    (this.leaf as unknown as { setTitle(title: string): void }).setTitle(this.getDisplayText());
  }

  private async loadActive(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    // 优先加载 .resume 文件；其他文件类型不响应（避免点普通 md 把简历清空）
    if (file && isResumeExt(file)) {
      await this.loadFile(file);
    } else {
      // 无文件或非简历文件 → 用默认数据渲染空表单（保证界面不空白）
      this.currentFile = null;
      this.model = { ...DEFAULT_RESUME };
      this.renderForm();
      this.renderPreview();
    }
  }

  private switchTemplate(id: TemplateId): void {
    this.model.templateId = id;
    this.renderPreview();
    this.scheduleSave();
  }

  private renderForm(): void {
    const b = this.formBody;
    b.empty();

    // 同步 header 中模板选择器的选中值（select 在 onOpen 创建，此处只更新值）
    const headerSelect = this.contentEl.querySelector('[data-tpl-select]') as HTMLSelectElement | null;
    if (headerSelect && headerSelect.value !== this.model.templateId) {
      headerSelect.value = this.model.templateId;
    }

    // 兜底：旧文件可能没有 globalSettings
    if (!this.model.globalSettings) {
      this.model.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
    }

    // 全局样式面板（主题色 / 字号 / 行距 / 间距 / 页边距 / 自动一页纸）
    this.buildStylePanel(b);

    // 模块列表（按 sections 顺序渲染）
    this.sectionList = b.createDiv({ cls: "re-section-list" });
    this.renderModules();

    // 添加模块按钮（永远在最下方）
    const addWrap = b.createDiv({ cls: "re-add-module-wrap" });
    const addBtn = addWrap.createEl("button", {
      cls: "re-btn re-add-module",
      text: "+ " + t("btn.addModule"),
    });
    addBtn.addEventListener("click", () => this.openAddMenu(addWrap));
  }

  private sectionTitle(sec: MenuSection): string {
    if (sec.type === "custom") return sec.title || t("form.customModule");
    return t(SECTION_TITLE_KEY[sec.type as Exclude<SectionType, "custom">]);
  }

  /* ---------- 全局样式面板 ---------- */

  private buildStylePanel(parent: HTMLElement): void {
    const gs = this.model.globalSettings;

    const det = parent.createEl("details", { cls: "re-sect re-style-panel" });
    det.createEl("summary", { text: t("style.heading") });
    const body = det.createDiv({ cls: "re-sect-body" });

    // 主题色色板
    const colorRow = body.createDiv({ cls: "re-style-row" });
    colorRow.createEl("span", { cls: "re-style-label", text: t("style.themeColor") });
    const swatches = colorRow.createDiv({ cls: "re-swatch-grid" });
    for (const c of THEME_COLORS) {
      const sw = swatches.createEl("button", {
        cls: "re-swatch" + (c === gs.themeColor ? " re-on" : ""),
        attr: { type: "button", "aria-label": c, "data-color": c },
      });
      sw.style.setProperty("background-color", c);
      sw.addEventListener("click", () => {
        gs.themeColor = c;
        swatches.querySelectorAll(".re-swatch").forEach((n) => n.removeClass("re-on"));
        sw.addClass("re-on");
        this.renderPreview();
        this.scheduleSave();
      });
    }

    this.styleRange(body, "style.fontSize", gs.baseFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, 1,
      (v) => (gs.baseFontSize = v), (v) => `${v}px`);
    this.styleRange(body, "style.lineHeight", gs.lineHeight, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX, 0.05,
      (v) => (gs.lineHeight = Math.round(v * 100) / 100), (v) => v.toFixed(2));
    this.styleRange(body, "style.sectionSpacing", gs.sectionSpacing, SECTION_SPACING_MIN, SECTION_SPACING_MAX, 1,
      (v) => (gs.sectionSpacing = v), (v) => `${v}px`);
    this.styleRange(body, "style.pagePadding", gs.pagePadding, PAGE_PADDING_MIN, PAGE_PADDING_MAX, 1,
      (v) => (gs.pagePadding = v), (v) => `${v}px`);

    // 多页显示开关
    const toggleRow = body.createDiv({ cls: "re-style-row" });
    const labelWrap = toggleRow.createDiv({ cls: "re-style-toggle-label" });
    labelWrap.createEl("span", { cls: "re-style-label", text: t("style.showPageLines") });
    labelWrap.createSpan({ cls: "re-style-hint", text: t("style.showPageLines.desc") });
    const toggleBtn = toggleRow.createEl("button", {
      cls: "re-icon-btn re-style-toggle-btn" + (gs.showPageLines ? " re-on" : ""),
      attr: { type: "button", "aria-label": t("style.showPageLines") },
    });
    setIcon(toggleBtn, gs.showPageLines ? "re-eye" : "re-eye-off");
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      gs.showPageLines = !gs.showPageLines;
      toggleBtn.toggleClass("re-on", gs.showPageLines);
      setIcon(toggleBtn, gs.showPageLines ? "re-eye" : "re-eye-off");
      this.renderPreview();
      this.scheduleSave();
    });
  }

  /** 全局样式滑块行：label + range + 当前值 */
  private styleRange(
    parent: HTMLElement,
    labelKey: string,
    current: number,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void,
    format: (v: number) => string
  ): void {
    const row = parent.createDiv({ cls: "re-style-row" });
    row.createEl("span", { cls: "re-style-label", text: t(labelKey) });
    const input = row.createEl("input", {
      cls: "re-range re-style-range",
      attr: { type: "range", min: String(min), max: String(max), step: String(step) },
    });
    input.value = String(current);
    const val = row.createSpan({ cls: "re-style-val", text: format(current) });
    const apply = () => {
      const v = Number(input.value);
      onChange(v);
      val.setText(format(v));
      this.renderPreview();
      this.scheduleSave();
    };
    input.addEventListener("input", apply);
    input.addEventListener("change", apply);
  }

  private renderModules(): void {
    if (!this.sectionList) return;
    this.sectionList.empty();
    for (const sec of this.model.menuSections) {
      this.sectionList.appendChild(this.buildModule(sec));
    }
    this.bindDnd();
  }

  private buildModule(sec: MenuSection): HTMLElement {
    const mod = document.createElement("div");
    mod.className = "re-module" + (sec.collapsed ? " re-collapsed" : "");
    mod.setAttribute("data-id", sec.id);
    mod.setAttribute("data-type", sec.type);

    const bar = mod.createEl("div", { cls: "re-module-bar" });

    const handle = bar.createEl("span", {
      cls: "re-drag-handle",
      attr: { title: t("module.drag") },
    });
    setIcon(handle, "re-grip-vertical");

    const titleWrap = bar.createEl("div", { cls: "re-module-title" });
    let titleInput: HTMLInputElement | null = null;
    if (sec.type === "custom") {
      titleInput = titleWrap.createEl("input", {
        cls: "re-module-title-input",
        attr: { placeholder: t("form.customModule") },
      });
      titleInput.value = sec.title;
      titleInput.addEventListener("input", () => {
        sec.title = titleInput!.value;
        this.syncFromForm();
      });
    } else {
      titleWrap.createSpan({ text: this.sectionTitle(sec) });
    }

    const actions = bar.createEl("div", { cls: "re-module-actions" });
    // 移动端 ↑↓ 排序（隐藏拖拽手柄，改用按钮更可靠）
    const modIdx = this.model.menuSections.indexOf(sec);
    this.buildMoveButtons(actions, modIdx, this.model.menuSections.length, (dir) => {
      this.moveItemInArray(this.model.menuSections, modIdx, dir);
      this.renderModules();
      this.renderPreview();
      this.scheduleSave();
    });
    const hideBtn = actions.createEl("button", {
      cls: "re-icon-btn",
      attr: { title: sec.visible ? t("module.hide") : t("module.show") },
    });
    setIcon(hideBtn, sec.visible ? "re-eye" : "re-eye-off");
    hideBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      sec.visible = !sec.visible;
      hideBtn.setAttribute("title", sec.visible ? t("module.hide") : t("module.show"));
      setIcon(hideBtn, sec.visible ? "re-eye" : "re-eye-off");
      this.renderPreview();
      this.scheduleSave();
    });

    const delBtn = actions.createEl("button", {
      cls: "re-icon-btn",
      attr: { title: t("module.delete") },
    });
    setIcon(delBtn, "re-trash");
    if (sec.type === "basic") {
      delBtn.setAttribute("disabled", "true");
      delBtn.addClass("re-disabled");
      delBtn.setAttribute("title", t("module.basicNoDelete"));
    } else {
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.model.menuSections = this.model.menuSections.filter((s) => s.id !== sec.id);
        this.renderModules();
        this.renderPreview();
        this.scheduleSave();
      });
    }

    // 标题栏空白处点击：折叠/展开当前模块；展开时自动折叠其他模块（手风琴）
    bar.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(".re-module-actions") ||
        target.closest(".re-drag-handle") ||
        target === titleInput
      ) {
        return;
      }
      sec.collapsed = !sec.collapsed;
      if (!sec.collapsed) {
        // 手风琴效果：仅保留当前模块展开
        for (const s of this.model.menuSections) {
          if (s.id !== sec.id) s.collapsed = true;
        }
        this.renderModules();
      } else {
        mod.classList.toggle("re-collapsed", sec.collapsed);
      }
      this.scheduleSave();
    });

    const body = mod.createEl("div", { cls: "re-module-body" });
    this.buildModuleContent(sec, body);

    return mod;
  }

  private buildModuleContent(sec: MenuSection, parent: HTMLElement): void {
    switch (sec.type) {
      case "basic":
        this.buildBasicContent(parent);
        break;
      case "education":
        this.sectionBlock(parent, "education", this.model.education, t("btn.addEducation"));
        break;
      case "experience":
        this.sectionBlock(parent, "experience", this.model.experience, t("btn.addWork"));
        break;
      case "projects":
        this.sectionBlock(parent, "projects", this.model.projects, t("btn.addProject"));
        break;
      case "skills":
        this.basicField(parent, "field.skills", "skillContent", this.model.skillContent, true);
        break;
      case "selfEvaluation":
        this.basicField(parent, "field.selfEvaluation", "selfEvaluationContent", this.model.selfEvaluationContent, true);
        break;
      case "certificates":
        this.certificatesBlock(parent);
        break;
      case "custom":
        const ta = parent.createEl("textarea", {
          cls: "re-textarea",
          attr: { "data-custom-content": "", placeholder: t("field.details") },
        });
        ta.value = sec.content;
        ta.addEventListener("input", () => {
          sec.content = ta.value;
          this.syncFromForm();
        });
        this.attachTextareaZoom(ta, sec.title || t("field.details"));
        break;
    }
  }

  private buildBasicContent(parent: HTMLElement): void {
    const layoutWrap = parent.createDiv({ cls: "re-field" });
    layoutWrap.createEl("span", { text: t("field.layout") });
    const layoutRow = layoutWrap.createDiv({ cls: "re-layout-row" });
    (["left", "top", "right"] as ResumeLayout[]).forEach((id) => {
      const btn = layoutRow.createEl("button", {
        cls: "re-layout-btn" + (this.model.layout === id ? " re-on" : ""),
        attr: { "data-layout": id, title: t("layout." + id) },
      });
      btn.createSpan({ cls: "re-layout-icon re-layout-" + id });
      btn.addEventListener("click", () => {
        this.model.layout = id;
        parent.querySelectorAll(".re-layout-btn").forEach((n) => n.removeClass("re-on"));
        btn.addClass("re-on");
        this.renderPreview();
        this.scheduleSave();
      });
    });

    this.avatarField(parent);
    this.basicField(parent, "field.name", "name", this.model.name);
    this.basicField(parent, "field.role", "role", this.model.role);

    const fieldsList = parent.createDiv({ cls: "re-basic-fields" });
    for (const f of this.model.basicFields) {
      fieldsList.appendChild(this.buildBasicFieldRow(f));
    }
    this.bindBasicFieldDnd(fieldsList);

    const addWrap = parent.createDiv({ cls: "re-add-basic-field-wrap" });
    const addBtn = addWrap.createEl("button", {
      cls: "re-btn re-btn-block",
      text: "+ " + t("btn.addBasicField"),
    });
    addBtn.addEventListener("click", () => this.openAddBasicFieldMenu(addBtn, addWrap));

    this.customFieldsBlock(parent);
  }

  private basicFieldIconKey(key: string): string {
    const map: Record<string, string> = {
      phone: "phone",
      email: "mail",
      employmentStatus: "employmentStatus",
      location: "location",
      birthDate: "birthDate",
    };
    return map[key] ?? key;
  }

  private buildBasicFieldRow(f: BasicFieldConfig): HTMLElement {
    const row = document.createElement("div");
    row.className = "re-basic-field-row" + (f.visible ? "" : " re-hidden");
    row.setAttribute("data-basic-field", f.key);

    const handle = row.createEl("span", {
      cls: "re-basic-field-drag",
      attr: { title: t("module.drag") },
    });
    setIcon(handle, "re-grip-vertical");

    const iconWrap = row.createEl("span", { cls: "re-basic-field-icon" });
    setIcon(iconWrap, contactIconId(this.basicFieldIconKey(f.key)));

    row.createEl("span", { cls: "re-basic-field-label", text: t("field." + f.key) });

    const inputWrap = row.createDiv({ cls: "re-basic-field-input-wrap" });
    const inp = inputWrap.createEl("input", {
      cls: "re-input",
      attr: { "data-basic": f.key, placeholder: t("field." + f.key) },
    });
    const value = this.model[f.key as keyof ResumeData];
    inp.value = typeof value === "string" ? value : "";
    inp.addEventListener("input", () => {
      (this.model as unknown as Record<string, string>)[f.key] = inp.value;
      this.renderPreview();
      this.scheduleSave();
    });

    const actions = row.createDiv({ cls: "re-basic-field-actions" });

    // 移动端 ↑↓ 排序（隐藏拖拽手柄，改用按钮更可靠）
    const bfIdx = this.model.basicFields.indexOf(f);
    this.buildMoveButtons(actions, bfIdx, this.model.basicFields.length, (dir) => {
      this.moveItemInArray(this.model.basicFields, bfIdx, dir);
      this.renderPreview();
      this.scheduleSave();
    });

    const hideBtn = actions.createEl("button", {
      cls: "re-icon-btn",
      attr: { title: f.visible ? t("module.hide") : t("module.show"), type: "button" },
    });
    setIcon(hideBtn, f.visible ? "re-eye" : "re-eye-off");
    hideBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      f.visible = !f.visible;
      row.classList.toggle("re-hidden", !f.visible);
      hideBtn.setAttribute("title", f.visible ? t("module.hide") : t("module.show"));
      setIcon(hideBtn, f.visible ? "re-eye" : "re-eye-off");
      this.renderPreview();
      this.scheduleSave();
    });

    const delBtn = actions.createEl("button", {
      cls: "re-icon-btn",
      attr: { title: t("module.delete"), type: "button" },
    });
    setIcon(delBtn, "re-trash");
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.model.basicFields = this.model.basicFields.filter((bf) => bf.key !== f.key);
      row.remove();
      this.renderPreview();
      this.scheduleSave();
    });

    return row;
  }

  private bindBasicFieldDnd(list: HTMLElement): void {
    list.querySelectorAll(".re-basic-field-row").forEach((row) => {
      const handle = row.querySelector(".re-basic-field-drag") as HTMLElement | null;
      if (!handle) return;
      handle.addEventListener("pointerdown", (e: PointerEvent) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        e.preventDefault();
        this.startBasicFieldDrag(row as HTMLElement, list);
      });
    });
  }

  private startBasicFieldDrag(row: HTMLElement, list: HTMLElement): void {
    this.basicFieldDragEl = row;
    row.addClass("re-dragging");

    const onMove = (ev: PointerEvent) => {
      if (!this.basicFieldDragEl || !list) return;
      const after = this.getBasicFieldDragAfter(list, ev.clientY);
      if (after == null) {
        if (list.lastElementChild !== this.basicFieldDragEl) list.appendChild(this.basicFieldDragEl);
      } else if (after !== this.basicFieldDragEl) {
        list.insertBefore(this.basicFieldDragEl, after);
      }
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      if (!this.basicFieldDragEl || !list) return;
      const keys = Array.from(list.querySelectorAll(".re-basic-field-row")).map(
        (r) => (r as HTMLElement).getAttribute("data-basic-field") as string
      );
      this.model.basicFields.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
      this.basicFieldDragEl.removeClass("re-dragging");
      this.basicFieldDragEl = null;
      this.renderPreview();
      this.scheduleSave();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  private getBasicFieldDragAfter(list: HTMLElement, y: number): HTMLElement | null {
    const rows = Array.from(
      list.querySelectorAll(".re-basic-field-row:not(.re-dragging)")
    ) as HTMLElement[];
    let closest: HTMLElement | null = null;
    let closestOffset = -Infinity;
    for (const row of rows) {
      const box = row.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closest = row;
      }
    }
    return closest;
  }

  private openAddBasicFieldMenu(anchor: HTMLElement, wrap: HTMLElement): void {
    const existing = wrap.querySelector(".re-add-menu");
    if (existing) {
      existing.remove();
      return;
    }

    const menu = wrap.createEl("div", { cls: "re-add-menu" });
    const present = new Set(this.model.basicFields.map((f) => f.key));
    const candidates = BASIC_FIELD_KEYS.filter((key) => !present.has(key));
    if (candidates.length === 0) {
      menu.createEl("div", { cls: "re-add-empty", text: t("basicField.allAdded") });
    } else {
      for (const key of candidates) {
        const item = menu.createEl("div", { cls: "re-add-item", text: t("field." + key) });
        item.addEventListener("click", () => {
          this.model.basicFields.push({ key, visible: true });
          const list = this.formBody.querySelector(".re-basic-fields") as HTMLElement | null;
          if (list) {
            list.appendChild(this.buildBasicFieldRow({ key, visible: true }));
            this.bindBasicFieldDnd(list);
          }
          this.renderPreview();
          this.scheduleSave();
          menu.remove();
        });
      }
    }

    const close = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (!menu.contains(target) && !(target as HTMLElement).closest(".re-add-basic-field-wrap")) {
        menu.remove();
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  private openAddMenu(wrap: HTMLElement): void {
    const existing = wrap.querySelector(".re-add-menu");
    if (existing) {
      existing.remove();
      return;
    }

    const menu = wrap.createEl("div", { cls: "re-add-menu" });
    const present = new Set(this.model.menuSections.map((s) => s.type));
    const candidates: { type: SectionType; label: string }[] = [
      { type: "education", label: t("form.education") },
      { type: "experience", label: t("form.work") },
      { type: "projects", label: t("form.project") },
      { type: "skills", label: t("form.skills") },
      { type: "selfEvaluation", label: t("form.selfEvaluation") },
      { type: "certificates", label: t("form.certificates") },
      { type: "custom", label: t("form.customModule") },
    ];
    let added = false;
    for (const c of candidates) {
      if (c.type !== "custom" && present.has(c.type)) continue;
      added = true;
      const item = menu.createEl("div", { cls: "re-add-item", text: c.label });
      item.addEventListener("click", () => {
        const id = c.type === "custom" ? "custom-" + Date.now().toString(36) : c.type;
        this.model.menuSections.push({ id, type: c.type, visible: true, collapsed: false, title: "", content: "" });
        this.renderModules();
        this.renderPreview();
        this.scheduleSave();
        menu.remove();
      });
    }
    if (!added) {
      menu.createEl("div", { cls: "re-add-empty", text: t("module.allAdded") });
    }

    const close = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (!menu.contains(target) && !(target as HTMLElement).closest(".re-add-module")) {
        menu.remove();
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  private openExportMenu(anchor: HTMLElement, wrap: HTMLElement): void {
    const existing = wrap.querySelector(".re-export-menu");
    if (existing) {
      existing.remove();
      return;
    }

    const menu = wrap.createEl("div", { cls: "re-export-menu" });
    const items: { kind: "pdf" | "html" | "docx" | "latex"; label: string }[] = [
      { kind: "pdf", label: t("export.pdf") },
      { kind: "html", label: t("export.html") },
      { kind: "docx", label: t("export.docx") },
      { kind: "latex", label: t("export.latex") },
    ];
    for (const item of items) {
      const row = menu.createEl("div", { cls: "re-export-item", text: item.label });
      row.addEventListener("click", () => {
        this.doExport(item.kind);
        menu.remove();
      });
    }

    const close = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (!menu.contains(target) && !(target as HTMLElement).closest(".re-export-btn")) {
        menu.remove();
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  private bindDnd(): void {
    const list = this.sectionList;
    if (!list) return;
    // 每次 renderModules 重建后重新绑定到新节点。
    // 使用 Pointer Events 而非原生 HTML5 拖放：Obsidian 的 Electron 环境会拦截
    // dragstart/dragover/drop，导致「拖不动」；Pointer 事件不受其影响，且统一鼠标/触屏。
    list.querySelectorAll(".re-module").forEach((mod) => {
      const handle = mod.querySelector(".re-drag-handle") as HTMLElement | null;
      if (!handle) return;
      handle.addEventListener("pointerdown", (e: PointerEvent) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        e.preventDefault();
        this.startModuleDrag(mod as HTMLElement);
      });
    });
  }

  private startModuleDrag(mod: HTMLElement): void {
    const list = this.sectionList;
    if (!list) return;
    this.dragEl = mod;
    mod.addClass("re-dragging");

    const onMove = (ev: PointerEvent) => {
      if (!this.dragEl || !list) return;
      const after = this.getDragAfterElement(list, ev.clientY);
      if (after == null) {
        if (list.lastElementChild !== this.dragEl) list.appendChild(this.dragEl);
      } else if (after !== this.dragEl) {
        list.insertBefore(this.dragEl, after);
      }
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      if (!this.dragEl) return;
      const ids = Array.from(list.querySelectorAll(".re-module")).map(
        (m) => (m as HTMLElement).getAttribute("data-id") as string
      );
      this.model.menuSections.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      this.dragEl.removeClass("re-dragging");
      this.dragEl = null;
      this.renderPreview();
      this.scheduleSave();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  private getDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
    const els = Array.from(
      container.querySelectorAll(".re-module:not(.re-dragging)")
    ) as HTMLElement[];
    let closest: HTMLElement | null = null;
    let closestOffset = -Infinity;
    for (const el of els) {
      const box = el.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closest = el;
      }
    }
    return closest;
  }

  private bindEntryDnd(section: string): void {
    const list = this.formBody.querySelector(
      `.re-entry-list[data-section-list="${section}"]`
    ) as HTMLElement | null;
    if (!list) return;
    list.querySelectorAll(".re-entry-card").forEach((card) => {
      const handle = card.querySelector(".re-entry-drag") as HTMLElement | null;
      if (!handle) return;
      // 避免重复绑定：标记后跳过
      if ((handle as unknown as Record<string, boolean>)["__re-entry-dnd-bound"]) return;
      (handle as unknown as Record<string, boolean>)["__re-entry-dnd-bound"] = true;
      handle.addEventListener("pointerdown", (e: PointerEvent) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        e.preventDefault();
        this.startEntryDrag(card as HTMLElement, section);
      });
    });
  }

  private startEntryDrag(card: HTMLElement, section: string): void {
    const list = this.formBody.querySelector(
      `.re-entry-list[data-section-list="${section}"]`
    ) as HTMLElement | null;
    if (!list) return;
    this.entryDragEl = card;
    card.addClass("re-dragging");

    const onMove = (ev: PointerEvent) => {
      if (!this.entryDragEl || !list) return;
      const after = this.getEntryDragAfterElement(list, ev.clientY);
      if (after == null) {
        if (list.lastElementChild !== this.entryDragEl) list.appendChild(this.entryDragEl);
      } else if (after !== this.entryDragEl) {
        list.insertBefore(this.entryDragEl, after);
      }
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      if (!this.entryDragEl || !list) return;

      const sectionKey = section as keyof ResumeData;
      const entries = this.model[sectionKey] as ResumeEntry[];
      const cards = Array.from(list.querySelectorAll(".re-entry-card")) as HTMLElement[];
      const newOrder: ResumeEntry[] = [];
      const used = new Set<number>();
      for (const c of cards) {
        const idx = Number(c.getAttribute("data-index"));
        if (!Number.isNaN(idx) && idx >= 0 && idx < entries.length && !used.has(idx)) {
          newOrder.push(entries[idx]);
          used.add(idx);
        }
      }
      // 兜底：若渲染过程中有极短暂的悬空，保留未匹配项
      for (let i = 0; i < entries.length; i++) {
        if (!used.has(i)) newOrder.push(entries[i]);
      }
      (this.model[sectionKey] as ResumeEntry[]) = newOrder;

      this.entryDragEl.removeClass("re-dragging");
      this.entryDragEl = null;
      this.renderModules();
      this.renderPreview();
      this.scheduleSave();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  private getEntryDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
    const els = Array.from(
      container.querySelectorAll(".re-entry-card:not(.re-dragging)")
    ) as HTMLElement[];
    let closest: HTMLElement | null = null;
    let closestOffset = -Infinity;
    for (const el of els) {
      const box = el.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closest = el;
      }
    }
    return closest;
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
      ta.addEventListener("input", () => {
        (this.model as unknown as Record<string, string>)[key] = ta.value;
        this.renderPreview();
        this.scheduleSave();
      });
      this.attachTextareaZoom(ta, t(labelKey));
    } else {
      const inp = wrap.createEl("input", {
        cls: "re-input",
        attr: { "data-basic": key },
      });
      inp.value = value;
      inp.addEventListener("input", () => {
        (this.model as unknown as Record<string, string>)[key] = inp.value;
        this.renderPreview();
        this.scheduleSave();
      });
    }
  }

  private certificatesBlock(parent: HTMLElement): void {
    if (!this.model.certificates) this.model.certificates = [];

    const listEl = parent.createDiv({
      cls: "re-entry-list",
      attr: { "data-section-list": "certificates" },
    });
    if (this.model.certificates.length === 0) {
      listEl.createDiv({ cls: "re-cert-empty", text: t("field.certificates.empty") });
    } else {
      for (const cert of this.model.certificates) {
        this.buildCertificateRow(cert, listEl);
      }
    }

    parent.createEl("div", {
      cls: "re-cert-hint",
      text: t("field.certificates.hint"),
    });

    const addBtn = parent.createEl("button", {
      cls: "re-btn re-btn-block",
      text: "+ " + t("btn.addCertificate"),
    });
    addBtn.addEventListener("click", () => {
      const cert: Certificate = {
        id: "cert-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        url: "",
        width: 50,
        visible: true,
      };
      this.model.certificates.push(cert);
      listEl.querySelector(".re-cert-empty")?.remove();
      this.buildCertificateRow(cert, listEl);
      this.renderPreview();
      this.scheduleSave();
    });
  }

  private buildCertificateRow(cert: Certificate, listEl: HTMLElement): void {
    const card = listEl.createDiv({
      cls: "re-entry-card" + (cert.visible === false ? " re-hidden" : ""),
      attr: { "data-cert-id": cert.id },
    });

    const handle = card.createEl("span", {
      cls: "re-entry-drag",
      attr: { title: t("module.drag") },
    });
    setIcon(handle, "re-grip-vertical");

    // 缩略图预览
    const thumb = card.createEl("div", { cls: "re-cert-thumb" });
    const img = thumb.createEl("img", { cls: "re-cert-thumb-img", attr: { alt: "" } });
    const applyImg = (url: string) => {
      if (url && url.trim()) {
        img.setAttribute("src", url);
        img.style.visibility = "visible";
      } else {
        img.removeAttribute("src");
        img.style.visibility = "hidden";
      }
    };
    applyImg(cert.url);
    img.addEventListener("error", () => {
      img.style.visibility = "hidden";
    });
    img.addEventListener("load", () => {
      img.style.visibility = "visible";
    });

    const body = card.createEl("div", { cls: "re-cert-body" });

    const urlRow = body.createDiv({ cls: "re-cert-url-row" });
    const urlInput = urlRow.createEl("input", {
      cls: "re-input",
      attr: { "data-cert": "url", placeholder: t("field.certificates.placeholder") },
    });
    urlInput.value = cert.url;
    urlInput.addEventListener("input", () => {
      cert.url = urlInput.value;
      applyImg(cert.url);
      this.syncFromForm();
    });

    const widthRow = body.createDiv({ cls: "re-cert-width-row" });
    widthRow.createEl("span", { cls: "re-cert-width-label", text: t("field.certificates.width") });
    const slider = widthRow.createEl("input", {
      cls: "re-range",
      attr: { type: "range", min: "10", max: "100", step: "1", "data-cert": "width" },
    });
    slider.value = String(cert.width);
    const widthVal = widthRow.createSpan({ cls: "re-cert-width-val", text: cert.width + "%" });
    slider.addEventListener("input", () => {
      const w = Number(slider.value);
      cert.width = w;
      widthVal.setText(w + "%");
      this.syncFromForm();
    });

    const actions = card.createEl("div", { cls: "re-entry-actions" });

    // 移动端 ↑↓ 排序（隐藏拖拽手柄，改用按钮更可靠）
    const certIdx = this.model.certificates.indexOf(cert);
    this.buildMoveButtons(actions, certIdx, this.model.certificates.length, (dir) => {
      this.moveItemInArray(this.model.certificates, certIdx, dir);
      this.renderPreview();
      this.scheduleSave();
    });

    const hideBtn = actions.createEl("button", {
      cls: "re-icon-btn",
      attr: { title: cert.visible === false ? t("module.show") : t("module.hide"), type: "button" },
    });
    setIcon(hideBtn, cert.visible === false ? "re-eye-off" : "re-eye");
    hideBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cert.visible = cert.visible === false ? true : false;
      card.classList.toggle("re-hidden", cert.visible === false);
      hideBtn.setAttribute("title", cert.visible === false ? t("module.show") : t("module.hide"));
      setIcon(hideBtn, cert.visible === false ? "re-eye-off" : "re-eye");
      this.renderPreview();
      this.scheduleSave();
    });
    const delBtn = actions.createEl("button", {
      cls: "re-icon-btn",
      attr: { title: t("module.delete"), type: "button" },
    });
    setIcon(delBtn, "re-trash");
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.model.certificates = this.model.certificates.filter((c) => c.id !== cert.id);
      card.remove();
      if (this.model.certificates.length === 0) {
        listEl.createDiv({ cls: "re-cert-empty", text: t("field.certificates.empty") });
      }
      this.renderPreview();
      this.scheduleSave();
    });

    this.bindCertDnd(card, listEl);
  }

  private bindCertDnd(card: HTMLElement, listEl: HTMLElement): void {
    const handle = card.querySelector(".re-entry-drag") as HTMLElement | null;
    if (!handle) return;
    if ((handle as unknown as Record<string, boolean>)["__re-cert-dnd-bound"]) return;
    (handle as unknown as Record<string, boolean>)["__re-cert-dnd-bound"] = true;
    handle.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      this.startCertDrag(card, listEl);
    });
  }

  private startCertDrag(card: HTMLElement, listEl: HTMLElement): void {
    this.certDragEl = card;
    card.addClass("re-dragging");

    const onMove = (ev: PointerEvent) => {
      if (!this.certDragEl) return;
      const after = this.getEntryDragAfterElement(listEl, ev.clientY);
      if (after == null) {
        if (listEl.lastElementChild !== this.certDragEl) listEl.appendChild(this.certDragEl);
      } else if (after !== this.certDragEl) {
        listEl.insertBefore(this.certDragEl, after);
      }
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      if (!this.certDragEl) return;
      const cards = Array.from(listEl.querySelectorAll(".re-entry-card")) as HTMLElement[];
      const order: Certificate[] = [];
      const used = new Set<string>();
      const all = this.model.certificates || [];
      for (const c of cards) {
        const id = c.getAttribute("data-cert-id");
        const found = all.find((x) => x.id === id);
        if (found && !used.has(found.id)) {
          order.push(found);
          used.add(found.id);
        }
      }
      for (const c of all) if (!used.has(c.id)) order.push(c);
      this.model.certificates = order;
      this.certDragEl.removeClass("re-dragging");
      this.certDragEl = null;
      this.renderPreview();
      this.scheduleSave();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  private avatarField(parent: HTMLElement): void {
    const wrap = parent.createDiv({ cls: "re-field re-avatar-field" });
    wrap.createEl("span", { text: t("field.avatar") });

    const card = wrap.createDiv({ cls: "re-avatar-card" });

    // 头像预览（点击即选图，合并「选择图片」按钮）
    const preview = card.createDiv({ cls: "re-avatar-preview" });
    preview.setAttribute("role", "button");
    preview.setAttribute("tabindex", "0");
    preview.setAttribute("title", t("btn.chooseImage"));
    preview.setAttribute("aria-label", t("btn.chooseImage"));
    const previewImg = preview.createEl("img", { cls: "re-avatar-preview-img", attr: { alt: "" } });
    preview.createDiv({ cls: "re-avatar-preview-hint", text: t("avatar.clickToSelect") });

    const openPicker = () => {
      new ImagePickerModal(this.app, (file) => {
        this.model.avatar = file.path;
        pathInput.value = file.path;
        this.updateAvatarPreview(preview, previewImg, this.model.avatar);
        this.renderPreview();
        this.scheduleSave();
        new Notice(t("notice.imageSelected", { name: file.name }));
      }).open();
    };
    preview.addEventListener("click", openPicker);
    preview.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPicker();
      }
    });
    this.updateAvatarPreview(preview, previewImg, this.model.avatar);

    // 控件区
    const controls = card.createDiv({ cls: "re-avatar-controls" });

    // 头像路径输入
    const pathRow = controls.createDiv({ cls: "re-avatar-path-row" });
    const pathInput = pathRow.createEl("input", {
      cls: "re-input re-avatar-input",
      attr: { "data-basic": "avatar", placeholder: "vault/path/photo.png 或 https://..." },
    });
    pathInput.value = this.model.avatar;
    const onChangePath = () => {
      this.model.avatar = pathInput.value;
      this.updateAvatarPreview(preview, previewImg, pathInput.value);
      this.renderPreview();
      this.scheduleSave();
    };
    pathInput.addEventListener("input", onChangePath);
    pathInput.addEventListener("change", onChangePath);

    // 尺寸滑块
    const sizeRow = this.avatarControlRow(controls, "field.avatarSize");
    const sizeInput = sizeRow.createEl("input", {
      cls: "re-range",
      attr: {
        type: "range",
        min: "40",
        max: "240",
        step: "2",
        "data-avatar": "size",
        value: String(this.model.avatarSize),
      },
    });
    const sizeVal = sizeRow.createSpan({ cls: "re-avatar-val", text: this.model.avatarSize + "px" });
    const applySize = () => {
      const v = Number(sizeInput.value);
      this.model.avatarSize = v;
      sizeVal.setText(v + "px");
      this.renderPreview();
      this.scheduleSave();
    };
    sizeInput.addEventListener("input", applySize);
    sizeInput.addEventListener("change", applySize);

    // 宽高比
    const ratioSel = this.avatarSelectRow(
      controls,
      "field.avatarAspectRatio",
      AVATAR_RATIO_OPTIONS as string[],
      this.model.avatarAspectRatio,
      AVATAR_RATIO_LABEL_KEYS,
      "ratio"
    );
    ratioSel.addEventListener("change", () => {
      this.model.avatarAspectRatio = ratioSel.value as AvatarRatio;
      this.updateAvatarEditorPreview(preview, this.model);
      this.renderPreview();
      this.scheduleSave();
    });

    // 圆角
    const radiusSel = this.avatarSelectRow(
      controls,
      "field.avatarRadius",
      AVATAR_RADIUS_OPTIONS as string[],
      this.model.avatarRadius,
      AVATAR_RADIUS_LABEL_KEYS,
      "radius"
    );
    radiusSel.addEventListener("change", () => {
      this.model.avatarRadius = radiusSel.value as AvatarRadius;
      this.updateAvatarEditorPreview(preview, this.model);
      this.renderPreview();
      this.scheduleSave();
    });

    // 初始化左侧头像预览（尺寸固定为 90px 宽度，仅随宽高比/圆角变化）
    this.updateAvatarEditorPreview(preview, this.model);
  }

  private avatarControlRow(parent: HTMLElement, labelKey: string): HTMLElement {
    const row = parent.createDiv({ cls: "re-avatar-ctl" });
    row.createEl("span", { cls: "re-avatar-ctl-label", text: t(labelKey) });
    return row;
  }

  private avatarSelectRow(
    parent: HTMLElement,
    labelKey: string,
    options: string[],
    current: string,
    labelKeys: Record<string, string>,
    dataKey: string
  ): HTMLSelectElement {
    const row = parent.createDiv({ cls: "re-avatar-ctl" });
    row.createEl("span", { cls: "re-avatar-ctl-label", text: t(labelKey) });
    const sel = row.createEl("select", {
      cls: "re-select re-avatar-select",
      attr: { "data-avatar": dataKey },
    });
    for (const opt of options) {
      const o = sel.createEl("option", { value: opt, text: t(labelKeys[opt] ?? opt) });
      if (opt === current) o.selected = true;
    }
    return sel;
  }

  private updateAvatarPreview(
    preview: HTMLElement,
    img: HTMLImageElement,
    avatarPath: string
  ): void {
    const url = resolveAvatarUrl(this.app, avatarPath);
    if (url) {
      img.src = url;
      preview.removeClass("re-avatar-empty");
    } else {
      img.removeAttribute("src");
      preview.addClass("re-avatar-empty");
    }
  }

  private updateAvatarEditorPreview(preview: HTMLElement, model: ResumeData): void {
    // 左侧编辑器预览保持固定宽度 90px，仅响应宽高比与圆角变化；
    // 尺寸滑块只影响右侧简历预览中的头像。
    const s = computeAvatarStyle({ ...model, avatarSize: 90 });
    preview.style.width = s.width + "px";
    preview.style.height = s.height + "px";
    preview.style.borderRadius = s.radius;
  }

  private sectionBlock(
    parent: HTMLElement,
    section: string,
    entries: ResumeEntry[],
    addLabel: string
  ): void {
    const wrapper = parent.createEl("div", { cls: "re-sect-block", attr: { "data-section-body": section } });
    const list = wrapper.createEl("div", { cls: "re-entry-list", attr: { "data-section-list": section } });
    entries.forEach((e, i) => this.buildEntry(list, section, e, i));
    const add = wrapper.createEl("button", { cls: "re-btn re-btn-block", text: "+ " + addLabel });
    add.addEventListener("click", () => {
      const target: ResumeEntry = {
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
      const idx = entries.length;
      entries.push(target);
      this.buildEntry(list, section, target, idx);
      // 把新增按钮保持在列表下方
      wrapper.appendChild(add);
      this.bindEntryDnd(section);
      this.renderPreview();
      this.scheduleSave();
    });
    this.bindEntryDnd(section);
  }

  private buildEntry(parent: HTMLElement, section: string, e: ResumeEntry, index: number): void {
    const cfg = SECTION_LABELS[section];
    const entries = this.model[section as keyof ResumeData] as ResumeEntry[];
    const visible = e.visible ?? true;
    const collapsed = e.collapsed ?? false;
    const isEducation = section === "education";

    const card = parent.createDiv({
      cls: "re-entry-card" + (collapsed ? " re-collapsed" : "") + (visible ? "" : " re-hidden"),
      attr: { "data-section": section, "data-index": String(index) },
    });

    const bar = card.createEl("div", { cls: "re-entry-bar" });

    const handle = bar.createEl("span", {
      cls: "re-entry-drag",
      attr: { title: t("module.drag") },
    });
    setIcon(handle, "re-grip-vertical");

    const summary = bar.createEl("div", { cls: "re-entry-summary" });
    const updateSummary = () => {
      summary.empty();
      const orgVal = (card.querySelector('[data-key="org"]') as HTMLInputElement)?.value ?? "";
      const titleVal = (card.querySelector('[data-key="title"]') as HTMLInputElement)?.value ?? "";
      const startVal = (card.querySelector('[data-key="startTime"]') as HTMLInputElement)?.value ?? "";
      const endVal = (card.querySelector('[data-key="endTime"]') as HTMLInputElement)?.value ?? "";
      const currentCb = card.querySelector('[data-key="current"]') as HTMLInputElement | null;
      const currentVal = currentCb?.checked ?? false;
      const timeStr = this.formatSummaryTime(startVal, endVal, currentVal);
      summary.createEl("span", { cls: "re-entry-summary-org", text: orgVal || t("entry.untitled") });
      if (titleVal) summary.createEl("span", { cls: "re-entry-summary-title", text: titleVal });
      if (timeStr) summary.createEl("span", { cls: "re-entry-summary-time", text: timeStr });
    };
    updateSummary();

    const actions = bar.createEl("div", { cls: "re-entry-actions" });

    // 移动端 ↑↓ 排序（隐藏拖拽手柄，改用按钮更可靠）
    this.buildMoveButtons(actions, index, entries.length, (dir) => {
      this.moveItemInArray(entries, index, dir);
      this.renderModules();
      this.renderPreview();
      this.scheduleSave();
    });

    // 显示/隐藏
    const hideBtn = actions.createEl("button", {
      cls: "re-icon-btn",
      attr: { type: "button", title: visible ? t("entry.hide") : t("entry.show") },
    });
    setIcon(hideBtn, visible ? "re-eye" : "re-eye-off");
    hideBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      e.visible = !visible;
      card.classList.toggle("re-hidden", !e.visible);
      hideBtn.setAttribute("title", e.visible ? t("entry.hide") : t("entry.show"));
      setIcon(hideBtn, e.visible ? "re-eye" : "re-eye-off");
      this.renderPreview();
      this.scheduleSave();
    });

    // 删除
    const rm = actions.createEl("button", {
      cls: "re-icon-btn re-entry-rm",
      attr: { type: "button", title: t("module.delete") },
    });
    setIcon(rm, "re-trash");
    rm.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const list = parent;
      const actualIndex = Array.from(list.children).indexOf(card);
      entries.splice(actualIndex, 1);
      this.renderModules();
      this.renderPreview();
      this.scheduleSave();
    });

    // 点击标题栏空白处折叠/展开
    bar.addEventListener("click", (ev) => {
      const target = ev.target as HTMLElement;
      if (target.closest(".re-entry-actions") || target.closest(".re-entry-drag")) {
        return;
      }
      e.collapsed = !e.collapsed;
      card.classList.toggle("re-collapsed", e.collapsed);
      this.scheduleSave();
    });

    const body = card.createEl("div", { cls: "re-entry-body" });

    // 第一行：学校/公司/项目 + 专业/职位/角色
    const row1 = body.createDiv({ cls: "re-entry-row" });
    this.entryField(row1, cfg.org, "org", e.org);
    this.entryField(row1, cfg.title, "title", e.title);

    if (isEducation) {
      // 第二行：学历 + GPA
      const row2 = body.createDiv({ cls: "re-entry-row" });
      this.entryField(row2, "field.degree", "degree", e.degree);
      this.entryField(row2, "field.gpa", "gpa", e.gpa);
    }

    // 时间行：开始时间 + 结束时间 + 至今开关
    const timeRow = body.createDiv({ cls: "re-entry-row" });
    this.entryField(timeRow, "field.startTime", "startTime", e.startTime);
    const endWrap = timeRow.createDiv({ cls: "re-field re-field-end-time" });
    endWrap.createEl("span", { text: t("field.endTime") });
    const endInner = endWrap.createDiv({ cls: "re-end-time-inner" });
    const endInput = endInner.createEl("input", {
      cls: "re-input",
      attr: { "data-key": "endTime", placeholder: t("field.endTime") },
    });
    endInput.value = e.current ? "" : e.endTime;
    endInput.disabled = e.current;
    const currentWrap = endInner.createEl("label", { cls: "re-current-toggle" });
    const currentCb = currentWrap.createEl("input", {
      attr: { type: "checkbox", "data-key": "current" },
    });
    currentCb.checked = e.current;
    currentWrap.createEl("span", { cls: "re-current-label", text: t("field.current") });
    currentCb.addEventListener("change", () => {
      endInput.disabled = currentCb.checked;
      if (currentCb.checked) endInput.value = "";
      updateSummary();
      this.syncFromForm();
    });

    // 简介：普通多行文本框
    this.entryField(body, cfg.details, "details", e.details, true);

    card.querySelectorAll('[data-key="org"], [data-key="title"], [data-key="startTime"], [data-key="endTime"]').forEach((el) => {
      el.addEventListener("input", updateSummary);
    });
    const currentCheckbox = card.querySelector('[data-key="current"]') as HTMLInputElement | null;
    currentCheckbox?.addEventListener("change", updateSummary);
  }

  private formatSummaryTime(start: string, end: string, current: boolean): string {
    if (current && start) return `${start} - 至今`;
    if (current) return "至今";
    if (start && end) return `${start} - ${end}`;
    return start || end || "";
  }

  private entryField(
    parent: HTMLElement,
    labelKey: string,
    key: string,
    value: string,
    multiline = false
  ): void {
    const wrap = parent.createDiv({ cls: "re-field" + (multiline ? "" : " re-field-half") });
    wrap.createEl("span", { text: t(labelKey) });
    if (multiline) {
      const ta = wrap.createEl("textarea", {
        cls: "re-textarea",
        attr: { "data-key": key },
      });
      ta.value = value;
      this.attachTextareaZoom(ta, t(labelKey));
    } else {
      const inp = wrap.createEl("input", {
        cls: "re-input",
        attr: { "data-key": key },
      }) as HTMLInputElement;
      inp.value = value;
    }
  }

  private syncFromForm(): void {
    const b = this.formBody;
    const get = (sel: string): string =>
      ((b.querySelector(sel) as HTMLInputElement | null)?.value ?? "");

    // 同步模块顺序 / 可见性 / 自定义模块内容（按当前 DOM 顺序）
    const mods = Array.from(this.sectionList.querySelectorAll(".re-module"));
    this.model.menuSections.forEach((sec, i) => {
      const el = mods[i] as HTMLElement | undefined;
      if (!el) return;
      sec.visible = !el.classList.contains("re-hidden");
      if (sec.type === "custom") {
        const ti = el.querySelector(".re-module-title-input") as HTMLInputElement | null;
        const ct = el.querySelector("[data-custom-content]") as HTMLTextAreaElement | null;
        sec.title = ti?.value ?? "";
        sec.content = ct?.value ?? "";
      }
    });

    const data: ResumeData = {
      id: this.model.id,
      title: this.model.title,
      createdAt: this.model.createdAt,
      updatedAt: new Date().toISOString(),
      templateId: this.model.templateId,
      name: get('[data-basic="name"]'),
      role: get('[data-basic="role"]'),
      phone: get('[data-basic="phone"]'),
      email: get('[data-basic="email"]'),
      employmentStatus: get('[data-basic="employmentStatus"]'),
      location: get('[data-basic="location"]'),
      birthDate: get('[data-basic="birthDate"]'),
      layout: this.model.layout,
      avatar: get('[data-basic="avatar"]'),
      avatarSize: (b.querySelector('[data-avatar="size"]') as HTMLInputElement | null)?.value
        ? Number((b.querySelector('[data-avatar="size"]') as HTMLInputElement).value)
        : this.model.avatarSize,
      avatarAspectRatio:
        ((b.querySelector('[data-avatar="ratio"]') as HTMLSelectElement | null)?.value as AvatarRatio) ??
        this.model.avatarAspectRatio,
      avatarRadius:
        ((b.querySelector('[data-avatar="radius"]') as HTMLSelectElement | null)?.value as AvatarRadius) ??
        this.model.avatarRadius,
      basicFields: this.readBasicFields(),
      customFields: this.readCustomFields(),
      education: this.readEntries("education"),
      experience: this.readEntries("experience"),
      projects: this.readEntries("projects"),
      certificates: this.model.certificates,
      customData: this.model.customData,
      skillContent: get('[data-basic="skillContent"]'),
      selfEvaluationContent: get('[data-basic="selfEvaluationContent"]'),
      menuSections: this.model.menuSections,
      globalSettings: this.model.globalSettings,
    };
    this.model = data;
    this.renderPreview();
    this.scheduleSave();
  }

  private readBasicFields(): BasicFieldConfig[] {
    const out: BasicFieldConfig[] = [];
    this.formBody.querySelectorAll(".re-basic-field-row").forEach((node) => {
      const el = node as HTMLElement;
      const key = el.getAttribute("data-basic-field") ?? "";
      if (!key) return;
      out.push({ key, visible: !el.classList.contains("re-hidden") });
    });
    return out;
  }

  private readEntries(section: string): ResumeEntry[] {
    const out: ResumeEntry[] = [];
    this.formBody
      .querySelectorAll(`.re-entry-card[data-section="${section}"]`)
      .forEach((node) => {
        const el = node as HTMLElement;
        const v = (s: string): string =>
          ((el.querySelector(`[data-key="${s}"]`) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "");
        const cb = el.querySelector('[data-key="current"]') as HTMLInputElement | null;
        const current = cb?.checked ?? false;
        out.push({
          org: v("org"),
          title: v("title"),
          degree: v("degree"),
          gpa: v("gpa"),
          startTime: v("startTime"),
          endTime: current ? "" : v("endTime"),
          current,
          time: "",
          details: v("details"),
          visible: !el.classList.contains("re-hidden"),
          collapsed: el.classList.contains("re-collapsed"),
        });
      });
    return out;
  }

  private customFieldsBlock(parent: HTMLElement): void {
    const det = parent.createEl("details", { cls: "re-sect", attr: { open: "" } });
    det.createEl("summary", { text: t("form.customFields") });
    const body = det.createDiv({ cls: "re-sect-body", attr: { "data-section-body": "customFields" } });

    this.model.customFields.forEach((f) => this.buildCustomField(body, f));

    const add = body.createEl("button", { cls: "re-btn re-btn-block", text: "+ " + t("btn.addCustomField") });
    add.addEventListener("click", () => {
      this.buildCustomField(body, { icon: "", label: "", value: "", showLabel: true, visible: true });
      body.appendChild(add);
      this.syncFromForm();
    });
  }

  private buildCustomField(parent: HTMLElement, f: ResumeCustomField): void {
    const row = parent.createDiv({ cls: "re-cf-row", attr: { "data-custom-field": "" } });

    const iconKey = normalizeCustomFieldIcon(f.icon);
    const iconBtn = row.createEl("button", {
      cls: "re-icon-btn re-cf-icon-btn",
      attr: { type: "button", title: t("field.cfIcon"), "aria-label": t("field.cfIcon") },
    });
    setIcon(iconBtn, contactIconId(iconKey));
    const iconHidden = row.createEl("input", {
      attr: { type: "hidden", "data-cf": "icon", value: iconKey },
    });
    iconBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openIconPicker(iconBtn, iconKey, (newKey) => {
        iconHidden.value = newKey;
        setIcon(iconBtn, contactIconId(newKey));
        this.syncFromForm();
      });
    });

    const labelInp = row.createEl("input", {
      cls: "re-input re-cf-label",
      attr: { placeholder: t("field.cfLabel"), "data-cf": "label" },
    });
    labelInp.value = f.label;

    const valueInp = row.createEl("input", {
      cls: "re-input re-cf-value",
      attr: { placeholder: t("field.cfValue"), "data-cf": "value" },
    });
    valueInp.value = f.value;

    const actions = row.createDiv({ cls: "re-cf-actions" });

    // 显示标签
    const showLabelWrap = actions.createDiv({ cls: "re-cf-toggle" });
    const showLabelCb = showLabelWrap.createEl("input", {
      attr: { type: "checkbox", "data-cf": "showLabel" },
    });
    showLabelCb.checked = f.showLabel;
    const showLabelBtn = showLabelWrap.createEl("button", {
      cls: "re-icon-btn re-cf-toggle-btn" + (f.showLabel ? " re-on" : ""),
      attr: { type: "button", title: t("field.cfShowLabel") },
    });
    setIcon(showLabelBtn, "re-tag");
    showLabelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showLabelCb.checked = !showLabelCb.checked;
      showLabelBtn.toggleClass("re-on", showLabelCb.checked);
      this.syncFromForm();
    });

    // 可见
    const visibleWrap = actions.createDiv({ cls: "re-cf-toggle" });
    const visibleCb = visibleWrap.createEl("input", {
      attr: { type: "checkbox", "data-cf": "visible" },
    });
    visibleCb.checked = f.visible;
    const visibleBtn = visibleWrap.createEl("button", {
      cls: "re-icon-btn re-cf-toggle-btn" + (f.visible ? " re-on" : ""),
      attr: { type: "button", title: t("field.cfVisible") },
    });
    setIcon(visibleBtn, f.visible ? "re-eye" : "re-eye-off");
    visibleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      visibleCb.checked = !visibleCb.checked;
      visibleBtn.toggleClass("re-on", visibleCb.checked);
      setIcon(visibleBtn, visibleCb.checked ? "re-eye" : "re-eye-off");
      this.syncFromForm();
    });

    // 删除
    const rm = actions.createEl("button", {
      cls: "re-icon-btn re-cf-rm",
      attr: { type: "button", title: t("module.delete") },
    });
    setIcon(rm, "re-trash");
    rm.addEventListener("click", () => {
      row.remove();
      this.syncFromForm();
    });

    row.addEventListener("input", () => this.syncFromForm());
  }

  private openIconPicker(
    anchor: HTMLElement,
    currentKey: string,
    onSelect: (key: string) => void
  ): void {
    this.closeIconPicker();

    const picker = document.createElement("div");
    picker.className = "re-icon-picker";
    picker.setAttribute("data-icon-picker", "");

    const grid = picker.createDiv({ cls: "re-icon-picker-grid" });
    for (const key of CUSTOM_FIELD_ICON_KEYS) {
      const item = grid.createEl("button", {
        cls: "re-icon-picker-item" + (key === currentKey ? " re-on" : ""),
        attr: { type: "button", title: key, "data-key": key },
      });
      setIcon(item, contactIconId(key));
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect(key);
        this.closeIconPicker();
      });
    }

    document.body.appendChild(picker);
    this.activeIconPicker = picker;

    const rect = anchor.getBoundingClientRect();
    const pickerHeight = Math.ceil(CUSTOM_FIELD_ICON_KEYS.length / 6) * 36 + 12;
    const top = rect.bottom + pickerHeight > window.innerHeight
      ? rect.top - pickerHeight - 4
      : rect.bottom + 4;
    picker.style.left = `${Math.min(rect.left, window.innerWidth - 240)}px`;
    picker.style.top = `${Math.max(4, top)}px`;

    const close = (ev: MouseEvent) => {
      if (!picker.contains(ev.target as Node)) {
        this.closeIconPicker();
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  private closeIconPicker(): void {
    if (this.activeIconPicker) {
      this.activeIconPicker.remove();
      this.activeIconPicker = null;
    }
  }

  private readCustomFields(): ResumeCustomField[] {
    const out: ResumeCustomField[] = [];
    this.formBody.querySelectorAll("[data-custom-field]").forEach((node) => {
      const el = node as HTMLElement;
      const v = (s: string): string =>
        ((el.querySelector(`[data-cf="${s}"]`) as HTMLInputElement | null)?.value ?? "");
      const cb = (s: string): boolean =>
        ((el.querySelector(`[data-cf="${s}"]`) as HTMLInputElement | null)?.checked ?? false);
      out.push({
        icon: v("icon"),
        label: v("label"),
        value: v("value"),
        showLabel: cb("showLabel"),
        visible: cb("visible"),
      });
    });
    return out;
  }

  private renderPreview(): void {
    renderResumeDom(this.previewPaper, this.model, this.app);
    this.applyPreviewPageLines();
    // 移动端切到预览后需按可用宽度重算 A4 等比缩放
    if (this.isMobile && this.activePane === "preview") this.applyPreviewFit();
  }

  /**
   * 多页预览：内容超出一页时，在 paper 上画 A4 高度的横向虚线 + 右侧页码标签，
   * 并在底部状态栏显示总页数；不再做整体缩放，内容始终铺开。
   */
  private applyPreviewPageLines(): void {
    const paper = this.previewPaper.querySelector(".re-paper") as HTMLElement | null;
    if (!paper || !this.previewStatus) return;

    // 每次渲染都先复位
    paper.classList.remove("re-paper-with-lines");
    paper.querySelector(".re-page-overlay")?.remove();
    this.previewStatus.empty();
    this.previewStatus.addClass("re-hidden");

    const gs = this.model.globalSettings;
    if (!gs?.showPageLines) return;

    const PAGE_H = PAPER_SIZE_PX.A4.height; // 1123px（96dpi）
    const contentH = paper.scrollHeight;
    if (contentH <= PAGE_H) return; // 单页不需要分隔

    const totalPages = Math.ceil(contentH / PAGE_H);
    const overlay = paper.createDiv({ cls: "re-page-overlay" });
    for (let i = 1; i < totalPages; i++) {
      const line = overlay.createDiv({ cls: "re-page-break" });
      line.style.top = `${i * PAGE_H}px`;
      const label = line.createDiv({ cls: "re-page-break-label" });
      label.textContent = `${i} / ${totalPages}`;
    }
    paper.classList.add("re-paper-with-lines");

    this.previewStatus.removeClass("re-hidden");
    this.previewStatus.addClass("re-status-pagecount");
    this.previewStatus.setText(t("style.pageCount", { count: String(totalPages) }));
  }

  /* ---------- 移动端：单栏切换 + A4 缩放 ---------- */

  /** 切换编辑/预览面板（移动端单栏只显示一个，默认编辑页） */
  private setActivePane(pane: "form" | "preview"): void {
    this.activePane = pane;
    this.formPane.toggleClass("re-active", pane === "form");
    this.previewPane.toggleClass("re-active", pane === "preview");
    if (this.paneToggleBtn && this.paneToggleIcon && this.paneToggleLabel) {
      const toPreview = pane === "form";
      this.paneToggleLabel.setText(toPreview ? t("btn.showPreview") : t("btn.showEditor"));
      setIcon(this.paneToggleIcon, toPreview ? "eye" : "pencil");
    }
    if (pane === "preview") {
      // 切回预览必须重渲染：applyPreviewPageLines 依赖 paper.scrollHeight，
      // 元素在 display:none 下测量为 0，A4 分页线会算错
      this.renderPreview();
    }
  }

  /** 移动端预览：A4 纸张固定 794px，按可用宽度等比缩放，并补偿缩放后的空白高度 */
  private applyPreviewFit(): void {
    if (!this.isMobile) return;
    const holder = this.previewPaper;
    const scroll = holder.parentElement as HTMLElement | null;
    if (!scroll) return;
    const avail = scroll.clientWidth - 28; // 减去 .re-preview-scroll 左右内边距
    const PAPER_W = 794;
    const s = Math.max(0.2, Math.min(1, avail / PAPER_W));
    holder.style.width = `${avail}px`;
    holder.style.transformOrigin = "top left";
    holder.style.transform = `scale(${s})`;
    const paper = holder.querySelector(".re-paper") as HTMLElement | null;
    if (paper) {
      requestAnimationFrame(() => {
        holder.style.marginBottom = `-${paper.offsetHeight * (1 - s)}px`;
      });
    }
  }

  /* ---------- 移动端：↑↓ 排序按钮（替代触屏难用的拖拽） ---------- */

  /** 原地交换数组中 index 与目标位置的元素 */
  private moveItemInArray<T>(arr: T[], index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    const tmp = arr[index];
    arr[index] = arr[target];
    arr[target] = tmp;
  }

  /** 在 actions 容器最前插入 ↑↓ 按钮（移动端显示；首项↑/末项↓禁用） */
  private buildMoveButtons(
    parent: HTMLElement,
    index: number,
    total: number,
    onMove: (dir: -1 | 1) => void
  ): void {
    const up = parent.createEl("button", {
      cls: "re-icon-btn re-move-btn",
      attr: { type: "button", title: t("btn.moveUp"), "aria-label": t("btn.moveUp") },
    });
    setIcon(up, "arrow-up");
    if (index <= 0) {
      up.disabled = true;
      up.addClass("re-disabled");
    }
    up.addEventListener("click", (e) => {
      e.stopPropagation();
      onMove(-1);
    });

    const down = parent.createEl("button", {
      cls: "re-icon-btn re-move-btn",
      attr: { type: "button", title: t("btn.moveDown"), "aria-label": t("btn.moveDown") },
    });
    setIcon(down, "arrow-down");
    if (index >= total - 1) {
      down.disabled = true;
      down.addClass("re-disabled");
    }
    down.addEventListener("click", (e) => {
      e.stopPropagation();
      onMove(1);
    });
  }

  // 移动端：点击多行文本框 → 弹出放大编辑层（方案 A）
  private attachTextareaZoom(ta: HTMLTextAreaElement, title: string): void {
    if (!this.isMobile) return;
    ta.addEventListener("click", () => {
      if (this.textareaZoomOverlay) return;
      this.openTextareaZoom(ta, title);
    });
  }

  private openTextareaZoom(original: HTMLTextAreaElement, title: string): void {
    if (this.textareaZoomOverlay) return;
    const overlay = document.body.createDiv({ cls: "re-textarea-zoom-overlay" });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.closeTextareaZoom();
    });

    const panel = overlay.createDiv({ cls: "re-textarea-zoom-panel" });
    const header = panel.createDiv({ cls: "re-textarea-zoom-header" });
    header.createSpan({ cls: "re-textarea-zoom-title", text: title });
    const doneBtn = header.createEl("button", {
      cls: "re-btn re-textarea-zoom-done",
      text: t("textarea.done"),
      attr: { type: "button" },
    });
    doneBtn.addEventListener("click", () => this.closeTextareaZoom());

    // 用 div 作为滚动容器，textarea 只负责输入；比直接让 <textarea> 在 flex 里滚动更可靠
    const scrollWrap = panel.createDiv({ cls: "re-textarea-zoom-scroll" });
    const zoomTa = scrollWrap.createEl("textarea", { cls: "re-textarea-zoom-area" });
    zoomTa.value = original.value;
    // 在 textarea 下方插入固定高度的空白占位，确保即使文字不满一页也能滚动，
    // 并且编辑到末尾时文字与键盘之间始终有约三行空白间距。
    scrollWrap.createDiv({ cls: "re-textarea-zoom-spacer" });
    zoomTa.addEventListener("input", () => {
      original.value = zoomTa.value;
      this.syncFromForm();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.closeTextareaZoom();
    };
    document.addEventListener("keydown", onKey);

    this.textareaZoomOverlay = overlay;
    this.textareaZoomKeyHandler = onKey;
    this.textareaZoomOriginal = original;
    original.blur();
    zoomTa.focus();
    const len = zoomTa.value.length;
    zoomTa.setSelectionRange(len, len);

    // 键盘弹出后可视区域（visualViewport）会缩小，浮层需贴合可视区域，
    // 否则仍按整屏布局视口定位、被键盘遮挡一半，可见区过小且无滚动。
    const applyVV = () => {
      const vv = window.visualViewport;
      const ov = this.textareaZoomOverlay;
      if (!vv || !ov) return;
      ov.style.top = `${vv.offsetTop}px`;
      ov.style.left = `${vv.offsetLeft}px`;
      ov.style.width = `${vv.width}px`;
      ov.style.height = `${vv.height}px`;
      ov.style.right = "auto";
      ov.style.bottom = "auto";
    };
    applyVV();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", applyVV);
      window.visualViewport.addEventListener("scroll", applyVV);
    }
    this.textareaZoomVVHandler = applyVV;
  }

  private closeTextareaZoom(): void {
    const overlay = this.textareaZoomOverlay;
    if (!overlay) return;
    const zoomTa = overlay.querySelector(".re-textarea-zoom-area") as HTMLTextAreaElement | null;
    if (zoomTa && this.textareaZoomOriginal) {
      this.textareaZoomOriginal.value = zoomTa.value;
      this.syncFromForm();
    }
    if (this.textareaZoomKeyHandler) {
      document.removeEventListener("keydown", this.textareaZoomKeyHandler);
    }
    if (this.textareaZoomVVHandler && window.visualViewport) {
      window.visualViewport.removeEventListener("resize", this.textareaZoomVVHandler);
      window.visualViewport.removeEventListener("scroll", this.textareaZoomVVHandler);
    }
    overlay.remove();
    this.textareaZoomOverlay = null;
    this.textareaZoomKeyHandler = null;
    this.textareaZoomVVHandler = null;
    this.textareaZoomOriginal = null;
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
      !m.skillContent &&
      m.education.length === 0 &&
      m.experience.length === 0 &&
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
      // 新格式：.resume 文件（纯 JSON）
      const path = `${normalizedDir}/${name}.${RESUME_EXT}`;
      const file = await this.app.vault.create(
        path,
        JSON.stringify({ ...DEFAULT_RESUME }, null, 2)
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
    // 没有当前文件时，若内容非空则在 vault 根目录新建文件
    if (!this.currentFile) {
      if (this.isModelEmpty()) {
        // 自动保存模式下空内容不创建文件，避免无输入时自动生成
        return;
      }
      const file = await this.createResumeInDir("");
      if (!file) return;
      this.currentFile = file;
      new Notice(t("notice.created", { name: file.basename }));
      return;
    }

    // 旧 .md 文件 → 自动迁移为 .resume 格式（首次保存时转换）
    if (this.currentFile.extension !== RESUME_EXT) {
      const oldFile = this.currentFile;
      const newPath = oldFile.path.replace(/\.[^.]+$/, `.${RESUME_EXT}`);
      try {
        const newFile = await this.app.vault.create(
          newPath,
          JSON.stringify(this.model, null, 2)
        );
        this.currentFile = newFile;
        // 删除旧的 .md 文件
        await this.app.vault.delete(oldFile);
        new Notice(t("notice.savedMigrated", { name: newFile.basename }));
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        new Notice(t("error.export", { msg }));
        return;
      }
    }

    // 正常 .resume 文件 → 直接 JSON 写入
    try {
      await writeResume(this.app, this.currentFile, this.model);
      new Notice(t("notice.saved", { name: this.currentFile.basename }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(t("error.export", { msg }));
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
    const paper = this.plugin.settings.paperSize;
    switch (kind) {
      case "pdf":
        void exportPdf(this.app, data, base, paper);
        break;
      case "html":
        void exportHtml(this.app, data, base);
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
