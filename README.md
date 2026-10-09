# House of Ideas

By Hadi Zamani. A house you can walk through, learn in, and develop with Socrates as a fellow resident.

The [GitHub repository](https://github.com/hadi1373z/house-of-ideas) is the source of truth for this offline edition. Use the supplied Windows portable package, or run the source locally. The [public browser preview](https://hadi1373z.github.io/house-of-ideas/) is a demonstration; the older [private cloud edition](https://house-of-ideas.nutmeg-ibex-4408.chatgpt.site) remains separate.

## Run offline

With a supplied portable ZIP, extract the entire folder and double-click **Start House.vbs**. It includes its own Node runtime and opens the house in your browser. **Stop House.vbs** closes the local server safely. Your saved house stays in `data/house.json`. See [OFFLINE.md](OFFLINE.md) for controls, backups and optional GPT.

To run a source checkout, install Node.js **22.14 or newer**, then:

```sh
git clone https://github.com/hadi1373z/house-of-ideas.git
cd house-of-ideas
node server/local.mjs
```

Open the local address printed in the terminal, normally `http://127.0.0.1:4317`. Runtime startup needs no npm installation and no internet connection.

## Share the house with Socrates

Open **Your home · Socrates** to find your home, enter a named room and see its objects and activities. **Meet Socrates** helps you find the resident in your personal home; the artists inhabit their own gallery houses in Artists’ City. If you are visiting an earlier edition, **Build a home with paintings and upper floors** creates a separate residence with your existing notes and history.

Enter in first person, walk with WASD or the joystick, and drag to look around. Socrates walks between connected rooms, observes the house and stops to converse nearby. Press **E** near him, choose **Talk to Socrates**, or **Call Socrates** over. **Journal · J** opens reflections; **Map & ideas** opens the room and idea editor; **Floor plan** edits the architecture; **Dollhouse** shows the interior from above.

Offline Socrates is a persistent character using local dialogue rules and your saved material. He asks about definitions, assumptions, evidence, counterexamples, other perspectives and an examined life. His critique now connects a room's stated purpose, its objects and functions, reflections, earlier visits and your decisions. He remembers expressed goals and declined suggestions. He can ask whether a bedroom supports rest, whether a discussion space helps people listen, or whether an experiment has an observable result. He is not an LLM, and his dialogue is not historical quotation.

Critiques can propose a question board, discussion circle, reflection lamp, experiment table or learning book. Each local proposal includes a philosophical concept, a practice to try and a next-visit test of whether it helped. **Build next edition** installs an approved addition in a new home next door. The previous edition stays available in the neighbourhood. **Decline** leaves the room intact; Socrates takes that refusal into account instead of repeatedly offering the same furnishing. Conversation, observations, preferences and decisions are saved with the house. His critique cannot overwrite your notes or change the building structure.

The daily journal is a separate loop: the **local server** checks from **21:00 Europe/Prague**, even with the browser closed, and catches up on missed recorded days when it starts. Socrates connects a visited room's purpose and learning evidence to a book and, when useful, a question board, discussion circle, reflection lamp or experiment table. The review names the philosophical concept, a practice and a next-visit test. Confirm or decline it on or after the next calendar day; approval builds an independent house next door. Earlier book-only reviews remain valid. The server never approves a critique, calls GPT or publishes code on its own. **Stop House.vbs** stops the reviews until you start the server again.

If a nightly review is saved while you are editing, the journal offers **Reload saved house**. Reload explicitly to see it; a background review cannot replace an unsaved reflection or bypass the save conflict check. The public preview keeps its per-visit review and has no background server.

## Inhabit a home and keep its history

The entrance hall, living room, kitchen, bedroom, study and library have domestic furnishings and solid furniture you can use. Choose a book from a shelf, turn its pages, sit, rest, make tea, or keep a thought in a notebook. Assigned idea objects have selectable reading, questioning, experiment or reflection functions.

The residence edition adds visible paintings and one to three physical floors. **Your home · Socrates → Assign room & objects** lets you change a room's name, purpose, color, brightness (0–100), writing shown on entry and up to three paintings from the sixty locally bundled works. Choose a destination room for each saved idea; its notes and function stay attached. Each room holds up to twelve ideas. Painting selection opens its image, description, attribution and a looking exercise.

Floors are spaced 3.4 metres apart. Use the guide's floor/room buttons, or approach a marked staircase landing and press **E** to go upstairs or downstairs. The landing transfers you to the connected floor; continuous stair climbing is not implemented. Adding a floor creates a connected upper room without moving your existing ideas. Rooms must remain connected by doors or valid adjacent-floor landings, and an occupied upper floor cannot be silently removed.

The house fills the screen while you walk. **Neighbourhood** lets you walk to preserved editions and enter them. Older editions retain their complete documents and visual style; develop them by building an independent new edition. Room-guide changes build a new home next door, including room purposes and entry writing. Layout, furniture, assigned object and imported design changes also preserve the previous home. `web/legacy-scene.js`, `web/inhabited-scene-v1.js` and the new `web/residence-scene-v1.js` retain their respective visual editions; the residence furnishing helper is versioned separately. Your previous local file is backed up automatically during the first neighbourhood upgrade.

## Bring designs into the neighbourhood

**Design workshop** imports self-contained static **GLB** objects, furniture and complete house models from your design tools, including tools used to create VR assets. Choose a room or garden placement, give the design a note, and assign reading, questioning, experiment or reflection as its function. Select a placed model to inspect its note and activity. Complete house models appear as garden exhibits; **Tour this design** opens a full-size, ground-level exploration view, and **Return home** brings you back.

Import a House of Ideas **house JSON** or **portable design package** to create an independent neighbouring home. A portable design package embeds the selected home's local GLBs together with its notes, journal, conversations and memories. Review that personal content before sharing. House JSON keeps model references, so its GLB files must also be available on the receiving computer. These exports contain one selected home; back up the full `data` folder to keep the entire neighbourhood.

The workshop currently accepts up to 24 contributions per home, with static GLBs up to 12 MiB each and a portable package model budget of 32 MiB. Geometry and textures must be embedded; animations, external files and unsupported compressed extensions are rejected. This is a local learning and design exploration prototype, with no native BIM/CAD editing, multiplayer or asset marketplace. A GLB house tour shows the supplied geometry; it does not automatically turn its rooms, furniture and doors into the app's interactive household objects.

## Visit Artists’ City

**Artists’ City · 10 houses** takes you from your home into a walkable gallery street. You can also follow its sign in your neighbourhood. Each house has a roof, an open doorway, a bench, an artist worktable and six selectable artworks. The ten houses are Claude Monet, Wassily Kandinsky, Vincent van Gogh, Katsushika Hokusai, Auguste Rodin, Hilma af Klint, Piet Mondrian, Dorothea Lange, William Morris and Paul Klee.

Open **City guide · 10 houses** to jump to a named gallery, or walk along the street. Walk around the furniture, approach a frame and press **E** or select it. Browse works, read their original descriptions and source credits, and keep an observation in your current home’s learning journal. Earlier home editions remain preserved. **Each house is inhabited by its own artist.** Ten distinct embodied residents walk around their own galleries, look at the works, and turn to meet you. Press **E** near the resident or use **Meet the artist**. **Discuss with Claude Monet** (or the selected artist) brings that work into the host’s own conversation. Each artist has original offline responses about their practice, observations, small art exercises and ideas for your home. Conversations and unsent drafts are separate for each artist; saved dialogue survives offline restarts. These residents are educational interpretations, not historical quotations. **Return to my home** restores the place you left.

Choose **ChatGPT plan** or **API key** for generated conversations in each artist’s creative persona. Connect through the conversation’s **Connect ChatGPT** button; the optional connection is provided by the offline local server. Each artist uses their own saved conversation and works. **Review house ideas** lets you edit and approve an artist’s suggestion. Approval builds a separate house in the new gallery district with a learning object, an exercise and a chosen atmosphere. The original and all earlier approved editions remain visitable, and the resident meets you in the house you enter. **Export approved GitHub update brief** carries reviewed designs to this Codex chat for a source update and publication. See [the complete procedure](OFFLINE.md#artist-conversations-and-house-editions).

The city connects the existing [artist-galleries project](https://github.com/hadi1373z/artist-galleries). Its complete ten artist websites and all sixty images are bundled locally: **Explore this artist’s local website** works offline. Source and original website links open online only when selected. These are fictional gallery houses and independent artist studies, with per-image attribution and reuse records retained in the websites and `web/art-city/credits.json`.

## Discover Mathematics City and Atlas of Ideas

**Mathematics City · 8 floors** takes you to a separate city with a tall Mathematics Institute. **Mathematics guide** lists its eight physical floors: foundations, algebra, geometry, calculus and analysis, discrete mathematics, probability and statistics, topology, and the logic and computation observatory. Enter from the guide or walk through the entrance. Floors are four metres apart; use the lift's destination panels, marked stair landings or guide buttons to transfer to the actual level. Continuous stair climbing is not implemented. This eight-floor public building does not change the one-to-three-floor limit of your personal residence or replace a preserved home.

Each floor has three selectable learning objects, for **24 concepts and exercises**. Approach a book, diagram board or idea object and press **E** to read its explanation, question, exercise and further-reading link. Keep a reflection in the Mathematics City journal; this uses the independent city collection, preserves all personal house editions and survives offline restarts. Failed saves and closing the guide keep the current reflection draft for retry during that browser session. **Discuss this question with Socrates** prepares an unsent question about definitions, assumptions or a counterexample; sending it remains your choice.

The building's **Atlas of Ideas monitor** opens the actual [Atlas of Ideas project](https://github.com/hadi1373z/atlas-of-ideas) as a bundled, sandboxed offline miniature. The reader loads only when you select the physical screen or its guide action. It includes **131 thinkers and 181 connections**, along with eight reading trails and thirteen idea lenses, pinned to source commit `90a6dab9f7ae7b54bb34e0d7d8cabac155775e40`. Its source credits are retained in the reader and `web/math-city/atlas/source.json`. The snapshot does not automatically synchronise; **Open the original website online** is a separate explicit link.

**Notes inside the embedded Atlas reader are session-only and are not saved in `data/house.json`.** Use the reader's JSON export before reloading or leaving the page to retain its shelf and notes. Save a mathematical reflection to the city journal when you want it kept with your offline house. Physical headset operation remains unverified; the ordinary monitor and keyboard controls remain available.

## Travel between cities

**Travel & collection** connects your home neighbourhood, Artists’ City, **Makers’ City** and **Mathematics City**. Makers’ City has three roofed, furnished halls you can enter: a library, an experiment workshop and a dialogue house. Their books, chairs, tea cups, idea boards and notebooks each open a learning activity. Socrates walks between the halls and accompanies you in Makers’ City, Mathematics City and your home neighbourhood. The artists inhabit their own houses in Artists’ City.

Copy a book or an idea from any preserved home into your travelling collection. The original stays in that home. Place separate, selectable display copies at each city's library, learning table/workshop or plaza; your collection stays with you. Each city has its own journal, saved independently of home editions. **Discuss this with Socrates** prepares a question in the home neighbourhood, Makers’ City or Mathematics City. In Artists’ City, discuss with the artist resident of the house you are visiting. You choose when to send it. His offline guide offers a question and a small test to bring home, without changing buildings or approving proposals.

Export a **collection JSON** to carry copied learning objects and city journals to another offline installation; import adds records and preserves existing ones. Artist conversations stay private and are excluded from collection exports. Back up the complete `data/` folder to keep the neighbourhood and all resident conversations together. Full home templates and GLB assets continue to travel through the Design workshop's portable home package. The public preview keeps this collection only for the current visit; the offline edition persists it in `data/house.json` with the homes and protects concurrent saves with the same revision checks.

## Explore with a VR headset

**Enter VR** uses WebXR when your browser and connected headset support immersive VR. The page needs a secure origin: HTTPS or the same computer's trusted loopback page. Browser and hardware compatibility varies; see [WebXR permissions and security](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Permissions_and_security).

Point a controller and press its trigger to select nearby objects or teleport to a clear floor. The left stick moves forward/back; the right stick turns in steps. Book text and the current artist or Socrates reply can appear on an in-world panel. Residence floor changes retain the selected floor's height in desktop and WebXR navigation; this behavior is checked with mocked XR sessions. VR also works with a design tour; ordinary desktop walking remains available. Hardware headset/controller operation has not been verified live for this release.

## Optional online conversation

**Connect GPT → Continue with ChatGPT** offers a separate OpenAI OAuth sign-in for eligible ChatGPT Plus/Pro plans. Click the displayed sign-in link, authorize House of Ideas, and choose a model from your account's current catalog. Then select **ChatGPT plan · online** when speaking to Socrates. It uses your ChatGPT plan's applicable usage limits. See the [official OpenAI sign-in quickstart](https://developers.openai.com/siwc/quickstart) and [account model catalog](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).

The house always works offline; GPT replies require internet access. ChatGPT access, refresh and identity tokens remain in the local server's memory and clear when it stops. Only nonsecret host/account registrations are saved for later sign-in. This connection is separate from the Codex session. An OpenAI API key remains a separate optional route, using **API key · online**; its default configured model is `gpt-5.4-mini`, subject to your API access and billing.

Both online modes send the message, recent conversation and bounded relevant room/object context, saved memories, reflections and decisions to OpenAI. They can return only validated suggestions for the same approval flow. No account is connected by default. OAuth and inference have been checked with mocks; no live account sign-in or paid/model request has been tested for this release.

**Export conversation for game improvements** downloads a text brief you can give to GPT or Codex. It includes recent dialogue, observations and decisions. Exporting does not execute code, update the repository or publish changes.

## Development

Install dependencies only for development checks and builds:

```sh
npm install
npm test
npm run build:pages
```

Three.js r186 and its matching GLTF loader, BufferGeometryUtils and SkeletonUtils are vendored locally from the official Three.js repository under the included MIT license. Only their module imports use local paths. The runtime server uses Node's built-in modules. Tests cover actual loopback HTTP, atomic saves and restart, revision conflicts, conversation memory, mocked OAuth and streamed GPT responses, approval gates, imported asset validation, portable packages, furnishings and navigation. Browser rendering, live account/inference and physical VR verification must be recorded separately. Follow [PUBLISHING.md](PUBLISHING.md) for source or package updates.
