# FIGM Code Inspector — VS Code Extension

Official Visual Studio Code extension for the **Framework-Independent Guideline Model (FIGM)** AST static analysis engine.

---

## 🌟 Key Features

- **⚡ Live Real-time Diagnostics**: Red squiggly underlines and inline warnings as you type or save (uses fast client-side line heuristic mode for instant IDE responsiveness; full AST analysis runs via CLI/server engine).
- **🛡️ WCAG 2.2 & ISO 25010 Mapping**: Hover popups provide detailed explanations, severity ratings, and standards citations.
- **💡 Quick-Fix Code Actions**: Automated code patch transformations for React, Next.js, Angular, and Vue.
- **📊 Status Bar Integration**: Displays current file quality score and issue count in real time.
- **📂 Workspace Scanner**: Scan your entire repository with a single command.
- **⚙️ Extension Settings**: Configure ignored rules, scan triggers, and severity thresholds.

---

## 🚀 Commands Available (`Ctrl+Shift+P` / `Cmd+Shift+P`)

- `FIGM: Scan Current File` — Run static inspection on active editor.
- `FIGM: Scan Entire Workspace` — Scan all project source files.
- `FIGM: Apply Auto-Fixes to File` — Trigger quick-fix menu.
- `FIGM: Show Inspection Output Logs` — View extension output logs.

---

## ⚙️ Extension Settings

| Setting | Default | Description |
| :--- | :---: | :--- |
| `figm.enable` | `true` | Enable or disable FIGM live analysis. |
| `figm.scanOnSave` | `true` | Trigger AST inspection on file save. |
| `figm.scanOnType` | `true` | Trigger real-time analysis while typing (300ms debounce). |
| `figm.ignoreRules` | `[]` | Array of Rule IDs to ignore (e.g. `["FIGM-PERF-05"]`). |

---

## 📜 License
Published under the MIT License.
