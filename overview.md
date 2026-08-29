# DOCX 导出样式修复总结

## 问题
导出 Word 文档时样式与预览差异较大：预览中的双栏/主题色/头像/联系信息网格等视觉效果在 DOCX 中全部丢失，仅输出为普通单栏文本。

## 修复内容
重写 `src/export/docx.ts`，使用 `docx` 库提供更丰富的排版能力：

1. **分栏布局**
   - `twoCol` 模板：使用表格实现左侧主题色边栏 + 右侧内容区，左侧放置头像、姓名、职位、联系方式和教育经历。
   - `leftRight` 模板：左侧 30% 放头像和联系信息，右侧 70% 放姓名、职位和其余模块。
   - 其他模板：单栏布局，但头部和标题均带样式。

2. **主题色与样式**
   - 章节标题底部边框使用主题色（`classic` 保持黑色）。
   - `twoCol` 左侧边栏背景使用主题色，并自动根据主题色亮度选择黑/白文字。
   - 字号、模块间距、段间距、页边距跟随 `globalSettings`。

3. **头像**
   - 支持从 vault 内图片或网络图片读取，转换为 `ImageRun` 插入 DOCX。
   - 尺寸和圆角样式复用 `computeAvatarStyle`。

4. **联系信息**
   - 按 `basicFields` + `customFields` 顺序渲染，使用 Emoji 图标替代无法直接嵌入的 SVG。

5. **模块覆盖**
   - 完整支持 `basic`、`education`、`experience`、`projects`、`skills`、`selfEvaluation`、`certificates`、`custom` 全部模块类型。

6. **错误处理**
   - 导出失败时通过 `Notice` 提示用户，并在控制台输出错误详情。

## 变更文件
- `src/export/docx.ts`（重写）
- `manifest.json`：版本 0.7.2 → 0.7.3
- `package.json`：版本 0.7.2 → 0.7.3
- `versions.json`：追加 0.7.3 条目
- `main.js`：重新构建产物

## 验证
- `npm run build` 通过，无 TypeScript 错误。

## 第二轮修复（2026-08-29）
- 修复 `twoCol` 模板左侧主题色边栏内文字颜色问题：
  - 为 `sectionHeading`、`bulletParagraph`、`entryTopParagraph`、`entrySubParagraph`、`entryDetailParagraphs`、`entryParagraphs`、`sectionParagraphs` 等渲染函数增加 `dark` 参数。
  - 左侧边栏的 `education` 模块以 `dark=true` 渲染，标题、机构名、时间、子标题、 bullet 点全部使用白色/浅灰色，确保在紫色背景上可读。

## 第三轮修复（2026-08-29）
- 修复字体不一致问题：
  - 将 `fontFamily` 替换为 `runFont`，解析 CSS font stack 的第一个字体，并以 `{ ascii, hAnsi, eastAsia }` 对象形式传入 `TextRun.font`。
  - 避免 Word 把整个逗号分隔字符串当成单个字体名；中文正文显式设置 `eastAsia` 字体，确保与预览一致。
- 修复联系信息图标显示问题：
  - 新增 `contactIconPng`（`src/ui/contact-icons.ts`），将 Lucide 风格 SVG 图标通过 canvas 渲染为 PNG。
  - DOCX 导出时把联系信息图标作为 `ImageRun` 嵌入，不再依赖系统 Emoji 字体；失败时回退到 Emoji。
- 版本号同步：0.7.3 → 0.7.4。

## 第四轮修复（2026-08-29）
- 修复导出后表格布局崩坏、页数变成 24 页的问题：
  - 根因：`docx` 库的 `ImageRun.transformation` 接收像素单位，库内部再乘以 9525 换算成 EMU；之前的代码错误地传入了 EMU（`pxToEmu`），导致图标/头像被渲染成十几万像素的巨图，撑破表格。
  - 修正 `avatarImageRun` 和 `iconImageRun`，直接传入像素值（`width: st.width, height: st.height` / `width: size, height: size`）。
- 版本号同步：0.7.4 → 0.7.5。

## 未执行项
- 未在真实 Obsidian 环境中进行端到端导出验证（需在测试 vault 中手动验证）。
- 证书作品模块目前以图片 URL 文字占位，未嵌入实际图片（docx 图片嵌入已预留，可待后续增强）。
