# Publication and source synchronization

Canonical saved app: [House of Ideas on Sites](https://house-of-ideas.nutmeg-ibex-4408.chatgpt.site), owner-private.

GitHub source: [hadi1373z/house-of-ideas](https://github.com/hadi1373z/house-of-ideas).

Public interactive preview: [House of Ideas on Pages](https://hadi1373z.github.io/house-of-ideas/).

## Publishing roles

Sites remains canonical and hosts the authenticated Worker with D1 house documents, learning history and pending review queues. GitHub stores clean source snapshots. GitHub Pages serves an in-memory browser preview; changes reset on reload and do not access private saved data.

`.github/workflows/pages.yml` runs `scripts/build-pages.mjs` and publishes `dist/pages`. It watches `web/**`, `docs/**`, the Pages build script, package files and its own workflow on `main`, and also supports manual dispatch. `web/` is the interactive preview source; The private app's `/project/` redirects to the saved house. Pages uses GitHub Actions as its publishing source. `.github/workflows/verify.yml` runs `npm ci`, `npm test` and the Worker build. Neither workflow generates improvements or uses a paid AI API.

The daily Socrates task prepares pending room and learning exercises through the private service described in `NIGHTLY.md`. It does not publish source or synchronize GitHub. The separate hourly task reads `IMPROVEMENT.md` and `improvement-state.json`; preserve its paused status unless the owner explicitly requests resumption. A local manual push does not verify GitHub writes in a scheduled executor.

## Mirror a successful source update

1. Reopen the same Site through the supported Sites workflow. Reconcile pending source or deployments, run the applicable checks and both builds, publish normally, and confirm terminal deployment success. Retain the exact verified canonical source commit.
2. Verify authorized GitHub writes in the current execution environment using available connected operations or existing Git authentication. Keep credentials out of files, arguments, exports and commits. If access is unavailable, record the limitation and leave GitHub unchanged.
3. Fetch GitHub `main` into a separate clean checkout and retain its head. An acknowledged mirror commit carries `Sites-Source-Commit: <full SHA>`. Compare its complete source tree with that known canonical commit. Stop for reconciliation if provenance is absent, the canonical commit is unavailable, the tree differs, or another writer has changed the branch. Successful fetching does not authorize overwriting edits.
4. Export the exact tested and deployed canonical commit with `git archive`. Copy only tracked source into the separate checkout, preserving `.git`. Exclude credentials, Git configuration, `.env`, database contents, saved ideas, dependencies, build output, scratch files and deployment archives. Remove obsolete tracked source only inside the confirmed checkout after validating target paths; preserve unrelated untracked work.
5. Create an ordinary commit on the retained GitHub head with the exact `Sites-Source-Commit` trailer; skip a no-op. Push normally without force. Stop and reconcile concurrent changes. API writes must use the retained parent commit and an expected-head lease for the branch update.
6. Read back GitHub `main` and confirm the pushed commit and tracked tree. Check verification Actions and the Pages deployment when any watched preview source changed. Verify the actual published URL. Record source and mirror commits, checks actually completed and remaining limitations. Reconcile publication evidence on the next run instead of making an extra deployment just to write its own identifier into source.

Never force-push, mirror refs, copy Sites Git history, or equate one successful upload with automatic synchronization. Reconcile independent repository edits into canonical source before the next mirror.

## Pages recovery

If setup is missing, confirm the repository's Pages publishing source is **GitHub Actions**, then dispatch **Publish project page** on `main`. Require terminal job success and verify the deployed interactive preview before reporting publication complete. Preserve the saved app's private audience.
