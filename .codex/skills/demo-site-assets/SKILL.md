---
name: demo-site-assets
description: Keep Hugo demo assets organized when adding screenshots, logos, and other static files for the Querylight demo site.
---

# Demo Site Assets

Use this skill when adding or replacing static assets for the Hugo demo.

## Canonical Structure

- `apps/demo/static/` for copied public assets
- `apps/demo/static/data/` for generated JSON payloads only
- `apps/demo/static/js/` for generated browser bundles only
- `apps/demo/content/docs/` for generated Hugo documentation content only

## Workflow

1. Prefer source-controlled authoring assets outside generated folders.
2. Keep generated outputs separated from hand-authored files.
3. If an asset path changes, update the Hugo templates or browser code in the same change.
4. Run:
   - `npm run check --workspace @querylight/demo`

## Guardrails

- Do not hand-edit generated files under `apps/demo/content/docs/`, `apps/demo/static/data/`, or `apps/demo/static/js/`.
- Do not mix permanent authored assets into generated output folders.
- Keep demo asset paths stable unless a migration requires a path change.
