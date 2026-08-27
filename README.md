# Resume Editor

Form-driven resume editor for Obsidian. Edit structured fields on the left, see a live preview on the right, and export to PDF / HTML / DOCX / LaTeX.

> 中文简历编辑器插件：左侧表单填写、右侧实时预览，内置多套中文向模板，一键导出 PDF / HTML / DOCX / LaTeX。

## Features

- **Form-driven editing** — no need to learn a custom Markdown syntax. Fill name, contact, education, work, projects and skills; data is stored in the note's frontmatter.
- **Live preview** — updates instantly as you type.
- **Chinese-first templates** — Single column / Two columns / Academic, styled with A4-friendly typography.
- **Multi-format export** — PDF (via Electron `printToPDF`), HTML, DOCX, LaTeX.
- **ATS pre-check** — a light heuristic panel scores ATS-friendliness (text-copyable, no graphic separators, quantified results).
- **AI polish** (optional) — rewrite descriptions via an OpenAI-compatible API. See *Network usage* below.

## Install (BRAT)

1. Install the BRAT plugin, then add this repository as a beta plugin.
2. Enable **Resume Editor** in Settings → Community plugins.

## Usage

- Ribbon icon or command **Open Resume Editor** opens the dual-pane view (right sidebar).
- Command **New resume note** creates a note marked with `resume: true`.
- Command **Mark current note as resume** marks the active note as a resume note.
- Edits auto-save back to the note's frontmatter (plain text, diff-friendly, vault-native).

## Templates & settings

Settings → Resume Editor:

- Default template (single / two-column / academic)
- PDF paper size (A4 / Letter)
- AI polish endpoint, key, model

## Network usage

The **AI polish** feature sends the resume text to a user-configured HTTP endpoint (default: OpenAI-compatible `chat/completions`). This requires network access and a valid API key, and is **disabled by default**. No data leaves your machine unless you enable it and provide credentials.

## Platform

**Desktop only.** PDF/DOCX/LaTeX export depend on Electron (`printToPDF` and file writing), so the plugin sets `isDesktopOnly: true` and does not run on mobile.

## Development

```bash
npm install
npm run dev      # watch build
npm run build    # type-check + production build
```

## License

MIT
