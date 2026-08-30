# Resume Editor

Form-driven resume editor for Obsidian. Edit structured fields on the left, see a live preview on the right, and export to PDF / HTML / DOCX / LaTeX.

> 中文简历编辑器插件：左侧表单填写、右侧实时预览，内置多套中文向模板，一键导出 PDF / HTML / DOCX / LaTeX。

## Features

- **Form-driven editing** — no need to learn a custom Markdown syntax. Fill name, contact, education, work, projects and skills; data is stored as plain Markdown in the note body (no YAML frontmatter properties).
- **Live preview** — updates instantly as you type.
- **Chinese-first templates** — Single column / Two columns / Academic / Classic / Timeline / Swiss, styled with A4-friendly typography.
- **Multi-format export** — PDF (via Electron `printToPDF`), HTML, DOCX, LaTeX.
- **Resume directory** — point to a vault folder and every Markdown file inside it is automatically treated as a resume (no need for the `resume: true` frontmatter tag). Clicking any file in this folder automatically opens the resume editor; new resume notes are created here when no file is active.
- **ATS pre-check** — a light heuristic panel scores ATS-friendliness (text-copyable, no graphic separators, quantified results).
- **Global style panel** — theme color (12-swatch palette), base font size, line height, section spacing and page padding, driven by CSS variables so preview and exports stay in sync. Stored per resume in the note's config block; old notes fall back to defaults.
- **Auto fit one page** — when content exceeds one page, the resume is scaled down automatically (down to 90%) in both preview and PDF export, with a status hint below the preview.
- **AI polish** (optional) — rewrite descriptions via an OpenAI-compatible API, with quick presets for OpenAI / DeepSeek / Doubao (Ark). See *Network usage* below.
- **AI resume review** (optional) — sends the whole resume to an OpenAI-compatible API and lists concrete issues (missing quantified results, weak verbs, redundancy, ATS-unfriendly wording). Clicking an issue jumps to and highlights the corresponding form field.

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

- Default template (single / two-column / academic / classic / timeline / swiss)
- PDF paper size (A4 / Letter)
- Resume directory (vault-relative path; Markdown files in this folder are automatically treated as resumes; new resume notes are created here when set)
- Auto save toggle (on by default; when off, use the Save button)
- AI provider preset (Custom / OpenAI / DeepSeek / Doubao), plus endpoint, key and model

Per-resume settings live in the **Global style** panel at the top of the editor's left column: theme color (12-swatch palette), base font size, line height, section spacing, page padding, and the **Auto fit one page** toggle. They are stored inside the note's config block, so each resume keeps its own look — old notes without these fields fall back to defaults.

## Network usage

The **AI polish** and **AI resume review** features send the resume text to a user-configured HTTP endpoint (default: OpenAI-compatible `chat/completions`). This requires network access and a valid API key, and is **disabled by default**. No data leaves your machine unless you enable it and provide credentials.

## Platform

**Desktop and mobile.** Since v0.8.0 the plugin sets `isDesktopOnly: false` and runs on phones and tablets (detected via `Platform.isMobile`, covering both phone and tablet).

All export formats are pure-frontend and use Obsidian's `vault.adapter` APIs — no Electron, `fs`, `path`, `os`, or `child_process`:

- **PDF** — `html2pdf.js` (`html2canvas` + `jsPDF`), written with `app.vault.adapter.writeBinary`.
- **DOCX** — `docx` library, written with `app.vault.adapter.writeBinary`.
- **HTML / LaTeX** — written with `app.vault.adapter.write`.

Mobile UI differences (compared to desktop):

- **Single-pane layout.** Edit and preview never show side-by-side. By default the **edit pane** is shown; a dedicated **toggle button** in the header switches between edit and preview.
- **A4 preview auto-fit.** The preview renders a fixed 794px-wide A4 sheet and scales it down to fit the screen width (with blank-space compensation), so it looks like a real A4 page.
- **↑↓ sort buttons.** Drag-to-reorder handles are hidden on touch; each reorderable list (modules, basic fields, entries, certificates) gets up/down buttons instead.
- **PDF export resolution** is reduced on mobile (`scale: 1.5` instead of `2`) to lower memory use.

Notes:

- AI polish / AI review still require a network endpoint and API key, and stay **disabled by default** (same as desktop).
- Image-heavy resumes may render the PDF preview/capture a bit slower on mobile due to `html2canvas`.

## Development

```bash
npm install
npm run dev      # watch build
npm run build    # type-check + production build
```

## License

MIT
