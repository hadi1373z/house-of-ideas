# Atlas of Ideas inside Mathematics City

This directory contains an exact, pinned copy of the owner's actual published
Atlas of Ideas Reader's Edition. `index.html` is self-contained: its styles,
scripts, catalogue, mathematics SVGs and editorial diagrams are embedded.
It needs no remote runtime requests. Links to cited sources need a connection.

Source: https://github.com/hadi1373z/atlas-of-ideas
Website: https://hadi1373z.github.io/atlas-of-ideas/

The exact source commit, deployed build and HTML hash are recorded in
`source.json`. The original credits, citations and catalogue are unchanged.
The source repository declares no license; this integration does not invent
one or imply a general redistribution grant. This copy is included at the
shared project owner's request.

The in-game miniature should use an iframe with `sandbox="allow-scripts
allow-downloads"`, without `allow-same-origin`, forms or top navigation. This
isolates the embedded document and makes its notebook session-only. Explain
that limit next to the reader, and allow deliberate JSON backup downloads.
The reader's own storage warning provides export instructions. Keeping the
iframe open preserves the active session, but reopening or reloading it does
not preserve these sandboxed notes. No iframe-parent data synchronization is
implemented or claimed.

An explicitly opened standalone local copy can use its normal browser-local
notebook. It does not join the House of Ideas server's private-data backups.
The online and local copies can have separate storage; use My shelf -> Export,
then My shelf -> Import -> Merge when deliberately moving notes. Neither the
house nor this pinned snapshot fetches future Atlas updates automatically.

Useful existing routes: `#ideas`, `#idea/spaces`, `#idea/algebra`,
`#idea/verification`, `#idea/randomness`, `#idea/counting`,
`#idea/symmetry`, `#idea/data-structures`, `#person/riemann`,
`#person/turing`, `#connections/turing`, `#library`, and `#trails`.
They are existing hash routes, not a new iframe messaging API.

To refresh: verify a current public version manifest and its exact HTML hash,
replace the whole pinned HTML, update `source.json`, then test the miniature
offline, the known routes, explicit external links and note backup behavior.
Do not merge personal notes into this public source directory.
