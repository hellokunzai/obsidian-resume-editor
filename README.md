# Resume Editor

Form-driven resume editor for Obsidian. Edit structured fields on the left, see a live preview on the right, and export to PDF / HTML / DOCX / LaTeX.

> 中文简历编辑器插件：左侧表单填写、右侧实时预览，内置多套中文向模板，一键导出 PDF / HTML / DOCX / LaTeX。

## Features

- **Form-driven editing** — no need to learn a custom Markdown syntax. Fill name, contact, education, work, projects and skills; data is stored as plain Markdown in the note body (no YAML frontmatter properties).
- **Live preview** — updates instantly as you type.
- **Chinese-first templates** — Single column / Two columns / Academic, styled with A4-friendly typography.
- **Multi-format export** — PDF (via Electron `printToPDF`), HTML, DOCX, LaTeX.
- **Resume directory** — point to a vault folder and every Markdown file inside it is automatically treated as a resume (no need for the `resume: true` frontmatter tag). Clicking any file in this folder automatically opens the resume editor; new resume notes are created here when no file is active.
- **ATS pre-check** — a light heuristic panel scores ATS-friendliness (text-copyable, no graphic separators, quantified results).
- **AI polish** (optional) — rewrite descriptions via an OpenAI-compatible API. See *Network usage* below.

## Install (BRAT)

1. Install the BRAT plugin, then add this repository as a beta plugin.
2. Enable **Resume Editor** in Settings → Community plugins.

## Usage

- Ribbon icon or command **Open Resume Editor** opens the dual-pane view (right sidebar).
- Command **New resume note** creates a Markdown resume in the configured Resume directory.
- Command **Mark current note as resume** marks the active note as a resume note.
- Clicking any Markdown file inside the configured **Resume directory** automatically opens the editor for that file.
- Edits are saved either automatically (toggle **Auto save** in settings) or manually via the **Save** button. If no file is active, the first save creates a new resume note in the Resume directory.

## Templates & settings

Settings → Resume Editor:

- Default template (single / two-column / academic)
- PDF paper size (A4 / Letter)
- Resume directory (vault-relative path; Markdown files in this folder are automatically treated as resumes; new resume notes are created here when set)
- Auto save toggle (on by default; when off, use the Save button)
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
