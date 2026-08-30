// 设置面板 + 设置接口

import {
  App,
  Notice,
  PluginSettingTab,
  Setting,
} from "obsidian";
import type ResumeEditorPlugin from "../main";
import { TemplateId } from "../data/resume-model";
import { TEMPLATE_REGISTRY } from "../render/templates/registry";
import { t } from "../i18n";

export interface ResumeEditorSettings {
  template: TemplateId;
  paperSize: "A4" | "Letter";
  autoSave: boolean;
}

export const DEFAULT_SETTINGS: ResumeEditorSettings = {
  template: "single",
  paperSize: "A4",
  autoSave: true,
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
      .addDropdown((dd) => {
        TEMPLATE_REGISTRY.forEach((e) => dd.addOption(e.id, t(e.config.nameKey)));
        return dd
          .setValue(this.plugin.settings.template)
          .onChange(async (v) => {
            this.plugin.settings.template = v as TemplateId;
            await this.plugin.saveSettings();
          });
      });

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

    new Setting(containerEl)
      .setName(t("settings.autoSave.name"))
      .setDesc(t("settings.autoSave.desc"))
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.autoSave).onChange(async (v) => {
          this.plugin.settings.autoSave = v;
          await this.plugin.saveSettings();
        })
      );

  }
}
