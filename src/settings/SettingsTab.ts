// 设置面板 + 设置接口

import {
  App,
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
  aiEnabled: boolean;
  /** AI 供应商预设：选中后自动填入默认 endpoint 与模型 */
  aiProvider: AiProvider;
  aiEndpoint: string;
  aiKey: string;
  aiModel: string;
  autoSave: boolean;
}

/** AI 供应商预设（均为 OpenAI 兼容的 chat/completions + Bearer 认证，polish.ts 无需分支） */
export type AiProvider = "custom" | "openai" | "deepseek" | "doubao";

export const AI_PROVIDER_PRESETS: Record<Exclude<AiProvider, "custom">, { endpoint: string; model: string }> = {
  openai: { endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
  deepseek: { endpoint: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" },
  doubao: { endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions", model: "doubao-1.5-pro-32k" },
};

export const DEFAULT_SETTINGS: ResumeEditorSettings = {
  template: "single",
  paperSize: "A4",
  aiEnabled: false,
  aiProvider: "custom",
  aiEndpoint: "https://api.openai.com/v1/chat/completions",
  aiKey: "",
  aiModel: "gpt-4o-mini",
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
      .setName(t("settings.ai.provider.name"))
      .setDesc(t("settings.ai.provider.desc"))
      .addDropdown((dd) =>
        dd
          .addOption("custom", t("ai.provider.custom"))
          .addOption("openai", "OpenAI")
          .addOption("deepseek", "DeepSeek")
          .addOption("doubao", t("ai.provider.doubao"))
          .setValue(this.plugin.settings.aiProvider ?? "custom")
          .onChange(async (v) => {
            const provider = v as AiProvider;
            this.plugin.settings.aiProvider = provider;
            if (provider !== "custom") {
              const preset = AI_PROVIDER_PRESETS[provider];
              this.plugin.settings.aiEndpoint = preset.endpoint;
              this.plugin.settings.aiModel = preset.model;
              await this.plugin.saveSettings();
              this.display();
            } else {
              await this.plugin.saveSettings();
            }
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
