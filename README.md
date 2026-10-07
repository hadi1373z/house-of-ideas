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

Enter in first person, walk with WASD or the joystick, and drag to look around. Socrates walks between connected rooms, observes the house and stops to converse nearby. Press **E** near him, choose **Talk to Socrates**, or **Call Socrates** over. **Rooms & journal** opens ideas and reflections; **Floor plan** edits the architecture; **Dollhouse** shows the interior from above.

Offline Socrates is a persistent character using local dialogue rules, room notes and recent conversation. He asks about definitions, assumptions, evidence, counterexamples, other perspectives and an examined life. He is not an LLM, and his dialogue is not historical quotation. Conversation, observations, preferences and decisions are saved with the house.

Critiques can propose a question board, discussion circle, reflection lamp, experiment table or learning book. **Build this change** installs an approved addition. **Decline** leaves the room intact. Socrates cannot overwrite your notes or change the building structure through a critique.

The daily journal is a separate loop: the open page checks for a review at **21:00 Europe/Prague**, and missed recorded days can be reviewed when you return. Its proposed learning book requires confirmation on or after the next calendar day. No local review runs while the application is stopped.

## Optional online conversation

**Connect GPT** configures your own OpenAI API key for the local server session. Then choose **GPT · online** to send a message. The configured default model is `gpt-5.4-mini`. This option requires internet access and paid API access; offline dialogue remains available. No paid connection is preconfigured, and no live paid request has been verified for this edition.

**Export conversation for game improvements** downloads a text brief you can give to GPT or Codex. It includes recent dialogue, observations and decisions. Exporting does not execute code, update the repository or publish changes.

## Development

Install dependencies only for development checks and builds:

```sh
npm install
npm test
npm run build:pages
```

Three.js is vendored locally. The runtime server uses Node's built-in modules. Tests cover actual loopback HTTP, atomic file saves and restart, revision conflicts, conversation memory, bounded mocked GPT responses, approval gates, furnishings and navigation. Browser rendering and paid API verification must be recorded separately. Follow [PUBLISHING.md](PUBLISHING.md) for source or package updates.
