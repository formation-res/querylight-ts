---
name: verify-demo-site
description: Verify the Hugo-based Querylight demo after changes. Use when the user asks to validate, check, or confirm that demo site changes are safe.
---

# Verify Demo Site

## Overview

Use this skill to confirm the Hugo demo still builds and the generated demo artifacts stay valid.

## Verification Checklist

1. Run:
   - `npm run check --workspace @querylight/demo`
2. If the task changed interactive runtime behavior, layout templates, or served assets, also run:
   - `npm run build --workspace @querylight/demo`
3. Only require browser verification when the task changed:
   - `apps/demo/src/**`
   - `apps/demo/layouts/**`
   - `apps/demo/src/styles.css`
   - `apps/demo/static/**`
4. For package export or type-surface changes that affect demo imports, also run:
   - `npm test`
   - `npm run build --workspace @tryformation/querylight-ts`

## Reporting

- State which commands you ran.
- Report whether Hugo built cleanly.
- Report whether generated docs and payload assets were refreshed successfully.
- Call out any browser verification you skipped and why.
