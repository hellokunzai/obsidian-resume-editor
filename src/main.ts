// 插件入口：生命周期、注册视图 / 命令 / Ribbon / 设置

import { Plugin, Menu, Notice, TAbstractFile, TFile, TFolder } from "obsidian";
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
import { uniqueResumeBasename } from "./utils/file-name";
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

    // 在文件列表右键菜单中注入「新建简历」
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
        menu.addItem((item) => {
          item.setTitle(t("menu.newResume"))
            .setIcon("file-plus")
            .onClick(async () => {
              const dir = file instanceof TFolder ? file.path : file.parent?.path ?? "";
              void this.newResumeNote(dir);
            });
        });
      })
    );
  }

  onunload(): void {
    // 通过 registerEvent / registerView 注册的资源会自动清理
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) ?? {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
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

  private async newResumeNote(targetDir?: string): Promise<void> {
    const dir = (targetDir ?? "").trim().replace(/\/+$/, "");
    const name = uniqueResumeBasename(this.app.vault, dir);
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
      createResumeJson({ ...DEFAULT_RESUME, templateId: this.settings.template })
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
