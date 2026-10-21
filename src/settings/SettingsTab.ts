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

export type ViewMode = "edit" | "split" | "preview";
export type ViewModeControl = "cyclic" | "segment" | "dropdown";

export interface ResumeEditorSettings {
  template: TemplateId;
  paperSize: "A4" | "Letter";
  autoSave: boolean;
  /** 页面显示模式：编辑页 / 编辑预览页 / 预览页（持久化用户最后选择） */
  viewMode: ViewMode;
  /** 工具栏「调整页面显示」按钮的形态：循环图标 / 分段控件 / 下拉菜单 */
  viewModeControl: ViewModeControl;
}

export const DEFAULT_SETTINGS: ResumeEditorSettings = {
  template: "single",
  paperSize: "A4",
  autoSave: true,
  viewMode: "split",
  viewModeControl: "dropdown",
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

    new Setting(containerEl)
      .setName(t("settings.viewMode.name"))
      .setDesc(t("settings.viewMode.desc"))
      .addDropdown((dd) => {
        dd.addOption("edit", t("viewMode.edit"));
        dd.addOption("split", t("viewMode.split"));
        dd.addOption("preview", t("viewMode.preview"));
        return dd
          .setValue(this.plugin.settings.viewMode)
          .onChange(async (v) => {
            this.plugin.settings.viewMode = v as ViewMode;
            await this.plugin.saveSettings();
            this.plugin.getView()?.syncFromSettings();
          });
      });

    new Setting(containerEl)
      .setName(t("settings.viewModeControl.name"))
      .setDesc(t("settings.viewModeControl.desc"))
      .addDropdown((dd) => {
        dd.addOption("cyclic", t("viewModeControl.cyclic"));
        dd.addOption("segment", t("viewModeControl.segment"));
        dd.addOption("dropdown", t("viewModeControl.dropdown"));
        return dd
          .setValue(this.plugin.settings.viewModeControl)
          .onChange(async (v) => {
            this.plugin.settings.viewModeControl = v as ViewModeControl;
            await this.plugin.saveSettings();
            this.plugin.getView()?.syncFromSettings();
          });
      });

  }
}
