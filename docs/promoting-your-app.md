# Promoting your app with an AI influencer

The full job end to end: cast a creator, put her in a scene, get a silent reaction clip, and merge your app's screen recording under a hook. Around 9 credits and a few minutes per ad.

```bash
# 1. Cast her once (2 credits — the first look is included).
#    Copy any casting from docs/casting.md; this one is the blonde Scandinavian.
clipugc characters create --wait --json \
  --description "Very pretty Danish woman aged 22, light blonde fine hair to her shoulders with a middle parting, pale blue upturned eyes, heart-shaped face, porcelain cool-toned skin. Genuinely attractive Instagram-creator look, but reads as a real girl — natural skin texture with visible pores, not airbrushed." \
  --scene "close selfie in a softly lit bedroom at golden hour, warm rim light on her hair, full glam makeup with winged liner and glossy lips, natural skin texture, amateur front-camera phone quality, headroom above her head for text"

# 2. Turn that look into a 5s silent reaction (7 credits). Mouth closed — no lip-sync,
#    no uncanny valley. The empty space above her head is where your hook will sit.
clipugc videos create --image <lookId> --duration 5 --wait --json \
  --prompt "Handheld selfie framing, slight drift. Her expression gradually shifts from neutral to amazed — eyebrows rise, eyes widen, lips part slightly in a silent gasp — then she breaks into a delighted grin and holds it, looking straight into the camera. Hair moves subtly. No talking."

# 3. Merge your screen recording under a hook (free). Record 5-10s of your app doing
#    the ONE thing worth showing — the result, not the onboarding.
clipugc videos merge <videoId> --wait --json \
  --app-video ./screenrec.mp4 \
  --hook "nobody talks about this app"

# 4. Download the finished ad — by AD id, not the clip id.
clipugc ads download <adId> -o ugc-ad.mp4
```

**Hook variants are free.** Merging costs nothing, so re-merge the same clip with
different hooks and let the platform pick the winner — this is the cheapest A/B test
you have:

```bash
clipugc hooks suggest --context "habit tracker app that makes streaks addictive"
clipugc videos merge <videoId> --app-video ./screenrec.mp4 --hook "I stopped paying for 4 apps" --wait
clipugc videos merge <videoId> --app-video ./screenrec.mp4 --hook "why did nobody tell me" --wait
```

**Or just ask Claude Code**, which does all of the above and picks the archetype,
casting and hooks for you (skill names are unprefixed if you cloned the repo rather
than installing the plugin — see [skills](skills.md)):

```
/clipugc:ugc-director make a TikTok ad for my habit tracker app
/clipugc:ugc-director I need 3 hook variants of that same clip
/clipugc:persona-account create an AI influencer for my fitness app
/clipugc:persona-account give me the next post
```

One thing worth knowing before you spend credits: **cast for the person who pays,
not the prettiest creator.** Attractive early-20s creators are right for dating,
photo/AI and persona accounts, but a fitness or finance app usually converts better
with someone who looks like the customer — the `ugc-director` skill's casting matrix
covers this per app category.

---

[← Back to the README](../README.md)
