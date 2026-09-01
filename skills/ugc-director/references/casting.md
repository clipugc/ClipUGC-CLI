# Casting Matrix: Which Character Converts for Which App

Core principle: **cast the paying user, not the prettiest creator.** Ad marketplaces are saturated with 20-something ring-lit creators, but payers are often 30–64. The 55–64 demo spends ~55 hours/month in apps and clicks social video ads MORE than younger demos. Exceptions exist (dating, photo/AI apps) where attractiveness is itself the ad.

## Matrix by app category

| App category | Who converts | Archetype pairing (formats.md) | Ready `--description` |
|---|---|---|---|
| **Fitness / health** | Women 30–55; postpartum/perimenopause life stages. Older-creator casting beats young influencers here | Mid-Task Glance-Up (11), Head-Shake (7), Nod-Along (9) | `warm approachable woman in her late 30s, athletic but realistic build, light freckles, hair in a practical ponytail, wearing a casual workout top, kind tired eyes, natural no-makeup look` |
| **Finance / budgeting** | Late-20s–40s "regular person with receipts"; category has a trust deficit, so skeptic energy converts | Side-Eye Skeptic (5), Hand-Over-Mouth (3), Point-at-Text (6) | `down-to-earth man in his early 30s, short brown hair, light stubble, plain crew-neck sweater, honest straightforward face, natural skin texture` |
| **Habit / productivity** | 20s–30s student or knowledge worker; "chaotic person got organized" arc | Deadpan Stare (8), Head-Shake (7), Speed-Shock (10) | `slightly frazzled but charming woman in her mid 20s, messy bun, oversized cardigan, expressive eyebrows, glasses, studenty vibe, natural look` |
| **Dating / social** | Attractive 20s women front the ads (the ad casts who the majority wants to meet); safety apps cast relatable women in emotional formats | Crying Girl (4), Fake-Discovery (12), Smirk (1) | `naturally pretty woman in her early 20s, long dark hair, soft features, minimal makeup, cozy hoodie, girl-next-door warmth, candid unposed energy` |
| **Photo / AI apps** | 18–30, trend-fluent, conventionally attractive — their face IS the before/after | Jaw-Drop (2), Speed-Shock (10), Smirk (1) | `photogenic gen-z woman around 22, striking but natural features, trendy casual outfit, playful confident expression, clear skin with natural texture` |
| **Learning (language, music)** | Genuinely older beginners (e.g. 45–64); show adult first-win moments, not young performers | Nod-Along (9), Jaw-Drop (2), Mid-Task Glance-Up (11) | `friendly man in his early 50s, salt-and-pepper hair, reading glasses pushed up, comfortable flannel shirt, warm genuine smile lines, approachable dad energy` |
| **Meditation / wellness** | 40+; realistic relatable humans over aspirational influencers | Deadpan Stare (8, calm variant), Nod-Along (9) | `serene woman in her mid 40s, shoulder-length natural hair, soft cardigan, calm gentle expression, no makeup, warm natural light vibe` |
| **Games / entertainment** | 18–34 either gender; energy over polish | Speed-Shock (10), Jaw-Drop (2), Smirk (1) | `energetic guy around 24, tousled hair, graphic tee, expressive animated face, playful grin, casual bedroom-gamer vibe` |

## Description craft rules (for `clipugc characters create --description`)

- 10–1000 chars; the server extracts structured appearance DNA from it. Concrete physical detail beats vibes: hair, age, build, clothing, one facial signature (freckles, smile lines, glasses).
- Always include an authenticity anchor: "natural skin texture", "candid energy", "reads as a real girl/guy, not airbrushed". That anchor is what defeats the AI look — a bare face is NOT required, so only write "no makeup" when you actually want one.
- Makeup is yours to direct: "barely-there makeup", "soft glam", "done-up for a night out" all render. The server no longer forces a bare face, so say what the character wears.
- **Attractiveness is a dial, not a taboo.** For a performance ad, age the character to the PAYER (table above) rather than to default-pretty-22 — that is what converts. For anything whose job is to attract an audience (a persona account, dating, photo/AI), say so outright: "very pretty", "striking", "conventionally attractive". The pairing that works is pretty AND real — e.g. `Woman aged 22, Scandinavian, very pretty, shoulder-length light blonde hair, pale blue eyes, freckles across the nose, barely-there makeup, oversized grey sweatshirt. Reads as a real girl, natural skin texture, not airbrushed.` Pretty without the realism anchor is what looks synthetic.
- Match wardrobe to the setting you'll use in looks (hoodie→bedroom, athletic top→gym, flannel→den).
- One character, many ads: move the SAME person through different settings — `images generate --character <id> --scene "…"` for a new look of that character, `images variation <lookId> --scene "…"` to remix one specific look (or to pull `--count 1-4` alternatives at once). Both keep the face, because every picture after the first is generated from the character's base image. Identity consistency is the product's whole superpower.
- For consistency-critical campaigns, create the character with `--scene` pointing at the primary setting so the auto-generated first look — which becomes the base image every later look is anchored to — is already on-brand.

## Ready-made castings for attractive influencer accounts

For anything whose job is to ATTRACT an audience — a persona/Instagram account, dating,
photo/AI apps — cast pretty on purpose. These are known-good and produce a strong first
look immediately; tweak nationality, hair and age rather than writing from scratch.

The pattern that makes them work is four parts: concrete features (hair colour + length
+ texture + parting, eye colour + shape, face shape, skin tone + undertone) → an explicit
attractiveness claim ("very pretty", "strikingly beautiful") → directed makeup AND a named
lighting setup → a realism anchor. Drop the anchor and it reads synthetic; drop the makeup
and lighting and you get a snapshot instead of a post.

**Vary bone structure, not just hair colour.** The failure mode when casting several
influencers at once — especially within one region — is a set of near-identical faces
wearing different wigs. Nationality alone does not separate them. What does: face shape
(heart / oval / square / diamond), cheekbone height and width, jaw definition, nose bridge
and tip, eye shape (upturned / almond / hooded / round) and spacing, brow shape and
thickness, lip volume. Each casting below deliberately differs on several of those, not
only on hair. If you adapt one, change at least three structural features or you will get
the same woman back.

**Blonde Scandinavian** (the strongest first-run demo — this is the casting behind the
reference influencer at clipugc.com/studio/influencers/20):

```
Very pretty Danish woman aged 22, light blonde fine hair to her shoulders with a middle parting and natural movement, pale blue upturned eyes, heart-shaped face, porcelain cool-toned skin, soft pink lips, gentle jawline. Calm, faintly teasing expression. Genuinely attractive Instagram-creator look, but reads as a real girl — natural skin texture with visible pores, not airbrushed.
```
first `--scene`: `close selfie in a softly lit bedroom at golden hour, warm low sun through the window behind her giving a rim light on her hair, full glam makeup with winged liner, long lashes and glossy lips, natural skin texture, amateur front-camera phone quality, headroom above her head for text`

**Sun-kissed Californian:**

```
Very pretty Californian woman aged 21, sun-kissed golden-blonde hair past her shoulders with a natural wave, warm green-hazel eyes, light freckles across her nose, soft everyday makeup with a nude lip, oversized cream knit sweater. Conventionally attractive but reads as a real girl someone would follow — natural skin texture, not airbrushed, candid unposed energy.
```

**Mediterranean, soft glam:**

```
Very pretty Spanish woman aged 22, long dark chocolate-brown hair in loose beachy waves, deep brown almond eyes, defined brows, warm olive skin with a small beauty mark near her jaw, soft glam makeup with a glossy lip, gold hoop earrings. Strikingly attractive Instagram-creator look that still reads as a real person — natural skin texture, visible pores, not airbrushed.
```

**Korean, polished and camera-ready:**

```
Strikingly beautiful Korean woman aged 21, glossy jet-black hair with soft volume and wispy curtain bangs, large expressive dark brown eyes with subtle winged eyeliner, groomed brows, high cheekbones, dewy glass-skin complexion with soft peach blush and a glossy gradient lip, delicate gold jewellery. Polished Korean-Instagram creator look, warm confident smile — yet still reads as a real person: natural skin texture, visible pores, not airbrushed.
```

### Slavic & Eastern European

The most-requested look for influencer accounts, and the easiest to get wrong — cast
them as one region and every face comes out the same. These five are structurally
distinct on purpose: a broad-cheekboned Russian, a soft-oval Ukrainian, a square-jawed
Pole, a diamond-faced Moldovan and a long-oval Czech.

**Russian — ash-blonde, high broad cheekbones:**

```
Very pretty Russian woman aged 22 from Moscow, ash-blonde straight hair falling below her shoulders with a middle parting, cool grey-blue almond eyes set wide apart, high broad cheekbones, a straight narrow nose, fair skin with cool undertones, medium lips with a defined cupid's bow, fine straight brows. Reserved, slightly aloof expression that warms when she smiles. Strikingly attractive Instagram-creator look, yet unmistakably a real person — natural skin texture with visible pores, not airbrushed.
```
first `--scene`: `close selfie in a softly lit bedroom at golden hour, warm low sun through the window behind her giving a rim light on her hair, soft glam makeup with winged liner and a nude glossy lip, natural skin texture, amateur front-camera phone quality, headroom above her head for text`

**Ukrainian — honey-brown, soft oval, warm:**

```
Very pretty Ukrainian woman aged 21 from Kyiv, honey-brown hair with a soft natural wave falling past her shoulders, warm green eyes with a gentle upturn, a soft oval face with a rounded chin and gentle jawline, light golden-toned skin, full lips, softly arched medium brows, a small mole above her lip. Warm, open, easy-smiling energy. Genuinely attractive Instagram-creator look that reads as a real girl — natural skin texture with visible pores, not airbrushed.
```
first `--scene`: `front-camera phone selfie by a large window in a bright apartment, soft diffused daylight on her face, plants blurred behind, everyday makeup with fluffy brows and a glossy lip, natural skin texture, amateur phone quality, headroom above the head for text`

**Polish — dark blonde, square jaw, hooded eyes:**

```
Very pretty Polish woman aged 22 from Kraków, dark blonde hair worn in a low ponytail with loose face-framing strands, hazel hooded eyes, a square face with a defined straight jawline, fair neutral-toned skin with a faint blush across the cheeks, a slightly rounded nose tip, thick straight brows, medium lips. Direct, dry, confident expression. Conventionally attractive but reads as a real person — natural skin texture with visible pores, not airbrushed.
```
first `--scene`: `mirror selfie in a bathroom in the evening, phone visible in her hand, warm vanity lights either side of the mirror, polished makeup with glowing skin, blush and a soft matte lip, natural skin texture, amateur phone quality, headroom above the head for text`

**Moldovan / Romanian — dark hair, diamond face, striking brows:**

```
Strikingly beautiful Moldovan woman aged 22, long dark brown hair with a deep side parting and loose waves, dark amber-brown almond eyes, a diamond face shape with sharp high cheekbones and a narrow pointed chin, olive-fair skin with warm undertones, strong naturally thick brows, full lips. Intense, self-possessed expression. Very attractive Instagram-creator look that still reads as a real person — natural skin texture with visible pores, not airbrushed.
```
first `--scene`: `front-camera phone selfie in a city apartment at night, warm lamp light from one side, blurred living room behind her, soft glam makeup with defined brows, bronzed skin and a glossy lip, natural skin texture, amateur phone quality, headroom above the head for text`

**Czech — chestnut, long oval, freckled:**

```
Very pretty Czech woman aged 21 from Prague, chestnut-brown shoulder-length hair with a blunt cut and a side parting, blue-grey round eyes, a long oval face with a soft narrow jaw, fair skin with light freckles across her nose and cheeks, a small straight nose, thin arched brows, medium-full lips. Playful, slightly mischievous expression. Genuinely attractive but reads as a real girl — natural skin texture with visible pores, not airbrushed.
```
first `--scene`: `front-camera phone selfie sitting on a bed with a laptop beside her, warm bedside lamp light, cozy oversized hoodie, everyday makeup with mascara and a tinted lip balm, natural skin texture, amateur phone quality, headroom above the head for text`

Regional notes that help: Scandinavian reads cooler and paler (porcelain, ash/platinum,
pale blue); Slavic spans a wider range than the stereotype — Ukrainian and Moldovan skew
warmer and darker-haired than Russian or Polish. Say the city, not just the country
("from Kyiv", "from Kraków"): it sharpens the result and keeps the face from drifting
toward a generic "Eastern European model" average.

Cast adults only, and keep the stated age unambiguously adult (21-22 rather than 18) —
these characters are often made public, where anyone can build ads from them.

Lighting phrases that reliably flatter: `golden hour rim light through the window behind
her`, `warm vanity lights either side of the mirror`, `soft diffused north-facing daylight`,
`warm lamp light in a dim room`, `warm flattering afternoon light by a large window`.

## Persona account: one influencer, a whole grid

Use this when the user wants ONE AI influencer for their app that posts like a real creator's TikTok/Instagram grid: the same person across many videos, in different settings, outfits and reactions. Cast once, then vary the setting and the reaction — never the person.

> This is the casting-side summary. For running the account over time — persona definition, content pillars per niche, the "next post" loop, grid composition, and the picture-before-video credit gate — use the **`persona-account`** skill.

```bash
# 1. Cast once (2 credits, first look included). That first look becomes the base image —
#    the identity anchor every later look is generated from.
clipugc characters create --description "<casting.md description>" --scene "<primary setting from prompts.md>" --wait --json

# 2. One look per post — same face, new setting/outfit/mood (2 credits each). Vary ONLY the
#    scene; never re-describe the person, the base image already carries the face.
clipugc images generate --character <characterId> --scene "front-camera phone selfie in a parked car, seatbelt visible, daylight through the windshield, natural skin texture, headroom above for text" --wait --json
clipugc images generate --character <characterId> --scene "mirror selfie in a normal apartment bathroom, overhead light, casual outfit, amateur quality, headroom above for text" --wait --json
clipugc images generate --character <characterId> --scene "front-facing phone selfie at a cluttered desk with sticky notes and a coffee mug behind, daytime window light, headroom above for text" --wait --json
# Use `images variation <lookId> --scene "…"` instead to remix ONE look, or when you want
# --count 1-4 alternatives of the same setting in a single call.

# 3. One silent reaction clip per look (7 credits each at 5s) — prompt VERBATIM from prompts.md,
#    a DIFFERENT archetype per post so the grid doesn't repeat itself.
clipugc videos create --image <lookId> --prompt "<archetype reaction prompt from prompts.md>" --duration 5 --wait --json

# 4. Merge each clip with the app recording + its own hook (free), download by AD id.
clipugc videos merge <videoId> --app-video clipugc/assets/<their-screenrec>.mp4 --hook "<hook n>" --wait --json
clipugc ads download <adId> -o clipugc/influencers/<id>-<name>/ads/<adId>-<hook-slug>.mp4
```

Credits per post: look 2 + clip 7 (5s) + merge 0 = 9 — merging is free. The character's first look is already paid for by creation, so a 6-post grid costs 2 (cast) + 5×2 (extra looks) + 6×7 (clips) = 54 credits. Read live values with `clipugc credits`.

Grid discipline:

- Rotate setting AND archetype together across posts (bedroom→Deadpan Stare, car→Head-Shake, desk→Mid-Task Glance-Up); repeating a pairing makes the account read as a template.
- Keep wardrobe plausible for the person, not only for the setting — a real creator re-wears clothes.
- Every look id, clip id, ad id and the exact prompt goes into that influencer's `influencer.json` (`pictures`/`clips`/`ads` arrays — see the `clipugc` skill's project-workspace section). That manifest is how the account keeps growing in later sessions instead of being recast.
- Cast a second character only for a deliberate casting test (below), never mid-grid — swapping the face breaks the account illusion.

## Diversity & multi-variant testing

Make 2–3 characters per campaign that differ on ONE casting axis (age band, gender, or vibe) and run the same hook/clip/recording against each. Character creation costs 2 credits (first look included) — casting tests are cheap.
