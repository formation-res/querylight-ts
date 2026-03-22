---
name: api-style-guardrails
description: Use when adding or changing Querylight TS public APIs so exported TypeScript surfaces use value-object params instead of positional multi-argument signatures, and every exported public API declaration has concise TSDoc.
---

# API Style Guardrails

Use this skill whenever a task adds, removes, renames, or changes exported APIs in `packages/querylight/src`.

## Default stance

- Public TypeScript APIs should prefer a single params object over positional multi-argument signatures.
- Treat this as the default for constructors, functions, and helpers when there is more than one meaningful input.
- Exported declarations must have concise TSDoc.
- Keep comments declaration-focused. Explain what the API is for, not how obvious syntax works.

## Public API shape

- Prefer:
  - `new MatchQuery({ field, text, operation, boost })`
  - `createThing({ documents, fields, ranking })`
- Avoid new positional APIs like:
  - `new MatchQuery(field, text, operation, boost)`
  - `createThing(documents, fields, ranking)`
- For one required scalar input, a direct scalar can still be acceptable if it is clearly better than an object. Use judgment, but bias toward the object style for consistency.
- When a params object grows nested options, keep nesting only where it improves readability:
  - grouped range bounds
  - grouped tuning/config blocks
  - grouped callback/options bags

## Naming rules

- Use explicit keys such as `field`, `fields`, `text`, `query`, `queries`, `boost`, `operation`, `prefixMatch`, `options`, `origin`, `pivot`, `vector`.
- Avoid vague parameter names like `value`, `arg`, `input`, or `params` unless they are genuinely the clearest name.
- If adding a public query or helper, also export its params type when that improves discoverability in editors.

## TSDoc rules

- Add TSDoc to every exported top-level declaration in the changed surface:
  - `class`
  - `function`
  - `interface`
  - `type`
  - `enum`
  - exported `const` helpers
- Keep it short:
  - one sentence is usually enough
  - two short sentences if needed for an important constraint
- Prefer:
  - what it represents
  - what it does
  - what it is used for
- Mention critical constraints only when omission would cause misuse.
- Do not add noisy member-by-member comments unless the member is non-obvious or externally important.

## Required workflow for API changes

1. Inspect existing exported declarations in the touched module.
2. Update the API to object-style params if the change introduces or modifies multi-input public entrypoints.
3. Add or refresh TSDoc on all exported declarations in the touched public surface, not only the newly added symbol.
4. Update tests, docs, and examples in the same work session.
5. Run at least:
   - `npm test`
   - `npm run build --workspace @tryformation/querylight-ts`

## Review checklist

- No new exported positional multi-argument API slipped in.
- New public params objects use explicit, DSL-friendly field names.
- Exported declarations in changed public modules have TSDoc.
- Docs and samples reflect the object-style API.
- DTS build still passes.
