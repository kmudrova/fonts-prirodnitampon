# CLAUDE.md

## Project Overview

This is a **web font distribution package** containing the "Haboro Contrast Ext Thin" font by the insigne foundry, licensed through MyFonts. It is not a software project — it is a static asset repository for serving a custom web font.

## Repository Structure

```
fonts-prirodnitampon/
├── MyWebfontsKit.css   # @font-face declaration (font-family: "HaboroContrastExtThin")
├── font.woff2          # Modern compressed web font format
├── font.woff           # Standard web font format (older browser fallback)
└── CLAUDE.md           # This file
```

All files live at the repository root. There are no subdirectories, build tools, or dependencies.

## Font Details

- **Font name:** Haboro Contrast Ext Thin
- **CSS font-family:** `"HaboroContrastExtThin"`
- **Foundry:** insigne
- **License:** MyFonts End User License Agreement (proprietary)
- **MyFonts Build ID:** 3867246

## How the Font Is Used

The CSS file declares a `@font-face` rule that references the font files at `webFonts/HaboroContrastExtThin/font.woff2` and `webFonts/HaboroContrastExtThin/font.woff`. Consuming projects should either:

1. Adjust the `src` URLs in `MyWebfontsKit.css` to match the actual deployment path of `font.woff` and `font.woff2`, or
2. Place the font files at the path the CSS expects (`webFonts/HaboroContrastExtThin/`).

## Development Notes

- **No build system** — there is nothing to build, compile, or transpile.
- **No tests** — static font files have no test suite.
- **No linting/formatting** — no code to lint.
- **No dependencies** — no `package.json` or similar manifest.
- **No CI/CD** — no automated pipelines.

## Key Conventions

- Font files are binary assets — do not modify them directly.
- The CSS file contains a license header that must be preserved.
- Any changes to font file paths require updating the `src` URLs in `MyWebfontsKit.css`.
- The font is proprietary; usage must comply with the MyFonts EULA.

## Common Tasks

| Task | How |
|------|-----|
| Use the font in a project | Include `MyWebfontsKit.css` and ensure font files are accessible at the referenced paths |
| Update the font | Replace `font.woff` and `font.woff2` with new files from MyFonts, preserve the CSS license header |
| Change serving paths | Edit the `src` URLs in the `@font-face` block in `MyWebfontsKit.css` |
