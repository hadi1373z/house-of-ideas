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

Enter in first person, walk with WASD or the joystick, and drag to look around. Socrates walks between connected rooms, observes the house and stops to converse nearby. Press **E** near him, choose **Talk to Socrates**, or **Call Socrates** over. **Journal · J** opens ideas and reflections; **Floor plan** edits the architecture; **Dollhouse** shows the interior from above.

Offline Socrates is a persistent character using local dialogue rules and your saved material. He asks about definitions, assumptions, evidence, counterexamples, other perspectives and an examined life. His critique now connects a room's stated purpose, its objects and functions, reflections, earlier visits and your decisions. He remembers expressed goals and declined suggestions. He can ask whether a bedroom supports rest, whether a discussion space helps people listen, or whether an experiment has an observable result. He is not an LLM, and his dialogue is not historical quotation.

Critiques can propose a question board, discussion circle, reflection lamp, experiment table or learning book. Each local proposal includes a philosophical concept, a practice to try and a next-visit test of whether it helped. **Build next edition** installs an approved addition in a new home next door. The previous edition stays available in the neighbourhood. **Decline** leaves the room intact; Socrates takes that refusal into account instead of repeatedly offering the same furnishing. Conversation, observations, preferences and decisions are saved with the house. His critique cannot overwrite your notes or change the building structure.

The daily journal is a separate loop: the open page checks for a review at **21:00 Europe/Prague**, and missed recorded days can be reviewed when you return. Its proposed learning book requires confirmation on or after the next calendar day. No local review runs while the application is stopped.

## Inhabit a home and keep its history

The entrance hall, living room, kitchen, bedroom, study and library have domestic furnishings and solid furniture you can use. Choose a book from a shelf, turn its pages, sit, rest, make tea, or keep a thought in a notebook. Assigned idea objects have selectable reading, questioning, experiment or reflection functions.

The house fills the screen while you walk. Open **Journal · J** for notes and tools. **Neighbourhood** lets you walk to preserved editions and enter them. Older editions retain their documents and visual style; develop them by building an independent new edition. The earlier inhabited renderer is retained in `web/inhabited-scene-v1.js`, alongside the original house's renderer. Layout, furniture, assigned object and imported design changes create another home rather than replacing the old one. Your previous local file is backed up automatically during the first neighbourhood upgrade.

## Bring designs into the neighbourhood

**Design workshop** imports self-contained static **GLB** objects, furniture and complete house models from your design tools, including tools used to create VR assets. Choose a room or garden placement, give the design a note, and assign reading, questioning, experiment or reflection as its function. Select a placed model to inspect its note and activity. Complete house models appear as garden exhibits; **Tour this design** opens a full-size, ground-level exploration view, and **Return home** brings you back.

Import a House of Ideas **house JSON** or **portable design package** to create an independent neighbouring home. A portable design package embeds the selected home's local GLBs together with its notes, journal, conversations and memories. Review that personal content before sharing. House JSON keeps model references, so its GLB files must also be available on the receiving computer. These exports contain one selected home; back up the full `data` folder to keep the entire neighbourhood.

The workshop currently accepts up to 24 contributions per home, with static GLBs up to 12 MiB each and a portable package model budget of 32 MiB. Geometry and textures must be embedded; animations, external files and unsupported compressed extensions are rejected. This is a local learning and design exploration prototype, with no native BIM/CAD editing, multiplayer or asset marketplace. A GLB house tour shows the supplied geometry; it does not automatically turn its rooms, furniture and doors into the app's interactive household objects.

## Visit Artists’ City

**Artists’ City · 10 houses** takes you from your home into a walkable gallery street. You can also follow its sign in your neighbourhood. Each house has a roof, an open doorway, a bench, an artist worktable and six selectable artworks. The ten houses are Claude Monet, Wassily Kandinsky, Vincent van Gogh, Katsushika Hokusai, Auguste Rodin, Hilma af Klint, Piet Mondrian, Dorothea Lange, William Morris and Paul Klee.

Open **City guide · 10 houses** to jump to a named gallery, or walk along the street. Walk around the furniture, approach a frame and press **E** or select it. Browse works, read their original descriptions and source credits, and keep an observation in your current home’s learning journal. Earlier home editions remain preserved. **Each house is inhabited by its own artist.** Ten distinct embodied residents walk around their own galleries, look at the works, and turn to meet you. Press **E** near the resident or use **Meet the artist**. **Discuss with Claude Monet** (or the selected artist) brings that work into the host’s own conversation. Each artist has original offline responses about their practice, observations, small art exercises and ideas for your home. Conversations and unsent drafts are separate for each artist; saved dialogue survives offline restarts. These residents are educational interpretations, not historical quotations. **Return to my home** restores the place you left.

Choose **ChatGPT plan** or **API key** for generated conversations in each artist’s creative persona. Connect through the conversation’s **Connect ChatGPT** button; the optional connection is provided by the offline local server. Each artist uses their own saved conversation and works. **Review house ideas** lets you edit and approve an artist’s suggestion. Approval builds a separate house in the new gallery district with a learning object, an exercise and a chosen atmosphere. The original and all earlier approved editions remain visitable, and the resident meets you in the house you enter. **Export approved GitHub update brief** carries reviewed designs to this Codex chat for a source update and publication. See [the complete procedure](OFFLINE.md#artist-conversations-and-house-editions).

The city connects the existing [artist-galleries project](https://github.com/hadi1373z/artist-galleries). Its complete ten artist websites and all sixty images are bundled locally: **Explore this artist’s local website** works offline. Source and original website links open online only when selected. These are fictional gallery houses and independent artist studies, with per-image attribution and reuse records retained in the websites and `web/art-city/credits.json`.

## Travel between cities

**Travel & collection** connects your home neighbourhood, Artists’ City and **Makers’ City**. Makers’ City has three roofed, furnished halls you can enter: a library, an experiment workshop and a dialogue house. Their books, chairs, tea cups, idea boards and notebooks each open a learning activity. Socrates walks between the halls and accompanies you in Makers’ City and your home neighbourhood. The artists inhabit their own houses in Artists’ City.

Copy a book or an idea from any preserved home into your travelling collection. The original stays in that home. Place separate, selectable display copies at each city's library, learning table/workshop or plaza; your collection stays with you. Each city has its own journal, saved independently of home editions. **Discuss this with Socrates** prepares a question in the home neighbourhood or Makers’ City. In Artists’ City, discuss with the artist resident of the house you are visiting. You choose when to send it. His offline guide offers a question and a small test to bring home, without changing buildings or approving proposals.

Export a **collection JSON** to carry copied learning objects and city journals to another offline installation; import adds records and preserves existing ones. Artist conversations stay private and are excluded from collection exports. Back up the complete `data/` folder to keep the neighbourhood and all resident conversations together. Full home templates and GLB assets continue to travel through the Design workshop's portable home package. The public preview keeps this collection only for the current visit; the offline edition persists it in `data/house.json` with the homes and protects concurrent saves with the same revision checks.

## Explore with a VR headset

**Enter VR** uses WebXR when your browser and connected headset support immersive VR. The page needs a secure origin: HTTPS or the same computer's trusted loopback page. Browser and hardware compatibility varies; see [WebXR permissions and security](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Permissions_and_security).

Point a controller and press its trigger to select nearby objects or teleport to a clear floor. The left stick moves forward/back; the right stick turns in steps. Book text and the current artist or Socrates reply can appear on an in-world panel. VR also works with a design tour; ordinary desktop walking remains available. Hardware headset/controller operation has not been verified live for this release.

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
