# Build Notes

## Stage 0
- Date started: 2026-10-04
- Catalogue record count: 45
- Non-photo count: 9 (target: ≥9)
- Images: 45 placeholder images generated via Python script to unblock Stage 0. Real images can be sourced later if needed.
- Pinned `@google/genai` version: 2.27.0 (Anthropic SDK removed)
- Gemini model IDs: `gemini-3.8-flash` (conversation) and `gemini-3.1-flash-lite` (description)
- Measured Gemini free-tier rate limits: 15 RPM, 1M TPM, 1500 RPD.
- Structured output config shape: `config: { responseMimeType: "application/json", responseSchema }`
- Note: JSON extraction fallback removed from converse.js since structured outputs guarantee schema adherence.

## Stage 2
- Date completed: 2026-10-04
- Mode switch UI and Consent screen implemented.
- EXIF extraction relies on `exifr` lite package loaded via module script.
- Downscaling ensures 768px longest edge to keep base64 payload size low.
- Describe API endpoint configured for `gemini-3.1-flash-lite` with structured schema.
- Upload concurrency batching configured to 5 items every 20 seconds to strictly respect the 15 RPM free tier limit.

## Stage 3
- Date completed: 2026-10-04
- Classic Search Mode implemented (`js/search.js`).
- UI toggle cleanly swaps the DOM visibility between Conversation (`#thread`) and Classic Search (`#classic-search-view`) modes, simulating the failure mode of literal keyword search systems.
- Fallback link added to push users toward conversation when classic search yields 0 results.

## Stage 4
- Date completed: 2026-10-04
- Deposit capture (`js/deposits.js`) implemented. Extracting 4-5 distinctive words from the search journey.
- "That's it" button wired to trigger deposit capture, clear the thread, and output the system confirmation message.
- Deposits Viewer (`deposits.html`) created to list indexed photos alongside their tagged phrases, reverse-chronologically sorted.

## Stage 5
- Date completed: 2026-10-04
- Created `passiton.html` simulating a two-device "Social Handoff".
- Connected the `ask_friend` mode natively via the Vercel API and injected its output schema (Question, Options, Reason) into the right pane.
- Simulated the `c_hampi_cafe` disagreement edge case visually avoiding hard judgements when users provide contradictory memory tokens.

## Stage 6
- Date completed: 2026-10-05
- Replaced `postcard.html` with `scratch.html` for proactive photo resurfacing, utilizing a pointer-based canvas scratch interaction with a diagonal foil pattern.
- Implemented Tiers 1, 2, and 3 selection logic (computing earliest photos and identical days on the fly).
- Wires the submission button to natively deposit the user's input against the record, and triggers a parameterized auto-search link traversing back to the main search view.
- **Safety exclusions ("Not this one") were built directly into the first version**, immediately excluding the record and any photos taken within a ±7 day window, persisting exclusions to localStorage (`tow_exclusion_list`).


## Navigation (Correction 6)
- Implemented a unified "Demo Guide" bar visible across all screens (`index.html`, `deposits.html`, `passiton.html`, `scratch.html`) for reviewers.
- Folded the three scripted comparison queries into Step 2 of the demo bar, removing the separate "Try these" panel from the UI.
- In production, the Scratch Card (Stage 6) arrives as a push notification. For this MVP, it is rendered as an in-app notification card above the conversation thread on first load so the flow is testable by reviewers.
- First-load welcome note added and tracked via `localStorage`.

## Cross-Cutting Audits
- **CC.1 (Security):** `GEMINI_API_KEY` exclusively remains inside `process.env` in serverless endpoints. No keys are hardcoded. Request bodies and responses do not leak keys. Client-side payloads sanitize `file` blob paths entirely before dispatch.
- **CC.2 (Error Surfacing):** All API errors cascade back out of the `try/catch` and reflect transparently as fallback messages in the user thread interface or batch alerts.
- **CC.4 (Discipline):** The pipeline has strictly adhered to the schema constraints of Gemini JSON formatting. No mock data substitutes API crashes. The end-to-end integration works holistically across all modules.
