# House of Ideas

The owner's house history is part of the experience. Preserve complete older house documents and make a separate neighbouring edition for spatial changes. Never silently discard editions, notes, conversations, decisions or personal data.

For a future visual redesign, retain the current renderer in a versioned local module before changing its appearance. Add a distinct supported edition tag for new houses and keep old edition tags mapped to their original renderer. `web/legacy-scene.js` preserves the pre-neighbourhood house; existing inhabited homes must also retain their appearance when a later renderer is introduced.

`web/inhabited-scene-v1.js` retains the inhabited renderer and `atelier` identifies designer-enabled homes. Before changing shared furnishing, book-display or style helpers, retain the versions needed by older renderers and point those renderers to the retained helpers too.

The offline edition and GitHub Pages preview are canonical here. Keep personal `data/` out of commits and portable ZIPs. Preserve an existing data folder during a program update. Use temporary data for tests. Do not deploy the separate legacy Sites edition as part of local work.

Socrates can propose bounded room furnishings and learning activities. Changes require the owner's recorded approval. Offline dialogue stays available; optional GPT must remain an explicit connection without a bundled key.

Read `PUBLISHING.md` before publication. Run meaningful persistence, interaction and geometry checks and inspect visual changes in a real browser.

Artist gallery editions are approved, independent lots in `cityNetwork.artistHomes`. Keep every earlier lot, decision and conversation, including its order (which determines its street position). `web/art-city-scene.js` remains the original gallery renderer; `web/artist-city-editions.js` is the first study-house renderer. Before a later visual redesign, retain the renderer and furnishing helpers used by existing gallery editions and add an explicit renderer version for the new editions. AI replies cannot approve or publish designs. Provider requests use only the selected artist's bounded context; GitHub update briefs contain owner-approved designs and exclude transcripts.
