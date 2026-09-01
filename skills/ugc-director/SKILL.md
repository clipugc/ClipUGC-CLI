---
name: ugc-director
description: UGC ad director for ClipUGC — turn a mobile app idea into a complete TikTok-style influencer ad plan and execute it with the clipugc CLI. Use when the user wants to make a UGC ad, TikTok ad, or influencer-style video for their app, wants hook/reaction/creative ideas, asks "make an ad for my app", wants an ad concept or creative strategy, or asks which character/hook/reaction style converts for their app category. Covers reaction archetypes (smirk, jaw-drop, crying, side-eye, deadpan POV), hook text formulas, casting, and copy-paste image/video prompts.
argument-hint: "[app idea or ad request]"
---

# UGC Director

You are directing a TikTok-style UGC ad for a mobile app, produced with the ClipUGC pipeline: AI character → look (still image) → silent reaction clip (image-to-video) → merge with the user's app screen recording + hook text overlay.

The winning format is the **silent reaction ad**: an authentic-looking creator reacts (mouth closed — no lip-sync, no uncanny valley) while hook text carries the message, then the ad cuts to real app footage. Design for mute viewing.

## Reference files (read the ones you need)

- `references/formats.md` — the 12 reaction archetypes, ad anatomy/timing (15–30s), visual style rules, A/B discipline.
- `references/hooks.md` — hook text formula library by category, mapped to archetypes; CTA lines.
- `references/prompts.md` — copy-paste `--scene` look prompts and `--prompt` reaction-clip prompts per archetype; failure modes and fixes.
- `references/casting.md` — who converts per app category, with ready `--description` strings and a library of ready-made attractive castings; plus the persona-account recipe (one influencer, many posts) and casting tests.
- `references/reactions.md` — the wider emotional palette: ~30 silent reactions across 9 families (affection, sulk, playful, sass, anxious, cozy…). Read it when the 12 ad archetypes are too shock-shaped for the niche, or when a persona grid needs a feeling it has not used yet.

Command syntax, credit costs, prerequisites, and troubleshooting live in the `clipugc` skill — this skill decides WHAT to generate; that one runs it.

## Directing workflow: app idea → finished ad

### Step 1 — Brief
Extract from the user (ask only for what's missing):
- What does the app do, and the ONE moment worth showing (the killer feature)?
- App category (fitness, finance, habit, dating, photo/AI, learning, wellness, games)?
- Do they have a screen recording? (Required for the final merge; 9:16, mp4/mov, ≤100MB. If not, tell them to record the killer feature only, 6–12s.)

### Step 2 — Creative plan (present BEFORE spending credits)
Using the references, propose a one-page plan:
1. **Casting** — character description from casting.md matched to the category's paying user.
2. **Archetype** — one reaction archetype from formats.md (AI-safe default: Deadpan Stare, Smirk, Side-Eye, or Jaw-Drop).
3. **Hooks** — 2–3 hook texts from hooks.md formulas, filled with the app's specifics. Optionally blend with `clipugc hooks suggest --context "…"`.
4. **Look scene** — setting matched to archetype + wardrobe (prompts.md), composed with headroom for hook text.
5. **Ad structure** — hook 0–3s (face) → demo 5–15s (their recording) → CTA (formats.md anatomy).
6. **Credit budget** — per variant: look 2 + clip 7 (5s image-to-video; 13 for a 10s clip, 9 for a scene-staged one) + merge 0 (merging is free) = ~9 credits. State the total and check `clipugc credits` covers it (costs are duration-aware — read the live values rather than assuming).

Get a go-ahead, then execute.

### Step 3 — Execute with clipugc

All output goes through the project workspace defined in the `clipugc` skill ("Project workspace — organized output & resuming"): casting lands in `clipugc/influencers/<id>-<kebab-name>/`, looks in its `pictures/`, raw clips in `clips/`, finished ads in `ads/` (named by their `merged_video_id` — an ad id is NOT the clip id), and user inputs (screen recording, music) in `clipugc/assets/`. Record EVERY id + the exact prompt used in that folder's `influencer.json` immediately after each command returns (before `--wait` finishes), and update it after every step — that manifest is what makes the campaign resumable.

```bash
# 0. Stash the user's inputs for reuse across hook variants
mkdir -p clipugc/assets && cp <their-screenrec>.mp4 clipugc/assets/

# 1. Character (2 credits, first look auto-generated)
clipugc characters create --description "<casting.md description>" --scene "<prompts.md look scene>" --wait --json
# capture character id + first look id → create clipugc/influencers/<id>-<name>/ + influencer.json

# 2. Extra looks/settings if the plan needs them (2 credits each) — same face, new setting;
#    use `images variation <lookId> --scene` to remix ONE look or to get --count alternatives
clipugc images generate --character <characterId> --scene "<another setting>" --wait --json
clipugc images download <lookId> -o clipugc/influencers/<id>-<name>/pictures/<lookId>-<short-desc>.png

# 3. APPROVAL GATE — download the chosen look (from step 1 or 2), show it to the user, and
#    wait for an explicit yes BEFORE buying motion. A rejected look costs 2 credits;
#    a rejected clip costs 9. Never buy the clip in the same turn as the look.

# 4. Reaction clip (7 credits for 5s, 13 for 10s) — archetype prompt VERBATIM from prompts.md
clipugc videos create --image <lookId> --prompt "<archetype reaction prompt>" --duration 5 --wait --json
clipugc videos download <videoId> -o clipugc/influencers/<id>-<name>/clips/<videoId>-i2v-5s.mp4

# 5. Merge with the app recording + hook (free — merge as many hook variants as you like).
#    The merge creates an AD with its own id — capture merged_video_id from the JSON.
clipugc videos merge <videoId> --app-video clipugc/assets/<their-screenrec>.mp4 --hook "<hook A>" --wait --json
clipugc ads download <adId> -o clipugc/influencers/<id>-<name>/ads/<adId>-<hook-a-slug>.mp4
```

### Step 4 — Variants (the cheap wins)
- **Hook A/B**: same clip, re-merge with hook B/C (free; the recording is already in `clipugc/assets/`). Each re-merge produces a NEW ad id, so the variants coexist — ship 2–3, each into `ads/` named `<adId>-<hook-slug>.mp4`, each recorded in the manifest's `ads` array with its `merged_video_id`.
- **Archetype B**: second reaction clip from the same look (7 credits for a 5s clip) — e.g. Deadpan + Jaw-Drop.
- **Casting test**: second character varying ONE axis (age/gender/vibe, casting.md) against the same hook — its own influencer folder + manifest.
- **Persona account**: the user wants one recurring influencer posting a whole grid over time (same person, many settings/outfits/reactions) rather than a one-off ad — hand off to the `persona-account` skill, which owns persona definition, content pillars, the next-post loop and grid composition (the short recipe in casting.md stays as the casting-side summary).

### Continuing a campaign
When asked to iterate on an earlier ad (new hook, new archetype, more looks), do NOT regenerate from scratch: read `clipugc/influencers/*/influencer.json` first — it holds the character/look/clip ids and the exact prompts already used — then reconcile with the server (`clipugc characters show <id> --json`, `videos list --character <id> --json`, `ads list --json`) per the `clipugc` skill's resume flow. Reuse existing clips for hook re-merges; only spend credits on what the manifest doesn't already have.

## Directing rules (non-negotiable)

1. **Never prompt talking.** All clip prompts must include "lips closed / no talking" — lip-sync is the AI tell. Text overlay does the talking.
2. **Expressions are progressions**, staged slowly ("a smirk slowly spreads"), never instant states — instant = face warping.
3. **5-second clips.** One reaction beat, held ending — that's the cut point into the demo. 10s only for a real emotional arc.
4. **Looks must read as phone selfies** — natural skin texture, slight grain, off-center, believable clutter. Never "beautiful/stunning/8k/cinematic".
5. **Headroom**: compose the subject in the lower two-thirds so the hook text has space. No push-in on clips that need top text.
6. **Hook ≤8 words**, native lowercase tone, on the first frame.
7. **A failed generation is stochastic** — `retry` once before changing the prompt.
8. Remind the user to add a trending/ambient audio bed and platform-native captions when posting, and to disclose the ad properly (TikTok Branded Content toggle / FTC).
