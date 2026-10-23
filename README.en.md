# Resume Editor

> A **form-driven** resume editor for Obsidian, with Chinese-friendly templates, live preview, and export to **PDF / HTML / DOCX / LaTeX**.

[简体中文](./README.md)

![version](https://img.shields.io/badge/version-0.11.1-blue)
![Obsidian](https://img.shields.io/badge/Obsidian-1.11.4%2B-purple)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-desktop%20%2F%20mobile-lightgrey)

---

## Features

- **Form-driven editor**: a structured form on the left (add/remove entries, drag to reorder, hide modules) with a live preview on the right — what you see is what you get.
- **12 templates**: Single column, Two columns, Academic, Classic, Timeline, Swiss, Modern, Minimalist, Left & right, Elegant, Creative, Editorial — config-driven and switchable with one click.
- **Per-resume global styling**: each resume can override theme color, base font size, line height, section spacing, and page padding; the avatar supports size, aspect ratio, and corner radius.
- **Four export formats**: PDF (auto pagination, A4 or Letter), HTML, DOCX, and LaTeX, with a progress indicator during export.
- **Native `.resume` files**: opens natively like `.md` — double-click to enter the editor view; auto-save supported.
- **Backward compatibility**: legacy `.md` resumes marked with frontmatter are still recognized and migrated to the `.resume` format on save.
- **Internationalization**: the UI follows Obsidian's display language (Simplified Chinese / English); all strings are resolved through a single `t()` function.
- **A4 page preview**: when content exceeds one page, dashed A4 page boundaries and an estimated page count are shown to help you control the layout.

---

## Installation

### Option 1: Via BRAT (recommended for updates)

1. Install the **BRAT** plugin from the Obsidian community plugin store.
2. Open BRAT settings → `Add a beta plugin`, and enter:
   ```
   https://github.com/hellokunzai/obsidian-resume-editor
   ```
3. Enable **Resume Editor** in the community plugins list.

### Option 2: Manual install

1. Download the latest release from [Releases](https://github.com/hellokunzai/obsidian-resume-editor/releases), and extract `main.js`, `manifest.json`, and `styles.css`.
2. Place these three files into your vault's `.obsidian/plugins/resume-editor/` directory (create it if it does not exist).
3. Enable **Resume Editor** under Settings → Community plugins.

> The build artifact must be copied into the vault's plugin directory; the `main.js` in the repo is the bundled output.

---

## Usage

### Commands

Open the command palette (`Ctrl/Cmd + P`) and run:

| Command ID | Name | Description |
| --- | --- | --- |
| `open-editor` | Open Resume Editor | Open the resume editor view in the right sidebar |
| `new-resume-note` | New resume | Create a new `.resume` file in the current/specified folder |
| `mark-resume` | Mark current note as resume | Mark the currently open note as a resume file |
| `export-pdf` | Export resume as PDF | Export a paginated PDF |
| `export-html` | Export resume as HTML | Export a self-contained HTML file |
| `export-docx` | Export resume as DOCX | Export a Word document |
| `export-latex` | Export resume as LaTeX | Export LaTeX source |

> Right-click **any folder** in the file explorer to reveal a "New resume" menu item for quickly creating a resume inside that folder.

### Settings

Plugin settings (Settings → Community plugins → Resume Editor):

- **Default template**: the template applied to new resumes; saved resumes use their own stored template.
- **PDF paper size**: A4 or Letter.
- **Auto save**: automatically save changes after you stop typing.
- **Default display mode**: whether to open a resume in Edit / Edit + preview / Preview mode.

### File format

Resumes use the `.resume` extension; the file content is structured **JSON** (the `ResumeData` object). Obsidian opens it natively in the same tab as `.md`. A newly created file looks like:

```json
{
  "name": "Jane Doe",
  "role": "Frontend Engineer",
  "templateId": "single",
  "globalSettings": { "themeColor": "#7c5cff", "baseFontSize": 14, "lineHeight": 1.6 },
  "education": [ { "school": "Some University", "major": "Computer Science", "degree": "Bachelor" } ],
  "experience": [ { "company": "Some Company", "position": "Engineer", "details": ["Responsible for..."] } ]
}
```

Legacy `.md` files marked with frontmatter (or placed under a resume folder) are still readable and are automatically migrated to the `.resume` format on save.

---

## Templates

All templates are registered as configuration in `src/render/templates/registry.ts`. Adding a new template is just one registry entry plus a CSS block — no changes to other rendering logic are needed.

| ID | Name | Basic-info layout |
| --- | --- | --- |
| `single` | Single column | Avatar left |
| `twoCol` | Two columns | Avatar left |
| `academic` | Academic | Avatar top |
| `classic` | Classic | Avatar left |
| `timeline` | Timeline | Avatar left |
| `swiss` | Swiss | Avatar left |
| `modern` | Modern | Avatar left |
| `minimalist` | Minimalist | Avatar top |
| `leftRight` | Left & right | Avatar left |
| `elegant` | Elegant | Avatar top |
| `creative` | Creative | Avatar left |
| `editorial` | Editorial | Avatar left |

Each resume can switch templates independently and override global styles (theme color, font size, line height, section spacing, page padding, etc.).

---

## Export

Click the corresponding button in the editor toolbar, or run an export command from the palette:

- **PDF**: auto-paginates based on the selected paper size (A4/Letter) and exports a styled PDF.
- **HTML**: exports a self-contained single-file HTML, convenient for sharing or further editing.
- **DOCX**: exports a Word document that preserves structure and styling.
- **LaTeX**: exports LaTeX source, suitable for academic submissions.

A progress indicator is shown during export (preparing → rendering layout → encoding pages → writing file).

---

## Internationalization

All UI strings are resolved through the `t()` function in `src/i18n/index.ts`. Built-in translations cover **Simplified Chinese (`zh-cn`)** and **English (`en`)**, and switch automatically with Obsidian's display language. Adding a language is as simple as adding a corresponding field set to the `translations` object.

---

## Development

The plugin is built with TypeScript + esbuild. `main.js` is bundled by esbuild (CJS format, with `obsidian`, `electron`, `@codemirror/*`, etc. marked external).

```bash
# Install dependencies
npm install

# Dev mode (watch and rebuild on change)
npm run dev

# Production build (type-check then bundle → main.js)
npm run build
```

Source layout:

```
src/
├── main.ts                  # Entry: lifecycle, commands, view, .resume extension registration
├── settings/SettingsTab.ts  # Settings tab
├── data/resume-model.ts     # Data model, .resume read/write, migration
├── i18n/index.ts            # Internationalization
├── views/ResumeEditorView.ts# Two-pane editor view (form left / preview right)
├── render/
│   ├── template.ts          # Template engine (data → DOM / export HTML)
│   └── templates/registry.ts# Template config registry
├── export/                  # PDF / HTML / DOCX / LaTeX export implementations
├── ui/                      # Icons, contact icons
└── utils/                   # File name, auto one-page, async helpers, etc.
```

---

## License

[MIT](./LICENSE) © hellokunzai
