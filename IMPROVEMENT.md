# Improve the offline House of Ideas

The current goal is a durable local house shared with a persistent Socrates character: walk, investigate ideas, converse, reflect, and approve useful physical improvements.

GitHub is canonical for this edition. The older private Sites app and its schedules are separate. This procedure describes manual, owner-requested source work; it does not resume the paused hourly task, schedule new work or authorize cloud deployment.

## One reviewable change

1. Read the current request, repository history, `improvement-state.json` and any owner-provided game improvement brief. Prefer a reproducible defect or a specific request over speculative expansion.
2. Choose one observable outcome. Preserve existing house documents and use isolated fixtures or temporary `HOUSE_DATA_DIR` folders. Personal saved houses and conversation exports do not belong in commits.
3. Keep the local runtime dependency free. Preserve room/idea validation, stale-save protection, resident memory, approved furnishings and the daily journal. Pending or declined proposals must not change furniture or ideas; the daily book additionally requires next-day confirmation.
4. Run appropriate checks and `npm test`. Use browser verification for movement, presence, conversation or furniture changes. Check a packaged restart when launch/persistence changes. Record what was tested and any unavailable verification.
5. Review the implementation against the outcome. Preserve failed drafts and newer data. Reconcile concurrent repository edits and publish only within the owner's requested scope, following `PUBLISHING.md`.
6. Record the source commit, actual checks, result and remaining work. Do not call a mocked GPT check a live paid connection, or a local ZIP a published GitHub Release.

## Conversation as evidence

**Export conversation for game improvements** produces a text brief with recent dialogue, observations, remembered questions and decisions. The owner can give it to GPT or Codex to develop a source change. The export itself never executes code, installs dependencies or publishes changes.

The offline resident uses guided rules and saved context. Optional GPT dialogue sends a bounded online request only when the owner selects it. Both may propose safe additive furnishings; neither may rewrite the application from conversation or treat a room note as executable instructions.

Keep mathematical workbenches, including any Vertigo experiment, in the backlog until the owner supplies the exact rules and requested scope. Do not invent research claims to fill an implementation gap.
