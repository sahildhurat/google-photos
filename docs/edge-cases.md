# Edge Cases — *The One Where*

> Derived from [ProblemStatement.md](file:///d:/Google%20Photos/docs/ProblemStatement.md), [context.md](file:///d:/Google%20Photos/docs/context.md), and [implementation-plan.md](file:///d:/Google%20Photos/docs/implementation-plan.md). This document catalogues every edge case, boundary condition, and failure mode that can occur across the product — organised by stage, then by cross-cutting concern.

---

## Stage 0 — Demo Catalogue

### EC-0.1 — `taken_at` is null on a clustered record

A clustered record with `taken_at: null` is valid in the schema but dangerous in Stage 5 and 6. The postcard's date-anchor logic (`"A Tuesday in 2019"`) would break. The social handoff's re-ranking might use date proximity.

**Rule:** All 23 clustered demo records (5 + 6 + 4 + 8) must have non-null `taken_at`. Null dates are only acceptable on standalone records.

### EC-0.2 — `visible_only_on_close_look` is empty

A record with an empty array here is technically valid but defeats the demo's core mechanic — the system can't explain what it can't distinguish.

**Rule:** Every clustered record with `near_identical: true` must have at least 1 entry in `visible_only_on_close_look`. Standalone records should have 1–3 but an empty array is tolerable.

### EC-0.3 — Duplicate record ids

If two records share an id, the catalogue loader will silently overwrite one. Deposits attached to the overwritten record will be lost.

**Rule:** Validate id uniqueness in Task 0.1. A simple `Set` check during catalogue generation.

### EC-0.4 — Cluster with a single member

A cluster string assigned to only one record is semantically meaningless — it will never trigger Mechanism A. It wastes a field and might confuse deposit logic.

**Rule:** Every non-null `cluster` value must appear on at least 2 records. Validate in Task 0.1.

### EC-0.5 — Mixed `near_identical` within a cluster

If `c_hampi_cafe` has 4 records with `near_identical: true` and 1 with `false`, Mechanism A will fire but the one outlier won't be included in the expansion, creating an inconsistent display.

**Rule:** All records sharing a `cluster` must share the same `near_identical` value. Validate in Task 0.1.

### EC-0.6 — `scene` that doesn't match the image

The spec calls this out explicitly: a past build had scenes describing things the image didn't show. This is the most common and most damaging data quality failure.

**Rule:** After generating the catalogue, open 10 random records and visually confirm `scene` matches the actual image. Do this *after* image sourcing, not before.

### EC-0.7 — Image file missing for a record

If `images/p_0412.jpg` doesn't exist, the thumbnail renders as a broken image icon. The modal shows nothing.

**Rule:** After sourcing images, verify every record's `file` resolves to an existing file. A script that iterates `catalogue.json` and checks `fs.existsSync` for each.

---

## Stage 1 — Conversation Engine

### EC-1.1 — Model returns non-JSON

Claude sometimes wraps JSON in markdown fences (`` ```json ... ``` ``), or prepends a conversational sentence before the JSON block.

**Handling:**
1. Try `JSON.parse(response)`.
2. If that fails, extract content between first `{` and last `}` (or first `[` / last `]`), then parse again.
3. If that also fails, return 502 with the raw text. Never silently substitute a mock.

### EC-1.2 — Model returns candidate ids not in the catalogue

The model may hallucinate a plausible-looking id (`p_9999`) that doesn't exist.

**Handling:** Skip silently in the UI. Log the count of skipped ids to the console. Never render a `<img>` with a src that will 404.

### EC-1.3 — Model returns zero candidates

The user's description matches nothing, or the model is confused.

**Handling:**
- Render the model's `say` text with no thumbnail grid.
- If `say` is also empty or missing, render: *"I haven't found anything yet. Tell me something else you remember — anything at all, even if you're not sure about it."*
- Never render an empty grid container (visual blank space is confusing).

### EC-1.4 — Model returns `candidates` with duplicates

The model might list the same id twice: `["p_0412", "p_0412", "p_0413"]`.

**Handling:** Deduplicate the candidates array before rendering. Preserve the order of first occurrence.

### EC-1.5 — Model returns more than 8 candidates

The system prompt says "at most 8" but the model may ignore this.

**Handling:** Truncate to the first 8 *before* cluster expansion (Mechanism A). After expansion, the rendered set may exceed 8 — that's expected and correct for near-identical clusters.

### EC-1.6 — Cluster expansion produces a very large grid

`c_trek` has 8 records but `near_identical: false`, so Mechanism A won't fire. But a user-uploaded library could have a burst of 15 photos in 60 seconds, all clustered with `near_identical: true`. Mechanism A would expand to all 15.

**Handling:** No cap on expansion — showing all near-identical records is the correct behaviour. But ensure the CSS grid wraps gracefully at any count. Test with 15+ thumbnails.

### EC-1.7 — Two different clusters both need expansion

The model returns candidates from both `c_hampi_cafe` and `c_receipts`. Both are near-identical. Mechanism A fires for both.

**Handling:** Expand each cluster independently. Each gets its own "All from the same moment" band. The grid shows both expanded clusters in candidate order.

### EC-1.8 — `cannot_distinguish` is missing from the response

The model's JSON might omit the field entirely: `{ "say": "...", "candidates": [...] }`.

**Handling:** Default `cannot_distinguish` to `false`. Default `co_present` to `[]`. The code must never crash on a missing optional field.

### EC-1.9 — `say` contains markdown, HTML, or very long text

The model might return markdown formatting, HTML tags, or a 500-word essay despite rule 10 ("two or three sentences").

**Handling:**
- Render `say` as plain text, not innerHTML. Use `textContent` or a minimal markdown renderer (bold/italic only).
- No length truncation — if the model is verbose, let it show. The prompt discourages it; code shouldn't fight it.

### EC-1.10 — Conversation grows very long

After 20+ turns, the messages array sent to the API becomes large. Combined with the full catalogue, the request may exceed model context limits.

**Handling:**
- The catalogue is 45 records × ~200 bytes ≈ 9KB — small.
- Monitor the total message token count. If the conversation exceeds ~50 turns (unlikely in practice), consider truncating the earliest turns while keeping the system prompt + catalogue intact.
- For MVP: no truncation. Flag this for post-MVP if users report issues.

### EC-1.11 — API key not set

The Vercel function reads `process.env.ANTHROPIC_API_KEY`. If it's missing or empty:

**Handling:** Return `{ error: "API key not configured" }` with status 500. The client must display this error, not silently fail. Never fall back to mock data.

### EC-1.12 — Anthropic API rate limiting (429)

Under load or during testing, the API may return 429 Too Many Requests.

**Handling:** Surface the error to the user: *"The service is busy. Please try again in a moment."* Do not retry automatically in a tight loop — that worsens the problem.

### EC-1.13 — Network failure between client and Vercel function

The user's internet drops, or Vercel has an outage.

**Handling:** Catch `fetch` errors. Display: *"Something went wrong. Check your connection and try again."* Remove the loading indicator. Do not leave the UI in a "thinking" state forever.

---

## Stage 1 — Voice Input

### EC-1.V1 — Browser doesn't support Web Speech API

Safari on iOS supports it; Firefox desktop does not. Many mobile browsers are inconsistent.

**Handling:** Check `window.SpeechRecognition || window.webkitSpeechRecognition`. If unavailable, hide the mic button entirely. Do not show an error message — the text input works fine alone.

### EC-1.V2 — Microphone permission denied

The user clicks the mic button but denies the browser's permission prompt, or has previously blocked mic access for the site.

**Handling:** Catch the `error` event from SpeechRecognition. If `error.error === 'not-allowed'`, show a brief toast: *"Microphone access was denied."* Then hide the mic button for the rest of the session (re-prompting is annoying).

### EC-1.V3 — Speech recognition returns gibberish

Background noise, accents, or low-confidence results produce nonsensical text.

**Handling:** The transcript appears in the text field and is **editable before sending**. The user can correct it. Never auto-send. This is the spec's explicit design.

### EC-1.V4 — User speaks for a very long time

With `continuous = true`, the user might speak for 2+ minutes, producing a very long transcript.

**Handling:** No hard cutoff. The text field should scroll or expand. The 3-second silence timeout will eventually stop recognition. The long transcript is actually valuable — the spec says "voice is how the system gets enough to work with."

### EC-1.V5 — Multiple rapid mic toggle taps

User taps mic-start, mic-stop, mic-start in quick succession.

**Handling:** Debounce the mic button. Track recognition state (`idle`, `listening`, `stopping`). Ignore taps while in `stopping` state. `SpeechRecognition.start()` throws if called while already started — catch that error.

---

## Stage 2 — Upload Mode

### EC-2.1 — User uploads 0 files

They open the file picker and click Cancel, or select nothing.

**Handling:** No-op. Don't show an error. The consent screen stays visible.

### EC-2.2 — User uploads 1–9 files

Below the minimum of 10.

**Handling:** Show a message: *"Please pick at least 10 photos. You selected N."* Do not process. The minimum exists because the conversation engine needs enough records to be meaningful.

### EC-2.3 — User uploads 61+ files

Above the maximum of 60.

**Handling:** Warn: *"You selected N photos. Processing the first 60."* Process the first 60 by the order the browser provides them (typically alphabetical or by selection order). Do not silently truncate — the user must see the warning.

### EC-2.4 — Non-image files in the selection

User selects a `.pdf`, `.mp4`, `.txt`, or other non-image file despite `accept="image/*"`.

**Handling:** The `accept` attribute is a hint, not enforcement. Check each file's MIME type before processing. Skip non-image files with a count: *"Skipped 3 files that weren't images."*

### EC-2.5 — Corrupt or unreadable image file

A JPEG with a truncated header, a renamed `.txt` file, or a zero-byte file.

**Handling:** The canvas draw or `createImageBitmap` will fail. Catch per-file, mark `describe_failed: true`, continue with the rest. Report at the end: *"N photos couldn't be read."*

### EC-2.6 — HEIC/HEIF images

iPhones produce `.heic` files. Most browsers can't render them natively. `<canvas>` drawImage will fail.

**Handling:** Detect by file extension or MIME type (`image/heic`, `image/heif`). Show a specific message: *"N photos are in HEIC format, which this browser can't process. Export them as JPEG from your phone's gallery first."* Do not silently skip — the user needs to know why their photos weren't included.

### EC-2.7 — All EXIF dates are missing (WhatsApp scenario)

More than 50% of files have no `DateTimeOriginal` and no useful `lastModified`.

**Handling:** Show the WhatsApp warning: *"Most of these photos have no date — they were probably shared through a messaging app. Copying them from your phone or Google Photos keeps the dates."* Continue processing — the photos are still searchable, just not clusterable.

### EC-2.8 — `exifr` lite fails on valid camera JPEGs

The lite build of `exifr` doesn't parse all EXIF variants. If >⅓ of files that look like camera JPEGs return no date:

**Handling:** Switch the import to the full `exifr` build. This is a developer-time decision during build, not a runtime fallback. Add a note in `build_notes.md` if this occurs.

### EC-2.9 — `lastModified` is unreliable

Some browsers report the *upload time* as `lastModified`, not the file's original modification date. A batch of photos from different years might all get today's date.

**Handling:** Prefer `DateTimeOriginal` from EXIF. Use `lastModified` only as fallback. If all fallback dates are suspiciously close together (e.g., all within 1 hour), treat them as `null` instead — they're the upload timestamp, not the photo timestamp.

### EC-2.10 — Two photos taken exactly at the same second

`taken_at` is identical for two photos (burst mode on a phone).

**Handling:** They fall within the 60-second clustering window. They get the same cluster and `near_identical: true`. This is correct — burst-mode photos are near-identical.

### EC-2.11 — Very large image files (10MB+ each)

A batch of 50 × 10MB photos = 500MB of data to process. IndexedDB might struggle; the browser tab might run low on memory.

**Handling:** The downscale step (768px, JPEG 0.7) should reduce each to ~100–200KB. But the *input* files are large. Process one at a time: read → downscale → store downscaled blob → release the original. Don't hold all 50 full-resolution images in memory simultaneously.

### EC-2.12 — Description API returns an invalid `kind`

The model might return `kind: "selfie"` or `kind: "meme"` — values not in the enum.

**Handling:** If `kind` is not one of `photo`, `screenshot`, `document`, `receipt`, `video_thumb`, default to `photo`. Log the unexpected value.

### EC-2.13 — One image in a batch of 5 fails during description

One of the concurrent Anthropic API calls times out or errors.

**Handling:** `Promise.allSettled` ensures the other 4 succeed. Return `{ id, error: "<message>" }` for the failed image. Mark it `describe_failed: true` in the record. Continue to the next batch. Report total failures at the end.

### EC-2.14 — All 5 images in a batch fail

The API key is invalid, or Anthropic is down.

**Handling:** All 5 return as errors. The batch reports 5 failures. The next batch will likely fail too. After 2 consecutive fully-failed batches, stop and surface: *"Image descriptions are failing. Check your connection or try again later."* Do not burn through 40 API calls that will all fail.

### EC-2.15 — User navigates away mid-upload

The page is refreshed or closed while describing photo 23 of 40.

**Handling:** IndexedDB writes already committed are durable. The localStorage catalogue is only written at the end (step 8). On return, the user sees the consent screen again because no catalogue was saved. They must re-upload. This is acceptable for MVP — partial resume is complex and not required.

### EC-2.16 — "Delete everything" while upload is in progress

The user taps Delete while the batch description is running.

**Handling:** Abort the upload pipeline first (set a flag, stop making API calls). Then clear IndexedDB and localStorage. Show the consent screen. Do not let the upload continue writing to a store that was just cleared.

### EC-2.17 — IndexedDB quota exceeded

On some browsers (Safari private browsing), IndexedDB has very low limits (as low as a few MB).

**Handling:** Catch `QuotaExceededError` on `putBlob`. Stop storing further blobs. Show: *"Your browser's storage limit was reached. N photos were saved. Try using a regular (non-private) browser window."*

### EC-2.18 — User uploads the same photos twice

They complete one upload, then upload 30 more photos that include some of the same files.

**Handling:** Generate new ids for every upload. The catalogue will contain duplicates. This is acceptable for MVP — deduplication requires image hashing, which is out of scope. The conversation engine will just have redundant records.

---

## Stage 3 — Classic Search

### EC-3.1 — Empty query

User submits an empty string or only whitespace.

**Handling:** Return 0 results. Do not search against all records — that would show everything and be misleading.

### EC-3.2 — Query is a single character

User types "a". This matches nearly every record because `scene` almost always contains "a".

**Handling:** No special handling. Return all matches. The result is technically correct, and if the user tries single-character searches in a real product, the result speaks for itself.

### EC-3.3 — Query contains special regex characters

User types `"receipt (2023)"` — the parentheses are literal, not regex.

**Handling:** Classic search uses `String.includes()`, not regex. No escaping needed. This is a benefit of the simple design.

### EC-3.4 — Query matches `visible_only_on_close_look` but search doesn't read that field

User types "eyes closed" — this detail is in `visible_only_on_close_look` but classic search only reads `scene`, `place.name`, and `people`.

**Handling:** Returns 0 results. This is correct and intentional — it demonstrates the failure mode that the conversation engine solves. Do not "fix" this by adding `visible_only_on_close_look` to the search fields.

### EC-3.5 — Query in a different language

User types in Hindi or another language. The `scene` text is in English.

**Handling:** Returns 0 results. Classic search is literal token matching — no translation. The conversation engine (Stage 1) can handle this because Claude understands multiple languages and can match concepts across languages.

### EC-3.6 — Very long query (100+ words)

User pastes a paragraph. All tokens must match — this will almost certainly return 0 results.

**Handling:** No truncation. Return 0 results. The "0 of 45. Try the conversation" message appears.

---

## Stage 4 — Deposits

### EC-4.1 — User taps "That's it" on the wrong photo

They confirm a photo by mistake.

**Handling:** The deposit is saved. For MVP, there is no undo. The deposits view (`deposits.html`) shows all deposits — the user can see what was saved but cannot delete individual deposits. Document this as a known limitation in `build_notes.md`.

### EC-4.2 — User's hunt messages are empty

The user opens a photo from the grid without saying anything (e.g., the engine showed candidates on the first message and the user tapped one immediately).

**Handling:** There's at least one user message (the initial query). That message becomes the deposit. If somehow the hunt messages array is truly empty (shouldn't happen — the user must have typed something to get candidates), skip the deposit silently.

### EC-4.3 — Deposit text contains only stop words

User said: "the one that is it". After removing stop words, no distinctive words remain.

**Handling:** Fall back to the full phrases. The confirmation shows the raw text rather than extracted keywords: *"Saved what you said. This photo now answers to: 'the one that is it'."* It's not elegant but it's honest.

### EC-4.4 — Same photo confirmed multiple times across hunts

The user searches for the same photo in three separate sessions and taps "That's it" each time.

**Handling:** Each hunt's messages are appended to `user_deposits`. The deposit array grows with each confirmation. This is correct — the photo accumulates more and more descriptions from different search contexts, making it progressively easier to find. This is the compounding effect the spec calls out.

### EC-4.5 — `user_deposits` grows very large

After many hunts, a record has 50 deposit entries.

**Handling:** No cap. The deposits are stored in localStorage as part of the catalogue. A single record with 50 deposits is ~5KB — well within limits. The deposits view should render them all, perhaps with most recent first.

### EC-4.6 — localStorage is full when saving deposits

On some browsers, localStorage has a 5MB limit per origin.

**Handling:** Catch the `QuotaExceededError` on `setItem`. Show: *"Couldn't save — your browser's storage is full. Try clearing old data."* Do not lose the deposit silently.

### EC-4.7 — Demo mode deposits vs. user mode deposits

Deposits saved in demo mode should not appear in user mode, and vice versa.

**Handling:** They use separate localStorage keys (`tow_demo_deposits` vs. `tow_user_deposits`). The catalogue loader merges the correct deposits based on the current mode.

---

## Stage 5 — Social Handoff

### EC-5.1 — `ask_friend` prompt returns invalid JSON

The model returns free-form text instead of `{ question, options, why }`.

**Handling:** Same JSON extraction logic as EC-1.1. If extraction fails, show a fallback question: *"What do you remember about this moment?"* with a free-text input only (no tappable options).

### EC-5.2 — `options` array is empty or has 1 item

The prompt says "2 or 3 options" but the model might return fewer.

**Handling:** If 0 options: show the free-text input only. If 1 option: show it plus the free-text input. The free-text input is always available as a fallback.

### EC-5.3 — Amit's answer doesn't change the ranking

The friend's answer is irrelevant or the model fails to re-rank meaningfully.

**Handling:** Show the unchanged candidate list with: *"That didn't narrow it down, but it's noted."* Still store the answer as a deposit — it has future value even if it didn't help this hunt.

### EC-5.4 — Disagreement case fails to surface both chair colours

In the `c_hampi_cafe` disagreement, the model might pick a side instead of saying "both are real."

**Handling:** This is a model behaviour issue, not a code issue. The hunt prompt (rule 4) tells the model not to pick sides. If it still does, the code has no structural fix — but Mechanism A will expand the full cluster, so at least all 5 photos are shown. Document in `build_notes.md` if this occurs during testing.

### EC-5.5 — Pass-it-on page loaded without demo catalogue

The page hardcodes `c_trek` and `c_hampi_cafe` clusters. If the demo catalogue fails to load (network error, corrupted JSON):

**Handling:** Show a clear error: *"Couldn't load the demo library. Check your connection."* Do not show an empty two-pane layout.

---

## Stage 6 — Postcard

### EC-6.1 — No qualifying record exists

All records either have `opened_since_capture: true` or non-empty `user_deposits`.

**Handling:** Show: *"You've described everything! No forgotten photos left."* Do not show a blank card.

### EC-6.2 — `taken_at` is null on the selected record

The postcard's date anchor ("A Tuesday in 2019") requires a parseable date.

**Handling:** Use the fallback text: *"Sometime. You haven't opened this one."* Do not crash on `new Date(null)`.

### EC-6.3 — User submits an empty answer to "What was this?"

They tap Submit without typing or speaking anything.

**Handling:** Do not save an empty deposit. Show: *"Say or type something about this photo — even a few words help."*

### EC-6.4 — User submits a single word

They type "food".

**Handling:** Accept it. A one-word deposit is still valuable. The confirmation shows: *"This photo now answers to 'food'."* The search chip links to a conversation that searches for "food".

### EC-6.5 — The search-chip navigation fails

The chip links to `index.html?q=<deposited words>`. If the conversation surface has a bug, the pre-filled search might not auto-send.

**Handling:** The query parameter pre-fills the text input. If auto-send fails, the user can hit Enter manually. The text is there — the photo will be found. Don't make the postcard experience depend on a fragile auto-send mechanism.

---

## Cross-Cutting Edge Cases

### CC-1 — localStorage cleared by browser

Some browsers (especially mobile) may clear localStorage under storage pressure, or the user clears site data from browser settings.

**Impact:** All catalogues, deposits, and mode preferences are lost. IndexedDB blobs may also be cleared.

**Handling:** On load, if expected localStorage keys are missing, revert to demo mode with the consent screen available. Do not crash. Do not show a confusing empty state.

### CC-2 — IndexedDB unavailable

Firefox private browsing historically had broken IndexedDB. Some enterprise browsers disable it.

**Handling:** The IDB wrapper's `openDB()` should catch the open failure. If IndexedDB is unavailable:
- Demo mode works fine (images are static files).
- User mode cannot work (no blob storage). Disable the "Your photos" toggle and show: *"Photo upload isn't available in this browser."*

### CC-3 — Two tabs open simultaneously

User opens the app in two tabs. Both read/write localStorage and IndexedDB.

**Handling:** localStorage writes are visible across tabs immediately. IndexedDB transactions isolate concurrent access. The main risk is one tab saving a catalogue while the other is mid-hunt with an older copy. For MVP: no tab coordination. If deposits are lost because of a race, it's unfortunate but not a blocker.

### CC-4 — User refreshes mid-conversation

The page reloads. The conversation messages (in-memory) are lost.

**Handling:** The conversation starts fresh. The input field is empty. This is expected behaviour — the spec says messages are not persisted. The user starts a new hunt.

### CC-5 — Very slow network

The Anthropic API call takes 10+ seconds. The user sees the loading indicator for a long time.

**Handling:** Show the loading indicator (animated dots/pulse) immediately on send. No timeout on the client side — let the Vercel function's 30-second `maxDuration` be the backstop. If the function times out, the fetch will fail and the error handler from EC-1.13 applies.

### CC-6 — Vercel cold start

The first request after idle hits a cold serverless function, adding 2–5 seconds of latency.

**Handling:** No code fix — this is infrastructure. The loading indicator covers it. If it's consistently slow, consider using Vercel's "always warm" feature for the `converse.js` function. Document in `build_notes.md`.

### CC-7 — `catalogue.json` fails to fetch

Network error, 404, or malformed JSON when loading the demo catalogue.

**Handling:** Catch the fetch/parse error. Show: *"Couldn't load the photo library. Please refresh."* Do not show an empty conversation surface with no catalogue backing it — the engine will produce meaningless results.

### CC-8 — Object URL memory leak

In user mode, `loadCatalogue` creates `URL.createObjectURL()` for every blob. If the user switches modes repeatedly without calling `releaseImageURLs()`, browser memory grows.

**Handling:** `releaseImageURLs()` is called on every mode switch and on "Delete everything". If the user somehow triggers 100 mode switches, each properly releases. Test by monitoring browser memory in DevTools during repeated switching.

### CC-9 — Content Security Policy blocks CDN scripts

If Vercel or a browser extension applies a restrictive CSP, the `exifr` CDN import will fail.

**Handling:** The upload pipeline should catch the import failure. If `exifr` can't load, EXIF extraction is unavailable — set all `taken_at` to `file.lastModified` with a console warning. The photos still get described; they just can't be clustered as accurately.

### CC-10 — Model response latency varies between turns

Turn 1 takes 2 seconds; turn 5 (with a large message history + catalogue) takes 12 seconds.

**Handling:** The loading indicator has no timeout or progress bar — it's a simple animation. This is correct. A progress bar that fills unpredictably is worse than a spinner. The user sees the input is disabled and the animation is running.

### CC-11 — User pastes an image into the text field

Some browsers allow pasting images into text inputs. The conversation engine can't process images.

**Handling:** The `<input type="text">` naturally ignores pasted images. If using a `<textarea>` or contenteditable, explicitly ignore paste events that contain image data. Only accept text.

### CC-12 — Catalogue sent to API is too large

45 records × ~200 bytes ≈ 9KB. This is fine. But a user-uploaded catalogue with 60 records, each with long `visible_only_on_close_look` and accumulated deposits, could reach 50–100KB.

**Handling:** Still well within API limits (Claude's context window handles millions of characters). No action needed for MVP. Monitor if user catalogues with heavy deposits grow beyond 200KB.

### CC-13 — Modal opened but the image fails to load

The thumbnail rendered, but the full-size image (or object URL) fails when opened in the modal.

**Handling:** Add an `onerror` handler on the modal `<img>`. Show a placeholder with: *"Couldn't load this photo."* Keep the modal functional (date, place, people still visible).

### CC-14 — User types in the text field while voice recognition is active

The mic is recording, live transcript is filling the field, and the user starts typing.

**Handling:** The voice transcript and manual typing will collide in the same field. Stop recognition if the user types (keydown event → call `stop()`). This gives the user control — their typing overrides the voice.

### CC-15 — Rapid successive messages

User sends 3 messages before the first response arrives.

**Handling:** Queue messages. Only send to the API after receiving the previous response. Show each user message in the thread immediately, but hold the API call until the previous one resolves. This prevents race conditions in the messages array.

---

## Summary: severity classification

| Severity | Count | Examples |
|----------|-------|---------|
| **Will crash/break** | 7 | EC-1.1 (non-JSON), EC-2.6 (HEIC), EC-2.17 (quota), EC-6.2 (null date), CC-2 (no IDB), CC-7 (catalogue 404), EC-1.V5 (double start) |
| **Silent data loss** | 5 | EC-0.3 (duplicate ids), EC-4.6 (localStorage full), EC-2.15 (nav mid-upload), CC-1 (storage cleared), CC-3 (two tabs) |
| **Confusing UX** | 10 | EC-1.3 (zero candidates), EC-1.6 (large grid), EC-2.3 (61+ files), EC-2.7 (no EXIF), EC-2.14 (all fail), EC-3.4 (visible-only detail), EC-5.3 (no re-rank), EC-6.1 (no record), CC-5 (slow), CC-6 (cold start) |
| **Correct but surprising** | 8 | EC-3.2 (single char), EC-4.4 (multi-confirm), EC-1.5 (>8 candidates), EC-2.10 (same-second), EC-2.18 (duplicates), EC-4.3 (stop words), EC-6.4 (single word), CC-10 (latency varies) |
| **Defence in depth** | 6 | EC-0.4 (single-member cluster), EC-0.5 (mixed near_identical), EC-1.4 (duplicate candidates), EC-1.8 (missing fields), EC-2.12 (invalid kind), CC-9 (CSP) |
