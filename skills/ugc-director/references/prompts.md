# Prompt Library: Looks (image) & Reaction Clips (video)

Copy-paste prompts for the ClipUGC pipeline. `--scene` on `images generate`/`images variation` steers the LOOK (a still image). `--prompt` on `videos create` steers the MOTION (image-to-video). Two different crafts — do not mix them.

## Golden rules (image-to-video)

1. **Never re-describe the person.** The look image already encodes appearance, lighting, framing. The video prompt describes ONLY what moves. Re-describing the face causes warping.
2. **Stage expressions as a progression, never an instant state.** "She smiles" → morphing. "A faint smile slowly forms, warmth reaching her eyes" → natural.
3. **No talking, ever.** Lip-sync from a still image is the #1 uncanny tell. Always include "lips closed" / "without speaking" in the prompt. Silent reactions + text overlay ARE the format (see formats.md).
4. **Slow verbs.** `slowly`, `gradually`, `subtle`, `gentle`. Never `suddenly`/`quickly` — fast motion warps faces.
5. **One emotional arc per clip, one camera behavior.** End on a held expression — that's the clean cut point into the app screen recording.
6. **Anchor hands.** Free-floating hand motion morphs fingers. "hand resting on…", "natural grip", "fingers still" — or keep hands out of frame.
7. **Add ambient motion** ("hair moves subtly") — without it the clip looks like a frozen photo.
8. **5s beats 10s.** One reaction beat needs 3–5s; identity drift compounds with duration. You cut to the screen recording anyway. Use 10s only for a real arc (neutral → tearing up → smile).

## Look prompts (`--scene` on images generate/variation)

The goal: the look must read as a phone selfie, not a studio portrait. Compose the subject in the LOWER two-thirds so hook text has headroom.

**Authenticity keyword arsenal** (mix 3–5 into any scene):
`front-facing phone selfie` · `holding the phone at arm's length` · `candid, unposed` · `natural skin texture` · `slight grain` · `soft window daylight` · `slightly off-center framing` · `casual home environment with believable clutter` · `amateur phone photo, not professional` · `empty space above her head for text overlay`

**Never use:** "beautiful", "stunning", "8k", "cinematic lighting", "masterpiece" — these pull toward the plastic stock-photo look that scrollers ignore.

### Ready-made look scenes

Bedroom selfie (default for most archetypes):
```
front-facing phone selfie at arm's length, looking directly into the camera, casual bedroom behind her with warm lamp light and soft window daylight, natural skin texture, slight grain, slightly off-center framing, candid unposed expression, head in the lower two-thirds of the frame with empty space above for text overlay, amateur phone photo
```

Parked car (confession / rant energy):
```
front-camera phone selfie sitting in the driver's seat of a parked car, seatbelt visible, phone slightly below eye level, daylight through the windshield with slightly uneven exposure, natural skin texture, candid expression, casual clothes, amateur phone photo, headroom above for text
```

Bathroom mirror:
```
mirror selfie on a phone, standing in a normal apartment bathroom with products on the counter, overhead light, natural skin, casual outfit, off-center framing, amateur quality, headroom above for text overlay
```

Cozy in bed (crying-girl / emotional format):
```
front-facing phone selfie lying propped up in bed, dim warm lamp light, oversized hoodie, slightly puffy tired eyes, natural skin texture, unposed and vulnerable, phone at arm's length, amateur photo, space above head for text
```

Desk / chaotic workspace (productivity apps):
```
front-facing phone selfie at a cluttered desk with a laptop, sticky notes and a coffee mug behind, daytime window light, tired but amused expression, natural skin, candid framing, amateur phone photo, headroom above for text
```

## Reaction clip prompts (`--prompt` on videos create)

> These 11 cover the ad archetypes in `formats.md`. For the wider emotional palette —
> affection, longing, sulk, playful, sass, anxious, cozy — see `reactions.md`, which is
> where a persona grid gets its variety.

Formula: `[camera behavior] + [staged expression arc in beats] + [held ending] + [ambient motion] + [anti-talking clause]`. Numbers match archetypes in formats.md. All designed for `--duration 5`.

### 1. Smirk — "I know something you don't"
```
Handheld selfie framing with tiny natural wobble. She looks directly into the camera, one eyebrow raises slightly, a knowing smirk slowly spreads across her face, and she nods slowly twice, lips closed, holding eye contact the entire time. Hair moves subtly. No talking, mouth stays closed.
```

### 2. Jaw-Drop
```
Handheld selfie framing, slight drift. Her expression gradually shifts from neutral to amazed — eyebrows rise, eyes widen, lips part slightly in a silent gasp — then she breaks into a delighted grin and holds it, looking straight into the camera. Hair moves subtly. No talking.
```

### 3. Hand-Over-Mouth Shock
```
Handheld selfie framing, tiny wobble. She looks into the camera, neutral. Her eyes slowly widen, eyebrows shoot up, and she covers her mouth with one hand in disbelief, natural grip, keeping direct eye contact, expression held. Lips closed, no talking. Hair moves subtly.
```

### 4. Crying Girl (happy tears — hardest, keep 5s)
```
Static selfie shot with subtle handheld drift. Her eyes gradually glisten with emotion, a single happy tear wells up, she blinks, presses her lips together into a trembling smile and nods slowly, overwhelmed, mouth stays closed. Hair moves subtly. No talking, no sobbing.
```

### 5. Side-Eye Skeptic → Convinced
```
Handheld selfie framing. She gives a slow skeptical side-eye glance away from the camera, then looks back at the lens, her expression softening into an impressed nod, eyebrows raised, slight closed-mouth smile, holding eye contact at the end. Hair moves subtly. No talking.
```

### 6. Point-at-Text (needs headroom in the look)
```
Handheld selfie framing, locked composition. She glances up toward the empty space above her head, points upward with her index finger, hand steady and natural, then looks back into the camera with raised eyebrows and an excited closed-mouth smile, nodding once. No talking.
```

### 7. Head-Shake — "why did nobody tell me"
```
Handheld selfie framing, slight wobble. She exhales through her nose, shakes her head slowly with a rueful closed-mouth smile, briefly glances up at the ceiling, then back into the camera with an amused resigned look, holding it. Hair follows the motion naturally. No talking.
```

### 8. Deadpan POV Stare (cheapest, most reliable)
```
Nearly static selfie framing with subtle handheld drift. She holds direct eye contact with the camera, face almost still — only a slow blink, a tiny eyebrow raise, and the faintest hint of a smile forming at the end. Lips closed the entire time. Hair moves subtly. No talking.
```

### 9. Nod-Along — "that's actually useful" (proof beat)
```
Handheld selfie framing. She looks at the camera with raised eyebrows and an approving closed-mouth half-smile, nods along slowly three times as if agreeing, small shrug at the end, expression held. Hair moves subtly. No talking.
```

### 10. Speed-Shock double-take
```
Handheld selfie framing. She looks off to the side casually, then does a double-take toward the camera, eyes gradually widening, a silent gasp with lips barely parted, then an incredulous grin, slight head shake, holding eye contact. Hair follows naturally. No talking, no fast movement.
```

### 11. Mid-Task Glance-Up
```
Handheld framing, slight wobble. She is looking down concentrating, then slowly glances up into the camera with a knowing, tired but amused closed-mouth smile, one eyebrow raised, holds the look, then a small nod. Hair moves subtly. No talking.
```

## Failure modes → fixes

| Symptom | Fix |
|---------|-----|
| Mouth moves / ghost-talking | Add "lips closed, no talking" AND avoid any speech-adjacent verbs ("says", "reacts verbally"). If it persists, regenerate — it's stochastic |
| Face melts mid-clip | Expression was requested as instant state — restage as slow progression; shorten to 5s |
| Hands morph / extra fingers | Anchor the hand ("covers her mouth, natural grip") or remove the hand action |
| Frozen-photo look | Missing ambient motion — add "hair moves subtly" |
| Motion too theatrical | Remove intensity words; add "subtle", "slight", "gently" |
| Composition drifts, headroom lost | Add "locked composition" / avoid push-in when hook text needs the top third |

## Duration & cost cheatsheet

- Look: 2 credits. Clip: 7 credits (5s) / 13 (10s); a `--scene` staged clip is 9. Motion control: 3 credits per second of driver video (rounded up, capped at 30s). Merge: free. Costs are duration-aware — read the live values with `clipugc credits`.
- Default `--duration 5`. A full ad = 1 look (2) + 1 clip (7) + 1 merge (0) = ~9 credits minimum.
- Hook A/B: reuse the same clip, merge again with a different `--hook` (free per variant).
