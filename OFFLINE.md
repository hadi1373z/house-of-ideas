# Offline house: start, explore and keep your memories

## Windows portable package

1. Extract the whole supplied ZIP into a folder you can keep and write to. Leave `runtime`, `server` and `web` together.
2. Double-click **Start House.vbs**. The included Node runtime runs in the background and opens the local house in your default browser. No Node installation or npm command is needed.
3. Return to the same folder and use the same launcher next time. Your ideas, journal, conversation and approved furniture remain saved.
4. Double-click **Stop House.vbs** when finished. Closing a browser tab alone does not stop the local server.

The portable package is delivered separately from repository source. No GitHub Release binary is implied by these instructions.

## Carry conversations to your private online house

Open **Your home · Socrates → Meet Socrates → Conversation settings**, choose **Continue with ChatGPT**, then explicitly send a message after connecting. This uses an eligible ChatGPT plan on localhost. The connection is kept only in memory; sign in again after stopping the house. A ChatGPT login on the hosted website identifies you but does not provide hosted model inference.

Choose **Download private conversation file** to keep a JSON copy of the durable local dialogue archive. New successful saves preserve messages beyond the resident's recent 80-message window, including artist conversations. A copied home does not duplicate the same exchange. Previously discarded messages cannot be recovered. Exporting an old installation backfills its retained messages in memory without rewriting the saved house.

Open [the private online house](https://house-of-ideas-online.nutmeg-ibex-4408.chatgpt.site), then **Conversations**. Select that JSON file and choose **Import conversations**. File selection alone sends nothing. Import copies dialogue for private review, preserves both neighbourhoods, ignores imported approval authority and skips exact duplicates. The archive holds up to 10,000 messages; reaching capacity refuses new records without pruning. Full files up to 192 MiB are uploaded in bounded chunks. If an import stops partway through, keep the original file and retry; already imported messages remain saved.

Select conversation evidence, write your own problem, proposed change and observable check, then **Save development draft**. Read it before approving it. The approved JSON contains your design summary, conversation references and source-place labels; the full transcript stays in the private archive. Approval does not edit GitHub or publish a site. Give the approved brief to Codex for a reviewed source change, tests and a new publication. Online residents currently use rule-based dialogue; no separately billed hosted API is enabled.

## Run from source

Use Node.js 22.14 or newer. From the repository folder, run `node server/local.mjs` and open the printed local address. Press Ctrl+C in that terminal to stop it. No dependency installation is needed to play; `npm install` is for development tests and builds.

The server binds to `127.0.0.1`, normally port 4317, and can try the next ports if needed. Follow the launcher or terminal address rather than opening `web/index.html` directly.

## Walk and converse

Click the 3D view to focus it. WASD or arrow keys move; drag to look; the joystick also moves you. **Open the front door** takes you through the entrance. The house fills the screen; **J** opens or closes your journal. **Map & ideas** opens room notes and the floor-plan tools; **Dollhouse** shows the building from above. **Your home · Socrates** opens a guide to your homes, rooms and objects.

Socrates lives in the house and walks through its connected rooms. Go near him and press **E**, or choose **Talk to Socrates**. Use **Call Socrates** when he is elsewhere. Sending a message becomes available when he is close enough. **Gentle / Direct** changes the conversational pace he remembers.

Try “What assumption does this idea depend on?”, “What would change my mind?” or “Please add an experiment table.” The offline guide uses local rules and your actual saved material. It draws on a room's purpose, objects and assigned functions, reflections, previous observations, your expressed aims and recorded refusals. It can compare a design's purpose with how you actually use it. Its answers may help you investigate, but it is not a language model or a collection of historical quotations.

**Critique this room** prepares a concrete proposal with its reason, philosophical concept, practice and next-visit success test. For example, a discussion circle asks you to make the strongest alternative case, then record what changed your mind. Read it before choosing **Build next edition** or **Decline**. Approved additions become physical learning furnishings or a book in a new house next door; pending proposals do not change the room. Socrates remembers refusals and avoids offering the same declined furnishing again unless you explicitly request it. Decisions and conversation survive a restart.

## Find and shape your residence

Open **Your home · Socrates** to see each neighbouring home, every room's floor and purpose, and an inventory of its objects and activities. Choose **Go there** for a room, a floor button for an upper level, or **Meet Socrates** to find him. Your personal house is his residence; the ten artists inhabit their separate houses in Artists’ City.

An earlier home can be copied with **Build a home with paintings and upper floors**. The new residence keeps the source home's ideas, notes, journal, Socrates conversation and decisions. It adds an upper gallery, marked stair landings and a selection of locally bundled paintings. The earlier complete home remains visitable.

Choose **Assign room & objects** in a current room to configure it:

- Set its name, purpose or idea, and color.
- Set **Room brightness** between 0 and 100.
- Write up to 1,000 characters to display when you enter that room. Dismiss the writing while you explore; entering again shows it again.
- Choose up to three different paintings from the sixty attributed local works. Inspect a wall painting with **E**, or choose it from the inventory, to read its description, credit and looking exercise. The image and description work offline; source and reuse-record links are deliberate online actions.
- Use **Assign ideas to rooms** to choose a destination for each saved idea. Its complete note and reading, question, experiment or reflection function stay attached. Each room holds up to twelve ideas.
- Choose one, two or three floors. Adding a floor creates a connected upper room. A floor with existing rooms cannot be removed until those rooms have been moved; invalid overlaps or stair connections are rejected without discarding the draft.

**Build this room in a new home** records these settings in an independent house next door. The prior home's rooms and objects stay intact. A save conflict keeps your room settings, painting selection, entry writing and idea destinations for retry; use **Reload saved house**, review the retained draft, then build again. Older homes remain read-only until copied into a new edition.

The floors physically stack at 3.4-metre intervals. Approach a staircase landing and press **E** for **Go upstairs** or **Go downstairs**, or use the guide's floor and room buttons. Landings transfer you between connected floors; they do not provide continuous stair climbing. The room guide lists household furnishings, saved ideas, paintings, approved learning features and imported room designs, with available activities beside them.

## Daily learning and physical changes

Use **Journal · J** to open your ideas, learning activity and reflection. From **21:00 Europe/Prague**, the running local server prepares a critique from recorded visits, ideas and reflections. Closing the browser leaves this review running; **Stop House.vbs**, shutting down the computer or stopping the server pauses it. Startup catches up on missed recorded days, without inventing activity for days you did not visit.

The proposal includes a learning book and, when justified, a question board, discussion circle, reflection lamp or experiment table suited to the room's purpose. Read the concept, practice and next-visit test before confirming on or after the next day. **Build next edition** installs the approved additions in a separate neighbouring home; earlier homes remain complete. A furnishing already installed or declined is taken into account. Existing book-only proposals still work.

If the server saves a new critique while your journal is open, choose **Reload saved house** when ready. Reflection drafts are retained, and stale saves are rejected instead of overwriting newer activity. The review status shows the running local schedule; it is an offline rule-based critique, with no unattended GPT request or GitHub publication.

Resident furniture proposals can be approved when you review them. They use a separate approval flow from the daily next-day critique. Neither flow silently applies a suggestion. Stopped local software does not run background reviews.

## Objects you can use

Look at an object nearby and press **E**, or click it. Chairs and beds let you sit or rest; walking or **Stand up** returns you to your feet. The kitchen cup opens a tea break. A notebook opens your journal.

Books on the shelves are individually selectable. Choose a title, turn pages, and keep an answer to its question in the room’s journal. The six short readings are original learning material, available offline.

Your assigned idea objects have a function you choose when saving: **read a note**, **examine a question**, **plan an experiment**, or **reflect on an idea**. Inspecting an object opens its actual saved note and activity; **Edit this object** changes the note or function. Answers are saved as reflections.

## Bring objects and houses from design tools

Open **Design workshop**, choose a static GLB, and give it a name, purpose/note and function. Choose **Inside the selected room** or **In the garden gallery** for an object or piece of furniture. **Complete house exhibit** places a house model in the garden gallery. **Place design in a new edition** preserves the earlier house before saving the contribution.

Export from your design tool as a self-contained GLB version 2 with embedded geometry and PNG, JPEG or WebP textures. Each file can be up to 12 MiB, and each home can hold up to 24 contributions. Animated models, external files and unsupported compressed extensions are rejected. A room object must fit without blocking its furnishings and passages.

Select an imported object nearby or choose it in the workshop. Its saved note and selected reading/question/experiment/reflection activity appear there, and you can save an answer to that activity in the room's learning journal. **Save design changes** updates its purpose, function, scale, rotation and position; the offsets are relative to its room centre or assigned garden location. **Remove from this home** preserves the earlier edition. Socrates can consider this title, note and assigned function in his critique, but cannot infer an object's usefulness from its geometry alone.

**Tour this design** opens the imported geometry at full size for a ground-level tour. Use the usual walking controls or **Enter VR**, then **Return home** when finished. A complete GLB house remains an imported exhibit/tour: its mesh does not automatically become semantic rooms, functioning household furniture or opening doors. Tours currently stay at ground level. The workshop is a local exploration tool, with no native BIM/CAD editing, multiplayer or asset marketplace.

## Import and share a neighbouring home

**Import a house or package → Build this design next door** accepts the app's own house JSON or an exported portable design package. It creates an independent new home; the existing neighbourhood stays intact.

**Export portable design package** downloads `house-of-ideas-design-package.json` with the selected house and embedded local GLBs, up to 32 MiB of models. **It also includes this home's notes, learning journal, conversations and memories.** Review that content before giving a package to another person. Imported packages can be up to 48 MiB including JSON encoding.

**Export house JSON** downloads `house-of-ideas-house.json`. It includes the same selected home's saved document but references GLBs rather than embedding them. Keep its original GLB files separately and import them on the receiving computer before importing that JSON. A portable design package is the simpler transfer when a home uses models. Both exports contain one home; copy the full `data` folder for a backup of every neighbouring edition.

Imported files in the browser preview last for that visit. Export a package before closing the preview if you want to keep them. The desktop edition keeps its GLBs under `data/designs`.

## Visit the artists

Choose **Artists’ City · 10 houses** to enter the street. **City guide · 10 houses** opens a list of the houses you can visit. Every gallery has six artworks from your existing artist websites. Approach a painting and press **E**; walk around the bench to reach the back wall. The artist’s worktable and doorway plaque open its guide too. Artist houses are fictional places for learning, with their own roofs and visual details.

The ten websites, their 130 views and all sixty artwork images work from the local folder without Internet access. **Explore this artist’s local website** opens the bundled site in another tab. Artwork source, image license and original GitHub website links are explicit online actions. Source credits and reuse records remain attached to each work; the bundled source edition is recorded in `web/art-city/credits.json`.

Save an artwork observation to today’s journal in your selected home room, or discuss the work with its artist. Every gallery has its own embodied resident, with a distinct appearance, art tool and movement inside that house. Press **E** nearby or choose **Meet the artist**. Each host offers original offline conversations grounded in their displayed works, small art exercises and room design studies. These are interpretive residents, not historical quotations. Saved dialogue is separate for every artist and survives a restart; drafts remain while you switch houses. Artist conversations do not start paid requests, install furnishings or approve changes. Return through the gate or **Return to my home** to resume at your previous location. Artist city visits do not replace or create personal home editions. Preserved homes remain available, and saving new observations requires a current home edition.

City walking and artwork selection also use the existing WebXR controls when compatible hardware is present. Artwork title and learning question appear in the in-world reading panel; the painting remains on its gallery wall. Physical headset operation is still unverified.

## Enter Mathematics City

Choose **Mathematics City · 8 floors**, or select Mathematics City in **Travel & collection**. You arrive outside the Mathematics Institute. Walk through its entrance, or open **Mathematics guide → Enter the building** to arrive inside on the ground floor. The building belongs to a separate city; it neither replaces a personal house nor changes a preserved edition.

The institute has eight physical levels spaced four metres apart: foundations, algebra, geometry, calculus and analysis, discrete mathematics, probability and statistics, topology, and the logic and computation observatory. Choose a destination on the lift panel, approach a marked stair landing and press **E**, or use a floor button in the guide. Each action transfers you to that level, with its own floor height and learning objects. Continuous stair climbing is not implemented. Your own residence still supports one to three floors.

There are **24 selectable mathematical concepts**, three per level. Books, diagram boards and idea objects open a plain-language explanation, a question and an exercise. Further-reading links are optional online actions. **Save to Mathematics City journal** records your reflection in the local city collection, separate from home-room reflections and house editions. Saved journal entries survive a local restart; an unsaved reflection remains a browser-session draft when you close the guide or retry a failed save. **Discuss this question with Socrates** prepares the question in his conversation without sending it. His offline guide examines assumptions, precise examples and the distinction between successful examples and a proof.

Select the physical **Atlas of Ideas** screen or **Atlas of Ideas monitor** in the guide to open a miniature of the actual website inside the building. Nothing loads the reader before that action. The bundled reader works offline and retains the original credits and citations. It contains **131 thinkers, 181 connections, eight reading trails and thirteen idea lenses**, pinned to [Atlas source commit `90a6dab9f7ae7b54bb34e0d7d8cabac155775e40`](https://github.com/hadi1373z/atlas-of-ideas/tree/90a6dab9f7ae7b54bb34e0d7d8cabac155775e40); local source metadata is in `web/math-city/atlas/source.json`. **Open the original website online** explicitly opens the public Atlas. There is no automatic synchronisation with that website.

The embedded reader is sandboxed separately from the house. **Its shelf and notes last only for this page session.** Closing and reopening the guide retains that reader session, but reloading or leaving the house page does not. Use the reader's **JSON export** to keep those Atlas notes; they are not part of `data/house.json`, a house package or the city collection. Mathematical reflections saved with **Save to Mathematics City journal** do belong to your offline city data and backups. Reading the Atlas, moving floors and saving a city reflection do not start a GPT request.

Use **Travel & collection → Home neighbourhood** to return to the place you left. Desktop interaction is available without a headset. WebXR support and mocked floor-height checks do not establish physical headset comfort or controller operation; real hardware operation remains unverified.

## Travel and carry learning between cities

Open **Travel & collection**, or approach a travel sign and press **E**. Choose the home neighbourhood, Artists’ City, Makers’ City or Mathematics City. Socrates accompanies you in your home neighbourhood, Makers’ City and Mathematics City. In Artists’ City, each house is inhabited by its own artist. Makers’ City has an open-door library, workshop and dialogue house with physical books, experiment tables, question boards, seats, tea and notebooks.

Choose a source home and **Copy this idea to my collection**, or copy a library book. Copying works from preserved editions and keeps their original documents intact. Choose a city landmark and **Place a display copy in this city**. You can place the same item in more than one city and still carry it in your collection. Visit a landmark to find its copies, then approach an object and press **E** to read or use its assigned activity.

Keep observations in the **city journal** or save an answer while reading a book. City notes are separate from room reflections and do not create or modify home editions. Travel retains unfinished city journal and activity drafts during that browser session. Saved copies, placements, journals and visit counts survive a local restart. Returning home restores the place you left, using a nearby clear position if an approved furnishing has since occupied it.

**Discuss this with Socrates** prepares a question and calls him over in your home neighbourhood, Makers’ City and Mathematics City. In Artists’ City, enter a gallery and discuss with its artist resident. It does not send a message. His offline city guide helps examine a definition, assumption or practical use and suggests one small learning test; it does not build or approve anything. Optional GPT still requires a deliberate online conversation.

**Export collection JSON** saves your copied personal idea notes, display locations and city journals to a portable file. Import merges that file into another local installation; repeated import is safe, and identifier conflicts preserve both records. Artist conversations are excluded from these collections; back up the complete `data/` folder to keep all resident histories with your neighbourhood. Keep the file private if its notes are private. Full houses and their GLB files use the separate portable home package in Design workshop.

Each collection holds up to 64 learning objects, 128 displays (eight per landmark) and 120 city notes. Reaching a limit stops the addition and retains existing records. No records are silently removed. Stop the program before replacing its files; updating preserves the complete `data` folder.

## Use a VR headset

Connect a headset supported by your browser's WebXR implementation and open the house on a secure origin. The same computer's `http://127.0.0.1` page can be trusted; remote pages need HTTPS. The loopback address refers to the device opening it, so it does not connect a standalone headset browser to a server on a different PC. This launcher does not expose the server to the network. See [secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts) and [WebXR permissions](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Permissions_and_security).

When the page detects compatible immersive VR, the button becomes **Enter VR**. Approve the browser's headset permission when you choose to enter. **VR unavailable** means the current browser/device connection cannot start that mode; you can continue walking on the monitor.

Point a controller and press its trigger to select a nearby object or teleport onto a clear floor. The left stick moves forward/back in your looking direction; the right stick turns in 30-degree steps. Opened book text or the latest artist or Socrates reply appears on an in-world panel with **Close**, **Next page** and **Ask a question** controls. Residence navigation and floor changes preserve the selected floor's 3.4-metre height offset in mocked WebXR checks. Typed answers, model imports and connection settings still use the desktop interface. **Exit VR** returns to desktop viewing. Physical headset and controller operation has not been tested live for this release.

## Visit earlier houses

**Neighbourhood** takes you to the street. Each preserved edition has its own house; approach its entrance and press **E**, or select an edition from **Your home · Socrates** or the journal. The original house retains its previous visual style. Earlier inhabited homes keep `web/inhabited-scene-v1.js`, and designer-enabled `atelier` homes retain their import layer. The new `residence` edition uses `web/residence-scene-v1.js` and `web/residence-interior-v1.js` for paintings, configurable lighting and multiple floors.

Older houses are read-only. Their complete rooms, objects, notes, journal, conversations, decisions and custom metadata remain available to inspect. **Build a new edition next door** makes an independent copy that you can develop. Changing a layout, installing approved furnishings, or adding/moving/changing an assigned object preserves the previous edition before creating the next one. Building changes through the room guide also creates a new home for brightness, paintings, writing on arrival, purposes and assignments. Ordinary idea-note edits and conversations with Socrates save in the current house.

On first upgrade, the previous saved house is retained in the neighbourhood and its original storage envelope is copied to `data/house-before-neighborhood.json`. The new home keeps your notes and history. Back up the entire `data` folder to preserve all editions. Up to 128 editions are kept; reaching the limit stops new editions without removing an old house.

## Optional online GPT

The house and **Offline guide** need no account or internet connection. Both GPT routes below are online services. This release has no account/key configured and has not been tested with a live sign-in or live model request.

### Continue with ChatGPT

Open Socrates' conversation, choose **Connect GPT**, then **Continue with ChatGPT**. Open the displayed **Continue to ChatGPT** link and authorize House of Ideas in OpenAI's sign-in page. Eligible ChatGPT Plus/Pro plans can use this open-source local connection under their plan's applicable limits; availability and account permissions are controlled by OpenAI. See the [official OpenAI sign-in quickstart](https://developers.openai.com/siwc/quickstart).

After returning, choose a **Plan model** from the current list supplied for your signed-in account. There is no fixed API-key model substituted for this list. Select **ChatGPT plan · online** in the conversation menu and send a message when you want an online reply. Signing in and listing models do not automatically send your saved conversation. Saved account registrations can be selected for later sign-in, or choose **Add another ChatGPT account**.

The authorization is separate from your Codex or existing ChatGPT browser session; the house does not read another app's credentials. ChatGPT access, refresh and ID tokens stay in the local server's memory, renew there while connected, and clear when the server stops. The nonsecret registration file `data/chatgpt-registration.json` retains this host's ID, issued account client IDs and validated account labels/identities so they can be reauthorized later. Sign in again after restarting the server. The flow follows [OpenAI's public-client sign-in documentation](https://developers.openai.com/siwc/token-sharing-open-source/sign-in).

**Cancel sign-in** ends the pending attempt. **Disconnect ChatGPT** clears the local connection and attempts to revoke its renewable session. If the app says remote revocation was not confirmed, you can disconnect House of Ideas in ChatGPT Settings. That message does not affect your local house.

### Use your own API key

In the same **Connect GPT** dialog, enter your OpenAI API key and configure its model. The default is `gpt-5.4-mini`, subject to your API account's model access. **Configure GPT for this session** does not send a conversation request. Choose **API key · online** and send a message only when you want to use API billing.

The key stays in the local server's memory and clears when it stops; it is not saved in the house document. The API-key **Disconnect** button clears that route independently from the ChatGPT plan connection.

Both online modes send your message, up to 12 recent conversation turns, and bounded context relevant to the current room: its purpose, idea notes/functions, designer object metadata, furnishings, preferences, saved aims/questions, reflections, observations and decisions. They send this to OpenAI using the same philosophical prompt. A model suggestion still goes through the same bounded feature validation and your recorded approval before any house change. OAuth, token renewal and model responses have been verified with mocked requests only.

## Artist conversations and house editions

In **Artists’ City**, enter one of the ten gallery houses and meet its artist resident. **Offline** uses a local art guide. For generated AI dialogue, choose **Connect ChatGPT**, complete OpenAI’s sign-in, choose a **Plan model**, return to the artist and select **ChatGPT plan**. You can also select **API key** after configuring that connection. Each artist has a distinct interpretive persona inspired by their catalogued works; replies are not historical statements or quotations.

An explicit online message sends that artist’s persona, six work descriptions, up to 12 turns from their own conversation and bounded summaries of their own gallery editions. Other artists’ conversations and your personal Socrates house are excluded. Failed requests keep the exact draft and never silently substitute an offline answer. Opening the conversation, choosing a mode and signing in do not send conversation material to a model.

Use **Review house ideas** after discussing the home. Generated design suggestions remain pending. The offline guide can also draft a study from the latest discussion. Edit the title, reason, exercise, learning object and atmosphere before choosing **Approve and build a new house**. Approval creates a separate gallery house in the new district; the original and earlier approved houses remain visitable. Select an edition to enter it and meet the artist there. Its learning object opens the saved exercise. Up to 20 new gallery houses and 40 retained decisions are supported; reaching a limit removes nothing.

To make an approved design part of the public GitHub city, choose **Export approved GitHub update brief**. Attach that JSON to this Codex chat and ask to update `hadi1373z/house-of-ideas` from the approved designs. The brief contains approved design records and the artist’s approach, excluding the private transcript. Review the implementation and tests before publication. GitHub Pages runs a demonstration in memory; the offline app supplies your durable houses and local ChatGPT connection. Signing into ChatGPT does not automatically commit or publish.

The model catalogue accepts bounded metadata responses up to 2 MiB while sign-in documents retain their smaller limit. If a catalogue cannot be loaded, the account remains connected; focus **Plan model** to retry. A server update clears memory-only tokens, so sign in again after restarting.

## Save, back up and update

Your durable neighbourhood file is `data/house.json` beside the launcher or source checkout. Imported GLBs are in `data/designs`; optional ChatGPT registration metadata is in `data/chatgpt-registration.json`. Stop the server and copy the entire `data` folder to back up the neighbourhood and its models. Keep that folder when replacing application files; replacing it with another package's empty data would lose your saved house. The folder contains personal material and should stay out of GitHub.

Launcher status and errors are in `data/launcher.log`. If the house cannot open, check that log and preserve `data/house.json` before attempting a repair. Two tabs use revisions to prevent one stale tab from overwriting newer changes; reload a stale tab before saving again.

**Export conversation for game improvements** downloads `house-of-ideas-game-brief.txt`. Give it to GPT or Codex when you want a reviewable source improvement. The brief includes personal conversation and observations, so share it deliberately. Exporting it does not run code or update the game automatically.
