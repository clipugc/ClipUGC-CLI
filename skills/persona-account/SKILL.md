---
name: persona-account
description: Run an ongoing AI creator account with ClipUGC — one persona, posting consistently over time. Use when the user wants to create an AI influencer or virtual influencer for Instagram or TikTok, asks for "the next post", wants a content plan / posting grid / content pillars for an AI creator account, wants the same person to stay recognisable across every post, asks what a fitness / beauty / faith / study / food / mom / tech influencer would plausibly post, or wants to grow and keep feeding an AI creator account. Covers persona definition, per-niche content pillars, the next-post loop, grid composition, and the picture-before-video credit gate.
argument-hint: "[niche, or 'next post']"
---

# Persona Account

You are running ONE AI creator account over time: an Instagram/TikTok persona whose posts must read as the same person living a plausible life. Cast once, then post forever — the face never changes, the setting/outfit/pillar rotate.

This is a different job from a one-off ad:

| | `ugc-director` | `persona-account` (this skill) |
|---|---|---|
| Unit of work | one app → one ad campaign | one person → an endless feed |
| Success test | does it convert | does the account read as a real human |
| Output | ad (clip merged with app footage + hook) | post (look, usually + clip; occasionally an ad post) |
| Repeats | 2–3 hook variants of the same clip | a new post every time, never the same beat twice |

Use `ugc-director` when the user says "make an ad for my app". Use this skill when they say "create an AI influencer", "give me the next post", or "grow my account".

## Reference files (read the ones you need)

- `references/niches.md` — persona profiles + content pillars per niche (fitness, beauty/GRWM, faith, study/productivity, food, mom-life, tech), with ready `--description` strings and what each persona would NOT post.
- `references/grid.md` — what a believable 6/9/12-post grid looks like, rotation matrices, sequencing rules, cadence, caption voice, and a grid audit checklist.

Borrow, never restate:

- **Command syntax, credit costs, prerequisites, the `clipugc/` workspace and `influencer.json`** → the `clipugc` skill.
- **Reaction archetypes (the 12), clip `--prompt` text, look `--scene` text, hook formulas** → the `ugc-director` skill and its `references/formats.md`, `references/prompts.md`, `references/hooks.md`. Copy clip prompts VERBATIM; do not write your own reaction prompts here.
- **The emotional palette for an ongoing grid** → ugc-director's `references/reactions.md` — ~30 silent reactions across 9 families (affection, longing, sulk, playful, sass, anxious, cozy, warmth, shock). This is the file this skill leans on most: the 12 ad archetypes are shock-and-curiosity shaped, and a grid built only from those reads as a bot. Real creator accounts run mostly on the soft families with a jaw-drop as punctuation.

The silent format is the same one `ugc-director` enforces. Its directing rule 1, verbatim:

> **Never prompt talking.** All clip prompts must include "lips closed / no talking" — lip-sync is the AI tell. Text overlay does the talking.

On a persona account the caption (or the burned-in overlay on an ad post) is what does the talking. No exceptions — a persona account posts more clips than an ad campaign does, so one talking clip poisons a whole feed.

## Cost discipline — the approval gate (read before spending anything)

A picture is 2 credits. A clip is 7 (5s) or 13 (10s). A merge is 1. So the cheap thing is the face and the expensive thing is the motion.

**The gate: look first, then ask, then spend.**

1. Generate the look (2 credits) and download it into `pictures/`.
2. Show the user the image path, plus what the post is (pillar, setting, caption direction) and what the clip will cost.
3. **Wait for an explicit yes.** Never run `videos create` in the same turn as `images generate`.
4. Only on approval, spend the 7 (or 13) credits on the clip.

A rejected look costs 2 credits. A rejected clip costs 9. **If the user does not like the character at all, no video credits are ever burned** — that is the entire point of the gate.

When a look is rejected, diagnose before re-spending:

| What's wrong | Fix | Cost |
|---|---|---|
| Setting, outfit, framing, mood | New `--scene` on the same character | 2 |
| This one look is close but off | `images variation <lookId> --scene "…" --count 2` | 2 each |
| The *person* is wrong (age, vibe, gender, face) | The casting is wrong — recast with a new `--description` (see `niches.md` and ugc-director's `casting.md`). Do NOT keep buying looks off a character the user dislikes | 2 (new character) |

Per-post maths:

| Post type | Commands | Credits |
|---|---|---|
| Photo post | `images generate` | 2 |
| Video post (5s) | `images generate` + `videos create --duration 5` | 9 |
| Video post (10s) | `images generate` + `videos create --duration 10` | 15 |
| Ad post (video + the user's app recording) | + `videos merge` | 10 |
| Scene-staged clip (`videos create --scene`, stages then animates) | replaces the two-step | 9, no separate look |
| Look the user rejected | `images generate` only | 2 |

**Do not use the scene-staged shortcut on a persona account.** It is one credit cheaper than look-then-clip, but it stages the new setting inside the video job, so there is no still to approve — the gate disappears and a bad setting costs 9 instead of 2. Take the two-step every time.

These are the current published values. **Read live costs with `clipugc credits` before quoting a budget** — costs are duration-aware and server-authoritative; never hard-code them into a plan you show the user.

## Step 1 — Define the persona (once, then obey it)

Do this the first time the user says "create an AI influencer for <niche>". Ask only for what's missing; propose defaults from `niches.md` rather than interrogating the user.

| Field | What to settle | Source |
|---|---|---|
| `niche` | fitness, beauty, faith, study, food, mom-life, tech, … | user |
| `handle` | account name/handle the posts are for | user (optional) |
| `age_look` | age band, build, hair, one facial signature, authenticity anchor | `niches.md` → ready `--description` |
| `aesthetic` | colour/light palette the whole feed obeys (e.g. "warm neutrals, morning window light, film grain") | `niches.md` |
| `settings` | 4–6 recurring places this person actually lives in — the rotation pool | `niches.md` + ugc-director `prompts.md` scenes |
| `wardrobe` | 3–5 outfits the person re-wears, matched to the settings and the season | `niches.md` |
| `voice` | caption tone + energy (e.g. "low-hype, lowercase, first person, self-deprecating") | user/`niches.md` |
| `pillars` | 3–5 recurring post types | `niches.md` |
| `posts_about` / `never_posts` | the boundary that keeps the account plausible | `niches.md` |
| `visibility` | `--private` if this persona is the user's alone; public/discoverable is the CLI default | user |

**Cast for attraction here, not for a payer persona.** An account grows on whether people want to follow this person, so `age_look` should say it outright — "very pretty", "striking", "conventionally attractive" — unless the user asks for something plainer. Pair it with the realism anchor or it reads synthetic: "natural skin texture", "not airbrushed", "reads as a real person". Makeup is directable ("barely-there makeup", "soft glam"); nothing forces a bare face. This is the one place `persona-account` deliberately parts from ugc-director's "cast the paying user, not the prettiest creator" — that rule optimises ad conversion, this account optimises follows.

**Start from a known-good casting rather than writing one from scratch.** ugc-director's
`references/casting.md` has ready-made, proven descriptions (blonde Scandinavian, sun-kissed
Californian, Mediterranean soft-glam, polished Korean) plus the four-part formula behind
them — concrete features, an explicit attractiveness claim, directed makeup AND a named
lighting setup, then the realism anchor. Adapt one to the niche instead of inventing a
description; a vague cast ("gen-z woman, brown hair, friendly smile") is the single most
common reason a persona's first look comes out looking generic. Cast adults only, and keep
the stated age unambiguously adult.

Then cast — once, and never again for this account:

```bash
# 2 credits, first look included. That first look becomes the BASE IMAGE: the identity
# anchor every later picture is generated from. Make it on-brand.
clipugc characters create --description "<persona description>" \
  --scene "<the persona's primary setting, from niches.md / prompts.md>" --wait --json
clipugc characters rename <characterId> --name "<Persona Name>"
```

Create `clipugc/influencers/<id>-<kebab-name>/`, write `influencer.json` with the `persona` block below, download the base look into `pictures/`, and record its id as `persona.base_image_id`.

**Mid-conversation persona edits are persona edits.** When the user says "she's a fitness influencer", "keep roughly the same outfit", "less makeup from now on", write it into the `persona` block immediately. Every later post reads that block first — a preference stated once must not need restating.

## Step 2 — The next-post loop (the core of this skill)

When the user says "next post" (or "another one", "post for tomorrow"):

1. **Read the manifest.** `clipugc/influencers/*/influencer.json` — the `persona` block and the `posts` array. If the manifest marks anything pending/processing, or it looks stale, reconcile with the server first per the `clipugc` skill's resume flow (`characters show`, `images list --character <id>`, `videos list --character <id>`).
2. **Pick the pillar.** From `persona.pillars`, one NOT used in the last post; prefer the pillar least used across the whole `posts` array.
3. **Pick the setting and framing.** From `persona.settings`, never the setting used in the previous post, and prefer one unused in the last two (reuse it sooner only with a clearly different light or time of day). Rotate framing too (arm's-length selfie → mirror → mid-task glance-up → photo-only still).
4. **Pick the reaction archetype** from ugc-director `formats.md` — not the archetype used in either of the last two posts.
5. **Compose the look `--scene`**: persona `aesthetic` + the chosen setting + a wardrobe item + 3–5 authenticity keywords from `prompts.md`. **Never re-describe the person** — the base image carries the face; re-describing it causes drift.
   ```bash
   clipugc images generate --character <characterId> --scene "<setting + wardrobe + authenticity keywords>" --wait --json
   clipugc images download <lookId> -o clipugc/influencers/<id>-<name>/pictures/<lookId>-<short-desc>.png
   ```
   Record the look id + the exact `--scene` in the manifest's `pictures` array as soon as the command returns (the `clipugc` skill's record-ids-immediately rule).
6. **STOP. Show the look and the plan, and wait for the explicit yes** (see the approval gate above). Present: the image path, the pillar, the caption draft, the archetype, and the clip cost.
7. **On approval, and only then**, buy the motion — reaction prompt VERBATIM from `reactions.md` (or `prompts.md` for the ad archetypes). Pick a family the grid has not used recently; rotating feeling is what stops a grid looking generated:
   ```bash
   clipugc videos create --image <lookId> --prompt "<reaction prompt from reactions.md / prompts.md>" --duration 5 --wait --json
   clipugc videos download <videoId> -o clipugc/influencers/<id>-<name>/clips/<videoId>-i2v-5s.mp4
   ```
8. **Write the caption** in `persona.voice` (see `grid.md` for caption rules), and append the post to the manifest's `posts` array.
9. **Merge only if this is an ad post** — i.e. the user has an app screen recording and wants this post to sell. Then it is a `ugc-director` job for the hook and the anatomy; the merge command and the ad id space live in the `clipugc` skill (`merged_video_id` ≠ clip id).

Deliver ONE post per request. Do not batch a week of posts unless the user explicitly asks for a batch — and if they do, still gate every clip behind the look approval, look-by-look.

## Step 3 — Continuity rules (what makes it one person)

1. **The base image never moves.** The character's first completed picture is the identity anchor; every later picture is an edit of it. Both `images generate --character <id>` and `images variation <lookId>` keep the face — choose by intent (a new look of the person vs. a remix of one specific look), not out of identity fear.
2. **Never recast mid-account.** A new character is a new person and breaks the illusion. Recast only when the user rejects the persona itself, and then start the account over.
3. **Rotate settings; never repeat a setting back-to-back.**
4. **Wardrobe must be plausible for the same life.** A real creator re-wears clothes: repeat outfits across the feed, but keep a single day/season coherent — no snow parka one post and a tank top the next unless time has passed in the story.
5. **Vary the reaction.** Same expression twice in a row reads as a template, not a person.
6. **One emotional register per persona.** A calm wellness persona does not suddenly do Speed-Shock double-takes.
7. **Respect `never_posts`.** The boundary is what makes the account believable; breaking it for one good idea costs more than the idea is worth.
8. **A failed generation is stochastic** — `retry` once before rewriting the prompt.

## Manifest — extend `influencer.json`, do not invent a new file

Same file, same folder, same rules as the `clipugc` skill's "Project workspace" section (record ids immediately, update after every step). Add two keys; keep `pictures` / `clips` / `ads` exactly as they are — they stay the id + prompt ledger, and `posts` only indexes into them.

```json
{
  "id": 12,
  "name": "Isabella Romero",
  "description": "warm approachable woman in her late 30s, athletic but realistic build …",
  "created_at": "2026-08-17",
  "visibility": "public",
  "persona": {
    "niche": "fitness",
    "handle": "@izzy.moves",
    "base_image_id": 87,
    "age_look": "late 30s, athletic-realistic build, freckles, practical ponytail",
    "aesthetic": "warm neutrals, morning window light, slight grain",
    "settings": ["home gym corner", "kitchen counter", "parked car", "bathroom mirror"],
    "wardrobe": ["grey workout top + black leggings", "oversized hoodie", "denim jacket"],
    "voice": "low-hype, lowercase, first person, honest about hard days",
    "pillars": ["morning routine", "progress check-in", "form tip", "meal of the day", "rest-day honesty"],
    "posts_about": ["consistency over intensity", "training around a full-time job"],
    "never_posts": ["extreme diets", "medical advice", "supplement miracle claims"]
  },
  "pictures": [
    { "id": 87, "prompt": "kitchen counter, early morning window light…", "file": "pictures/87-kitchen-base.png", "status": "completed" },
    { "id": 88, "prompt": "home gym corner, morning light…", "file": "pictures/88-home-gym.png", "status": "completed" }
  ],
  "clips": [
    { "id": 92, "mode": "i2v", "duration": 5, "prompt": "…approving closed-mouth half-smile, nods along slowly three times… No talking.", "source_image_id": 88, "file": "clips/92-i2v-5s.mp4", "status": "completed", "merged": false }
  ],
  "ads": [],
  "posts": [
    {
      "n": 4,
      "date": "2026-08-17",
      "pillar": "progress check-in",
      "setting": "home gym corner",
      "framing": "arm's-length selfie",
      "archetype": 9,
      "picture_id": 88,
      "clip_id": 92,
      "merged_video_id": null,
      "caption": "week 6. still not shredded. still going.",
      "status": "posted"
    }
  ]
}
```

`posts[].merged_video_id` stays `null` for organic posts and carries the ad id for ad posts (the same id recorded in `ads[]`). Prompts live in `pictures`/`clips` only — never duplicate them into `posts`.

**Resuming an account**: read `influencer.json` first, reconcile with the server, and derive the next post from `posts` (last pillar, last setting, last archetype, post count). If a manifest is missing but the character exists on the server, rebuild the folder + manifest from `characters show` / `images list` / `videos list`, then infer a `persona` block from the existing looks and confirm it with the user before posting.

## Growing the account

`references/grid.md` has the blueprints. The short version:

- A believable grid mixes pillars, settings and framings — not one pose repeated in nine outfits.
- Establish the person in the first 3 posts (face-forward, niche legible), then rotate.
- Photo posts are legitimate posts and cost 2 credits; a feed of nothing but video reads as a content farm.
- Promo/ad posts are at most 1 in 5, and never in the first 3.
- Budget a 9-post grid (6 video + 3 photo) at 2 (cast, first look included) + 8×2 (further looks) + 6×7 (clips) = **60 credits**. Confirm against `clipugc credits` before promising a number.

## When the account also sells an app

An ad post is a `ugc-director` deliverable dropped into this feed: its hook, archetype and 15–30s anatomy come from that skill's references, and the merge/ad-id handling from the `clipugc` skill. Keep the persona intact — the same face, the same voice, an app it would plausibly use. If more than one post in five is an ad post, say so and push back; a feed that only sells stops reading as a person.
