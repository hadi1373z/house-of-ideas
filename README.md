# House of Ideas

By Hadi Zamani. A house to explore, learn in, and improve through your own decisions.

[Explore the public house](https://hadi1373z.github.io/house-of-ideas/) · [Open your saved house](https://house-of-ideas.nutmeg-ibex-4408.chatgpt.site) · [Source](https://github.com/hadi1373z/house-of-ideas)

The house opens from outside with a roof, windows and an entrance. Enter it, view its rooms from above, or walk through connected doors. Mathematics, Art, Work, Questions, Learning and Connections each have a purpose, a short learning activity, and physical objects for your ideas. The floor plan remains editable.

## Learn with Socrates

Open **Socrates** to explore the rooms with a critical companion. He points to the room's actual ideas, asks a question, and suggests an exercise. Save what you discovered as a reflection.

The requested evening review is daily at **21:00 Europe/Prague**. It prepares one suggestion from that day's recorded room visits, ideas and reflections. On your next entry, on or after the following day, confirm or decline the suggestion. Confirmation places a learning book in the reviewed room; declining leaves the ideas unchanged. Preparing a proposal never applies it. Missing reviews can also be prepared from recorded activity when you return. See [NIGHTLY.md](NIGHTLY.md) for the service and schedule setup.

Socrates uses deterministic guided questions and local rules. He is not an LLM, and his prompts are not historical quotations. The app calls no paid AI API. The daily workflow improves your rooms and learning activities; it does not edit application source.

## Preview and saved house

GitHub Pages runs the interactive browser preview, including the house, floor plan, ideas and Socrates. Its state stays in memory for the current visit and resets on reload. It has no background reviews or durable journal.

The owner-private Sites app keeps authenticated house documents and learning history in D1. Entering the saved house enables its guided learning records. User IDs come from Sites authentication; saves use parameterized queries and optimistic revisions to reject stale tabs. Pending evening proposals live separately from house documents, so the service cannot overwrite edits or make decisions. Operational run receipts contain only dates, aggregate counts and completion times. No user data is stored in localStorage or committed to GitHub.

## Build and checks

```sh
npm ci
npm test
npm run build
npm run build:pages
```

`npm run build` creates the Cloudflare Worker and browser assets under `dist/server` and `dist/client`. `npm run build:pages` creates the static preview under `dist/pages`. Three.js and its license are vendored under `web/vendor`; external CDNs are unnecessary.

The Node suites cover house validation, navigation geometry, UI actions, Socratic learning and decisions, isolated SQLite storage, daily queues, run receipts and revision conflicts. They do not establish GPU rendering or touch usability; record available browser checks separately.

## Publication and recurring work

Sites is canonical and hosts the saved app. GitHub contains verified source snapshots, and `.github/workflows/pages.yml` builds the public preview from `web/` through `scripts/build-pages.mjs`. The verification workflow runs tests and the Worker build. Follow [PUBLISHING.md](PUBLISHING.md) before synchronizing source.

The separate **Improve House of Ideas** hourly source task was verified paused on 7 October 2026. Preserve that status unless the owner asks to resume it. This daily review request does not resume it or establish unattended GitHub writes. The evening schedule and live service verification must be confirmed through the native Sites tools; this README describes the implemented workflow rather than claiming activation.
