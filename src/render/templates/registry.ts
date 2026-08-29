// 模版注册表（配置驱动，对齐 magic-resume 的 TEMPLATE_REGISTRY 思路）
// 新增一套模版 = 在 TEMPLATE_REGISTRY 加一行 + 在 template.ts 的 RESUME_CSS 补一段样式。
// 渲染逻辑按 templateId 分发到对应风格（style 与 id 1:1），无需改其它文件。

import type { TemplateId, SectionType, ResumeLayout } from "../../data/resume-model";

export interface ResumeTemplateConfig {
  id: TemplateId;
  /** i18n key，用于下拉/芯片显示模版名 */
  nameKey: string;
  /** 渲染风格标识（与 TemplateId 1:1 对应） */
  style: TemplateId;
  /** 配色预设（与 magic-resume 对齐，供互用/预览参考；实际渲染由 globalSettings + CSS 控制） */
  colorScheme: { primary: string; secondary: string; background: string; text: string };
  spacing: { sectionGap: number; itemGap: number; contentPadding: number };
  basic: { layout?: ResumeLayout };
  availableSections: SectionType[];
}

export interface TemplateRegistryEntry {
  id: TemplateId;
  nameKey: string;
  config: ResumeTemplateConfig;
}

export const TEMPLATE_REGISTRY: TemplateRegistryEntry[] = [
  {
    id: "single",
    nameKey: "template.single",
    config: {
      id: "single", nameKey: "template.single", style: "single",
      colorScheme: { primary: "#7c5cff", secondary: "#555", background: "#fff", text: "#222" },
      spacing: { sectionGap: 16, itemGap: 10, contentPadding: 30 },
      basic: { layout: "left" },
      availableSections: ["basic", "education", "experience", "projects", "skills", "custom"],
    },
  },
  {
    id: "twoCol",
    nameKey: "template.twoCol",
    config: {
      id: "twoCol", nameKey: "template.twoCol", style: "twoCol",
      colorScheme: { primary: "#7c5cff", secondary: "#555", background: "#fff", text: "#222" },
      spacing: { sectionGap: 16, itemGap: 10, contentPadding: 30 },
      basic: { layout: "left" },
      availableSections: ["basic", "education", "experience", "projects", "skills", "custom"],
    },
  },
  {
    id: "academic",
    nameKey: "template.academic",
    config: {
      id: "academic", nameKey: "template.academic", style: "academic",
      colorScheme: { primary: "#222", secondary: "#444", background: "#fff", text: "#111" },
      spacing: { sectionGap: 16, itemGap: 10, contentPadding: 32 },
      basic: { layout: "top" },
      availableSections: ["basic", "education", "experience", "projects", "skills", "custom"],
    },
  },
  {
    id: "classic",
    nameKey: "template.classic",
    config: {
      id: "classic", nameKey: "template.classic", style: "classic",
      colorScheme: { primary: "#1a1a1a", secondary: "#444", background: "#fff", text: "#1a1a1a" },
      spacing: { sectionGap: 16, itemGap: 10, contentPadding: 32 },
      basic: { layout: "left" },
      availableSections: ["basic", "education", "experience", "projects", "skills", "custom"],
    },
  },
  {
    id: "timeline",
    nameKey: "template.timeline",
    config: {
      id: "timeline", nameKey: "template.timeline", style: "timeline",
      colorScheme: { primary: "#7c5cff", secondary: "#555", background: "#fff", text: "#222" },
      spacing: { sectionGap: 16, itemGap: 12, contentPadding: 30 },
      basic: { layout: "left" },
      availableSections: ["basic", "education", "experience", "projects", "skills", "custom"],
    },
  },
  {
    id: "swiss",
    nameKey: "template.swiss",
    config: {
      id: "swiss", nameKey: "template.swiss", style: "swiss",
      colorScheme: { primary: "#111", secondary: "#444", background: "#fff", text: "#111" },
      spacing: { sectionGap: 16, itemGap: 10, contentPadding: 28 },
      basic: { layout: "left" },
      availableSections: ["basic", "education", "experience", "projects", "skills", "custom"],
    },
  },
  {
    id: "modern",
    nameKey: "template.modern",
    config: {
      id: "modern", nameKey: "template.modern", style: "modern",
      colorScheme: { primary: "#2563eb", secondary: "#555", background: "#fff", text: "#1f2937" },
      spacing: { sectionGap: 18, itemGap: 10, contentPadding: 30 },
      basic: { layout: "left" },
      availableSections: ["basic", "education", "experience", "projects", "skills", "custom"],
    },
  },
  {
    id: "minimalist",
    nameKey: "template.minimalist",
    config: {
      id: "minimalist", nameKey: "template.minimalist", style: "minimalist",
      colorScheme: { primary: "#111", secondary: "#666", background: "#fff", text: "#222" },
      spacing: { sectionGap: 14, itemGap: 8, contentPadding: 34 },
      basic: { layout: "top" },
      availableSections: ["basic", "education", "experience", "projects", "skills", "custom"],
    },
  },
  {
    id: "leftRight",
    nameKey: "template.leftRight",
    config: {
      id: "leftRight", nameKey: "template.leftRight", style: "leftRight",
      colorScheme: { primary: "#7c5cff", secondary: "#555", background: "#fff", text: "#222" },
      spacing: { sectionGap: 16, itemGap: 10, contentPadding: 30 },
      basic: { layout: "left" },
      availableSections: ["basic", "education", "experience", "projects", "skills", "custom"],
    },
  },
  {
    id: "elegant",
    nameKey: "template.elegant",
    config: {
      id: "elegant", nameKey: "template.elegant", style: "elegant",
      colorScheme: { primary: "#5b3a29", secondary: "#777", background: "#fff", text: "#2b2b2b" },
      spacing: { sectionGap: 18, itemGap: 10, contentPadding: 34 },
      basic: { layout: "top" },
      availableSections: ["basic", "education", "experience", "projects", "skills", "custom"],
    },
  },
  {
    id: "creative",
    nameKey: "template.creative",
    config: {
      id: "creative", nameKey: "template.creative", style: "creative",
      colorScheme: { primary: "#db2777", secondary: "#555", background: "#fff", text: "#222" },
      spacing: { sectionGap: 16, itemGap: 10, contentPadding: 28 },
      basic: { layout: "left" },
      availableSections: ["basic", "education", "experience", "projects", "skills", "custom"],
    },
  },
  {
    id: "editorial",
    nameKey: "template.editorial",
    config: {
      id: "editorial", nameKey: "template.editorial", style: "editorial",
      colorScheme: { primary: "#0f766e", secondary: "#555", background: "#fff", text: "#1a1a1a" },
      spacing: { sectionGap: 16, itemGap: 10, contentPadding: 30 },
      basic: { layout: "left" },
      availableSections: ["basic", "education", "experience", "projects", "skills", "custom"],
    },
  },
];

/** 所有模版配置（drop-in 替代旧的 TemplateId 硬编码列表） */
export const DEFAULT_TEMPLATES: ResumeTemplateConfig[] = TEMPLATE_REGISTRY.map((e) => e.config);

/** 按 id 查模版配置，找不到回退第一项 */
export function getTemplateConfig(id: TemplateId): ResumeTemplateConfig {
  return TEMPLATE_REGISTRY.find((e) => e.id === id)?.config ?? TEMPLATE_REGISTRY[0].config;
}

/** 模版 id 列表（供设置/视图下拉与芯片使用） */
export const TEMPLATE_IDS: TemplateId[] = TEMPLATE_REGISTRY.map((e) => e.id);
