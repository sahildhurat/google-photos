# Context — *The One Where*

> Corrections dated 2026-10-04 supersede `ProblemStatement.md` where they conflict. See `docs/corrections.md`, `docs/corrections-2-gemini.md`, `docs/corrections-4-comparison.md`, and `docs/corrections-5-scratch.md, corrections-6-navigation.md`.

> This document distils the full [ProblemStatement.md](file:///d:/Google%20Photos/docs/ProblemStatement.md) into an actionable reference. It is organised so any contributor can understand **why** the product exists, **what** it does, **how** it is built, and **where** the traps are — without re-reading the original spec each time.

---

## 1. What the product is

**The One Where** is a publicly deployed, interactive web MVP for **photo retrieval**. It is built for people who *remember* a photo but *cannot describe it precisely enough to find it*.

It is **not** a better search box. The core thesis — validated in user research — is:

> Retrieval is a **conversation with someone who was there**, not a query.

The product must feel like talking to a friend who was present, not like filing a support ticket with a search engine.

---

## 2. The four founding principles

Every design, engineering, and copy decision must visibly serve these four principles. They are non-negotiable.

| # | Principle | What it means in practice |
|---|-----------|--------------------------|
| 1 | **Offer recognition, not description** | Users cannot produce the right words. They *can* recognise the photo the instant they see it. The system's job is to narrow to a small set and *show them* — never to demand a better query. |
| 2 | **Name what you cannot distinguish** | The worst failure is a *convincing wrong answer* — the user trusts it and stops checking. When the system holds several candidates it cannot tell apart, it must **say so out loud** and show all of them. |
| 3 | **Hedged details rank, never filter** | "Maybe green chairs" is a ranking nudge. A search engine would filter on `green` and destroy the result set. This system must *never* exclude a photo based on a hedged detail. |
| 4 | **Memory is social** | Every research participant reached for another person. The product must support — and eventually harness — the fact that memories are shared across people. |

---

## 3. Architecture & technology stack

### 3.1 Hard constraints

| Layer | Choice | Rationale / Constraint |
|-------|--------|------------------------|
| **Front end** | Plain HTML + CSS + vanilla JS | No framework, no build step. One page per surface, shared stylesheet, shared JS modules. |
| **Back end** | Vercel serverless functions (`api/`) | Static + functions deploy target. |
| **Conversation model** | `claude-sonnet-5` | **Do not set `temperature`** — deprecated on this model and will error. |
| **Image description model** | `claude-haiku-4-5-20251001` | Used only in Stage 2 upload ingest. |
| **API key** | `ANTHROPIC_API_KEY` Vercel env var only | Must **never** appear in client code, committed files, or response bodies. |
| **Persistent state** | `localStorage` for catalogues & deposits; **IndexedDB for image blobs** | No database, no auth. IndexedDB is required for images — localStorage will silently blow its ~5 MB quota. |
| **Deploy** | Vercel | Project root contains `index.html`. |

### 3.2 Two catalogues, one engine

The product runs against **two interchangeable catalogues**, switchable in the UI:

1. **Demo library** — curated stock photos with hand-written records in `data/catalogue.json`. Contains deliberate "traps" so all four principles surface within 90 seconds. This is what an evaluator sees on a cold open.
2. **Your photos** — user uploads 30–50 of their own photos; the app auto-describes them via the Haiku model. This is for real testing, because the product's core claim (recognising *your own* memory) cannot be tested on a stranger's library.

**The conversation engine is identical in both modes.** Only the catalogue source differs. The engine must never be forked.

### 3.3 Pages / surfaces

| File | Purpose | Stage |
|------|---------|-------|
| `index.html` | Main conversation surface + classic search toggle | 1, 3 |
| `deposits.html` | Shows photos with accumulated user deposits | 4 |
| `passiton.html` | Two-pane "ask a friend" simulation | 5 |
| `scratch.html` | Proactive resurfacing card | 6 |

---

## 4. Data model — the photo record

Every photo (demo or user-uploaded) is represented as a structured record. The canonical shape:

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
  "near_identical": true,
  "opened_since_capture": false,
  "user_deposits": []
}
```

### 4.1 Field semantics

| Field | Rules |
|-------|-------|
| `kind` | One of `photo`, `screenshot`, `document`, `receipt`, `video_thumb`. ~20% of records must **not** be `photo` — research found 19% of things people hunt for are non-photographs. |
| `scene` | One sentence, neutral observer, describes the thumbnail. No emotional language, no event names. Must match the actual image. |
| `visible_only_on_close_look` | Details only visible after opening the photo. **This field is what makes the demo work** — it lets the system honestly say "I cannot tell these apart from the thumbnails." |
| `cluster` | `null` for standalone items; shared string for grouped sets (near-identical or same-event). |
| `near_identical` | `true` if the members of this record's cluster cannot be reliably told apart from a thumbnail. `false` otherwise. All records in a cluster must share the same value. Standalone records (`cluster: null`) are always `false`. |
| `opened_since_capture` | `false` on ~half the demo library. `null` in upload mode (unknowable). |
| `user_deposits` | Always starts `[]`. Grows as the user confirms photos (Stage 4). Each entry: `{ "said": "...", "at": "<ISO>" }`. |

### 4.2 Demo library clusters (Stage 0)

These four clusters are the demo. They are engineered to trigger all four principles.

| Cluster | Records | `near_identical` | Purpose & trap |
|---------|---------|-------------------|----------------|
| `c_hampi_cafe` | 5 | `true` | Same café, same morning. **3 frames have blue chairs, 2 have green.** Both colours are real. Tests Principle 2 (naming ambiguity) and the disagreement case in Stage 5. |
| `c_laughing` | 6 | `true` | Same woman laughing, same minute. Exactly **1 frame** has eyes almost closed / hair across face — that's the one users want. Tests Principle 1 (recognition) and Principle 2 (near-identical candidates). |
| `c_receipts` | 4 | `true` | Same provider, same amount, years 2021–2024. The year is illegible in a thumbnail. Tests Principle 2 (refusing to guess). |
| `c_trek` | 8 | **`false`** | Group trek, 3 named people, one day. **Not near-identical** — the eight are obviously different from each other. Used for the social handoff in Stage 5. |

Plus **22 standalone records** for realism: food (3), city streets (3), family at home (4), screenshots/documents (5–6), a wedding (2), a train journey (2), pets (2), accidental shots (1–2). Dates spanning 2018–2026. Recurring names: `Dev`, `Priya`, `Amit`, `Kavya`, `Rohan`, `Amma`, `Nani`, `Ishaan`.

**Total: exactly 45 records.** Within the 22 standalone, 5–6 must be non-`photo` kinds. Combined with the 4 receipts, that gives 9–10 non-photo records (~20%).

### 4.3 Demo images

- Source from **Unsplash or Pexels** (both permit this use).
- Resize longest edge to **1200px**, save as JPEG in `images/`, named by record id.
- For clusters: search for multi-shot series from the same photographer. Failing that, generate variants with crops/shifts/brightness.
- **The `scene` must describe the actual image.** Verify 10 random records before reporting done.
- If sourcing stalls >45 min: solid-colour placeholders with record id drawn on them, move to Stage 1, come back later.

---

## 5. The conversation engine

### 5.1 API endpoint

`api/converse.js` receives `{ mode, messages, catalogue }` and returns a response depending on mode.

**`mode: "hunt"` (default)** — returns:

```json
{
  "say": "<message to the user>",
  "candidates": ["<photo id>", ...],
  "cannot_distinguish": true | false,
  "co_present": ["<name>", ...]
}
```

- `candidates`: best-first, at most 8.
- `cannot_distinguish`: `true` when top candidates are near-identical and the distinguishing detail is not in the records.
- `co_present`: names of people who were present (for Stage 5 social features).

**`mode: "ask_friend"`** — returns:

```json
{
  "question": "<the question>",
  "options": ["<short answer>", "<short answer>", "<short answer>"],
  "why": "<one short line: what this would tell us>"
}
```

The `mode` parameter selects between two system prompts held **server-side**. The client sends only the mode string — it never controls the prompt text.

### 5.2 System prompt rules (summary)

**Hunt prompt** — the engine is a Gemini model given the catalogue (without `file` paths) and these behavioural rules:

1. **Never ask for a better description** — the user has given everything they can.
2. **Shortlist, then ask ONE splitting question** — a question that actually distinguishes between held candidates.
3. **Hedged details rank, never filter** — "maybe", "I think", "possibly" boost but never exclude.
4. **Say plainly when you cannot distinguish** — never present one photo confidently while holding an ambiguous set.
5. **Prefer time anchors over dates** — "the week before Diwali" > "August 2019".
6. **Remember everything** — each turn narrows; nothing is forgotten.
7. **Note mentioned people** — may suggest asking them.
8. **Weight `user_deposits` heavily** — they are the user's own words.
9. **Be honest about missing dates** — say "I don't know when" rather than guessing.
10. **Two or three sentences** — talking, not writing.

**Ask-friend prompt** (used in Stage 5):

```
Someone is trying to find a photo and has got stuck. A second person, who was
present when the photo was taken, is now being asked for help.

You are given the candidate records and the conversation so far.

Write ONE question for that second person. It must be:
- answerable in a few words, without them seeing the full photo
- about something the second person would know and the first person would not
- a question whose answer would change which candidate ranks highest

Do not ask them to describe the photo. Do not ask more than one question.

Return JSON only:
{
  "question": "<the question>",
  "options": ["<short answer>", "<short answer>", "<short answer>"],
  "why": "<one short line: what this would tell us>"
}

Give 2 or 3 options. They must be mutually exclusive, and each must point to a
different candidate.
```

When the friend answers, their answer is appended as a user turn (`"Amit says: \"it was the morning\""`), then `converse.js` is called in `"hunt"` mode as normal. The engine re-ranks using rule 7.

### 5.3 Cluster enforcement (two mechanisms)

The original single-rule approach over-fired on non-near-identical clusters (e.g., `c_trek`). It is replaced by two separate mechanisms:

**Mechanism A — structural, in code, cannot be overridden.**

```
After receiving candidates from the API, before rendering:

1. For each distinct non-null cluster appearing among the returned candidates:
2.   If 2 or more returned candidates belong to that cluster
     AND that cluster's records have near_identical === true:
3.     Add every catalogue record in that cluster to the render list,
       inserted at the rank of its highest-ranked existing member.
4.     Mark that cluster as expanded.
5. Render the resulting list as the thumbnail grid.
```

This guarantees the user is never shown one member of a near-identical set while the others are hidden.

**Mechanism B — judgement, from the model.**

The model sets `cannot_distinguish` in its own response. **Code must never set, override, or infer this flag.**

**Two bands, not one:**

- A cluster was expanded by Mechanism A → render an informational band above those thumbnails: **"All from the same moment."**
- The model returned `cannot_distinguish: true` → render the stronger band above the grid: **"I can't tell these apart from what I have."**

Both may appear at once. Style them differently — the first is neutral information, the second is the system admitting a limit.

This logic is enforced in `js/render.js`, not only in the prompt.

---

## 6. Voice input

Uses the **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`).

| Aspect | Behaviour |
|--------|-----------|
| Start | Mic button tap; `continuous = true`, `interimResults = true` |
| Display | Live transcript appears in the text field as spoken |
| Stop | Second tap, or 3 seconds of silence |
| Editing | Transcript is editable before sending; **never auto-send** |
| Unavailable | Hide the mic button silently; text-only input |
| Language | `en-IN` |

**Why voice matters:** Research found the same person describing the same memory produced a **40-word paragraph** when speaking vs. **two words** when typing. Voice is how the system gets enough signal.

---

## 7. Build stages — ordered summary

### Stage 0 — Demo catalogue
Create `data/catalogue.json` with exactly 45 records, 4 required clusters (with `near_identical` field), ~20% non-photo items, and matching images. **Everything depends on this.**

### Stage 1 — Conversation surface (`index.html`)
Single-column message thread, voice + text input, conversation engine integration, thumbnail grid rendering, two-mechanism cluster enforcement (Mechanism A for near-identical expansion, Mechanism B for model's `cannot_distinguish` judgement), full-width photo view with "that's it" button. **Deploy to Vercel immediately after this works.** Record URL in `docs/build_notes.md`.

### Stage 2 — Upload mode ("Your photos")
Mode switch UI, consent screen, file upload with EXIF extraction (via `exifr` CDN), browser-side downscale (768px, JPEG 0.7), IndexedDB storage, batch description via `api/describe.js` (Haiku model, **concurrent** calls per batch via `Promise.allSettled`), time-based clustering (**60-second** window), progress indicator, error resilience, WhatsApp EXIF warning, working delete button.

**Privacy is non-negotiable:** no logging of images/descriptions, no disk writes, response is JSON only.

**Known upload-mode limitations:**
- `people` stays empty (no name inference)
- `place` stays empty (no location inference)
- `opened_since_capture` is `null`
- WhatsApp strips EXIF → warn user if >50% of files have no date

### Stage 3 — Classic Search toggle
Literal token matching (lowercase, split on whitespace, all tokens must match across `scene`, `place.name`, `people`). No LLM, no fuzzy matching. Shows `"0 of <N>. Try the conversation."` on empty results. **This is the most persuasive comparison screen** — it reproduces documented search failures.

### Stage 4 — Deposits ("every search leaves something behind")
When user taps "that's it": collect all hunt messages, append to `user_deposits`, show confirmation with distinctive words. Deposits view at `deposits.html` shows all photos with accumulated phrases. This demonstrates compounding — the index grows with use.

### Stage 5 — Social handoff (`passiton.html`)
Two panes (You / Amit). Left: stalled hunt with 3 `c_trek` candidates. "Ask Amit" button. Right: shows a cropped detail + one model-generated question + tappable answers. Amit's answer re-ranks candidates and becomes a deposit on **both** libraries.

**Disagreement case:** `c_hampi_cafe` — user says blue, Amit says green. System must not pick a side; must surface that both are real ("there were two sets of chairs") and show both.

### Stage 6 — Scratch Card (`scratch.html`)
Pick a record based on tiers (Photo, Day, or Rarity) and disguise it as a scratch card interaction. Users scratch a foil canvas to reveal a photo and are asked "What was this?". On submit, it deposits the answer and immediately demonstrates retrieval. **The user sees the labour pay off in the same 10 seconds.**

---

## 8. Build order & cut line

```
Stage 0 → Stage 1 → deploy → Stage 2 → Stage 3 → Stage 4 → Stage 5 → Stage 6
```

If time runs short, **cut from the bottom**. A deployed Stage 1 + 2 + 3 is a valid MVP:
- Demonstrates the problem (Classic Search failing)
- Demonstrates the solution (Conversation)
- Lets a real user test on their own photos

**Six half-built stages is not a valid deliverable.**

---

## 9. Critical constraints & discipline rules

These exist because previous work on this project repeatedly reported completion that had not happened.

1. **Never report a stage complete without visually inspecting the running page.** Past bugs (e.g., invisible elements due to `width` on inline elements) survived code review but were broken on screen.
2. **Never report a number you haven't computed.** If you say 68 records, count them.
3. **Never invent quotes, statistics, or findings.** Everything factual is in the spec. If you need a fact that isn't there, say so.
4. **Raise, do not fall back.** Surface API errors. Do not substitute mock responses.
5. **Report partial completion honestly.** "Stage 4 done except the deposits view" is useful. "Stage 4 complete" when the view doesn't exist costs a day.
6. **Deploy after every stage** and confirm the live URL in a fresh browser.
7. **Test the delete button** by actually using it and confirming IndexedDB + localStorage are empty.
8. **Keep `docs/build_notes.md` current:** what's built, deployed, stubbed, and every ambiguous decision.

---

## 10. Upload test protocol (Appendix)

One real user will test with their own photos. The session design:

- **30–50 photos from ≥2 years ago**; they must not browse the folder first.
- Copy files directly from phone or Google Photos export (not messaging apps — WhatsApp strips EXIF).
- The test: can they find a specific photo they previously tried and failed to find?
- Consent screen before upload; delete button after.

**Build Stage 2 so this session happens in one sitting on a laptop:** upload → ~1 min visible progress → hunt. No sign-up, no setup, no config.

---

## 11. Key risks & edge cases

| Risk | Mitigation |
|------|------------|
| `localStorage` quota overflow with image blobs | Use IndexedDB for all image data (Stage 2 requirement) |
| Model ignoring cluster enforcement | Mechanism A in `js/render.js` structurally expands near-identical clusters; Mechanism B (`cannot_distinguish`) is the model's judgement and is never overridden by code |
| `c_trek` falsely triggering "can't distinguish" band | `near_identical: false` on `c_trek` prevents Mechanism A from firing; trek photos are obviously different |
| WhatsApp-forwarded images have no EXIF dates | Detect and warn user; do not silently degrade |
| `exifr` lite build missing EXIF on camera JPEGs | If >⅓ of camera JPEGs return no date, switch to the full `exifr` build before concluding the photos have no EXIF |
| Convincing wrong answer from near-identical receipts/photos | Mechanism A cluster expansion + model's `cannot_distinguish` flag |
| API key leakage | Server-side only via `process.env`; never in client code or response bodies |
| Image sourcing blocking progress | Placeholder fallback after 45 min; continue with engine work |
| Description batch timeout (Vercel 30s limit) | Run all 5 images in a batch **concurrently** via `Promise.allSettled`; each call individually wrapped in try/catch |
| Upload-mode thumbnails rendering empty | Pre-load all blobs from IndexedDB into an in-memory `Map<id, objectURL>` on catalogue load; `render.js` calls `getImageURL(id)` synchronously |
| Object URL memory leak in long sessions | `releaseImageURLs()` calls `URL.revokeObjectURL` on every entry; invoked on mode switch and "Delete everything" |
| Unpinned SDK dependency breaking mid-build | Pin SDK to exact version in `package.json`; record version in `build_notes.md` |
| Model returns zero candidates | Render the model's `say` with no grid; if `say` is also empty, show fallback: *"I haven't found anything yet. Tell me something else you remember — anything at all, even if you're not sure about it."* |
| Model returns unknown candidate ids | Skip silently in UI; log count of skipped ids to console; never render a broken image |
| Partial stage reported as complete | Discipline rules require visual verification + honest partial reporting |
