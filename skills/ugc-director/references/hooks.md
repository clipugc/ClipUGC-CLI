# Hook Text Library

Hook = the on-screen text overlay burned into the final ad (`videos merge --hook "…"`, max 150 chars — but aim for ≤8 words; ≤5 words is best for the first frame).

## Rules

- On screen at 0.0s. 2–5 words for the opening frame; 3–7 words per overlay line.
- Write like a friend texting, not a brand. No "Introducing…", no "revolutionary", no exclamation-mark salvos.
- Lowercase or sentence case reads more native than Title Case.
- Fill `[app]` / `[problem]` / `[result]` with the user's app specifics — concrete numbers beat adjectives ("saved me 3 hours this week" > "so useful").
- Pair the hook category with a matching reaction archetype (column 3; numbers refer to formats.md).

## Formulas by category

### A. Curiosity / information-gap → Smirk (1), Point-at-Text (6), Deadpan Stare (8)
- "nobody talks about this app"
- "why is nobody talking about this"
- "nobody told me this existed"
- "I wish I found this sooner"
- "3 apps that feel illegal to know"
- "the app store is hiding this one"
- "three words: [punchy phrase]"

### B. POV / identity → Deadpan Stare (8), Mid-Task Glance-Up (11)
- "POV: you finally found the [category] app that actually works"
- "POV: it's Sunday night and you still haven't [task]"
- "POV: your [problem] fixes itself"

### C. Secret / exclusivity → Smirk (1), Hand-Over-Mouth (3)
- "the hack I wish someone told me"
- "I wasn't going to share this but…"
- "gatekeeping this was getting hard"
- "this has a feature I've never seen anywhere else"

### D. Warning / negativity → Head-Shake (7), Point-at-Text (6)
- "stop scrolling if you've ever [frustration]"
- "if you [common behavior], you're doing it wrong"
- "you're probably making this mistake too"
- "don't make the mistake I made"
- "before you pay for [alternative], watch this"

### E. Skeptic-converted → Side-Eye (5), Nod-Along (9)
- "I thought this app was overhyped… then it did this"
- "I didn't expect to actually use this"
- "4.9 stars and I thought it was fake"
- "I was wrong about [app category] apps"
- "tested the free version first, obviously"

### F. Transformation / receipts → Jaw-Drop (2), Speed-Shock (10)
- "how I went from [X] to [Y]"
- "day 1 vs day 30"
- "this saved me 3 hours this week"
- "here's what $[X]/month actually gets you"
- "watch it do [task] in 20 seconds"

### G. Relatability / emotional → Crying Girl (4), Head-Shake (7)
- "I used to do this manually every friday"
- "why did nobody tell me this fixes [problem]"
- "this app lowkey saved me"
- "I was struggling with [problem] until this"
- Text-story melodrama (multi-line overlay, face just emotes): "[personal setback story]… then I found [app]"

## Combining with `clipugc hooks suggest`

`clipugc hooks suggest --context "<app description>"` returns 5 AI-generated hooks. Use them as raw material: keep the ones that match a formula above, rewrite the rest into a formula, then pick the archetype from the category mapping. Generate 2–3 hook variants per clip — hooks are the cheapest thing to A/B (re-merging the same clip is free).

## CTA lines (final overlay, last 2–3s)

- "it's called [AppName] btw"
- "link in bio / on the app store"
- "check it out if you deal with this too"
- "thank me later"

Soft and peer-to-peer. Never "DOWNLOAD NOW".
