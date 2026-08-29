// AI 简历体检结果弹窗：问题列表 + 点击定位
// 样式遵循 1.13+ 规范：选择器统一加 .re-check-modal 前缀，字号用 --font-ui-* 标准变量

import { App, Modal, Setting } from "obsidian";
import { CheckIssue, CheckSeverity } from "../ai/check";
import { t } from "../i18n";

const SEVERITY_KEY: Record<CheckSeverity, string> = {
  high: "check.severity.high",
  medium: "check.severity.medium",
  low: "check.severity.low",
};

/** field 定位键 -> 本地化的位置描述（education.2 -> 教育经历 #3） */
export function checkFieldLabel(field: string): string {
  const [section, idx] = field.split(".");
  const titleKey: Record<string, string> = {
    basic: "form.basic",
    skills: "form.skills",
    education: "form.education",
    experience: "form.work",
    projects: "form.project",
  };
  const title = titleKey[section] ? t(titleKey[section]) : section;
  return idx !== undefined ? `${title} #${Number(idx) + 1}` : title;
}

export class CheckModal extends Modal {
  private issues: CheckIssue[];
  private onJump: (issue: CheckIssue) => void;

  constructor(app: App, issues: CheckIssue[], onJump: (issue: CheckIssue) => void) {
    super(app);
    this.issues = issues;
    this.onJump = onJump;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("re-check-modal");

    new Setting(contentEl)
      .setName(t("check.title"))
      .setDesc(t("check.desc", { count: String(this.issues.length) }))
      .setHeading();

    const list = contentEl.createDiv({ cls: "re-check-list" });
    for (const issue of this.issues) {
      const item = list.createDiv({
        cls: `re-check-item re-check-${issue.severity}`,
        attr: { role: "button", tabindex: "0", "aria-label": t("check.jump") },
      });

      const head = item.createDiv({ cls: "re-check-item-head" });
      head.createSpan({
        cls: `re-check-badge re-check-badge-${issue.severity}`,
        text: t(SEVERITY_KEY[issue.severity]),
      });
      head.createSpan({ cls: "re-check-field", text: checkFieldLabel(issue.field) });

      item.createDiv({ cls: "re-check-message", text: issue.message });
      if (issue.suggestion) {
        item.createDiv({ cls: "re-check-suggestion", text: issue.suggestion });
      }

      item.createDiv({ cls: "re-check-jump-hint", text: t("check.jump") });

      const jump = (): void => {
        this.onJump(issue);
        this.close();
      };
      item.addEventListener("click", jump);
      item.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          jump();
        }
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
