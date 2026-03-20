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
- When preparing a release, treat the release commit, the CI run for that commit on the branch, the tag-triggered publish run, the npm registry state, and the GitHub release as separate checkpoints.
- If a user asks to tag a release, assume they want the full release flow: tag, publish, verify, and create the GitHub release.
- Release notes are required for every tagged release.

## Required checks before tagging

1. Confirm the intended version with the user.
2. Verify `git status --short --branch` is clean.
3. Verify the release commit is pushed to the remote branch.
4. Verify recent CI on that commit is green, or run the relevant checks locally if needed.
5. Verify package metadata lines up:
   - package version matches the intended tag
   - local workspace dependencies reference the same version where needed
   - publish workflow targets the correct workspace/package
6. Verify the version does not already exist on npm.
7. Verify release notes exist or prepare them before tagging.

## Release flow

1. Bump package version and any internal workspace references.
2. Refresh lockfiles if needed.
3. Draft release notes before tagging so they can be reviewed and reused for the GitHub release.
4. Run the relevant local validation:
   - tests
   - build
   - `npm pack --dry-run` for npm packages
5. Commit the release bump and any last-minute fixes found during validation.
6. Push the branch.
7. Wait for CI on the pushed release commit itself, not just for local checks.
8. Create or move the tag only after the correct commit is on the remote and branch CI is green.
9. Push the tag.
10. Follow the tag-triggered publish job until it finishes.
11. Verify the published version from the registry.
12. Create the GitHub release from the prepared notes file, with:
   - a brief introduction to the project
   - the npm package link
   - the Cloudflare demo link when available

## Recommended release sequence

Use this exact order unless the repo has a documented alternative:

1. Prepare the version bump and release notes locally.
2. Run local validation and fix anything it surfaces before proceeding.
3. Commit the release prep.
4. Push `main` or the intended release branch.
5. Identify the exact pushed commit SHA with `git rev-parse HEAD`.
6. Watch the branch CI for that exact SHA and wait for green.
7. Create the version tag on that exact SHA.
8. Push the tag.
9. Watch the publish workflow for the tag.
10. Verify the new version is live on npm and that `latest` is correct when appropriate.
11. Create the GitHub release from the prepared notes.

Do not collapse these into one step mentally. A release is only complete after the package is published, verified, and the GitHub release exists.

## Alignment guard rails

- Tag must match the package version exactly.
- Never try to publish a version that already exists on npm.
- If a tag was pushed with the wrong package version, fix the package version first, commit, push, then recreate the tag on the corrected commit.
- If CI fails, pull the exact failing logs before changing anything.
- If a workflow publishes from a workspace, ensure the workflow runs `npm publish --workspace <package>`.
- If local validation finds a release-blocking issue, fix it and include the fix in the release-prep commit before tagging.
- Wait for full branch CI success before tagging, even if local tests and build already passed.
- Wait for the publish workflow triggered by the tag, not just the branch workflow.
- Verify the registry after publish before creating the GitHub release.
- Prefer `gh release create <tag> --title <title> --notes-file <file>` when release notes were prepared locally.
- Do not stop after publishing the package; the release is incomplete until the GitHub release exists.
- Do not tag if you do not yet have release notes.

## Suggested verification commands

```bash
git status --short --branch
git rev-parse HEAD
git ls-remote --tags origin
gh run list --limit 10 --json databaseId,headSha,status,conclusion,workflowName,displayTitle,event,headBranch
gh run watch <run-id> --exit-status
npm test
npm run build --workspace <workspace>
npm pack --workspace <workspace> --dry-run
npm view <package> version dist-tags --json
gh api repos/<owner>/<repo>/releases/tags/<tag>
gh release create <tag> --title "<title>" --notes-file <file>
```

## Notes on GH Actions checks

- For branch validation, match the workflow run to the exact pushed commit SHA.
- For tag validation, look for the publish workflow whose `headBranch` is the tag name.
- Branch CI success does not prove publish success; watch both separately.
- Warnings in successful runs do not necessarily block a release, but note operationally relevant warnings in the final report.

## Release note pattern

Default release notes can be brief:

- one sentence on what the project is
- one sentence on what changed in this release if relevant
- Cloudflare demo link
- npm package link

If the release spans many commits or materially changes behavior, prepare a longer diff-based release notes draft and use that file for the GitHub release body.
There is no tagged release flow without release notes.

## Stop conditions

Stop and ask the user before proceeding if:

- the target version is unclear
- the worktree is dirty with unrelated changes
- CI is red on the release commit
- the tag-triggered publish run fails
- npm ownership/scope permissions are failing
- the tag and package version do not match
- release notes are missing and cannot be prepared
