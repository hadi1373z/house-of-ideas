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

Click the 3D view to focus it. WASD or arrow keys move; drag to look; the joystick also moves you. **Enter the house** takes you through the entrance. **Dollhouse** gives an overhead view.

Socrates lives in the house and walks through its connected rooms. Go near him and press **E**, or choose **Talk to Socrates**. Use **Call Socrates** when he is elsewhere. Sending a message becomes available when he is close enough. **Gentle / Direct** changes the conversational pace he remembers.

Try “What assumption does this idea depend on?”, “What would change my mind?” or “Please add an experiment table.” The offline guide uses local rules and your actual saved material. Its answers may help you investigate, but it is not a language model.

**Critique this room** prepares a concrete proposal with its reason and question. Read it before choosing **Build this change** or **Decline**. Approved additions become physical learning furnishings or a book; pending proposals do not change the room. Decisions and conversation survive a restart.

## Daily learning and physical changes

Use **Rooms & journal** to open your ideas, learning activity and reflection. The daily review prepares a learning-book proposal at 21:00 Prague time when the page is open, or catches up from recorded prior activity when you return. Confirm or decline that proposal on or after its next day.

Resident furniture proposals can be approved when you review them. They use a separate approval flow from the daily next-day book. Neither flow silently applies a suggestion. Stopped local software does not run background reviews.

## Optional GPT

Open Socrates' conversation, choose **Connect GPT**, enter your own OpenAI API key and configure the model. The default configuration is `gpt-5.4-mini`. Configuring the key does not send a paid conversation request. Choose **GPT · online** and send a message only when you want to use it.

That request sends your message, up to 12 recent conversation turns and bounded context from the current conversation room: its purpose, idea-note excerpts and installed furnishings. It goes to OpenAI and requires internet access and API billing. Model access depends on your API account. This edition has no key configured and has not been verified with a live paid request.

The key entered in settings stays in the local server's memory, is cleared when it stops, and is not saved in the house file. **Disconnect** clears it and returns to offline dialogue. Model suggestions still pass the same bounded feature validation and user approval gate.

## Save, back up and update

Your durable file is `data/house.json` beside the launcher or source checkout. Stop the server and copy the `data` folder to make a backup. Keep that folder when replacing application files; replacing it with another package's empty data would lose your saved house. The folder contains personal material and should stay out of GitHub.

Launcher status and errors are in `data/launcher.log`. If the house cannot open, check that log and preserve `data/house.json` before attempting a repair. Two tabs use revisions to prevent one stale tab from overwriting newer changes; reload a stale tab before saving again.

**Export conversation for game improvements** downloads `house-of-ideas-game-brief.txt`. Give it to GPT or Codex when you want a reviewable source improvement. The brief includes personal conversation and observations, so share it deliberately. Exporting it does not run code or update the game automatically.
