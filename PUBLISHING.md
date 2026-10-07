# Publication and source synchronization

Canonical app: https://house-of-ideas.nutmeg-ibex-4408.chatgpt.site (owner-private).

GitHub source: https://github.com/hadi1373z/house-of-ideas.

Public project introduction: https://hadi1373z.github.io/house-of-ideas/.

## Preserve the two publishing roles

Sites remains the canonical source and hosts the complete authenticated app with D1 storage. GitHub stores clean source snapshots. GitHub Pages serves only `docs/`, through `.github/workflows/pages.yml`; its publishing source is GitHub Actions. `.github/workflows/verify.yml` runs the existing tests and build on pushes and pull requests. These workflows do not create AI improvements.

The existing hourly task reads `IMPROVEMENT.md` and `improvement-state.json`. It was paused when GitHub setup completed on 7 October 2026. Preserve that status unless the owner asks to resume it. No hosted GitHub write path has been verified; a local manual push does not establish scheduled access.

## Mirror a successful source update

1. Recover the same Site through the Sites workflow. Read the improvement records and reconcile any pending deployment. Run the required checks, publish the candidate normally, and confirm its successful deployment. Retain that exact Sites source commit.
2. Confirm GitHub access in the current execution environment. Use the connected GitHub operations or existing Git authentication without placing credentials in files, arguments, exports, or commits. If write access is unavailable, record it once and stop synchronization.
3. Fetch GitHub `main` into a separate clean checkout. Retain its head before touching files. An acknowledged snapshot commit carries a `Sites-Source-Commit: <full SHA>` trailer. Compare its complete source tree to that known canonical commit. If the trailer is absent, the commit is unavailable, or the tree differs, treat the remote as independently edited and stop for reconciliation. Do not overwrite GitHub changes merely because they were fetched successfully.
4. Export the verified canonical commit using `git archive`. Copy only that tracked snapshot into the separate checkout, preserving `.git`. Never export Git configuration, credentials, `.env`, database contents, saved ideas, dependency directories, build output, scratch files, or deployment archives. Remove obsolete tracked source files only within this confirmed checkout after verifying their paths; do not remove unrelated untracked work.
5. Create an ordinary commit on the retained GitHub head with the exact `Sites-Source-Commit` trailer. Skip a no-op. Push normally without force. If another writer changes `main`, stop and reconcile; do not retry by replacing their work. For GitHub API writes, use a commit whose parent is the retained head and an expected-head lease when updating the branch ref.
6. Read back GitHub `main` and confirm the pushed commit and tracked tree. Check the verification workflow and, when `docs/` changed, the Pages deployment and its returned URL. Record the canonical commit, GitHub commit, actual checks, and any limitation in the run result. Reconcile the record on the next run instead of creating an extra deployment only to copy a commit or deployment ID into itself.

Never force-push, mirror Git refs, copy the Sites Git history, or assume a successful source upload means hourly synchronization is active. A repository edit should be reconciled into the canonical source before the next mirror.

## Manual Pages recovery

If a Pages job fails because setup is missing, confirm that the repository's Pages publishing source is **GitHub Actions**, then dispatch **Publish project page** on `main`. Verify terminal job success and the actual published URL before marking publication complete. Preserve the app's private audience.
