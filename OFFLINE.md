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

Try “What assumption does this idea depend on?”, “What would change my mind?” or “Please add an experiment table.” The offline guide uses local rules and your actual saved material. Its answers may help you investigate, but it is not a language model.

**Critique this room** prepares a concrete proposal with its reason and question. Read it before choosing **Build next edition** or **Decline**. Approved additions become physical learning furnishings or a book in a new house next door; pending proposals do not change the room. Decisions and conversation survive a restart.

## Daily learning and physical changes

Use **Journal · J** to open your ideas, learning activity and reflection. The daily review prepares a learning-book proposal at 21:00 Prague time when the page is open, or catches up from recorded prior activity when you return. Confirm or decline that proposal on or after its next day.

Resident furniture proposals can be approved when you review them. They use a separate approval flow from the daily next-day book. Neither flow silently applies a suggestion. Stopped local software does not run background reviews.

## Objects you can use

Look at an object nearby and press **E**, or click it. Chairs and beds let you sit or rest; walking or **Stand up** returns you to your feet. The kitchen cup opens a tea break. A notebook opens your journal.

Books on the shelves are individually selectable. Choose a title, turn pages, and keep an answer to its question in the room’s journal. The six short readings are original learning material, available offline.

Your assigned idea objects have a function you choose when saving: **read a note**, **examine a question**, **plan an experiment**, or **reflect on an idea**. Inspecting an object opens its actual saved note and activity; **Edit this object** changes the note or function. Answers are saved as reflections.

## Visit earlier houses

**Neighbourhood** takes you to the street. Each preserved edition has its own house; approach its entrance and press **E**, or select an edition from the journal. The original house retains its previous visual style.

Older houses are read-only. Their rooms, objects, notes and conversations remain available to inspect. **Build a new edition next door** makes an independent copy that you can develop. Changing a layout, installing approved furnishings, or adding/moving/changing an assigned object also preserves the previous edition before creating the next one. Writing notes and talking to Socrates save in the current house.

On first upgrade, the previous saved house is retained in the neighbourhood and its original storage envelope is copied to `data/house-before-neighborhood.json`. The new home keeps your notes and history. Back up the entire `data` folder to preserve all editions. Up to 128 editions are kept; reaching the limit stops new editions without removing an old house.

## Optional GPT

Open Socrates' conversation, choose **Connect GPT**, enter your own OpenAI API key and configure the model. The default configuration is `gpt-5.4-mini`. Configuring the key does not send a paid conversation request. Choose **GPT · online** and send a message only when you want to use it.

That request sends your message, up to 12 recent conversation turns and bounded context from the current conversation room: its purpose, idea-note excerpts and installed furnishings. It goes to OpenAI and requires internet access and API billing. Model access depends on your API account. This edition has no key configured and has not been verified with a live paid request.

The key entered in settings stays in the local server's memory, is cleared when it stops, and is not saved in the house file. **Disconnect** clears it and returns to offline dialogue. Model suggestions still pass the same bounded feature validation and user approval gate.

## Save, back up and update

Your durable file is `data/house.json` beside the launcher or source checkout. Stop the server and copy the `data` folder to make a backup. Keep that folder when replacing application files; replacing it with another package's empty data would lose your saved house. The folder contains personal material and should stay out of GitHub.

Launcher status and errors are in `data/launcher.log`. If the house cannot open, check that log and preserve `data/house.json` before attempting a repair. Two tabs use revisions to prevent one stale tab from overwriting newer changes; reload a stale tab before saving again.

**Export conversation for game improvements** downloads `house-of-ideas-game-brief.txt`. Give it to GPT or Codex when you want a reviewable source improvement. The brief includes personal conversation and observations, so share it deliberately. Exporting it does not run code or update the game automatically.
