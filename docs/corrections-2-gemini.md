# Correction 2 — move the model layer from Anthropic to Gemini

Apply this after `docs/corrections.md`. Save it as `docs/corrections-2-gemini.md` and update the line at the top of `docs/context.md` and `docs/implementation-plan.md` to reference both correction documents.

This replaces the model provider. Nothing about the product, the four principles, the record schema or the stage order changes.

---

## 1. Why

The Gemini API has a free tier; the Anthropic API does not. The conversation engine is the overwhelming majority of usage in this project — every demo turn and every test session — and it only ever sees text records, never an image.

One exception, which is not negotiable: **`api/describe.js` handles a real person's private photos.** Google's free tier terms state that content is used to improve their models. The consent screen in Stage 2 promises the opposite. So:

- `api/converse.js` → **Gemini free tier.** No images involved. Zero cost.
- `api/describe.js` → **a provider that does not train on the data.** Either Anthropic (roughly six cents for a fifty-photo session) or Gemini with billing enabled, which moves the project to the paid tier.

The project owner will confirm which of those two before Stage 2 is built. Build Stage 1 on Gemini now; do not block on this.

If the free tier ends up being used for `describe.js` after all, the consent screen copy **must** be corrected to say that Google may use the photos to improve their models. Do not leave the current wording in place alongside a free-tier key.

---

## 2. Verify these before writing code

Model names and API shapes have changed recently. Do not take the strings below on trust:

1. Open AI Studio and confirm the current free-tier model IDs.
2. Open the AI Studio rate-limit dashboard and **write the actual RPM, TPM and RPD limits for the chosen model into `docs/build_notes.md`.** Section 6 below depends on these numbers.
3. Check the current structured-output config shape in the Gemini API docs. Two forms exist in the wild — an older `responseMimeType` / `responseSchema` pair, and a newer `responseFormat: { text: { mimeType, schema } }`. Use whichever the current documentation specifies and note which one in `build_notes.md`.

As of now the docs indicate `gemini-3.8-flash` as the current free-tier flagship Flash model and `gemini-3.1-flash-lite` as the fastest, cheapest option for high-volume work.

---

## 3. Replace the stack entries

In `context.md` §3.1, replace the two model rows and the API key row:

| Layer | Choice | Notes |
|---|---|---|
| **Conversation model** | `gemini-3.8-flash` (confirm in AI Studio) | Free tier. Temperature **is** supported on Gemini — set it to `0` for reproducibility across test sessions. |
| **Image description model** | `gemini-3.1-flash-lite` (confirm), or `claude-haiku-4-5-20251001` | Decided before Stage 2. See §1. |
| **API key** | `GEMINI_API_KEY` as a Vercel environment variable | Server-side only, via `process.env`. Never in client code, committed files, or response bodies. If the Anthropic path is chosen for `describe.js`, that function alone also reads `ANTHROPIC_API_KEY`. |

**Delete the instruction "Do not set `temperature`."** That was specific to `claude-sonnet-5`. On Gemini, set `temperature: 0`.

In `package.json`, replace the Anthropic dependency with `@google/genai`, **pinned to an exact version** (correction 5.1 still applies). If `describe.js` uses Anthropic, keep `@anthropic-ai/sdk` pinned alongside it; otherwise remove it. Record both versions in `build_notes.md`.

---

## 4. Structured output — a real simplification

Gemini can enforce the response schema, so the model cannot return malformed JSON.

**Delete this from Task 1.5's error handling:** *"If the model returns non-JSON, attempt to extract JSON from the response. If that fails, return 502 with the raw text."* It is dead code once a schema is attached. Keep the key-missing and API-error branches.

Write the schemas as plain object literals. Do not add Zod or `zod-to-json-schema` — this project has no build step and does not need two dependencies to describe three objects.

**Hunt mode response schema:**

```js
const huntSchema = {
  type: "object",
  properties: {
    say: { type: "string" },
    candidates: { type: "array", items: { type: "string" } },
    cannot_distinguish: { type: "boolean" },
    co_present: { type: "array", items: { type: "string" } }
  },
  required: ["say", "candidates", "cannot_distinguish", "co_present"]
};
```

**Ask-friend mode response schema:**

```js
const askFriendSchema = {
  type: "object",
  properties: {
    question: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    why: { type: "string" }
  },
  required: ["question", "options", "why"]
};
```

**Describe response schema** — note the `enum`, which structurally prevents the describer inventing a sixth `kind`:

```js
const describeSchema = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["photo", "screenshot", "document", "receipt", "video_thumb"]
    },
    scene: { type: "string" },
    visible_only_on_close_look: { type: "array", items: { type: "string" } }
  },
  required: ["kind", "scene", "visible_only_on_close_look"]
};
```

---

## 5. Two API-shape differences to get right

**The system prompt is not a message.** Gemini takes it as `systemInstruction` inside the request config, not as the first entry in the contents array. Both hunt and ask-friend prompts go there, selected by the `mode` parameter from correction 2a. The prompts themselves are unchanged — do not reword them.

The catalogue JSON continues to travel with the system instruction, and the `file` field is still stripped before sending.

**Conversation history uses different role names.** Gemini's contents array uses `user` and `model`, not `user` and `assistant`. Map on the way in and out; the client-side `messages` array can keep whatever shape is convenient as long as the mapping is in one place in `converse.js`.

**Images are inline data parts.** For `describe.js`, each image is a part of shape `{ inlineData: { mimeType: "image/jpeg", data: "<base64>" } }` alongside the text part. The browser-side downscale to 768px at quality 0.7 is unchanged and still matters.

---

## 6. Rate limits — the one thing likely to break

This project has already hit a Gemini quota wall once. The upload flow in Stage 2 fires one vision call per photo — forty to fifty calls within a couple of minutes — which is exactly the shape of request burst a free-tier RPM limit rejects.

Add to Task 2.4:

- **Set the batch size from the measured RPM limit recorded in `build_notes.md`, not from the number 5.** If the limit is 10 requests per minute, five concurrent calls plus retries will trip it. Choose a batch size and an inter-batch delay that keep the sustained rate under the measured limit.
- **Retry on 429 with exponential backoff:** wait 2s, then 4s, then 8s, up to three attempts per image. Honour a `Retry-After` header if one is present.
- **A 429 that survives all retries is not an image failure.** Mark it distinctly from a genuine description failure and surface a clear message: *"Hit the API rate limit. Waiting, then continuing."* Then continue the remaining batches rather than aborting the upload.
- **Report both counts separately** at the end of ingest: images that failed to describe, and images skipped due to rate limits. Conflating them will send the project chasing the wrong bug.

Correction 3 still stands: the calls inside a single batch run concurrently via `Promise.all` or `Promise.allSettled`, never a sequential loop.

---

## 7. Update the security audit

In cross-cutting task CC.1, replace every reference to `ANTHROPIC_API_KEY` with `GEMINI_API_KEY`, keeping an `ANTHROPIC_API_KEY` line only if `describe.js` ends up on Anthropic. The rest of the checklist is unchanged: server-side only, never echoed, never in client JS, `file` paths stripped before sending.

---

## 8. Report back

When these edits are applied, report:

1. The model IDs you confirmed in AI Studio, and the measured rate limits you wrote into `build_notes.md`.
2. Which structured-output config shape the current docs specify.
3. Confirmation that the "attempt to extract JSON" fallback is gone and the three schemas are in place.
4. The pinned `@google/genai` version.

Then continue with Stage 0.
