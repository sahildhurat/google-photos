# Correction 5 — Level 3 becomes a scratch card

Save as `docs/corrections-5-scratch.md` and add it to the header line of `docs/context.md` and `docs/implementation-plan.md`.

**Build this after correction 4 is deployed and working.** The three-mode comparison is higher priority.

This replaces Stage 6 (the postcard) entirely. Delete the old Stage 6 spec from `implementation-plan.md` and substitute the following.

---

## 1. What it is and why

Google Pay has trained Indian users to scratch a card after every transaction. It is probably the most-tapped reward gesture in the country, and it belongs to Google.

Photos borrows the reflex and changes the prize. You scratch, and underneath is not cashback — it is a photo from your own life you had forgotten. Then, while it is open and you are looking at it, one question.

The order matters and must not be reversed: **the reveal is the gift, the question comes after.** The user is never asked to do anything before they get something.

The card is always drawn from the photos the system knows nothing about — never opened since capture, no deposits attached. The mechanic therefore aims itself at exactly the dark corners of the library where retrieval fails.

---

## 2. The scratch itself — non-negotiable

**A tap-to-reveal is not a scratch card and will not do.** The borrowed habit is the physical drag of a finger, foil coming away in patches, a partial glimpse before the whole thing clears. If this ships as a tap or a fade, the feature is pointless.

Implementation, on `scratch.html`:

1. The photo sits in a container at the card's size.
2A `<canvas>` of the same size overlays it, filled with the foil (see §6).
3. On `pointerdown` / `pointermove`, draw onto the canvas with `ctx.globalCompositeOperation = 'destination-out'` and a round brush of roughly 28px radius, stroking between the previous and current pointer positions so fast drags do not leave gaps.
4. Use **pointer events**, not mouse or touch events, so one code path covers both. Call `setPointerCapture` and `e.preventDefault()` so dragging does not scroll the page.
5. Sample the canvas alpha channel periodically — every 10th move event is plenty — and when more than **55%** is cleared, animate the remaining foil away and consider the card opened.
6. Respect `prefers-reduced-motion`: when set, offer a plain "Reveal" button alongside the canvas rather than removing the scratch.

Do not use a library for this.

---

## 3. One a day

- One card per day. Once opened, it is gone until tomorrow.
- An unopened card expires at local midnight and is not banked. Scarcity is the whole reason the gesture retains any value.
- Store the last-opened date in `localStorage`. On a day with no card remaining, the page shows the card already scratched away, the photo from today's card, and a quiet line saying the next one arrives tomorrow.
- **For the demo, add a "reset" affordance** — a small text button that clears today's state — so the flow can be shown repeatedly in a two-minute walkthrough. Label it plainly as a demo control.

---

## 4. What is underneath: three tiers

The payout varies in emotional weight, never in value. Pick the tier at card-generation time and record which tier was served in `localStorage` so the demo can show all three.

**Tier 1 — a photo.** The common case. One record with `opened_since_capture: false` and no deposits. Caption line uses a time anchor, not a date: *"A Tuesday in 2019."*

**Tier 2 — a day.** Less common. A record whose `taken_at` shares a date with several others. The reveal is that photo, then a strip of the rest: *"You took 23 photos this day."*

**Tier 3 — a rarity.** Rare, and these are the jackpots. Computed, not authored:
- *"This is the only photo of you and Dev together."* — the sole record whose `people` array holds exactly that pair.
- *"Your first photo of Priya."* — earliest `taken_at` among records naming that person.
- *"You haven't opened this in seven years."* — oldest record with `opened_since_capture: false`.

In upload mode, where `people` is empty and `opened_since_capture` is `null`, only Tier 1 and the oldest-record form of Tier 3 are available. Fall back silently; do not fabricate a rarity.

**There are no duds.** Google Pay has "better luck next time"; do not borrow that part. A blank card teaches people to stop scratching. Every card reveals a photo.

---

## 5. The question, and the payoff

Once the card is open:

- One line beneath the photo: **"What was this?"**
- The same input component as Stage 1 — text field and microphone, voice given equal weight.
- **It is optional.** No skip penalty, no nag, no second prompt. The user may close the card having simply looked at the photo, and that is a complete, successful interaction.
- On submit, write the answer into that record's `user_deposits` and show the payoff immediately: *"This photo now answers to 'the day the scooter broke down'."* Then a tappable chip, **"Try finding it →"**, which runs that search in the conversation surface and lands on the photo.

That last step is the point of the whole level: the labour pays off inside ten seconds rather than being promised for later.

---

## 6. The card's look

Follow the Material 3 design already applied in correction 3.

- Card at 28px radius (`radius-lg`), roughly 320 × 420 at mobile width.
- The foil is a flat neutral with a fine diagonal hatch, drawn on the canvas — not an image, not a gradient. Google Pay's own card is a solid field with a pattern; this should read as the same family without copying it.
- On the unscratched foil, two lines only: a small label reading **"Scratch"** and, under it, the tier teaser — *"A photo you've forgotten"*, *"A day you've forgotten"*, *"Something rare"*. The teaser is the hook and it should not give the photo away.
- **No Google Pay branding, no Google logo, no four-colour pinwheel.** This borrows a gesture, not an identity.

---

## 7. Safety — build this now, not later

A card that reaches into an old library will eventually surface a photo of someone who has died, an ex, a hospital visit, a bad year. A scratch card makes this worse than a plain card would, because it builds suspense and the user cannot un-see what they have uncovered.

Required, in the first version:

- **"Not this one"** on every opened card. One tap. It never asks why.
- A skip excludes **the photos adjacent to it in time**, not only that frame — a window of seven days either side. Bad weeks come in clusters.
- Skipped records and their windows are never served again. Keep the exclusion list in `localStorage` under its own key.
- A visible way to exclude a person or a date range permanently, reachable in two taps from the card.

Record in `docs/build_notes.md` that this was built in the first version rather than deferred.

---

## 8. Report back

1. Confirmation that the reveal is a real canvas scratch with pointer events, quoting the `destination-out` line and the alpha-sampling threshold.
2. The three tiers working, with a note on how each was computed from the catalogue.
3. Confirmation that the question is optional and that closing the card without answering is a clean exit path.
4. Confirmation that "Not this one" excludes a ±7 day window, quoting the code.
5. The deployed URL, confirmed in a fresh browser on a phone-width viewport.
