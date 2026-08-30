# Resume Editor

Form-driven resume editor for Obsidian. Edit structured fields on the left, see a live preview on the right, and export to PDF / HTML / DOCX / LaTeX.

> 中文简历编辑器插件：左侧表单填写、右侧实时预览，内置多套中文向模板，一键导出 PDF / HTML / DOCX / LaTeX。完整中文说明见 [README.zh.md](./README.zh.md)。

## Features

- **Form-driven editing** — no custom Markdown syntax to learn. Fill in name, contact, education, work, projects, skills and more; the editor builds the resume for you.
- **Live preview** — updates instantly as you type.
- **12 templates** — Single column, Two columns, Academic, Classic, Timeline, Swiss, Modern, Minimalist, Left & right, Elegant, Creative, Editorial, all styled with A4-friendly typography.
- **Multi-format export** — PDF (via `html2pdf.js`), HTML, DOCX (`docx` library) and LaTeX, all generated fully on-device.
- **Native `.resume` file format** — each resume is a structured JSON file that Obsidian opens directly in the editor. Legacy `.md` resumes (with the `resume` frontmatter marker or config block) are still recognized and migrated automatically.
- **Per-resume style** — theme color (12-swatch palette), base font size, line height, section spacing, page padding, paragraph spacing, font family and a multi-page A4 boundary-line toggle. Stored inside each resume, so every file keeps its own look.
- **Flexible sections** — basic info, education, work experience, projects, skills, self-evaluation, certificates and custom modules; reorder, collapse and toggle visibility per section.
- **Avatar & custom contacts** — avatar with size / aspect-ratio / corner-radius options; extra contact fields (icon + label + value).
- **Auto save** — toggle in settings; when off, use the Save button.

## Install (BRAT)

1. Install the BRAT plugin, then add this repository as a beta plugin.
2. Enable **Resume Editor** in Settings → Community plugins.

## Usage

- Ribbon icon or command **Open Resume Editor** opens the dual-pane view in the right sidebar.
- Command **New resume** creates a `.resume` file. The default name is `新建简历.resume`; if the name already exists, it is automatically incremented to `新建简历 1.resume`, `新建简历 2.resume`, etc.
- Command **Mark current note as resume** converts the active note into a resume.
- Right-click a folder/file in the file explorer → **New resume** creates a resume inside that folder.
- Any `.resume` file opens directly in the editor when clicked.
- Edits are saved automatically (toggle **Auto save**) or via the **Save** button. If no file is active, the first save creates a new resume note.

### Export

Use the export button in the editor, or the commands: **Export resume as PDF / HTML / DOCX / LaTeX**. Exports are written next to the current note via Obsidian's vault API.

## Templates

The default template (Settings → Resume Editor → Default template) applies to new resumes; each saved resume stores its own `templateId`, so existing files keep their look.

| Template | Description |
| --- | --- |
| Single column | One full-width column, clean and safe. |
| Two columns | Left sidebar (avatar, contacts) + right content. |
| Academic | Top-aligned basic info, formal black typography. |
| Classic | Traditional single-column business look. |
| Timeline | Vertical timeline for dates/experience. |
| Swiss | Grid-based, minimalist with strong type. |
| Modern | Blue-accented, contemporary. |
| Minimalist | Lots of whitespace, top basic info. |
| Left & right | Photo + contacts on the left 30%. |
| Elegant | Warm brown accent, refined. |
| Creative | Pink accent, expressive layout. |
| Editorial | Teal accent, magazine-style. |

## Global style (per resume)

Open the **Global style** panel at the top of the editor's left column:

- **Theme color** — 12-swatch palette.
- **Font size** — 11–16 px.
- **Line height** — 1.2–2.0.
- **Section spacing** — 8–32 px.
- **Page padding** — 16–48 px.
- **Paragraph spacing** — 0–16 px.
- **Font family** — optional custom font stack.
- **Show A4 page lines** — when content exceeds one page, draw dashed A4 page boundaries and show the estimated total page count. Exports paginate naturally (no whole-page scaling).

Settings are stored in the note's config block, so each resume keeps its own appearance; old files fall back to defaults.

## Data & privacy

The plugin runs **fully offline**. It makes **no outbound network requests** — there is no AI/cloud feature, and your resume data never leaves your device. All files are stored in your vault and exported locally.

## Platform

**Desktop and mobile.** Requires Obsidian **1.11.4+**; the plugin sets `isDesktopOnly: false` and runs on phones and tablets.

All export formats are pure-frontend and use Obsidian's `vault.adapter` APIs — no Electron, `fs`, `path`, `os`, or `child_process`:

- **PDF** — `html2pdf.js` (`html2canvas` + `jsPDF`), written with `app.vault.adapter.writeBinary`.
- **DOCX** — `docx` library, written with `app.vault.adapter.writeBinary`.
- **HTML / LaTeX** — written with `app.vault.adapter.write`.

Mobile UI differences (compared to desktop):

- **Single-pane layout.** Edit and preview never show side-by-side. By default the **edit pane** is shown; a dedicated **toggle button** in the header switches between edit and preview.
- **A4 preview auto-fit.** The preview renders a fixed 794px-wide A4 sheet and scales it down to fit the screen width.
- **↑↓ sort buttons.** Drag handles are hidden on touch; each reorderable list gets up/down buttons instead.
- **PDF export resolution** is reduced on mobile (`scale: 1.5` instead of `2`) to lower memory use.

## Development

```bash
npm install
npm run dev      # watch build
npm run build    # type-check + production build
```

## License

MIT
