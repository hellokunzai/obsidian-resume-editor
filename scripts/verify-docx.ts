// DOCX 生成自测：在 Node 环境中用 obsidian 桩驱动 docx-core，
// 为三种模板生成真实 .docx，并做基础结构校验（PK 头 / EOCD / 关键 part 存在）。
import { renderResumeDocx, type ImageLoader } from "../src/export/docx-core";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

function mkData(templateId: string): any {
  return {
    name: "张三",
    role: "Java 开发工程师",
    title: "Resume",
    avatar: "",
    templateId,
    skillContent: "Java\nSpring Boot\nMySQL\nRedis",
    selfEvaluationContent: "热爱技术，持续学习。\n注重代码质量与团队协作。",
    basicFields: [
      { key: "phone", visible: true },
      { key: "email", visible: true },
      { key: "location", visible: true },
    ],
    customFields: [
      { label: "GitHub", value: "github.com/zhangsan", icon: "github", visible: true, showLabel: true },
    ],
    menuSections: [
      { id: "education", type: "education", title: "教育经历", visible: true, content: "" },
      { id: "experience", type: "experience", title: "工作经历", visible: true, content: "" },
      { id: "projects", type: "projects", title: "项目经历", visible: true, content: "" },
      { id: "skills", type: "skills", title: "技能", visible: true, content: "" },
      { id: "selfEvaluation", type: "selfEvaluation", title: "自我评价", visible: true, content: "" },
      { id: "custom1", type: "custom", title: "自定义模块", visible: true, content: "自定义内容行1\n自定义内容行2" },
    ],
    education: [
      {
        org: "某大学",
        title: "计算机科学与技术",
        degree: "本科",
        gpa: "3.8",
        details: "- 主修数据结构与算法\n- 曾获国家奖学金",
        visible: true,
        startTime: "2016",
        endTime: "2020",
      },
    ],
    experience: [
      {
        org: "某科技公司",
        title: "后端工程师",
        details: "- 负责订单系统设计\n- 优化接口性能 40%",
        visible: true,
        startTime: "2020",
        endTime: "2023",
      },
    ],
    projects: [
      {
        org: "智能阅卷系统",
        title: "核心开发",
        details: "- 基于 Spring AI 落地 LLM 阅卷\n- 对接 OCR 填表",
        visible: true,
        startTime: "2023",
        endTime: "2024",
      },
    ],
    certificates: [],
    customData: {},
    globalSettings: {
      themeColor: "#7c5cff",
      baseFontSize: 13,
      sectionSpacing: 16,
      paragraphSpacing: 4,
      pagePadding: 30,
      fontFamily: "",
    },
  };
}

const EXPECTED_PARTS = [
  "[Content_Types].xml",
  "_rels/.rels",
  "word/document.xml",
  "word/styles.xml",
  "word/_rels/document.xml.rels",
  "docProps/core.xml",
  "docProps/app.xml",
];

function validateZip(buf: Buffer): string[] {
  const errors: string[] = [];
  if (!(buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04)) {
    errors.push("缺少 PK\\x03\\x04 本地文件头（不是合法 ZIP）");
  }
  // EOCD 签名 PK\x05\x06
  const eocdSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  if (buf.indexOf(eocdSig) === -1) {
    errors.push("缺少 PK\\x05\\x06 中央目录结束符（EOCD）");
  }
  const text = buf.toString("latin1");
  for (const part of EXPECTED_PARTS) {
    if (text.indexOf(part) === -1) errors.push(`缺少必备 part: ${part}`);
  }
  return errors;
}

async function main() {
  const outDir = "/tmp/docx-verify";
  mkdirSync(outDir, { recursive: true });
  const loader: ImageLoader = async () => null;

  for (const tpl of ["single", "twoCol", "leftRight"]) {
    const data = mkData(tpl);
    const bytes = await renderResumeDocx(data, loader);
    const file = join(outDir, `resume-${tpl}.docx`);
    writeFileSync(file, bytes);
    const buf = readFileSync(file);
    const errs = validateZip(buf);
    if (errs.length) {
      console.error(`[FAIL ${tpl}] ${errs.join("; ")}`);
      process.exit(1);
    }
    console.log(`[OK ${tpl}] ${bytes.length} bytes, 7 parts present, valid ZIP container`);
  }
  // 额外校验：单栏文档里确实包含姓名与章节标题文本
  // 注意：整文件是二进制 ZIP，但内部 XML part 为 UTF-8，故按 utf-8 解码检索中文文本。
  const single = readFileSync(join(outDir, "resume-single.docx")).toString("utf-8");
  const checks = ["张三", "教育经历", "工作经历", "技能", "自我评价", "自定义模块"];
  for (const c of checks) {
    if (single.indexOf(c) === -1) {
      console.error(`[FAIL content] 单栏文档缺少文本: ${c}`);
      process.exit(1);
    }
  }
  console.log("[OK content] 单栏文档包含姓名/各模块标题文本");
  console.log("ALL DOCX SELF-TESTS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
