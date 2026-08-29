// 插件入口：生命周期、注册视图 / 命令 / Ribbon / 设置

import { Plugin, Notice, TFile } from "obsidian";
import { t } from "./i18n";
import { registerResumeIcons } from "./ui/icons";
import { registerContactIcons } from "./ui/contact-icons";
import {
  DEFAULT_RESUME,
  createResumeJson,
  RESUME_EXT,
  isResumeFrontmatter,
  readResume,
  writeResume,
} from "./data/resume-model";
import { VIEW_TYPE_RESUME, ResumeEditorView } from "./views/ResumeEditorView";
import {
  ResumeEditorSettings,
  DEFAULT_SETTINGS,
  ResumeSettingTab,
} from "./settings/SettingsTab";

export default class ResumeEditorPlugin extends Plugin {
  settings!: ResumeEditorSettings;

  async onload(): Promise<void> {
    registerResumeIcons();
    registerContactIcons();

    await this.loadSettings();

    this.addSettingTab(new ResumeSettingTab(this.app, this));

    this.registerView(VIEW_TYPE_RESUME, (leaf) => new ResumeEditorView(leaf, this));

    // 把 .resume 扩展名注册到简历编辑器视图：点击该文件 Obsidian 原生打开编辑器，
    // 多标签 / 复用 / 聚焦全部由 Obsidian 框架管理，无需手动拦截 file-open。
    this.registerExtensions([RESUME_EXT], VIEW_TYPE_RESUME);

    this.addRibbonIcon("file-text", t("ribbon.tooltip"), () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-resume-editor",
      name: t("command.openEditor"),
      callback: () => {
        void this.activateView();
      },
    });

    this.addCommand({
      id: "new-resume-note",
      name: t("command.newResume"),
      callback: () => {
        void this.newResumeNote();
      },
    });

    this.addCommand({
      id: "mark-resume",
      name: t("command.markResume"),
      callback: () => {
        void this.markCurrent();
      },
    });

    this.addCommand({
      id: "export-pdf",
      name: t("command.exportPdf"),
      callback: () => {
        this.getView()?.doExport("pdf");
      },
    });

    this.addCommand({
      id: "export-html",
      name: t("command.exportHtml"),
      callback: () => {
        this.getView()?.doExport("html");
      },
    });

    this.addCommand({
      id: "export-docx",
      name: t("command.exportDocx"),
      callback: () => {
        this.getView()?.doExport("docx");
      },
    });

    this.addCommand({
      id: "export-latex",
      name: t("command.exportLatex"),
      callback: () => {
        this.getView()?.doExport("latex");
      },
    });
  }

  onunload(): void {
    // 通过 registerEvent / registerView 注册的资源会自动清理
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) ?? {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    // 旧配置项迁移：persistDir -> resumeDir
    if (!this.settings.resumeDir && data.persistDir) {
      const oldDir = data.persistDir;
      if (typeof oldDir === "string") {
        this.settings.resumeDir = oldDir;
      }
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private getView(): ResumeEditorView | null {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_RESUME)[0];
    return (leaf?.view as ResumeEditorView) ?? null;
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_RESUME)[0];
    if (!leaf) {
      const right = workspace.getRightLeaf(false);
      if (!right) return;
      leaf = right;
      await leaf.setViewState({ type: VIEW_TYPE_RESUME, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  private async newResumeNote(): Promise<void> {
    const name = "简历-" + new Date().toISOString().slice(0, 10);
    const dir = this.settings.resumeDir.trim().replace(/\/+$/, "");
    if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
      try {
        await this.app.vault.createFolder(dir);
      } catch {
        // 目录可能已存在，忽略
      }
    }
    const path = dir ? `${dir}/${name}.${RESUME_EXT}` : `${name}.${RESUME_EXT}`;
    const file = await this.app.vault.create(
      path,
      createResumeJson({ ...DEFAULT_RESUME, name })
    );
    await this.app.workspace.getLeaf(false).openFile(file);
    new Notice(t("notice.created", { name: file.basename }));
  }

  private async markCurrent(): Promise<void> {
    const file: TFile | null = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice(t("notice.noActive"));
      return;
    }
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (isResumeFrontmatter(fm)) {
      new Notice(t("notice.marked", { name: file.basename }));
      return;
    }
    const data = (await readResume(this.app, file)) ?? { ...DEFAULT_RESUME };
    await writeResume(this.app, file, data);
    new Notice(t("notice.marked", { name: file.basename }));
  }
}
