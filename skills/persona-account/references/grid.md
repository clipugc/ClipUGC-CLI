# Grid Composition & Sequencing

How a set of posts adds up to a person rather than a slideshow of one pose. Use this when planning a grid up front, when deciding what the next post should be, or when auditing an account that has started to look samey.

## The mix (per 9 posts)

Two independent axes. First, which pillar each post serves — these nine slots are the whole grid:

| Pillar role | Slots | Why |
|---|---|---|
| Routine / wrap (what this person does every day) | 3–4 | Gives the account a heartbeat |
| Teach / tip | 2 | The reason to follow |
| Verdict / reaction | 1–2 | The reason to watch |
| Honesty / struggle | 1–2 | The reason to believe |

Then, how each of those posts is shot:

- **Video vs. photo**: roughly two-thirds video, one-third stills. Photo posts are real posts — 2 credits each — and they carry the aesthetic between video beats; a feed of nothing but video reads as a content farm.
- **Promo / ad posts**: at most 1 in 5, never in the first three. A promo post occupies a pillar slot (usually verdict/reaction) rather than being an extra one.

## Rotation axes

Rotate all four independently. Repeating any two together across consecutive posts is what makes an account read as a template.

| Axis | Pool | Rule |
|---|---|---|
| Setting | `persona.settings` (4–6 places) | Never the same setting twice in a row; prefer one unused in the last two, and change the light when a setting does come back |
| Framing | arm's-length selfie · mirror · mid-task glance-up (subject not centred) · propped-phone static · photo-only still | Never the same framing twice in a row |
| Archetype | ugc-director `formats.md` | Not used in either of the last two posts; stay inside the persona's emotional register |
| Time of day / light | morning window · midday flat · golden hour · lamp/night | Alternate; a feed lit identically nine times looks synthetic |

Wardrobe is deliberately NOT fully rotated — real people re-wear clothes. Repeat outfits across the grid, but keep any single day coherent and the season consistent.

## 9-post blueprint

Pillar roles are generic; map them to the persona's actual pillars from `niches.md`.

| # | Pillar role | Setting | Framing | Format | Archetype |
|---|---|---|---|---|---|
| 1 | Routine (introduce the person) | primary setting | arm's-length selfie | video 5s | 8 Deadpan Stare |
| 2 | Teach / tip | secondary setting | mid-task glance-up | video 5s | 6 Point-at-Text |
| 3 | Verdict / reaction | third setting | arm's-length selfie | video 5s | 5 Side-Eye Skeptic |
| 4 | Routine | primary setting, different light | photo-only | photo | — |
| 5 | Honesty / struggle | car or bed | propped-phone static | video 5s | 7 Head-Shake |
| 6 | Teach / tip | secondary setting | mirror | photo | — |
| 7 | Verdict / reaction (or promo) | third setting | arm's-length selfie | video 5s | 2 Jaw-Drop |
| 8 | Routine detail (objects, hands, no face) | any | photo-only still | photo | — |
| 9 | Weekly wrap | primary setting | arm's-length selfie | video 5s | 9 Nod-Along |

- **6-post grid**: take rows 1, 2, 3, 4, 6, 9 (4 video + 2 photo). Honesty/struggle waits for the grid to grow.
- **12-post grid**: run the 9 above, then add three more (two video, one photo) with a NEW light/time — an evening block — one of which may be the second promo post.

Budget (5s clips, organic posts, before any merges; confirm with `clipugc credits`):

| Grid | Looks | Clips | Total |
|---|---|---|---|
| 6 posts (4 video + 2 photo) | 2 (cast, first look included) + 5×2 = 12 | 4×7 = 28 | **40** |
| 9 posts (6 video + 3 photo) | 2 + 8×2 = 18 | 6×7 = 42 | **60** |
| 12 posts (8 video + 4 photo) | 2 + 11×2 = 24 | 8×7 = 56 | **80** |

Merging is free, so an ad post costs no more than the clip behind it. (ugc-director's `casting.md` quotes 54 for a *6*-post grid because there every post is an ad — six clips; the rows above price an organic feed.) Every clip in these totals is still gated behind an approved look — the numbers are a ceiling, not a pre-authorisation.

## Sequencing rules

1. **The first three posts establish the person**: face clearly visible, niche legible without the caption, primary setting. No promo, no in-joke, no faceless detail shot.
2. **Never two consecutive posts sharing setting + framing.** One or the other must change; ideally both.
3. **Alternate energy.** A high-energy reaction post next to a quiet one. Three loud posts in a row reads as an ad account.
4. **Promo lands after value.** An ad post only after at least two consecutive non-promo posts, and never in the first three.
5. **Time passes in the story.** Wardrobe and light should imply days going by. If the user wants a mini-series shot "the same day", keep the outfit and setting family and vary framing and time-of-day only.
6. **One running thread is enough.** A single continuity thread (a challenge week, a project, a countdown) gives a grid narrative; two competing threads confuse it.
7. **End the batch on the routine or wrap pillar** so the next session has an obvious starting point.

## Cadence

Whatever the posting rhythm, the manifest is the clock: `posts[].date` plus the last pillar/setting/archetype is what the next-post loop reads. Generate on demand (one post per request) rather than stockpiling — a stockpiled batch drifts from whatever the user says next about the persona.

## Captions

- Written in `persona.voice`, 1–2 lines, lowercase or sentence case, first person.
- Concrete beats clever: "week 6, still not shredded" over "consistency is key".
- No hashtag walls; 2–4 tags if the user wants them.
- A caption is not a hook. Hook text is the burned-in overlay on an **ad post** and follows ugc-director's `references/hooks.md` (≤8 words, on the first frame, passed as `--hook` at merge). Organic posts have captions only.
- Never write a caption that implies the person spoke on camera — the clips are silent by design.

## Grid audit checklist

Run this when the user asks "does my account look real?" or before adding to an existing grid. Read `posts[]` in the manifest and flag every one that is true:

- [ ] A setting repeats in consecutive posts
- [ ] An archetype appears more than twice in the last six posts
- [ ] Every post uses the same framing (usually: all arm's-length selfies)
- [ ] The lighting is identical across the whole grid
- [ ] Every post is video (no photo posts at all)
- [ ] More than 1 in 5 posts is a promo post
- [ ] A post breaks `persona.never_posts`
- [ ] The wardrobe implies an impossible day (season or weather jumps)
- [ ] The face drifts — a picture not generated from the base image, or a recast mid-grid
- [ ] A clip shows the mouth moving as if talking (regenerate; see ugc-director rule 1)

Fix findings with the cheapest instrument available: reordering costs nothing, a replacement photo post costs 2, and only a genuinely unusable clip is worth 7.
