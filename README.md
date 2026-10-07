# House of Ideas

By Hadi Zamani. A spatial playground for mathematics, art, questions, and discoveries.

[Open the working app](https://house-of-ideas.nutmeg-ibex-4408.chatgpt.site) (currently owner-private). The project introduction is in `docs/index.html` and is also included under `/project/` in the hosted app.

A private, editable 3D mind palace. Rooms represent themes; ideas are saved as notes with physical memory objects. An editable 20 × 16 grid generates the floors, walls, and connected door openings. Dollhouse and first-person modes both use an analog joystick.

## Run and build

`npm ci`, `npm run build`. The build bundles the Cloudflare Worker into `dist/server/index.js`, and copies browser assets into `dist/client`. Three.js is vendored under `web/vendor` with its license. No external CDNs are required.

## Storage

Private Sites authentication supplies `oai-authenticated-user-id`. D1 stores one complete house document per authenticated user, using parameterized queries and optimistic revisions to prevent stale tabs overwriting a saved house. `db/schema.ts` is the Drizzle source; checked-in migrations under `drizzle` are applied by Sites before deployment. Failed saves preserve editor input. No user data is stored in localStorage.

## Interaction

- Select rooms or idea objects, add/edit/remove ideas, change themes and memory objects.
- Draw rooms on the grid or enter dimensions numerically; connect adjacent rooms with doors.
- Build the staged layout to update and save the house. Rooms containing ideas cannot be removed until their ideas are moved.
- Joystick: drag continuously for analog speed, release to stop. Focus the joystick for arrow-key navigation. Drag the 3D view to look/orbit.
- Feature-detected WebMCP tools share the same visible actions: read_house, navigate_to_room, save_idea.

## Verification

Domain, scene-geometry, and storage checks run in Node. GPU/browser and supported WebMCP-context checks are unavailable in this execution environment.

Run `npm test` for the existing domain and UI-action checks. These are not rendered browser tests; determine available browser capabilities on each run before making visual claims.

## Hourly improvement

The owner requested bounded recurring improvements to this playground. Read `IMPROVEMENT.md` and `improvement-state.json` before changing the project. They contain the scope, acceptance criteria, backlog, failure history, and update procedure. Source and deployment history are the durable record; a scratch checkout is not.

## GitHub repository and Pages

The intended repository name is `hadi1373z/house-of-ideas`. Repository creation and GitHub Pages publication are pending authenticated setup; this name is a target, not evidence that the repository exists.

The prepared `.github/workflows/pages.yml` publishes only `docs/` after changes on `main`, or on manual dispatch, once Pages is enabled with GitHub Actions as its publishing source. The separate verification workflow runs the existing tests and build. Neither workflow uses a paid AI API or generates improvements by itself.

GitHub Pages serves the project introduction. The complete application requires its Cloudflare Worker, D1 database, authenticated visitor identity, and the Sites deployment flow. It cannot be deployed as a complete application to static Pages. No saved user ideas or database contents belong in the repository.

The hourly Sites task is enabled for the hosted app. A GitHub write-and-readback path must be verified before calling repository synchronization active. Preserve that working task while access is being completed. Avoid competing development copies: treat Sites source as canonical until a deliberate, verified migration is requested.

To finish setup with authorized GitHub access: create or resolve the target repository; upload the current clean source; read back its commit; enable the Pages workflow; verify its successful deployment and actual URL; then extend the existing hourly task to synchronize successful source updates, recording conflicts without force-pushing.
