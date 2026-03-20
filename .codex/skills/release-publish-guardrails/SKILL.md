---
name: release-publish-guardrails
description: Use when the user asks to cut a release, tag a version, publish a package, or create a GitHub release. Enforces version confirmation, patch-first recommendations for small changes, clean git state, pushed commits, stable CI, tag/package alignment, and post-publish verification.
---

# Release Publish Guardrails

Use this skill for npm package releases, Git tags, and GitHub releases.

## Default behavior

- Confirm the target version with the user before tagging or publishing if it is not already explicit.
- Prefer a patch release for small fixes, metadata changes, docs-only changes that affect package presentation, or minor workflow updates.
- Do not publish if the working tree is dirty unless the user explicitly wants those changes included and they are committed first.
- Do not tag a commit that is not pushed.
- Do not assume CI is healthy. Check it.

## Required checks before tagging

1. Confirm the intended version with the user.
2. Verify `git status --short --branch` is clean.
3. Verify the release commit is pushed to the remote branch.
4. Verify recent CI on that commit is green, or run the relevant checks locally if needed.
5. Verify package metadata lines up:
   - package version matches the intended tag
   - local workspace dependencies reference the same version where needed
   - publish workflow targets the correct workspace/package

## Release flow

1. Bump package version and any internal workspace references.
2. Refresh lockfiles if needed.
3. Run the relevant local validation:
   - tests
   - build
   - `npm pack --dry-run` for npm packages
4. Commit the release bump.
5. Push the branch.
6. Create or move the tag only after the correct commit is on the remote.
7. Push the tag.
8. Follow the CI publish job until it finishes.
9. Verify the published version from the registry.
10. Create the GitHub release if requested, with:
   - a brief introduction to the project
   - the npm package link
   - the Cloudflare demo link when available

## Alignment guard rails

- Tag must match the package version exactly.
- Never try to publish a version that already exists on npm.
- If a tag was pushed with the wrong package version, fix the package version first, commit, push, then recreate the tag on the corrected commit.
- If CI fails, pull the exact failing logs before changing anything.
- If a workflow publishes from a workspace, ensure the workflow runs `npm publish --workspace <package>`.

## Suggested verification commands

```bash
git status --short --branch
git rev-parse HEAD
git ls-remote --tags origin
gh run list --limit 10
npm test
npm run build --workspace <workspace>
npm pack --workspace <workspace> --dry-run
npm view <package> version dist-tags --json
gh api repos/<owner>/<repo>/releases/tags/<tag>
```

## Release note pattern

Keep release notes brief:

- one sentence on what the project is
- one sentence on what changed in this release if relevant
- Cloudflare demo link
- npm package link

## Stop conditions

Stop and ask the user before proceeding if:

- the target version is unclear
- the worktree is dirty with unrelated changes
- CI is red on the release commit
- npm ownership/scope permissions are failing
- the tag and package version do not match
