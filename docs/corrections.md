# Corrections to apply before building

You have produced `docs/context.md` and `docs/implementation-plan.md` from `docs/ProblemStatement.md`. Both are good. Four defects will break the build and five smaller items need tightening.

**Apply these corrections to `docs/context.md` and `docs/implementation-plan.md` now, before writing any application code.** Leave `docs/ProblemStatement.md` unmodified, but add a single line at the top of each of the two derived documents:

> Corrections dated 2026-10-04 supersede `ProblemStatement.md` where the two conflict. See `docs/corrections.md`.

Save this document as `docs/corrections.md`. When the edits are done, report what changed in each file, then begin Stage 0.

---

## Blocker 1 — `cluster` is currently doing two unrelated jobs

The original spec used one field for two different ideas, and your plan has implemented the collision faithfully. This is the most important correction here.

`c_hampi_cafe`, `c_laughing` and `c_receipts` are **near-identical sets**. The entire point of them is that a person cannot tell the members apart from thumbnails.

`c_trek` is **not** a near-identical set. It is eight photos taken across one day on a trail, grouped only so that Stage 5 has a shared event to work with. The eight are obviously different from each other.

Your current enforcement rule fires whenever two or more candidates share a non-null cluster. So any search touching the trek will display *"I can't tell these apart from what I have"* above eight clearly distinguishable photographs. The product's single most distinctive behaviour will look like a bug.

### Fix 1a — add a field to the record schema

Every record gains:

```json
"near_identical": true
```

Add it to the canonical record shape in `context.md` §4, to the field semantics table in §4.1, and to the per-record checklist in `implementation-plan.md` Task 0.1.

Semantics: `true` means the members of this record's cluster cannot be reliably told apart from a thumbnail. `false` means they can.

Values in the demo catalogue:

| Cluster | `near_identical` |
|---|---|
| `c_hampi_cafe` | `true` |
| `c_laughing` | `true` |
| `c_receipts` | `true` |
| `c_trek` | **`false`** |
| all standalone records (`cluster: null`) | `false` |

Add to the Stage 0 validation list: every record in a cluster shares the same `near_identical` value as the rest of its cluster.

### Fix 1b — replace the enforcement rule

Replace §5.3 of `context.md` and the cluster-enforcement block in Task 1.6 of the plan with the following. The old version both over-fires and lies; this one does neither.

Two separate mechanisms, which must not be conflated:

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

This guarantees the user is never shown one member of a near-identical set while the others are hidden. It is the fix for the research finding that a convincing wrong answer is worse than no answer.

**Mechanism B — judgement, from the model.**

The model sets `cannot_distinguish` in its own response. **Code must never set, override, or infer this flag.** Delete the instruction "Set cannot_distinguish = true (override the model if needed)" from Task 1.6.

### Fix 1c — two bands, not one

The rendering rules currently attach one message to one condition. Split them:

- A cluster was expanded by Mechanism A → render an informational band above those thumbnails: **"All from the same moment."**
- The model returned `cannot_distinguish: true` → render the stronger band above the grid: **"I can't tell these apart from what I have."**

Both may appear at once. Style them differently — the first is neutral information, the second is the system admitting a limit.

### Fix 1d — tighten the upload-mode clustering window

In Task 2.3 step 5, change the time-based clustering window from **120 seconds to 60 seconds**. Two minutes is wide enough to group photos of two entirely different things.

Records placed in a time-based cluster get `near_identical: true`. Records with `cluster: null` get `near_identical: false`.

---

## Blocker 2 — Stage 5 asks for something the architecture cannot provide

Task 5.2 instructs you to call `api/converse.js` "with a modified system prompt." But Task 1.5 has `converse.js` constructing its system prompt server-side, which is correct — the behavioural rules must not be client-controlled. As written, Stage 5 cannot be built.

### Fix 2a — add a mode parameter to the endpoint

`api/converse.js` accepts `{ mode, messages, catalogue }`, where `mode` is `"hunt"` or `"ask_friend"` and defaults to `"hunt"`. The function selects between two system prompts held server-side. The client sends only the mode string.

Update Task 1.5 to describe both prompts and Task 5.2 to pass `mode: "ask_friend"`.

### Fix 2b — the `ask_friend` system prompt

Use this verbatim:

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

### Fix 2c — how the answer comes back

No third prompt is needed. When the second person answers, append their answer to the `messages` array as a user turn in this form:

```
Amit says: "it was the morning"
```

Then call `converse.js` in `"hunt"` mode as normal. The engine re-ranks, and rule 7 of the hunt prompt already covers people who were present. Add this to Task 5.2.

---

## Blocker 3 — the description batches will time out

`vercel.json` sets `maxDuration: 30`. Task 2.4 describes a batch of five images without specifying concurrency, which means a sequential loop: five vision calls at three to five seconds each is 15–25 seconds, and one slow image blows the limit. The failure is intermittent, which is the worst kind.

### Fix 3 — run the batch in parallel

In Task 2.4, state explicitly:

- The five images in a batch are described **concurrently** using `Promise.all`. **Do not write a sequential `for` loop over the batch.**
- Each image's call is individually wrapped in try/catch. A failure returns `{ id, error: "<message>" }` for that image only and must not reject the whole batch — use `Promise.allSettled` or catch inside each promise.
- The batch therefore takes roughly as long as its slowest image, and `maxDuration: 30` is comfortable.

---

## Blocker 4 — thumbnails will render empty in upload mode

Task 1.6 resolves images as a static path in demo mode and as an IndexedDB blob in user mode, but `renderAssistantMessage` is specified as synchronous. Reading from IndexedDB is asynchronous, so the grid will render before any blob arrives and the user will see a row of empty boxes.

### Fix 4 — resolve image URLs once, behind one accessor

Add to `js/catalogue.js`:

- On catalogue load in **user mode**, read every blob from IndexedDB once and build an in-memory `Map<id, objectURL>`.
- Export `getImageURL(id)`, which returns `images/<id>.jpg` in demo mode and the object URL from the map in user mode.
- Export `releaseImageURLs()`, which calls `URL.revokeObjectURL` on every entry and clears the map. Call it on mode switch, and after "Delete everything".

`js/render.js` then calls `getImageURL(id)` and never branches on mode. Rendering stays synchronous. Update Task 1.3, Task 1.6 and Task 2.1 accordingly.

Without the revoke step a long test session will leak memory steadily; include it.

---

## Five smaller corrections

**5.1 — Pin the SDK.** Change `"@anthropic-ai/sdk": "latest"` in `package.json` to the exact version that currently resolves, and record that version in `docs/build_notes.md`. An unpinned dependency changing under you mid-build is not a risk worth carrying.

**5.2 — Add a no-results state.** Nothing in the plan says what renders when the model returns zero candidates. Add to Task 1.6: when `candidates` is empty, render the model's `say` and no grid. If the model's `say` is also empty, use: *"I haven't found anything yet. Tell me something else you remember — anything at all, even if you're not sure about it."*

**5.3 — Drop unknown candidate ids.** Models occasionally return an id that is not in the catalogue. Add to Task 1.6: candidate ids with no matching record are skipped silently in the UI, and the count of skipped ids is logged to the console. Never render a broken image.

**5.4 — One record count, not a range.** Task 0.1 validation says 63–70 and `context.md` says 65–70. Replace both with the single target in correction 6 below, and compute the actual count before reporting Stage 0 complete.

**5.5 — `exifr` fallback.** If `DateTimeOriginal` comes back undefined for more than about a third of files that are plainly camera JPEGs, the lite build is the cause, not the files. Add a note to Task 2.3: in that case switch the import to the full `exifr` build before concluding the photos have no EXIF.

---

## Correction 6 — reduce the demo catalogue to 45 records

Sourcing and describing sixty-eight images is the longest single task in this plan and it buys almost nothing. "0 of 45. Try the conversation" reads exactly as well as "0 of 68", and the library still feels real.

Change the Stage 0 target in both documents:

| Group | Count |
|---|---|
| `c_hampi_cafe` | 5 |
| `c_laughing` | 6 |
| `c_receipts` | 4 |
| `c_trek` | 8 |
| Standalone | 22 |
| **Total** | **45** |

Within the 22 standalone records, **5 or 6 must be non-`photo`** — screenshots, a utility bill, a boarding pass, a scanned document. With the 4 receipts that gives 9–10 non-photo records out of 45, holding the one-in-five ratio the research supports.

Update the validation list: total records exactly 45; non-photo records at least 9; cluster sizes 5, 6, 4, 8.

Suggested standalone mix: food 3, city streets 3, family at home 4, screenshots and documents 5–6, a wedding 2, a train journey 2, pets 2, accidental shots 1–2. Dates spanning 2018–2026. Recurring names: Dev, Priya, Amit, Kavya, Rohan, Amma, Nani, Ishaan.

---

## Two things to leave exactly as they are

**The parallel branch in your dependency graph.** Stages 2 and 3 both hanging off the first deploy is correct. Classic search is twenty minutes of work and upload mode is several hours — if upload stalls, the toggle still ships, and Stage 3 is the most persuasive screen in the build.

**Classic search reading `scene`.** Do not weaken it to make the comparison look worse. Because `scene` is a written sentence, a literal query like "blue chairs hampi" *will* match, and that is correct and honest. The genuine failures are the ones the research documented: single-word queries, which were 60% of what real users typed, and queries about details that live in `visible_only_on_close_look` — such as whose eyes are closed — which keyword matching never reads.

Add that last point as a note in Task 3.3 so the validation step tests the queries that should fail rather than the ones that should succeed.

---

## Report back

When the edits are applied, report:

1. Each file changed and a one-line summary per change.
2. Confirmation that `near_identical` now appears in the schema in both documents, and that the old "override the model if needed" instruction is gone.
3. The final Stage 0 record target as it now reads in both documents.

Then begin Stage 0.
