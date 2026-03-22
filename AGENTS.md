# AGENTS.md

## Purpose

This repository is a small npm monorepo for Querylight TS:

- library package: `packages/querylight` (`@tryformation/querylight-ts`)
- browser demo: `apps/demo` (`@querylight/demo`)

The project is a pure TypeScript in-memory search toolkit with:

- BM25 / TF-IDF ranking
- bool, term, terms, exists, range, phrase, prefix, and multi-match queries
- aggregations and significant terms
- vector and geo search
- JSON-serializable index state
- highlight support
- beginner helpers via `createSimpleTextSearchIndex` and `simpleTextSearch`

## Routine commands

Install once:

```bash
npm install
```

Run the library test suite:

```bash
npm test
```

Build the published library package:

```bash
npm run build --workspace @tryformation/querylight-ts
```

Build everything:

```bash
npm run build
```

Run the demo locally:

```bash
npm run dev
```

Dry-run the npm package before releases:

```bash
npm pack --workspace @tryformation/querylight-ts --dry-run
```

## Important paths

- library entrypoint: `packages/querylight/src/index.ts`
- core query types: `packages/querylight/src/query.ts`
- document and field indexes: `packages/querylight/src/document-index.ts`
- shared public types/utilities: `packages/querylight/src/shared.ts`
- beginner helper API: `packages/querylight/src/simple-text-search.ts`
- browser demo: `apps/demo/src/main.ts`
- release notes draft for the latest release: `RELEASE_NOTES_0.9.2.md`
- release skill guidance: `.codex/skills/release-publish-guardrails/SKILL.md`

## Testing expectations

For library changes, at minimum run:

```bash
npm test
```

For release prep or any export/type-surface change, also run:

```bash
npm run build --workspace @tryformation/querylight-ts
npm pack --workspace @tryformation/querylight-ts --dry-run
```

The package uses `tsup` and DTS generation. A change can pass tests and still fail the type declaration build, so do not skip the package build for release prep.

## Release conventions

Tagging means doing a full release, not just pushing a tag.

Expected release flow:

1. bump package version in `packages/querylight/package.json`
2. update any internal version references, especially `apps/demo/package.json`
3. refresh `package-lock.json`
4. prepare release notes before tagging
5. run local validation:
   - `npm test`
   - `npm run build --workspace @tryformation/querylight-ts`
   - `npm pack --workspace @tryformation/querylight-ts --dry-run`
6. commit the release prep
7. push the branch
8. wait for CI on that exact pushed commit SHA
9. create and push the matching version tag
10. wait for the tag-triggered publish workflow
11. verify npm has the new version and the correct `latest` dist-tag
12. create the GitHub release from the prepared notes file

Release notes are required for every tagged release.

Useful commands:

```bash
git rev-parse HEAD
gh run list --limit 10 --json databaseId,headSha,status,conclusion,workflowName,displayTitle,event,headBranch
gh run watch <run-id> --exit-status
npm view @tryformation/querylight-ts version dist-tags --json
gh release create <tag> --title "<title>" --notes-file <file>
```

## Workflow notes

- CI workflow: `.github/workflows/ci-demo-deploy.yml`
- publish workflow: `.github/workflows/publish.yml`

The demo deploy workflow currently forces JavaScript actions onto Node 24 via:

```yaml
FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"
```

Keep third-party GitHub Actions current. If CI shows runtime deprecation warnings, inspect the workflow versions before changing application code.

## Editing guidance

- Preserve the public package name: `@tryformation/querylight-ts`
- Keep demo dependency versions aligned with the library package version
- Prefer adding tests when changing query semantics or exported APIs
- If changing docs and query behavior together, update both in the same work session
- For release-oriented work, check both local validation and GitHub Actions results

## Good search targets

Fast ways to orient in this repo:

```bash
rg --files
rg -n "simpleTextSearch|BoolQuery|MatchQuery|highlight|reciprocalRankFusion" packages/querylight/src packages/querylight/test docs
rg -n "uses:" .github/workflows
```
