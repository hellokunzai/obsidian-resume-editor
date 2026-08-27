// 设置面板 + 设置接口

import { App, PluginSettingTab, Setting } from "obsidian";
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
}

export const DEFAULT_SETTINGS: ResumeEditorSettings = {
  template: "single",
  paperSize: "A4",
  aiEnabled: false,
  aiEndpoint: "https://api.openai.com/v1/chat/completions",
  aiKey: "",
  aiModel: "gpt-4o-mini",
};

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
