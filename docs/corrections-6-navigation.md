# Correction 6 — how the four levels connect

Save as `docs/corrections-6-navigation.md` and add it to the header line of `docs/context.md` and `docs/implementation-plan.md`.

The choice offered — an evaluator menu **or** organic wiring — is a false one. Both are needed, because there are two distinct audiences, and the right answer for each is different from what was proposed.

**Audience one: an evaluator**, opening the public link cold, with about three minutes, reviewing a hundred submissions. Anything they do not find does not exist. They need a visible path.

**Audience two: a test user**, who should meet the product as a product, so that the flow itself is what gets tested.

---

## 1. The demo bar — not a hamburger

**Do not build a hamburger or a gear menu.** A reviewer with three minutes does not open menus to discover what is inside. A hidden feature scores zero.

Build a slim bar fixed directly beneath the header, **present on every page** — `index.html`, `deposits.html`, `passiton.html`, `scratch.html`. It holds a numbered path, with the current step marked:

```
Demo guide   1 Find a photo   2 Compare three modes   3 Ask a friend   4 Today's card   ·   Your index
```

Rules:

- Every item is a link. Step 2 scrolls to and opens the three-mode comparison from correction 4; steps 3 and 4 navigate to `passiton.html` and `scratch.html`; "Your index" goes to `deposits.html`.
- The bar is **labelled as a demo guide**. Do not disguise it as product navigation. Being explicit is honest and it is the point.
- It persists across all four pages so a reviewer can never dead-end on a sub-page with no way back. This is the single most important requirement here, because the product currently reads as four separate demos rather than one product.
- Keep it to one line at mobile width. Horizontal scroll inside the bar is acceptable; the page body must still never scroll sideways.

**This replaces the separate "Try these" panel from correction 4.** Fold those three scripted comparison queries into step 2 rather than maintaining two mechanisms. Note the merge in `docs/build_notes.md`.

### First load only

Above the bar, on first visit only, one dismissible line stating what this is and that the library is a demo set. Dismissal persists in `localStorage`. One sentence, not a splash screen, and nothing that must be clicked through before the app is usable.

---

## 2. Ask a friend — fires on stuck, not on success

**Do not place "Ask a friend" next to "That's it" in the photo modal.** Those two buttons represent opposite moments. "That's it" is recognition; asking a friend is failure. Offering help to someone who has just succeeded is noise, and it buries the feature at the one moment nobody needs it.

Trigger it on being stuck instead. The engine already returns `co_present` in its response (correction 2). So:

- When `co_present` is non-empty **and** no photo has been confirmed in this hunt, render a line beneath the candidate grid: *"Amit was there. Ask him?"* — using the actual name from `co_present`.
- Also offer it when the hunt reaches its **third assistant turn** without a confirmation, whether or not `co_present` has a name: *"Want to ask someone who was there?"*
- Tapping it opens `passiton.html`, carrying the current candidate ids in the URL hash so the simulation starts from the real hunt rather than a hardcoded scenario.

This is the correct product behaviour, not just better placement. Your research found four of seven participants messaged another person **mid-search** — at the point of being stuck. The offer should appear where the behaviour actually occurs.

---

## 3. The scratch card is a notification

**Do not build a floating button, and do not make anything wiggle for attention.** A FAB that animates to attract clicks is the fastest way to make a prototype look cheap, and it misrepresents what this is.

In the real product the daily card arrives as a **push notification**. So render it as one:

- A notification-shaped card at the top of `index.html` — the visual language of a system notification, not a marketing banner. Icon, one line of title, one line of body, dismissible.
- Title: **"Your card is ready"**. Body: the tier teaser already specified in correction 5 — *"A photo you've forgotten"*, *"A day you've forgotten"*, *"Something rare"*.
- Tapping it opens `scratch.html`. Dismissing it hides it for the rest of the session.
- It appears on load when a card is unopened, which given the one-a-day rule means it appears on a reviewer's first visit. That is the intent.

Record in `docs/build_notes.md` that in production this is a push notification and the MVP renders it in-app so the flow is testable. The deck will say the same.

---

## 4. The index

The existing link after a successful deposit is right and stays.

Add one more, low-key: a single line beneath the greeting on first load — *"Looking for what you've saved? Your index."* Plain text link, no icon, no card. It should not compete with the input row, which is the thing a first-time visitor must find.

Nothing else. The index is a supporting view, not a destination.

---

## 5. What a reviewer sees on first load

State the first frame explicitly, because it is what gets judged:

1. Header with the product mark.
2. The demo guide bar, numbered, with step 1 marked current.
3. The one-line first-load note.
4. The notification card: *"Your card is ready."*
5. The three-mode toggle.
6. The conversation surface with a short greeting and the index link.
7. The input row, with the microphone at equal weight to send.

Everything the product does is visible or one tap away in that frame. Nothing requires a menu, nothing requires scrolling to discover, and nothing is hidden behind an interaction a reviewer has no reason to perform.

---

## 6. Report back

1. A screenshot of `index.html` on first load at phone width, and confirmation that all seven elements above are present.
2. A screenshot of one sub-page showing the demo bar still present with the correct step marked.
3. Confirmation that "Ask a friend" fires on `co_present` or the third turn, quoting the condition, and that it is **not** in the photo modal beside "That's it".
4. Confirmation that nothing in the build animates to attract attention.
5. The deployed URL, confirmed in a fresh browser.
