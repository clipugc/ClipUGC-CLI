# Casting prompts

How to describe an AI influencer so she looks like a real creator instead of generic AI — the four-part formula, and a library of ready-made castings you can copy, paste and tweak.

The single biggest factor in how good your influencer looks is the `--description`
you cast her with. `"gen-z woman, brown hair, friendly smile"` gives you generic AI;
the prompts below give you someone who looks like a real creator's profile.

**The formula — four parts, all of them needed:**

1. **Concrete features, not vibes.** Hair colour *and* length *and* texture *and* parting; eye colour and shape; face shape; skin tone and undertone. Vagueness is what makes AI faces look interchangeable.
2. **Say she's attractive, out loud.** "Very pretty", "striking", "conventionally attractive" all render. Attractiveness is a dial, not a taboo — for an influencer account it's the whole point.
3. **Direct the makeup and the light.** This is the step most people skip and it's the difference between a snapshot and a post: `"full glam makeup: winged liner, long lashes, glossy lips"` plus a named lighting setup (`"golden hour rim light through the window behind her"`, `"warm vanity lights either side of the mirror"`).
4. **Anchor it to reality.** Always end with something like `"natural skin texture with visible pores, not airbrushed, amateur front-camera phone quality"`. Pretty *without* this anchor is exactly what looks synthetic.

## Ready-made castings (copy, paste, tweak)

**Blonde Scandinavian creator — the fastest way to see what this tool does:**

```bash
clipugc characters create --wait \
  --description "Very pretty Danish woman aged 22, light blonde fine hair to her shoulders with a middle parting and natural movement, pale blue upturned eyes, heart-shaped face, porcelain cool-toned skin, soft pink lips, gentle jawline. Calm, faintly teasing expression. Genuinely attractive Instagram-creator look, but reads as a real girl — natural skin texture with visible pores, not airbrushed." \
  --scene "close selfie in a softly lit bedroom at golden hour, warm low sun through the window behind her giving a rim light on her hair, full glam makeup with winged liner, long lashes and glossy lips, natural skin texture, amateur front-camera phone quality, headroom above her head for text"
```

**Sun-kissed Californian:**

```bash
clipugc characters create --wait \
  --description "Very pretty Californian woman aged 21, sun-kissed golden-blonde hair past her shoulders with a natural wave, warm green-hazel eyes, light freckles across her nose, soft everyday makeup with a nude lip, oversized cream knit sweater. Conventionally attractive but reads as a real girl someone would follow — natural skin texture, not airbrushed, candid unposed energy." \
  --scene "front-camera phone selfie at a coffee shop table in dappled afternoon sun, iced latte on the table, hair moving slightly in the breeze, natural skin texture, amateur phone quality, headroom above the head for text"
```

**Mediterranean, soft glam:**

```bash
clipugc characters create --wait \
  --description "Very pretty Spanish woman aged 22, long dark chocolate-brown hair in loose beachy waves, deep brown almond eyes, defined brows, warm olive skin with a small beauty mark near her jaw, soft glam makeup with a glossy lip, gold hoop earrings. Strikingly attractive Instagram-creator look that still reads as a real person — natural skin texture, visible pores, not airbrushed." \
  --scene "front-camera phone selfie in a city apartment at night, warm lamp light, blurred kitchen behind her, natural skin texture, amateur phone quality, headroom above the head for text"
```

**Korean, polished and camera-ready:**

```bash
clipugc characters create --wait \
  --description "Strikingly beautiful Korean woman aged 21, glossy jet-black hair with soft volume and wispy curtain bangs, large expressive dark brown eyes with subtle winged eyeliner, groomed brows, high cheekbones, dewy glass-skin complexion with soft peach blush and a glossy gradient lip, delicate gold jewellery. Polished Korean-Instagram creator look, warm confident smile — yet still reads as a real person: natural skin texture, visible pores, not airbrushed." \
  --scene "front-camera phone selfie by a large window in a bright modern apartment, warm flattering afternoon light on her face, soft bokeh of plants behind, smiling warmly at the camera, natural skin texture, amateur phone quality, headroom above the head for text"
```

**Slavic / Eastern European** — the most-requested look, and the easiest to get wrong.
Cast several as one region and you get the same face in different wigs, so these differ
on bone structure, not just hair:

```bash
# Russian — ash-blonde, high broad cheekbones, cool and reserved
clipugc characters create --wait \
  --description "Very pretty Russian woman aged 22 from Moscow, ash-blonde straight hair below her shoulders with a middle parting, cool grey-blue almond eyes set wide apart, high broad cheekbones, straight narrow nose, fair cool-toned skin, medium lips with a defined cupid's bow, fine straight brows. Reserved, slightly aloof expression that warms when she smiles. Strikingly attractive Instagram-creator look, yet unmistakably a real person — natural skin texture with visible pores, not airbrushed." \
  --scene "close selfie in a softly lit bedroom at golden hour, warm low sun behind her giving a rim light on her hair, soft glam makeup with winged liner and a nude glossy lip, natural skin texture, amateur front-camera phone quality, headroom above her head for text"

# Ukrainian — honey-brown, soft oval face, warm and open
clipugc characters create --wait \
  --description "Very pretty Ukrainian woman aged 21 from Kyiv, honey-brown hair with a soft natural wave past her shoulders, warm green eyes with a gentle upturn, soft oval face with a rounded chin, light golden-toned skin, full lips, softly arched brows, a small mole above her lip. Warm, open, easy-smiling energy. Genuinely attractive Instagram-creator look that reads as a real girl — natural skin texture with visible pores, not airbrushed." \
  --scene "front-camera phone selfie by a large window in a bright apartment, soft diffused daylight on her face, plants blurred behind, everyday makeup with fluffy brows and a glossy lip, natural skin texture, amateur phone quality, headroom above the head for text"
```

Polish, Moldovan and Czech castings — plus the regional notes that keep them from
averaging into one "Eastern European model" face — are in the
[`ugc-director`](skills.md) skill's `references/casting.md`.

**Casting more than one?** Change at least three *structural* features between them —
face shape, cheekbone height, jaw definition, nose bridge, eye shape and spacing, brow
thickness — not just hair colour. Hair alone gives you the same woman twice. Naming the
city rather than the country ("from Kyiv", "from Kraków") also sharpens the face.

Casting men or older creators for a performance ad instead? The
[`ugc-director`](skills.md) skill ships a casting matrix by app category —
for most apps the person who converts is the *payer*, not the prettiest creator.

## Then keep the same face

Every look after the first is generated **from the character's base image**, so the
face stays identical — that consistency is the product's whole point. Vary only the
setting, never re-describe the person:

```bash
clipugc images generate --character <characterId> --wait \
  --scene "mirror selfie in a bathroom in the evening, phone visible in her hand, warm vanity lights either side of the mirror, polished makeup with glowing skin and blush, natural skin texture, amateur phone quality, headroom above the head for text"

clipugc images generate --character <characterId> --wait \
  --scene "sitting in the driver's seat of a parked car in daylight, seatbelt on, daylight through the windscreen, natural skin texture, amateur phone quality, headroom above the head for text"
```

Then animate any look into a silent reaction clip — mouth closed, because lip-sync is
what makes AI video look fake:

```bash
clipugc videos create --image <lookId> --duration 5 --wait \
  --prompt "Handheld selfie framing with tiny natural wobble. She looks directly into the camera, one eyebrow raises slightly, a knowing smirk slowly spreads across her face, and she nods slowly twice, lips closed, holding eye contact the entire time. Hair moves subtly. No talking, mouth stays closed."
```

Want a whole Instagram-style grid of the same person rather than one ad? That's the
[`persona-account`](skills.md) skill: `/clipugc:persona-account create an AI influencer for a fitness account`,
then `/clipugc:persona-account give me the next post`.

---

[← Back to the README](../README.md)
