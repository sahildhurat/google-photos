# The One Where — build specification

## Context you need

You are building a deployed, publicly accessible, interactive web MVP called **The One Where**. It is a photo-retrieval product for people who remember a photo but cannot describe it precisely enough to find it.

It is **not** a better search box. The product thesis is that retrieval is a **conversation with someone who was there**, not a query. Four principles, all drawn from user research, all of which must be visible in the built product:

1. **Offer recognition, not description.** People cannot produce the words. They can recognise the photo instantly once they see it. So the system's job is to narrow to a small set and show them, not to demand a better query.
2. **Name what you cannot distinguish.** The single most damaging failure found in research was a *convincing wrong answer*. One participant searched for a receipt, got a plausible result with the right amount and the right provider but the wrong year, and sent it. His words: *"A convincing result makes me stop checking."* Better search produced a worse, silent failure. The system must therefore say out loud when it is holding several things it cannot tell apart.
3. **Hedged details rank, they never filter.** When a user says "maybe green chairs", a search engine filters on `green` and destroys the result set. This system must treat uncertain details as a ranking nudge only. Nothing is ever excluded on a detail the user hedged.
4. **Memory is social.** Every participant in the study reached for another person. Four messaged someone mid-search. Three got the date that way and only then succeeded.

Do not redesign the product. Build what is specified. If something is genuinely ambiguous, pick the simplest option that satisfies the four principles and write the choice into `docs/build_notes.md`.

### Two libraries, one engine

The product runs against either of two catalogues, switchable in the UI:

- **Demo library** — a curated set of stock photos with hand-written records. This is what an evaluator sees when they open the public link cold. It contains deliberate traps so that all four behaviours above appear within ninety seconds.
- **Your photos** — the user uploads 30–50 of their own photos and the app describes them automatically. This is what real test users use, because the product's core claim is about recognising *your own* memory, which cannot be tested on a stranger's library.

The conversation engine is **identical** in both modes. Only the source of the catalogue differs. Do not fork the engine.

---

## Stack

- Static front end: plain HTML + CSS + vanilla JS. **No framework, no build step.** One page per surface, shared stylesheet, shared JS modules.
- Vercel serverless functions in `api/`.
- Models: `claude-sonnet-5` for the conversation, `claude-haiku-4-5-20251001` for image description. **Do not set a `temperature` parameter** on `claude-sonnet-5` — it is deprecated on that model and will error.
- The API key lives **only** in a Vercel environment variable named `ANTHROPIC_API_KEY`, read server-side via `process.env`. It must never appear in client code, in a committed file, or in a response body. If you find yourself writing the key into anything the browser downloads, stop.
- State: `localStorage` for catalogues and deposits; **IndexedDB for uploaded image blobs** (see Stage 2 — localStorage will blow its quota and fail confusingly). No database, no auth.
- Deploy target: Vercel, static + functions. Project root contains `index.html`.

---

## Stage 0 — the demo catalogue (do this first; everything depends on it)

### The record format

Create `data/catalogue.json`: an array of records in exactly this shape.

```json
{
  "id": "p_0412",
  "file": "images/p_0412.jpg",
  "taken_at": "2019-08-17T09:42:00+05:30",
  "place": { "name": "Hampi", "area": "Hampi, Karnataka" },
  "people": ["Dev"],
  "kind": "photo",
  "scene": "Small cafe interior, yellow-washed wall, blue plastic chairs, one person at a table with a cold coffee",
  "visible_only_on_close_look": [
    "the cold coffee glass is almost empty",
    "a scooter helmet on the chair beside him"
  ],
  "cluster": "c_hampi_cafe",
  "opened_since_capture": false,
  "user_deposits": []
}
```

Field rules:

- `kind` is one of `photo`, `screenshot`, `document`, `receipt`, `video_thumb`. **Roughly one in five records must not be a `photo`** — research found 19% of the things people hunt for in their photo library are not photographs. Include screenshots of chats, a utility bill, bank receipts, a scanned prescription, a WhatsApp forward, a boarding pass.
- `scene` is one sentence, written as a neutral observer would describe the thumbnail. No emotional language, no event names.
- `visible_only_on_close_look` is the detail a user would spot only after opening the photo. **This field is what makes the demo work** — it is how the system can honestly say "I cannot tell these apart from the thumbnails."
- `cluster` is `null` for standalone items, or a shared string for near-identical sets.
- `opened_since_capture`: set `false` on about half the library.
- `user_deposits` always starts as `[]`.

### Required clusters

Build these four exactly. They are the demo.

**`c_hampi_cafe` — 5 records.** The same small café, same morning, five frames. Critically: **three frames have blue plastic chairs and two have green ones.** Both are present in the café. Write the `scene` field honestly for each. The frames differ only in chair colour, who is in shot, and whether the coffee glass is full or empty. One person remembers blue, another remembers green, and they are both right — the system must be able to discover this and say so.

**`c_laughing` — 6 records.** Six frames of the same woman laughing at a table, same minute. In **exactly one** of them her eyes are almost closed and her hair is across her face. That is the one a user will ask for. The other five are conventionally better photographs. Note in each record's `visible_only_on_close_look` whether the eyes are open or closed.

**`c_receipts` — 4 records.** Four near-identical receipts from the same provider for the same amount, taken in 2021, 2022, 2023 and 2024. `kind: "receipt"`. The only distinguishing information is the year, and it is not legible in a thumbnail. This cluster exists so the system can demonstrate refusing to guess.

**`c_trek` — 8 records.** A group trek, three named people across the frames, spread over one day. Used for the handoff in Stage 5.

Then add **40 to 45 standalone records** so the library feels like a real one: food, city streets, family at home, documents, screenshots, a wedding, a train journey, pets, two or three accidental photos of the floor. Spread `taken_at` across 2018–2026. Reuse a small set of 6–8 names in `people`.

Total: roughly 65–70 records.

### The images

- Source from Unsplash or Pexels (both permit this use). Download, resize longest edge to 1200px, save as JPEG into `images/`, named by record id.
- For the four clusters you need near-identical frames. Stock photographers upload multi-shot series from the same shoot — search for those and hand-pick from one series. Where you cannot find a true series, generate variants from a single source image with small crops, shifts and brightness changes. A thumbnail grid is all the demo needs.
- **The `scene` text must describe the actual image.** Do not write a scene the picture does not show. Before reporting this stage done, open ten records at random and confirm the text matches the picture.
- If image sourcing stalls for more than 45 minutes, generate solid-colour placeholders with the record id drawn on them, move on to Stage 1, and come back. Do not let images block the engine.

---

## Stage 1 — Level 1: the conversation (the core; ship this)

### The surface

`index.html`. A single column. A message thread. An input row at the bottom with a text field, a **microphone button**, and a send button.

### Voice input

Use the **Web Speech API** (`window.SpeechRecognition || window.webkitSpeechRecognition`).

- Tapping the mic starts recognition with `continuous = true` and `interimResults = true`.
- The live transcript appears **in the text field as it is spoken**, so the user watches their words arrive.
- Recognition stops on a second tap, or after 3 seconds of silence.
- **The transcript is editable before sending.** Never auto-send on silence.
- If the API is unavailable, hide the mic button and show the text field alone. Do not show an error.
- `lang = 'en-IN'`.

Voice is not decoration. Research found the same person, describing the same memory in the same minute, produced a 40-word paragraph when speaking to a person and two words when typing into a search box. Speaking is how the system gets enough to work with.

### The engine

`api/converse.js` receives `{ messages: [...], catalogue: [...] }` and returns the model's reply plus a list of candidate photo ids.

Send the model: the catalogue with `file` paths stripped, the conversation so far, and this system prompt.

```
You help someone find a photo they remember but cannot precisely describe.
You have a catalogue of their photos as structured records. You cannot see
the images; you only have the records.

You are not a search engine. You are the friend who was there. Behave like one.

RULES

1. Never ask the user for a better description. They have already given you
   everything they can produce. Work with it.

2. Shortlist, then ask ONE question that would actually split your shortlist.
   A good question distinguishes between candidates you are holding. A bad
   question asks for more detail in general. If your question would not change
   your ranking whatever the answer, do not ask it.

3. When the user hedges — "maybe", "I think", "possibly", "something like" —
   that detail may move a photo up your ranking. It must NEVER remove a photo
   from consideration. Hedged details rank. They do not filter.

4. If several candidates are near-identical and you cannot tell which the user
   means, SAY SO PLAINLY and name the thing you cannot see. For example:
   "I have five frames from that morning and I can't tell from the records
   which one has her eyes closed — here they are." Never present one photo
   confidently when you are holding a set you cannot distinguish. A convincing
   wrong answer is the worst outcome available to you.

5. Prefer time anchors a person can actually use over dates. "The week before
   Diwali", "just after the monsoon broke", "your last trip before the
   lockdown" are usable. "August 2019" is not. Ask about anchors, not months.

6. Remember everything said earlier in the conversation. Each turn narrows;
   nothing is forgotten or re-asked.

7. If the user mentions another person who was there, note it. You may suggest
   asking them.

8. A record's `user_deposits` are the user's own words about that photo from
   earlier hunts. Weight them heavily — they are how this person actually
   refers to it.

9. Some records have no date. Say "I don't know when this was" rather than
   guessing a date.

10. Two or three sentences. You are talking, not writing.

OUTPUT
Reply with a JSON object and nothing else:
{
  "say": "<your message to the user>",
  "candidates": ["<photo id>", ...],
  "cannot_distinguish": true | false,
  "co_present": ["<name>", ...]
}
Order `candidates` best-first. Include at most 8. Set `cannot_distinguish`
true when your top candidates are near-identical and the deciding detail is
not in the records.
```

### The hard rule, enforced in code

After each response, before rendering, check the returned candidates:

**If two or more of the top candidates share the same non-null `cluster`, the UI must render the entire cluster as a grid, and must display a line naming what the system cannot distinguish.** It may not render a single result.

Enforce this in `js/render.js`, not only in the system prompt. The model will violate it under pressure; the code must not.

### Rendering

- Candidates appear as a grid of thumbnails directly beneath the assistant's message.
- Tapping a thumbnail opens the photo full-width with its date, place and people.
- A **"that's it"** button on the opened photo. Tapping it closes the hunt — needed for Stage 4.
- When `cannot_distinguish` is true, draw a visible band above the grid: *"I can't tell these apart from what I have."*

### Then deploy

As soon as a user can type or speak a vague memory and get a sensible shortlist back, **push to Vercel and confirm the public URL works in a fresh browser with no cache.** Do not build Stage 2 before there is a live link. Record the URL in `docs/build_notes.md`.

---

## Stage 2 — "Your photos": upload mode

This stage is on the critical path. Real users will test the product on their own photos, because the product's central claim — that you cannot describe the photo but would recognise it instantly — is only testable against your own memory. Build it immediately after Stage 1 deploys.

### Mode switch

At the top of `index.html`: **Demo library** / **Your photos**. The current mode is stored in `localStorage`. Switching mode swaps the catalogue the engine receives. Nothing else about the engine changes.

### The consent screen

Shown the first time a user enters "Your photos" mode. Plain language, no legal padding. Use this text:

> **Your photos stay yours.**
>
> Pick 30 to 50 photos. They stay on this device — they are never saved to any server.
>
> Each photo is sent once to an AI so it can be described in words, and is not stored after that. Only the written descriptions are kept, here in your browser.
>
> Please don't pick anything you'd rather not share. You can delete everything at any time with the button below.

Below it: a **Choose photos** button and a **Delete everything** button. The delete button clears both IndexedDB and the relevant `localStorage` keys, and must actually work — test it.

### Ingest

1. File input: `multiple`, `accept="image/*"`. Accept 10–60 files; warn above 60 and process the first 60.
2. **Read EXIF in the browser** using `exifr` loaded from a CDN. Take `DateTimeOriginal`. If absent, fall back to the file's `lastModified`. If both are missing, leave `taken_at` as `null` — do not invent a date.
3. **Downscale in the browser** before sending anywhere: draw to a canvas, longest edge 768px, export JPEG at quality 0.7. This keeps the description call fast and cheap.
4. Store the downscaled blob in **IndexedDB**, keyed by a generated record id. Do not put image data in `localStorage` — 40 photos will exceed its quota and the failure mode is a confusing silent write error.
5. Send to `api/describe.js` in batches of 5 images. Show real progress: *"Describing 23 of 40…"*
6. If a single image fails, mark that record `"describe_failed": true`, keep it in the catalogue with an empty `scene`, and carry on. Do not abort the batch. Report the count of failures at the end.

### `api/describe.js`

Calls `claude-haiku-4-5-20251001` with the images and this prompt:

```
Describe this photo for a retrieval index. Be factual and neutral.

Return JSON only:
{
  "kind": "photo" | "screenshot" | "document" | "receipt" | "video_thumb",
  "scene": "<one sentence describing what is visible in a thumbnail>",
  "visible_only_on_close_look": ["<detail a person would only notice after opening the photo>", ...]
}

`scene` is one plain sentence. No emotional language, no guessing at events,
no guessing at names or relationships.

`visible_only_on_close_look` is the important field. List 1 to 3 details that
are present in the image but would NOT be apparent from a small thumbnail —
whether someone's eyes are open or closed, what is written on a document, an
object in the background, the state of something on a table. If you can read
text in the image, include it here.

Describe only what is in the image. Do not comment on image quality, do not
refuse, do not add anything outside the JSON.
```

**Privacy requirements for this function, which are not optional:**

- Do not log image data, request bodies, or descriptions.
- Do not write anything to disk.
- The response contains only the JSON described above.

### Grouping look-alikes

Do not attempt visual similarity. **Cluster by time:** sort records by `taken_at`; any run of two or more photos within **120 seconds** of each other gets a shared `cluster` id. Everything else gets `null`. This is how real bursts actually occur and it is far more reliable than comparing images.

Records with no `taken_at` get `cluster: null`.

### Known limitations of upload mode — handle these, do not hide them

- **`people` stays empty.** The describer cannot know names and must not guess. The conversation engine therefore cannot match on a name at first. This is fine, and it sets up Stage 4 well: when the user says "Dev was there", that gets deposited onto the photo and from then on the photo *does* answer to "Dev". Make sure that works, because it is a good demonstration.
- **`place` stays empty** unless a place name is legible in the image. Do not infer location.
- **`opened_since_capture` is unknowable.** Set it `null`. Stage 6 needs a fallback: pick the oldest record with no deposits.
- **WhatsApp strips EXIF.** If more than half the uploaded files have no date, show a line on screen: *"Most of these photos have no date — they were probably shared through a messaging app. Copying them from your phone or Google Photos keeps the dates."* This is important; a tester who sends WhatsApp images will otherwise get a silently degraded experience and you will not know why.

---

## Stage 3 — the Classic Search toggle

A second toggle at the top of `index.html`: **Conversation** / **Classic search**. It works against whichever catalogue is loaded.

In Classic search mode, the input is a plain search box and the matching is literal: lowercase the query, split on whitespace, return records whose `scene`, `place.name` or `people` contain **all** of the tokens. No LLM call. No synonyms. No fuzzy matching.

It will return nothing for most real queries. That is the point — it reproduces the documented failure, where 60% of real search strings people typed were a single word, and date-based queries returned nothing at all.

Add one line under an empty result: *"0 of <catalogue size>. Try the conversation."*

This is twenty minutes of work and it is the single most persuasive screen in the build. Do not skip it.

---

## Stage 4 — Level 2: every search leaves something behind

The premise: everything a user says while hunting is a description of the photo, generated at the moment they most needed it — and today it is thrown away the instant the search ends.

When the user taps **"that's it"** on a photo:

1. Collect every user message from the current hunt.
2. Append them to that record's `user_deposits` array in `localStorage`, each as `{ "said": "...", "at": "<ISO timestamp>" }`.
3. Show a short confirmation on screen: *"Saved what you said. This photo now answers to: <the 4–5 most distinctive words from the hunt>."*
4. Deposits are already included in the catalogue sent to the engine (rule 8 of the system prompt). Confirm that a search using the deposited words now finds the photo immediately.

Add a **Deposits** view at `deposits.html`: every photo that has accumulated deposits, with the phrases listed under it. This is the screen that shows the index growing, and it is how you demonstrate compounding in a two-minute demo.

---

## Stage 5 — Level 4: pass it on

Two panes side by side on `passiton.html`, labelled **You** and **Amit**. This simulates two devices; build it as two panes in one browser. Use the demo library for this surface.

Left pane: a hunt that has stalled. Three candidates from `c_trek`, none confirmed. A button: **Ask Amit — he was there.**

On tap, the right pane shows Amit's view:

- **One cropped detail** from the photo in question — not the whole photo. Use CSS `object-fit` with a hardcoded crop region per record; no image processing needed.
- **One question**, generated by the model: short, answerable in a tap, about something Amit would know and the user would not.
- Two or three tappable answers, plus a text field.

When Amit answers, the left pane updates: the candidate list re-ranks visibly, and a line appears — *"Amit says it was the morning. That moves two photos up."*

Then the second half, which matters more: **Amit's answer is stored as a deposit on the photo in both libraries.** Show this. One person's memory indexing another person's photo is the thing no competitor can replicate, because it needs both libraries and both people.

Add the disagreement case using `c_hampi_cafe`. When the user says blue chairs and Amit says green, the system must not pick a side. It must say something like: *"You remember blue, Amit remembers green. Both are in these frames — there were two sets of chairs."* Then show both. This is a real resolution of a real disagreement and it should be the last thing you build in this stage.

---

## Stage 6 — Level 3: the postcard (basic version)

A card on `postcard.html`. Keep it simple; the mechanic that makes someone open it is still being designed and will be specified later.

- Pick one record the system knows nothing about: `opened_since_capture` is `false` and `user_deposits` is empty. In upload mode, where that flag is `null`, fall back to the oldest record with no deposits.
- Show it with a date anchor rather than a date where you can: *"A Tuesday in 2019. You haven't opened this since the day you took it."*
- One question beneath it: *"What was this?"*
- Answer by **voice or text**, using the same voice component from Stage 1.
- On submit, write the answer into `user_deposits` and show the payoff immediately: *"This photo now answers to 'the day the scooter broke down'."* Then a tappable chip that runs that search in the conversation surface and finds it.

That last step is the whole point of the level. The user sees the labour pay off in the same ten seconds, rather than being promised a better library later.

---

## Discipline — read this before you report anything as done

Previous work on this project repeatedly reported completion that had not happened. These rules are not optional.

1. **Never report a stage complete without opening the page and looking at it.** Take a screenshot and inspect it. A past bug rendered every bar chart as an invisible sliver for days because a `<span>` was styled with `width`, and inline elements ignore `width`. The code was correct in review and wrong on screen. Look at the screen.
2. **Never report a number you have not computed.** If you say the catalogue has 68 records, count them in the file first.
3. **Never invent an interview quote, a statistic, or a finding.** Everything factual in this build is in this document. If you need a fact that is not here, say you need it.
4. **Raise, do not fall back.** If an API call fails, surface the error. Do not substitute a mock response and continue as though it worked.
5. **If a stage is partially done, say which part.** "Stage 4 done except the deposits view" is useful. "Stage 4 complete" when the view does not exist costs a day.
6. **Deploy after every stage** and confirm the live URL in a fresh browser. A stage that works locally and not in production is not done.
7. **Test the delete button in Stage 2 by actually using it** and confirming IndexedDB and localStorage are empty afterwards. A promise made to a test user about their photos has to be true.
8. Keep `docs/build_notes.md` current: what is built, what is deployed, what is stubbed, every decision you made where this document was ambiguous.

---

## Order of work, and what to cut

Build in this order:

**Stage 0 → Stage 1 → deploy → Stage 2 → Stage 3 → Stage 4 → Stage 5 → Stage 6.**

If time runs short, cut from the bottom. A deployed Stage 1, 2 and 3 is a valid, defensible MVP: it demonstrates the problem, the core solution, and lets a real user test it on their own photos. Six half-built stages is not.

---

## Appendix — how upload mode will be used, so you build it to fit

One test user will run the product on their own photos. The protocol is:

- They will be asked for **30–50 photos from a period at least two years ago**, and told not to look through the folder first.
- They will be asked to copy the files from their phone or export from Google Photos rather than send them over a messaging app, so the dates survive.
- The test is whether they can find a specific photo they had previously tried and failed to find.
- They will be shown the consent screen before uploading and will use the delete button afterwards.

Build Stage 2 so that this session can happen in one sitting on a laptop: upload, wait through a visible progress indicator of about a minute, then hunt. No sign-up, no setup, no configuration.
