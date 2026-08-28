// 设置面板 + 设置接口

import {
  App,
  FuzzySuggestModal,
  Notice,
  PluginSettingTab,
  Setting,
  TFolder,
} from "obsidian";
import type ResumeEditorPlugin from "../main";
import { TemplateId } from "../data/resume-model";
import { t } from "../i18n";

export interface ResumeEditorSettings {
  template: TemplateId;
  paperSize: "A4" | "Letter";
  aiEnabled: boolean;
  aiEndpoint: string;
  aiKey: string;
  aiModel: string;
  resumeDir: string;
  autoSave: boolean;
}

export const DEFAULT_SETTINGS: ResumeEditorSettings = {
  template: "single",
  paperSize: "A4",
  aiEnabled: false,
  aiEndpoint: "https://api.openai.com/v1/chat/completions",
  aiKey: "",
  aiModel: "gpt-4o-mini",
  resumeDir: "",
  autoSave: true,
};

// 文件夹选择器：复用 FuzzySuggestModal，列 vault 内所有 TFolder
class FolderPickerModal extends FuzzySuggestModal<TFolder> {
  private plugin: ResumeEditorPlugin;
  private onPick: () => void;

  constructor(app: App, plugin: ResumeEditorPlugin, onPick: () => void) {
    super(app);
    this.plugin = plugin;
    this.onPick = onPick;
  }

  getItems(): TFolder[] {
    const folders: TFolder[] = [];
    const stack: TFolder[] = [];
    // 从 vault root（path === "" 或 "/"）起遍历
    const root = this.app.vault.getRoot();
    if (root) stack.push(root);
    while (stack.length) {
      const cur = stack.pop() as TFolder;
      folders.push(cur);
      cur.children.forEach((child) => {
        if (child instanceof TFolder) stack.push(child);
      });
    }
    return folders;
  }

  getItemText(folder: TFolder): string {
    return folder.path === "" ? "/" : folder.path;
  }

  onChooseItem(folder: TFolder): void {
    const path = folder.path === "" ? "" : folder.path;
    this.plugin.settings.resumeDir = path;
    void this.plugin.saveSettings();
    this.onPick();
    if (path) {
      new Notice(t("notice.pickedFolder", { path }));
    } else {
      new Notice(t("settings.resumeDir.dir.placeholder"));
    }
  }
}

export class ResumeSettingTab extends PluginSettingTab {
  plugin: ResumeEditorPlugin;

  constructor(app: App, plugin: ResumeEditorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName(t("settings.title")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.template.name"))
      .setDesc(t("settings.template.desc"))
      .addDropdown((dd) =>
        dd
          .addOption("single", t("template.single"))
          .addOption("twoCol", t("template.twoCol"))
          .addOption("academic", t("template.academic"))
          .addOption("classic", t("template.classic"))
          .setValue(this.plugin.settings.template)
          .onChange(async (v) => {
            this.plugin.settings.template = v as TemplateId;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.paper.name"))
      .setDesc(t("settings.paper.desc"))
      .addDropdown((dd) =>
        dd
          .addOption("A4", "A4")
          .addOption("Letter", "Letter")
          .setValue(this.plugin.settings.paperSize)
          .onChange(async (v) => {
            this.plugin.settings.paperSize = v as "A4" | "Letter";
            await this.plugin.saveSettings();
          })
      );

    // 持久化目录
    new Setting(containerEl).setName(t("settings.resumeDir.heading")).setHeading();
    new Setting(containerEl)
      .setName(t("settings.resumeDir.dir.name"))
      .setDesc(t("settings.resumeDir.dir.desc"))
      .addText((tx) =>
        tx
          .setPlaceholder(t("settings.resumeDir.dir.placeholder"))
          .setValue(this.plugin.settings.resumeDir)
          .onChange(async (v) => {
            this.plugin.settings.resumeDir = v.trim();
            await this.plugin.saveSettings();
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText("📁")
          .setTooltip("Browse folders")
          .onClick(() => {
            new FolderPickerModal(this.app, this.plugin, () => this.display()).open();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.autoSave.name"))
      .setDesc(t("settings.autoSave.desc"))
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.autoSave).onChange(async (v) => {
          this.plugin.settings.autoSave = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName(t("settings.ai.heading")).setHeading();
    new Setting(containerEl)
      .setName(t("settings.ai.enable.name"))
      .setDesc(t("settings.ai.enable.desc"))
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.aiEnabled).onChange(async (v) => {
          this.plugin.settings.aiEnabled = v;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName(t("settings.ai.endpoint.name"))
      .addText((tx) =>
        tx
          .setPlaceholder("https://...")
          .setValue(this.plugin.settings.aiEndpoint)
          .onChange(async (v) => {
            this.plugin.settings.aiEndpoint = v;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName(t("settings.ai.key.name"))
      .addText((tx) =>
        tx
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.aiKey)
          .onChange(async (v) => {
            this.plugin.settings.aiKey = v;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName(t("settings.ai.model.name"))
      .addText((tx) =>
        tx.setValue(this.plugin.settings.aiModel).onChange(async (v) => {
          this.plugin.settings.aiModel = v;
          await this.plugin.saveSettings();
        })
      );
  }
}
