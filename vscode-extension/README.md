# FIGM Code Inspector — Lightweight Preview (VS Code Extension)

A lightweight, in-editor **preview** for a small subset of the Framework-Independent Guideline
Model (FIGM) rule catalog. This extension does **not** run FIGM's real AST-based analysis engine
and does **not** perform AI-assisted remediation — both of those live only in the FIGM web
application and CLI (`src/engine/rule-execution-engine.ts`, `src/cli/figm-analyze.ts`).

## Scope — read this before relying on it

This extension implements **5 of FIGM's 50 canonical rules**, detected with plain client-side
line-text pattern matching (substring/regex checks on raw source lines), not a real parser or AST:

| Rule ID | What it checks (heuristically) |
|---|---|
| `FIGM-REACT-02` | A `.map(...)` callback rendering with `key={index}` or `key={idx}` |
| `FIGM-PERF-05` | A `.map(...)` callback with an inline `onClick=` not wrapped in `useCallback` |
| `FIGM-PERF-02` | An `<img`/`<Image` tag with no `width=` or `aspectRatio` |
| `FIGM-A11Y-01` | A `<div onClick=...>` with no `onKeyDown` handler |
| `FIGM-PERF-04` | A top-of-file `import` statement in a file that also contains `if (`/`switch` |

No other rule in the 50-rule catalog is checked by this extension, for any framework. In
particular: no Angular-template, Vue-SFC, or Next.js-App-Router-specific rule runs here at all —
those require FIGM's real parsers (`angular-html-parser`, `@vue/compiler-sfc`) and only run in the
web app/CLI.

Because detection here is plain text matching rather than parsing real syntax, it can both
over-trigger (matching a superficially similar but actually-fine pattern) and under-trigger
(missing the same violation written in an equivalent but differently-formatted way) far more
readily than the real engine. Treat every diagnostic from this extension as a quick, approximate
hint to go run a real scan in the FIGM web app — not as an authoritative finding.

**"FIGM: Insert Remediation Comments"** does not apply an automated code fix. It opens VS Code's
Quick Fix menu, which — if you accept the suggested action — inserts a `// FIGM Remediation: ...`
advisory comment above the flagged line. It does not modify your code's logic, and it is not the
same thing as FIGM's real deterministic AST fixers or AI-assisted remediation (both web-app-only).

For the full 50-rule AST-based scan, deterministic fixes, and AI-assisted remediation, use the
FIGM web application's Live Scanner.

## Features

- **Live diagnostics** for the 5 rules above: inline squiggles as you type or save.
- **Hover details**: rule ID, domain, severity, and remediation guidance for any of the 5 rules.
- **Status bar**: shows a quality score computed only from what this extension itself detected —
  not FIGM's real quality score, since this extension never sees the other 45 rules.
- **Workspace scan**: runs the same 5-rule heuristic scan across every open-language file in the
  workspace.

## Commands (`Ctrl+Shift+P` / `Cmd+Shift+P`)

- `FIGM: Scan Current File`
- `FIGM: Scan Entire Workspace`
- `FIGM: Insert Remediation Comments` (opens Quick Fix — see the caveat above)
- `FIGM: Show Inspection Output Logs`

## Settings

| Setting | Default | Description |
| :--- | :---: | :--- |
| `figm.enable` | `true` | Enable or disable this extension's lightweight-preview scan. |
| `figm.scanOnSave` | `true` | Run the lightweight scan on file save. |
| `figm.scanOnType` | `true` | Run the lightweight scan while typing (300ms debounce). |
| `figm.ignoreRules` | `[]` | Rule IDs to ignore (e.g. `["FIGM-PERF-05"]`). |

## License

MIT.
