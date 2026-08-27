// AI 润色：通过 requestUrl 调用 OpenAI 兼容接口（需要网络与 API Key，已在 README 披露）

import { requestUrl, Notice } from "obsidian";
import { ResumeEditorSettings } from "../settings/SettingsTab";
import { t } from "../i18n";

export async function polishText(
  text: string,
  settings: ResumeEditorSettings
): Promise<string> {
  if (!settings.aiEnabled) return text;
  if (!settings.aiKey) {
    new Notice(t("error.noKey"));
    return text;
  }

  const prompt =
    "你是一名资深简历顾问。请优化下面这段简历描述，使其更专业、包含量化成果、" +
    "符合 ATS 友好格式（纯文本、无表格/图形）。只返回优化后的文本，不要解释或加引号。\n\n" +
    text;

  try {
    const resp = await requestUrl({
      url: settings.aiEndpoint,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.aiKey}`,
      },
      body: JSON.stringify({
        model: settings.aiModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      }),
    });
    const json = resp.json;
    const content =
      json && json.choices && json.choices[0] && json.choices[0].message
        ? json.choices[0].message.content
        : "";
    return content ? String(content).trim() : text;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    new Notice(t("error.export", { msg }));
    return text;
  }
}
