# Resume Editor（简历编辑器）

> 在 Obsidian 里用**表单驱动**的方式编写、预览简历，内置中文友好的多种模板，支持实时预览与 **PDF / HTML / DOCX / LaTeX** 四种格式导出。

[English](./README.en.md)

![版本](https://img.shields.io/badge/version-0.11.1-blue)



![Obsidian](https://img.shields.io/badge/Obsidian-1.11.4%2B-purple)

![许可证](https://img.shields.io/badge/license-MIT-green)

![平台](https://img.shields.io/badge/platform-desktop%20%2F%20mobile-lightgrey)

---

## 功能特性

- **表单驱动编辑器**：左侧是结构化的表单（增删条目、拖拽排序、隐藏模块），右侧是实时预览，所见即所得。
- **12 套模板**：单栏、双栏、学术、经典、时间轴、瑞士、现代、极简、左右分栏、优雅、创意、杂志风，配置驱动，一键切换。
- **全局样式自定义**：每篇简历可单独设置主题色、正文字号、行距、模块间距、页边距；头像支持尺寸、宽高比、圆角等样式。
- **四种导出格式**：PDF（自动分页 / A4 或 Letter）、HTML、DOCX、LaTeX，导出时带进度提示。
- **原生 `.resume` 文件**：与 `.md` 一样原生打开，双击即可进入编辑器视图；支持自动保存。
- **向后兼容**：旧版用 frontmatter 标记的 `.md` 简历文件仍可识别并迁移为 `.resume` 格式。
- **国际化**：界面跟随 Obsidian 的显示语言（简体中文 / 英文），所有文本通过 `t()` 统一翻译。
- **A4 分页预览**：内容超出一页时显示虚线分页线与预计页数，方便控制排版。

---

## 安装

### 方式一：通过 BRAT（推荐，便于获取更新）

1. 在 Obsidian 社区插件市场安装 **BRAT**。
2. 打开 BRAT 设置 → `Add a beta plugin`，输入：
   ```
   https://github.com/hellokunzai/obsidian-resume-editor
   ```
3. 启用 **Resume Editor** 插件。

### 方式二：手动安装

1. 从 [Releases](https://github.com/hellokunzai/obsidian-resume-editor/releases) 下载最新版压缩包，解压得到 `main.js`、`manifest.json`、`styles.css`。
2. 在仓库的 `.obsidian/plugins/resume-editor/` 目录下放入这三个文件（没有该目录就新建）。
3. 在 Obsidian 设置 → 第三方插件中启用 **Resume Editor**。

> 构建产物需要自行拷贝到 vault 的插件目录；仓库内的 `main.js` 即为打包后的产物。

---

## 使用

### 命令

打开命令面板（`Ctrl/Cmd + P`），输入以下命令：

| 命令 ID             | 名称          | 说明                        |
| ----------------- | ----------- | ------------------------- |
| `open-editor`     | 打开简历编辑器     | 在右侧面板打开简历编辑器视图            |
| `new-resume-note` | 新建简历        | 在当前/指定目录新建一份 `.resume` 文件 |
| `mark-resume`     | 标记当前笔记为简历   | 把当前打开的笔记标记为简历文件           |
| `export-pdf`      | 导出简历为 PDF   | 导出为带分页的 PDF               |
| `export-html`     | 导出简历为 HTML  | 导出为自包含 HTML 文件            |
| `export-docx`     | 导出简历为 DOCX  | 导出为 Word 文档               |
| `export-latex`    | 导出简历为 LaTeX | 导出为 LaTeX 源码              |

> 在文件管理器里**右键任意文件夹**会出现「新建简历」菜单项，可在该目录下快速创建简历。

### 设置

插件设置项（设置 → 第三方插件 → Resume Editor）：

- **默认模板**：新建简历时套用的模板；已保存的简历以自身记录为准。
- **PDF 纸张尺寸**：A4 或 Letter。
- **自动保存**：停止输入后自动保存修改。
- **默认显示模式**：打开简历时默认显示「编辑页 / 编辑预览页 / 预览页」。

### 文件格式

简历以 `.resume` 为扩展名，文件内容是结构化的 **JSON**（即 `ResumeData`），Obsidian 会像 `.md` 一样原生复用同一标签页打开它。例如新建文件的内容形如：

```json
{
  "name": "张三",
  "role": "前端工程师",
  "templateId": "single",
  "globalSettings": { "themeColor": "#7c5cff", "baseFontSize": 14, "lineHeight": 1.6 },
  "education": [ { "school": "某某大学", "major": "计算机科学", "degree": "本科" } ],
  "experience": [ { "company": "某某公司", "position": "工程师", "details": ["负责……"] } ]
}
```

旧版使用 frontmatter 或放在简历目录下的 `.md` 文件仍可读取，并在保存时自动迁移为 `.resume` 格式。

---

## 模板列表

所有模板在 `src/render/templates/registry.ts` 中以配置形式注册，新增模板只需在该注册表加一行并补一段 CSS，无需改动其它渲染逻辑。

| ID           | 中文名  | 英文名           | 基本信息布局 |
| ------------ | ---- | ------------- | ------ |
| `single`     | 单栏   | Single column | 头像在左   |
| `twoCol`     | 双栏   | Two columns   | 头像在左   |
| `academic`   | 学术   | Academic      | 头像在上   |
| `classic`    | 经典   | Classic       | 头像在左   |
| `timeline`   | 时间轴  | Timeline      | 头像在左   |
| `swiss`      | 瑞士   | Swiss         | 头像在左   |
| `modern`     | 现代   | Modern        | 头像在左   |
| `minimalist` | 极简   | Minimalist    | 头像在上   |
| `leftRight`  | 左右分栏 | Left & right  | 头像在左   |
| `elegant`    | 优雅   | Elegant       | 头像在上   |
| `creative`   | 创意   | Creative      | 头像在左   |
| `editorial`  | 杂志风  | Editorial     | 头像在左   |

每篇简历可单独切换模板，并覆盖全局样式（主题色、字号、行距、模块间距、页边距等）。

---

## 导出

在简历编辑器工具栏点击对应按钮，或在命令面板执行导出命令：

- **PDF**：根据所选纸张尺寸（A4/Letter）自动分页，导出带样式的 PDF。
- **HTML**：导出一份自包含的单文件 HTML，便于分享或二次排版。
- **DOCX**：导出为 Word 文档，保留结构与样式。
- **LaTeX**：导出为 LaTeX 源码，适合学术投递。

导出过程中会显示进度（准备 → 渲染排版 → 编码分页 → 写入文件）。

---

## 国际化

界面文本全部通过 `src/i18n/index.ts` 的 `t()` 函数获取，当前内置 **简体中文（`zh-cn`）** 与 **英文（`en`）** 两套翻译，跟随 Obsidian 的显示语言自动切换。新增语言只需在 `translations` 对象中补充对应字段。

---

## 开发

本插件使用 TypeScript + esbuild 构建，`main.js` 由 esbuild 打包（CJS 格式，外部化 `obsidian`、`electron`、`@codemirror/*` 等模块）。

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化并自动打包）
npm run dev

# 生产构建（先类型检查再打包，生成 main.js）
npm run build
```

源码结构：

```
src/
├── main.ts                  # 插件入口：生命周期、命令、视图、.resume 扩展名注册
├── settings/SettingsTab.ts  # 设置面板
├── data/resume-model.ts     # 数据模型、.resume 读写、迁移
├── i18n/index.ts            # 国际化
├── views/ResumeEditorView.ts# 双栏编辑器视图（左表单 / 右预览）
├── render/
│   ├── template.ts          # 模板渲染引擎（数据 → DOM / 导出 HTML）
│   └── templates/registry.ts# 模板配置注册表
├── export/                  # PDF / HTML / DOCX / LaTeX 导出实现
├── ui/                      # 图标、联系方式图标
└── utils/                   # 文件名、自动单页、异步工具等
```

---

## 许可证

[MIT](./LICENSE) © hellokunzai
