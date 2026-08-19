# Claude Code skills

Three skills ship with this repo, so you can drive the whole tool — casting, prompts, hooks, grids — in natural language instead of by flag.

- **`clipugc`** — drive the whole CLI through natural language, with automatic prerequisite checks (CLI installed, logged in, enough credits) and guided end-to-end workflows.
- **`ugc-director`** — a TikTok UGC ad director: turns an app idea into a complete creative plan (silent-reaction archetype, hook text, casting, copy-paste look & video prompts) and executes it with the CLI. Built on research into what actually converts: mouth-closed reaction formats (no lip-sync = no AI uncanny valley), text-overlay hooks, a 12-archetype reaction taxonomy, a library of ~30 silent reactions across 9 emotion families, hook formulas, and a casting matrix by app category.
- **`persona-account`** — run an ongoing AI creator account: define a persona once (niche, look, aesthetic, settings, voice, content pillars), then ask for "the next post" and get one on-brand post at a time — same face, rotating settings and reactions, grid composition rules, and a picture-before-video credit gate so you approve the character before any clip credits are spent.

**Install** via the Claude Code plugin system:

```
/plugin marketplace add clipugc/ClipUGC-CLI
/plugin install clipugc@ClipUGC-CLI
```

Or clone this repo — Claude Code picks the skills up from `.claude/skills/` when working inside it.

**How you invoke them depends on which of those two you did.** Installed as a plugin, skills are namespaced under the plugin name with a colon; read straight from a cloned repo, they are unprefixed:

| | Installed as a plugin | Cloned repo |
|---|---|---|
| CLI driver | `/clipugc:clipugc` | `/clipugc` |
| Ad director | `/clipugc:ugc-director` | `/ugc-director` |
| Persona account | `/clipugc:persona-account` | `/persona-account` |

The separator is `:` — there is no `/clipugc/ugc-director` form.

**Use:**

```
/clipugc:ugc-director make a TikTok ad for my habit tracker app
/clipugc:persona-account create an AI influencer for a fitness account
/clipugc:persona-account give me the next post
/clipugc:clipugc create a character for my fitness app ads
/clipugc:clipugc make a UGC ad from my screen recording
/clipugc:clipugc how many credits do I have left
```

You rarely need to type them at all — describing the task ("make me a TikTok ad for my habit tracker") matches the right skill on its own. The explicit form is for when you want to force one.

## Why three skills instead of one

They are deliberately separate even though all three are ClipUGC. Claude picks a skill by matching your request against its description, so three sharp descriptions ("make an ad", "next post", "run this CLI command") trigger far more reliably than one broad one — and only the matched skill's instructions get loaded, instead of all three every time. Merging them would make triggering worse and every invocation heavier.

---

[← Back to the README](../README.md)
