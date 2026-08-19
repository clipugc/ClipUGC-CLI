# UGC Ad Formats: Reaction Archetypes & Ad Anatomy

Why silent-reaction formats dominate TikTok app ads — and the exact production patterns to copy.

## Why non-talking reaction ads win (and why they're perfect for AI characters)

- **The face buys the first 3 seconds.** A reaction ad opens with a face, an emotion, and a point of view instead of a logo or feature list. Ads that win the first 3s see ~62% higher completion and ~54% lower CPM.
- **Sound-off insurance.** A large share of viewers scroll muted. A silent reaction + text overlay carries 100% of the message either way. Text overlays appear in ~71% of top-performing TikTok ads.
- **No lip-sync = no uncanny valley.** Lip-sync is the #1 tell of AI-generated creators. A mouth-closed smirk, jaw-drop, or head-shake requires zero phoneme matching — silent reactions are the single best format for AI avatars.
- **Short beats hide artifacts.** A reaction beat is 1–3s. AI video quality degrades with clip length, so 2s reaction + 10s REAL screen recording + soft CTA is nearly artifact-proof. The app UI footage is real, which anchors credibility.
- **Proven at scale.** The "crying girl" text-overlay format (zero spoken words, story told entirely in captions) generated billions of TikTok views. Replicate the format — and disclose ads properly (TikTok Branded Content Policy + FTC).
- **Under-act.** A quick eyebrow raise or a "nah, that's actually useful" nod beats cartoon shock. Micro-reactions read as genuine; theatrical ones read as ads.

## The 12 reaction archetypes

Pick ONE per ad. Each maps to hook categories (see hooks.md) and has ready-made generation prompts (see prompts.md).

| # | Archetype | What it looks like | Emotion | Best for |
|---|-----------|-------------------|---------|----------|
| 1 | **Smirk** ("I know something you don't") | One-sided smile, direct eye contact, slight head tilt while hook text types out | Curiosity / secrecy | Secret-tool hooks ("apps that feel illegal to know"); AI & photo apps |
| 2 | **Jaw-Drop** | Eyes widen, mouth opens, hand rises toward face at a result | Disbelief | Result-reveal ads: AI output, before/after, "watch what this app did" |
| 3 | **Hand-Over-Mouth** | Palm clamps over mouth, eyebrows up — slower, more "genuine" than jaw-drop | Disbelief | Scandalous/secret angles (dating-safety, "what they don't tell you" finance) |
| 4 | **Crying Girl / Emotional Confession** | Tears or post-cry face, bed or car setting, slow head-shake; text overlay carries the entire story, zero dialogue | Relief / sadness | "This app saved me" arcs: mental health, habit, dating-safety, debt recovery |
| 5 | **Side-Eye Skeptic → Convinced** | Squint, glance away, look back impressed | Disbelief → relief | Overcoming skepticism in hyped categories (AI, finance); "I thought it was fake" |
| 6 | **Point-at-Text** | Silently points at floating text beside/above their head | Curiosity | Listicle ads ("3 apps that…"), feature stacks; also as the CTA exit gesture |
| 7 | **Head-Shake** ("why did nobody tell me") | Slow head shake, mock disappointment, glance at ceiling | Relief + regret | "I've been doing this manually for years" — productivity, utility apps |
| 8 | **Deadpan POV Stare** | Motionless direct-to-camera stare while a long text overlay tells the story. Viewer reads; face holds | Ambiguous tension | "POV:" hooks, relatable-pain hooks. Cheapest to produce; ideal for AI characters |
| 9 | **Nod-Along** ("that's actually useful") | Small approving nods, raised eyebrows, half-smile | Approval | Mid-roll reaction beat over the demo; end-of-ad proof beat |
| 10 | **Speed-Shock** | Physical recoil / double-take at how fast the app did the thing | Speed surprise | AI generation apps, editors — "wait, it's already done?" |
| 11 | **Mid-Task Glance-Up** | Caught doing the chaotic thing (desk mess, gym, kitchen), knowing glance at camera | Relatability | Casting-matched ads (e.g. busy mom + fitness app) |
| 12 | **Fake-Discovery** | "Catches" something using the product, reacts silently | Curiosity | Social/dating apps, virality bait |

These 12 are tuned for ADS — shock, curiosity, approval, the beats that sell a feature in
15–30s. For persona accounts and relational niches (long-distance, dating, faith, mom-life,
mental health) that palette is too loud on its own: those grids run mostly on affection,
sulk, playfulness and cosiness, with a jaw-drop only as punctuation. `reactions.md` carries
that wider set — read it before planning a grid, or when a niche makes "silently amazed at a
feature" ring false.

AI-character guidance: prefer archetypes 1, 2, 5, 6, 7, 8, 9, 10 (curiosity/disbelief — AI excels). The crying/confession arc (4) is the hardest to make believable with AI; only attempt with the staged tearing-up prompt in prompts.md and keep it under 5s.

## Ad anatomy (15–30s)

| Segment | 15s cut | 30s cut | Content |
|---------|---------|---------|---------|
| **Hook** | 0–2s | 0–3s | Face + reaction + text overlay ON FIRST FRAME (≤5 words) |
| **Problem/setup** | 2–4s | 2–5s | Relatable pain — still on face |
| **Reveal** | 4–6s | 5–10s | "then I found this" — cut into the app |
| **Demo (screen recording)** | 6–12s | 10–20s | Real UI, ONE killer feature, result shown fast |
| **Proof beat** | (merged) | 20–25s | Cut back to face: nod-along or speed-shock |
| **CTA** | last 2–3s | last 3–5s | Soft, peer-to-peer ("check it out if you deal with this too") |

- **Bias short.** 12–25s is the reaction-ad sweet spot; completion drops ~10% per extra 5s. Use 30s only if the demo earns it.
- **Face vs app split:** open on the person, cut to screen demo at ~5–7s, close on the person + CTA — roughly 40–50% face, 50–60% app footage.
- **Transitions:** snap cut on a beat, whip pan, and the matched **zoom-into-the-phone-screen** (zoom in at end of the face clip, matched zoom out on the screen recording = seamless cut into the demo).
- **ClipUGC mapping:** the face clip = `videos create` output; the demo = the user's app screen recording; the hook text = `--hook` on `videos merge`. One merge = one hook+clip+recording combination.

## Visual style rules

- Front-facing selfie cam or handheld look. Smartphone-quality footage outperforms polished brand video (~22%).
- Settings: bedroom (bed = crying/confession), parked car (confession/rant), bathroom mirror, kitchen, street. Believable clutter = credibility.
- Imperfection is the feature: slightly off framing, natural light, no studio polish. Avoid "introducing…/revolutionary" language and logo-heavy first frames.
- 9:16 vertical only. Keep text inside safe zones (top/bottom thirds). Hook text ≤5 words on the first frame.
- Design for mute, ship with sound: non-talking ≠ silent upload — add a trending/ambient audio bed in post.

## Testing discipline

- Swap ONLY the first 3 seconds between variants; keep body/creator/CTA constant.
- 4–6 creatives per ad group; 2–3 hook variants per video is the standard deliverable.
- With ClipUGC the cheap wins come from reuse: one look generates 2–3 different reaction clips (7 credits each for a 5s clip), and each hook variant is just another merge (free) of the same clip + screen recording.
