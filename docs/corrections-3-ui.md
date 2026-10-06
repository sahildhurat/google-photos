# Correction 3 — apply the Stitch visual design

Apply this **only after Stage 1 is working and deployed.** Styling an engine that does not exist yet costs a day and gains nothing.

Save this document as `docs/corrections-3-ui.md` and add it to the header line of `docs/context.md` and `docs/implementation-plan.md` alongside the earlier corrections.

---

## 1. What has arrived

A visual design has been produced in Google Stitch and placed in `design/`.

- Exported markup, if any: `design/stitch/`
- Reference screenshots: `design/screens/`, numbered:

| # | Screen | Covers |
|---|---|---|
| 1 | The conversation surface | Header, Ask / Classic search segmented control, message thread, input row, and the microphone listening state |
| 2 | Candidate grid | Both honesty bands and the thumbnail grid |
| 3 | Photo detail | Full photo, plain-language date line, knowledge chips, "That's it" |
| 4 | The postcard | Before and after answering |
| 5 | Consent and upload | Including the mid-upload progress state |

Some screens may be missing. Build what exists and note the gaps in `docs/build_notes.md`.

---

## 2. One relaxation to the stack

**Tailwind via CDN is now permitted** — a single `<script src="https://cdn.tailwindcss.com"></script>` tag. This exists for one reason: so Stitch's exported class names can be used directly rather than hand-translated into CSS.

Everything else in §3.1 of `context.md` holds. **No React, no framework, no build step.** If the Stitch export is React, take the markup and the class names and discard the component structure.

Keep `css/style.css` for what Tailwind does not express cleanly — the microphone listening animation and the two band treatments in particular.

---

## 3. What the design governs, and what it does not

The design governs **appearance only**: layout, spacing, type, colour, corner radii, button weight, and the visual treatment of the two bands.

It does **not** govern behaviour. Every behavioural rule in `ProblemStatement.md`, `corrections.md` and `corrections-2-gemini.md` stands unchanged.

Four specific points, because these are the ones a mockup will tempt you to break:

**The two-mechanism cluster rule from correction 1b is untouched.** Code expands near-identical clusters; only the model sets `cannot_distinguish`. Screen 2 shows **both bands at once so the two visual treatments can be compared side by side.** That is a design reference, not an instruction to render them together. Band one — *"All from the same moment."* — appears when Mechanism A expanded a cluster. Band two — *"I can't tell these apart from what I have."* — appears only when the model sets the flag. They are independent, and rendering both unconditionally would put a false admission over photos the system can distinguish perfectly well.

**The microphone never auto-sends.** The listening state in screen 1 is a visual spec. The behaviour in Task 1.4 is unchanged: stop on a second tap or after three seconds of silence, leave the transcript editable, never send on its own.

**"That's it" still triggers deposit capture** exactly as Stage 4 specifies. It is styled as a confirm because that is what it is.

**The consent copy in screen 5 supersedes the original.** It is the approved wording and differs from the text in `ProblemStatement.md` Stage 2 and Task 2.2. Use the screen-5 version verbatim, and update Task 2.2 to match it:

> **Your photos stay on this device.**
>
> Pick 30 to 50 photos. They're never saved to any server — nothing is stored anywhere but this browser.
>
> Each photo is sent once to Google's Gemini AI to be described in words. This demo runs on Google's free tier, which means Google may use those photos to improve their AI. Only the written description comes back, and it's kept here.
>
> So please don't pick anything private — no documents, nothing you'd rather Google didn't see. Photos from a trip or an outing a few years ago are ideal.
>
> You can delete everything at any time with the button below.

**Where a mockup and a written rule disagree, the written rule wins.** Record any such conflict in `docs/build_notes.md` rather than resolving it silently in favour of the picture.

---

## 4. Layout

Build at **mobile width** — a column of roughly 390px, centred in the viewport, with a plain background either side at desktop widths. Do not build a separate desktop layout.

The bottom navigation holds four items: **Photos, Collections, Ask, Search**, with Ask active. The three inactive items are decorative and need no behaviour. Do not wire them to anything or add placeholder pages.

`passiton.html` has no mockup. Style it by reusing the components from screens 1 to 3, as two columns side by side at desktop width.

---

## 5. Branding

The product mark is the text **"The One Where"**.

**Do not add the Google logo, the Google Photos logo or wordmark, the four-colour pinwheel, or any Google account avatar** — even if a Stitch export appears to contain one. If an export includes any of these, strip it and note the removal in `build_notes.md`.

This is a feature concept presented as a concept. It must not be mistakable for a shipped Google product.

---

## 6. Order of work

Apply the design in this order, deploying after each step:

1. **Screens 1 and 2** — conversation surface, input row, candidate grid. This is the demo; nothing else matters as much.
2. **Screen 3** — photo detail view.
3. **Screen 5** — consent and upload, if Stage 2 exists.
4. **Screen 4** — the postcard, if Stage 6 exists.

If time runs out, screens 1 and 2 styled well beat all five styled roughly.

---

## 7. Before reporting done

Discipline rule 1 applies with particular force here, because this is a change whose entire purpose is visual.

**Open every restyled page, take a screenshot, and look at the screenshot.** Then compare it against the matching file in `design/screens/`.

A past bug in this project rendered every bar as an invisible sliver because an inline element was given a `width`. The code reviewed as correct and was wrong on screen, for days. Reading the CSS is not inspection.

For each page, state in `docs/build_notes.md`:

- which screenshot you compared it against
- what differs, and whether the difference was deliberate
- anything in the mockup you could not reproduce, and why
