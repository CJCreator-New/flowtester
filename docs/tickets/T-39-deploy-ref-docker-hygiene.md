# T-39: Generated workflow ref, Docker, repo hygiene

## Goal
The generated "In your GitHub repo" workflow runs today. The Docker build includes what the install needs. Local output is ignored.

## Gaps covered
Docs 1 (generated workflow pins tag `v0.1.0`, which does not exist; `workflow.ts:6`), Docs 10 (Dockerfile does not copy `fixtures/test-app/package.json`, `Dockerfile:9-14`), Docs 12 (`qa-report/` not ignored), Docs 13 (contributor commands are git-ignored with `.claude/`), Docs 20 (duplicate ignore lines; internal folders tracked: decision recorded for the human).

## In scope
- `packages/wizard/src/lib/workflow.ts`: `TOOL_REF` = `main` with a comment "tag v0.1.0 at release" (decision 2). Update the workflow template's comment.
- `packages/runner/Dockerfile`: copy `fixtures/test-app/package.json` before `pnpm install --frozen-lockfile`. Static check only; `docker build` is a human item.
- `.gitignore`: add `qa-report/`; remove duplicate `.vscode/` and `.review-shots/`.
- `CONTRIBUTING.md` and `CLAUDE.md`: state that `/check`, `/ship`, `/adr`, `/pr-ready` and `.claude/` are local-only, not part of a clone.
- Human-only, recorded in this ticket and not done by an agent: whether `.pipeline/`, `dev-pipeline/`, `agent-dashboard/` and root `PRODUCT_REVIEW.md` stay tracked.

## Acceptance criteria
- [ ] The generated workflow contains `ref: main` and no tag that does not exist.
- [ ] `git check-ignore qa-report/x` matches.
- [ ] The Dockerfile copies the fixture manifest before the install.

## Tests to update or add (written, not run)
- `packages/wizard/tests/` workflow template test: asserts the ref.
- A test that `.gitignore` covers `qa-report/`.

## Dependencies
None.

## Verification commands (deferred)
`pnpm exec vitest run packages/wizard/tests/workflow.test.ts`

## Status
todo
