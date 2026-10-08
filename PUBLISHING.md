# Source and publication

[hadi1373z/house-of-ideas](https://github.com/hadi1373z/house-of-ideas) is canonical for the offline edition. The Windows portable package is a local deliverable assembled from that source; it is not currently a GitHub Release binary.

The [public Pages site](https://hadi1373z.github.io/house-of-ideas/) is an in-memory demonstration. It cannot keep a durable local house or configure the local-server GPT connection. The older owner-private [Sites edition](https://house-of-ideas.nutmeg-ibex-4408.chatgpt.site), version 8, remains a separate cloud edition. Updating offline source does not deploy or synchronize it.

## Update the offline source

1. Read the owner's current request and GitHub branch state. Preserve unrelated changes and use normal commits; do not force-push or restore an older Sites snapshot over the local edition.
2. Implement a bounded change with an observable pass condition. Preserve saved ideas, resident memory, journal records and both approval flows. Use temporary data folders for tests.
3. Run the relevant checks and `npm test`; verify visible changes in a real browser when available. Record limitations separately. Optional GPT tests use mocked responses unless a live paid request is explicitly authorized and configured.
4. Push only source and documentation. Exclude `data/`, credentials, API keys, dependencies, logs, generated packages, build output and personal conversation exports. Retained layout drafts must preserve the latest ideas, learning journal and resident state.
5. Read back the pushed commit and check the applicable GitHub Actions. When Pages source changes, verify its deployment separately. Record the exact results in the task outcome and `improvement-state.json` as appropriate.

## Prepare a portable package

Use `scripts/package-offline.mjs` with the tested source and the intended Windows Node runtime. The package contains the local server, browser assets, runtime and Start/Stop launchers. Validate launch, graceful stop and a saved-house restart in a temporary package before delivery. Keep user data outside the source/package assembly input.

Delivering a ZIP in a chat does not publish a release. Create or upload a GitHub Release only when requested, and verify that action before describing a binary as downloadable there.

## Legacy cloud work

`worker/`, D1 migrations, `.openai/hosting.json` and `NIGHTLY.md` describe the older cloud implementation. `npm run build` still builds those assets; running it does not deploy a Site. Do not schedule or deploy cloud changes as part of an offline update.

The earlier hourly source-improvement task remains paused. The resident and exported improvement brief do not resume it or establish automatic repository writes. The offline server's local 21:00 Prague review creates pending proposals only while that server is running. Existing cloud review operations remain separate from local-server reviews.
