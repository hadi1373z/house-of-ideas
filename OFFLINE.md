# Offline house: start, explore and keep your memories

## Windows portable package

1. Extract the whole supplied ZIP into a folder you can keep and write to. Leave `runtime`, `server` and `web` together.
2. Double-click **Start House.vbs**. The included Node runtime runs in the background and opens the local house in your default browser. No Node installation or npm command is needed.
3. Return to the same folder and use the same launcher next time. Your ideas, journal, conversation and approved furniture remain saved.
4. Double-click **Stop House.vbs** when finished. Closing a browser tab alone does not stop the local server.

The portable package is delivered separately from repository source. No GitHub Release binary is implied by these instructions.

## Run from source

Use Node.js 22.14 or newer. From the repository folder, run `node server/local.mjs` and open the printed local address. Press Ctrl+C in that terminal to stop it. No dependency installation is needed to play; `npm install` is for development tests and builds.

The server binds to `127.0.0.1`, normally port 4317, and can try the next ports if needed. Follow the launcher or terminal address rather than opening `web/index.html` directly.

## Walk and converse

Click the 3D view to focus it. WASD or arrow keys move; drag to look; the joystick also moves you. **Open the front door** takes you through the entrance. The house fills the screen; **J** opens or closes your journal. The journal contains room notes, the floor plan, **Dollhouse**, and the button to call Socrates.

Socrates lives in the house and walks through its connected rooms. Go near him and press **E**, or choose **Talk to Socrates**. Use **Call Socrates** when he is elsewhere. Sending a message becomes available when he is close enough. **Gentle / Direct** changes the conversational pace he remembers.

Try “What assumption does this idea depend on?”, “What would change my mind?” or “Please add an experiment table.” The offline guide uses local rules and your actual saved material. It draws on a room's purpose, objects and assigned functions, reflections, previous observations, your expressed aims and recorded refusals. It can compare a design's purpose with how you actually use it. Its answers may help you investigate, but it is not a language model or a collection of historical quotations.

**Critique this room** prepares a concrete proposal with its reason, philosophical concept, practice and next-visit success test. For example, a discussion circle asks you to make the strongest alternative case, then record what changed your mind. Read it before choosing **Build next edition** or **Decline**. Approved additions become physical learning furnishings or a book in a new house next door; pending proposals do not change the room. Socrates remembers refusals and avoids offering the same declined furnishing again unless you explicitly request it. Decisions and conversation survive a restart.

## Daily learning and physical changes

Use **Journal · J** to open your ideas, learning activity and reflection. The daily review prepares a learning-book proposal at 21:00 Prague time when the page is open, or catches up from recorded prior activity when you return. Confirm or decline that proposal on or after its next day.

Resident furniture proposals can be approved when you review them. They use a separate approval flow from the daily next-day book. Neither flow silently applies a suggestion. Stopped local software does not run background reviews.

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

Save an artwork observation to today’s journal in your selected home room, or discuss the work with Socrates. The discussion button prepares a question; it does not send a message or start a paid request. Socrates walks through the galleries and can be called to meet you. His offline art exercises use the saved gallery notes, ask for evidence and an alternative interpretation, and suggest a five-minute activity for your selected home room. They do not install furnishings or approve changes. Return through the gate or **Return to my home** to resume at your previous location. Artist city visits do not replace or create personal home editions. Preserved homes remain available, and saving new observations requires a current home edition.

City walking and artwork selection also use the existing WebXR controls when compatible hardware is present. Artwork title and learning question appear in the in-world reading panel; the painting remains on its gallery wall. Physical headset operation is still unverified.

## Travel and carry learning between cities

Open **Travel & collection**, or approach a travel sign and press **E**. Choose the home neighbourhood, Artists’ City or Makers’ City. Your embodied Socrates companion comes with you. Makers’ City has an open-door library, workshop and dialogue house with physical books, experiment tables, question boards, seats, tea and notebooks.

Choose a source home and **Copy this idea to my collection**, or copy a library book. Copying works from preserved editions and keeps their original documents intact. Choose a city landmark and **Place a display copy in this city**. You can place the same item in more than one city and still carry it in your collection. Visit a landmark to find its copies, then approach an object and press **E** to read or use its assigned activity.

Keep observations in the **city journal** or save an answer while reading a book. City notes are separate from room reflections and do not create or modify home editions. Travel retains unfinished city journal and activity drafts during that browser session. Saved copies, placements, journals and visit counts survive a local restart. Returning home restores the place you left, using a nearby clear position if an approved furnishing has since occupied it.

**Discuss this with Socrates** prepares a question and calls him over. It does not send a message. His offline city guide helps examine a definition, assumption or practical use and suggests one small learning test; it does not build or approve anything. Optional GPT still requires a deliberate online conversation.

**Export collection JSON** saves your copied personal idea notes, display locations and city journals to a portable file. Import merges that file into another local installation; repeated import is safe, and identifier conflicts preserve both records. Keep the file private if its notes are private. Full houses and their GLB files use the separate portable home package in Design workshop.

Each collection holds up to 64 learning objects, 128 displays (eight per landmark) and 120 city notes. Reaching a limit stops the addition and retains existing records. No records are silently removed. Stop the program before replacing its files; updating preserves the complete `data` folder.

## Use a VR headset

Connect a headset supported by your browser's WebXR implementation and open the house on a secure origin. The same computer's `http://127.0.0.1` page can be trusted; remote pages need HTTPS. The loopback address refers to the device opening it, so it does not connect a standalone headset browser to a server on a different PC. This launcher does not expose the server to the network. See [secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts) and [WebXR permissions](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Permissions_and_security).

When the page detects compatible immersive VR, the button becomes **Enter VR**. Approve the browser's headset permission when you choose to enter. **VR unavailable** means the current browser/device connection cannot start that mode; you can continue walking on the monitor.

Point a controller and press its trigger to select a nearby object or teleport onto a clear floor. The left stick moves forward/back in your looking direction; the right stick turns in 30-degree steps. Opened book text or the latest Socrates reply appears on an in-world panel with **Close**, **Next page** and **Ask Socrates** controls. Typed answers, model imports and connection settings still use the desktop interface. **Exit VR** returns to desktop viewing. Physical headset and controller operation has not been tested live for this release.

## Visit earlier houses

**Neighbourhood** takes you to the street. Each preserved edition has its own house; approach its entrance and press **E**, or select an edition from the journal. The original house retains its previous visual style. Earlier inhabited homes also keep their renderer: `web/inhabited-scene-v1.js` is preserved while the new designer edition adds its import layer.

Older houses are read-only. Their rooms, objects, notes and conversations remain available to inspect. **Build a new edition next door** makes an independent copy that you can develop. Changing a layout, installing approved furnishings, or adding/moving/changing an assigned object also preserves the previous edition before creating the next one. Writing notes and talking to Socrates save in the current house.

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

## Save, back up and update

Your durable neighbourhood file is `data/house.json` beside the launcher or source checkout. Imported GLBs are in `data/designs`; optional ChatGPT registration metadata is in `data/chatgpt-registration.json`. Stop the server and copy the entire `data` folder to back up the neighbourhood and its models. Keep that folder when replacing application files; replacing it with another package's empty data would lose your saved house. The folder contains personal material and should stay out of GitHub.

Launcher status and errors are in `data/launcher.log`. If the house cannot open, check that log and preserve `data/house.json` before attempting a repair. Two tabs use revisions to prevent one stale tab from overwriting newer changes; reload a stale tab before saving again.

**Export conversation for game improvements** downloads `house-of-ideas-game-brief.txt`. Give it to GPT or Codex when you want a reviewable source improvement. The brief includes personal conversation and observations, so share it deliberately. Exporting it does not run code or update the game automatically.
