# House of Ideas: improvement procedure

## Goal and limits

Make Hadi's existing House of Ideas a usable playground for mathematical and artistic exploration. Preserve its six themed rooms, editable architecture, 3D idea objects, joystick, and dollhouse mode. The useful loop is: change something, observe, save a discovery, revisit it.

The owner requested an hourly improvement task on 7 October 2026 (Europe/Prague). A run is an opportunity for a useful change, not a requirement to produce a diff. Do not restart the project, continually restyle it, invent usage statistics, or claim that the model itself learns. Improvement comes from saved evidence and user feedback.

## Recover the project independently

1. Use the Sites building and hosting skills. Reopen the same linked Site with `get_site`; confirm its role, audience, current version, and active deployments. Its canonical ID is in `.openai/hosting.json`.
2. Obtain a fresh repository credential through the supported Sites action when needed. Open the source with the Sites workflow in a fresh checkout if no valid checkout exists. Never rely on this setup chat, a prior local path, a cached token, or an open browser.
3. Read this file, `improvement-state.json`, current source and relevant test results. Reconcile any prior pushed commit or deployment before beginning new work. Source branch history and saved Site versions are authoritative.
4. This task updates application source and project records through Sites. It does not need to read or edit Hadi's saved house documents. The runtime `/api/house` requires a signed-in visitor; a Site service token does not supply that identity. Do not weaken authentication, impersonate a user, or insert test records into their live house. Use isolated fixtures for storage tests.

## One bounded cycle

1. Prefer user feedback and reproducible defects, then unfinished acceptance criteria, then the small ordered backlog. Only one item may be active. Write one observable pass condition before editing and keep it fixed for the run.
2. Choose work small enough to implement and check in about 30 minutes. Reserve time to verify and save. Break larger work into independently useful changes. Finish, revert, or record a blocker before the next run.
3. Preserve the current architecture, privacy, dependencies, and user data. No new paid services, external API usage, accounts, sharing changes, destructive migrations, or broad rewrites under this schedule.
4. Run `npm test` and `npm run build`, plus the smallest targeted check needed for the changed behaviour. Existing tests exercise domain validation, navigation geometry, durable save/reload, optimistic conflicts, user isolation, and UI actions. They do not prove rendering, GPU behaviour, touch usability, or live persistence. Use available supported browser QA when changing a visible interaction; if it is unavailable, record the limitation and choose a change that can be adequately checked.
5. Keep evidence: selected item, pass condition, checks actually run, result, limitations, next action. Review against the criterion separately from implementation; an independent reviewer may inspect the diff without operating the Site. Never mark a criterion passed from a self-rating alone.
6. Publish only a candidate that passes its applicable checks. Use the normal Sites workflow, push exact source, save and deploy, then check terminal deployment status. Keep the existing audience. No need to publish a no-op. If the candidate fails before publication, keep production unchanged. If a confirmed regression reaches production, restore a verified prior version through the supported deployment flow and preserve the failed attempt's evidence.
7. Update `improvement-state.json` in the same source commit. Record deployment outcome in the task result; on the next run reconcile it from Sites before marking it successful. Do not make an extra deployment just to copy a deployment ID into a file. Read the pushed record through source recovery to verify writeback when the path changes.

## Prevent loops and competing runs

- After two failed attempts at an item, mark it blocked with the concrete reason; do not retry until a prerequisite changes. Continue a different independent item if useful. Report an access or product decision blocker once and wait for a change rather than repeatedly reporting it.
- At the start, inspect recent source changes and any in-progress deployment. If another run is active, make no changes. Before pushing, check the remote base; on a concurrent change, stop/rebase and revalidate as appropriate. Never force-push or overwrite another run's work. This is conservative conflict handling, not a claim of an atomic distributed lock.
- Do not change scope, loosen acceptance criteria, remove meaningful tests, or weaken these limits to make an attempt pass. User instructions may change the scope. A blocked run may make no change.
- Once the current milestone passes, select the next already-scoped milestone. When the finite backlog is exhausted, fix only evidence-backed defects or user-requested work; otherwise make no change. New expansion ideas go to the backlog for review, not directly into production.

## Initial milestones

M1: A dependable house. Verify launch, both navigation modes, create/edit/move/open an idea, persistence after reload, and preservation of existing ideas during floor-plan changes. Fix concrete defects. Existing Node checks cover much of this, but rendered browser checks remain to be established.

M2: One interactive workbench. The proposed first experiment is a small Vertigo board: place/remove turn markers, start/pause/step/reset, inspect the route and turn count, and preserve an arrangement with a note. Confirm exact mathematical rules from a current user-provided specification before using research claims or implementing an uncertain variant. Keep this one experiment bounded; do not start graph and art studios simultaneously. A route-to-colour view is a later optional idea.

Report meaningful completed improvements and specific blockers concisely, with what was verified and a Site link. Do not send an hourly reminder telling Hadi to do the work. No-change runs need no announcement. Use the run record for cumulative context.

## GitHub synchronization

The requested repository and Pages introduction now exist. Read `PUBLISHING.md` after each successful Sites publication. The existing task prompt already reads this procedure; no duplicate task is needed. Preserve its enabled or paused status unless Hadi requests a change.

Only synchronize source that has passed its checks and has a successful Sites deployment. Export tracked files from that exact source commit; exclude credentials, working directories, build dependencies, and saved house data. Confirm authorized GitHub writes in the current executor rather than assuming credentials from another chat or computer are available. If access is missing, record the blocker once and leave GitHub unchanged; continue independent useful work within the existing scope.

Before replacing a GitHub snapshot, confirm that its current head is the last acknowledged mirror of a known Sites source commit. Stop on human edits, missing provenance, or a concurrent change. Preserve GitHub history with ordinary commits and non-forced pushes, then read back the resulting commit and check the applicable Actions runs. Record verified outcomes and unresolved access separately; a successful one-time upload is not proof that hourly synchronization is running.
