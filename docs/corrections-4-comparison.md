# Correction 4 — fix what the comparison proves

Save as `docs/corrections-4-comparison.md` and add it to the header line of `docs/context.md` and `docs/implementation-plan.md`.

---

## 1. The problem

Testing on the 60-record demo library showed **classic search outperforming the conversation**. That result is real, and it is caused by the test setup rather than by the product. Three causes:

**The library is too small to contain the problem.** At 60 records a single keyword returns one to three results and the user recognises the right one immediately. The product exists for libraries of tens of thousands of photos. No 60-record demo can reproduce that.

**Classic search is reading the wrong field.** `search.js` matches against `scene`, which is a hand-written English sentence describing exactly what a person would look for. No keyword search has ever had an index like that. Real Google Photos indexes ML labels, OCR text, geotags, face groups and dates — not prose.

**The comparison is set up to test a claim this product does not make.** "Conversation beats keywords" is not the thesis, and Google already shipped a conversational search product. The thesis is four behaviours: the system admits when it cannot distinguish candidates, it never filters on a hedged detail, the index grows from what the user says while hunting, and someone who was there can answer on their behalf.

The documented research failure makes this sharper. The participant who sent the wrong receipt — right amount, right provider, wrong year — was using Google's conversational search. **A confident single answer caused that failure, not keyword matching.** His words: *"A convincing result makes me stop checking."*

So the comparison should not be two modes. It should be three.

---

## 2. Fix one — add a third mode: a single confident answer

This is the most important change in this document.

`api/converse.js` already takes a `mode` parameter (correction 2a). Add a third value: **`single`**.

### The `single` system prompt

Use this verbatim. It must be a genuine, well-written confident assistant — **not a straw man.** It fails on the right cases because the deciding information is not in the records, not because the prompt was written badly. If it is weakened deliberately the comparison is dishonest and worthless.

```
You help someone find a photo. You have a catalogue of their photos as
structured records. You cannot see the images; you only have the records.

Give the user the single most likely photo, with a brief confident
explanation of why it matches what they described. People want an answer,
not a list.

Do not hedge. Do not ask clarifying questions. Do not offer alternatives.
Do not mention uncertainty. Choose the best match and give it.

Return JSON only:
{
  "say": "<one or two sentences naming the photo you found and why it matches>",
  "candidates": ["<the single photo id>"]
}

`candidates` holds exactly one id.
```

Reuse `huntSchema` with `cannot_distinguish` and `co_present` permitted but ignored, or add a two-field `singleSchema`. Either is fine; note which in `build_notes.md`.

### Critical implementation note

**The code-level cluster expansion from correction 1b must NOT run in `single` mode.** Mechanism A exists to prevent exactly the failure this mode is demonstrating. If it expands the cluster here, the mode cannot fail and the comparison is pointless.

Gate it: Mechanism A applies in `hunt` mode only. Say so in a comment in `js/render.js` so a later pass does not "fix" it.

### Naming it in the UI

Label this mode **"Single answer"** or **"Best guess"**.

**Do not label it "Ask Photos" or imply it is Google's product.** It is a reconstruction of a confident single-answer assistant built for comparison, and presenting it as a named commercial product would be dishonest. The deck will describe it as such.

---

## 3. Fix two — give classic search an honest index

Add a `search_index` object to every record in `data/catalogue.json`:

```json
"search_index": {
  "labels": ["cafe", "restaurant", "indoor", "chair", "table", "drink"],
  "ocr": [],
  "place": "Hampi"
}
```

- **`labels`** — three to six single-word or two-word tags of the kind an ML vision classifier produces. Nouns and categories, never sentences, never adjectives about colour or mood. `"cafe"`, `"indoor"`, `"chair"` — not `"yellow-washed wall"` or `"a quiet morning"`.
- **`ocr`** — text legible in the image, as separate strings. Empty array for most photos. For receipts and documents, the provider name and the amount. Include the date **only if** it would plainly be legible to an OCR pass on that image.
- **`place`** — the geotag place name, or `null`. Roughly a third of records should be `null`, since plenty of real photos have no location.

Then change `js/search.js`: **classic search matches against `search_index` only** — `labels`, `ocr` and `place` concatenated. It must no longer read `scene`, and must not read `visible_only_on_close_look` or `user_deposits` either.

The conversation engine continues to receive the full record, `scene` included, because the conversation stands in for the vision layer that can describe an image on demand.

For records generated in upload mode (Stage 2), build `search_index.labels` by taking the three to six most concrete nouns from the describer's `scene` output. Do not make a second API call for this.

This change makes classic search behave like keyword search. It is a correction toward accuracy, not a handicap.

---

## 4. Fix three — script the three comparisons

Add a small panel to `index.html`: three buttons that each load a prepared query, so the comparison can be run in sequence without typing. Label it something like **"Try these"**.

Each button runs the same query in all three modes and shows the three results together — classic, single answer, conversation — stacked or side by side. The point is seeing the three outcomes at once.

### Scenario A — the confident wrong answer

Query: the receipt, described the way the participant described it, by provider and amount but **not** by year.

- **Classic search:** returns all four receipts, unranked. Safe but useless.
- **Single answer:** picks one and explains why it matches. It has a 1-in-4 chance of being right, and it will not say so.
- **The conversation:** returns all four, says it cannot read the year from what it has, and asks a question that would narrow it.

This is the demo. It reproduces a documented real-world failure live, and the middle mode fails in front of the viewer.

### Scenario B — the hedge that deletes the answer

Query: a café photo described with `green chairs`, when the wanted photo has blue ones.

- **Classic search:** filters on `green` and the blue frames disappear. The photo the user wanted is not in the results.
- **Single answer:** picks a green-chair frame, confidently.
- **The conversation:** keeps all five, ranks the green ones higher, and says so.

Ten seconds, and it works every time, because it is a property of how filtering works rather than of how clever the model is.

### Scenario C — compounding

This one needs two steps and is the strongest of the three.

1. Find a photo in conversation mode, open it, tap **"That's it"**, having said something distinctive during the hunt.
2. Then search those exact words in **classic search**: zero results, because those words were never in the index.
3. Then search them in **conversation** mode: immediate.

Classic search can only ever match words that were already there. Only this product adds words. Make sure the "Try these" panel can run step 2 and 3 back to back on whatever the user actually deposited, rather than on a hardcoded string.

---

## 5. Fix four — reframe the toggle

The toggle currently implies a contest that this product does not claim to win. In the real product these modes coexist.

- Change the toggle to three options: **Classic search · Single answer · The One Where**.
- Remove the line *"0 of N. Try the conversation."* Replace it with something that states the division of labour rather than a taunt — for example *"Keyword search found nothing. Try describing it instead."*
- In `docs/build_notes.md`, record this reasoning: 60% of the search strings in the research were a single word, and single-word searches are what keyword matching is for. This product is for the rest.

---

## 6. Optional, only if the three fixes above are done and tested

The honest limitation is that 60 records cannot contain a 30,000-photo problem.

That gap narrows if the catalogue holds more **records** than **images**: reuse each image across several records with different dates, places and metadata, taking the library to 300–600 items. Every count displayed on screen is then real, and the search space is genuinely that size. The four required clusters stay exactly as they are.

If you do this, note it in `build_notes.md` as a demo-scale simulation, alongside the existing note that the metadata stands in for a vision layer.

**Do not start this before fixes one through four are deployed and working.**

---

## 7. Report back

1. The `single` mode prompt in place, and confirmation that Mechanism A is gated to `hunt` mode only, quoting the guard in `js/render.js`.
2. The raw output of scenario A in all three modes, verbatim, so the single-answer mode can be seen failing.
3. Confirmation that `js/search.js` no longer reads `scene`, quoting the line.
4. A count of records with a non-empty `search_index`, computed from the file.
5. The deployed URL, confirmed in a fresh browser.
