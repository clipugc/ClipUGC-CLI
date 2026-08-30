---
name: story-runner
description: Run an ongoing AI-influencer story series with the ClipUGC CLI - a character living a continuing life in short talking-video episodes, where each episode picks up from the previous one's last frame. Use when the user wants to create a story series, an episodic AI character account, a "day in her life" video series, daily AI influencer content with a continuing plot, draft or approve a story episode, write an episode's plot themselves, check episode generation status, or download finished episodes for posting.
argument-hint: "[story request]"
---

# ClipUGC Story Runner

You are running an ongoing story series on [ClipUGC](https://clipugc.com): one AI character
living a continuing life, one short talking episode at a time. She speaks on camera with
native voice + lipsync, the plot carries over between episodes (series memory), and each
episode's first scene starts on the previous episode's exact last frame.

**The flow is always: draft (free) → review the script → approve (charged) → download.**
Never approve an episode without showing the user the script first.

## Commands

| Intent | Command |
|--------|---------|
| List story series | `clipugc stories list` |
| Start a series | `clipugc stories create --character <id> --title <t> --premise <p> [--tone <t>] [--resolution 480P\|768P]` |
| Show a series + episodes + story-so-far | `clipugc stories show <storyId>` |
| Draft next episode (FREE) | `clipugc stories draft <storyId> [--minutes 1\|2\|5] [--direction <plot>]` |
| Approve → generate (CHARGED) | `clipugc stories approve <storyId> <episodeId> [--wait] [--output <path>]` |
| Check progress | `clipugc stories status <storyId> <episodeId>` |
| Download finished episode | `clipugc stories download <storyId> <episodeId> [--output <path>]` |

Costs: **13 credits per 10-second scene** at 480P (default), **20** at 768P HD. A 1-minute
episode is 6 scenes → 78 credits (480P). Drafting scripts is always free; credits are charged
only on approve, and refunded automatically if generation fails.

## Writing a good premise

The premise drives every episode's script — invest in it. Good premises give the character
a life with built-in tension and recurring settings, e.g.:
- "A 22-year-old founder in Copenhagen juggling 6am gym sessions, fashion, and pitching
  investors for her first raise."
- "A fitness coach documenting 90 days to her first competition while running her studio."

Add `--tone` for delivery ("dry humor, a little teasing, cliffhanger endings").

## AI plot vs user plot

- **Default:** omit `--direction` — the AI continues the story from the series memory.
- **User-written:** pass `--direction "she gets the investor call mid-workout and has to
  decide on the spot"` — the AI only breaks the user's plot into scenes and natural lines.
- Either way the draft comes back as an editable script; on the web studio individual
  lines can be edited before approval. Via CLI, re-draft with a sharper `--direction`
  instead of hand-editing scenes.

## Reviewing scripts (what to check before approving)

- **Dialogue length:** ~15 words max per 10s scene; near-silent during physical action
  (the video model drops actions when lines are long).
- **No selfie-filming:** scenes must never have her holding a phone — the pipeline films
  her from a propped camera so her hands stay free. If a drafted scene has her filming
  herself, re-draft.
- **One location per scene, walkable transitions** — no teleporting inside an episode.
- **Cliffhanger:** episodes should end on a small hook; that's what makes a series.

## Cadence for a daily account

1. Once: `stories create` with a strong premise.
2. Daily: `stories draft <id>` → show the user the script → `stories approve <id> <ep> --wait`
   → the finished .mp4 downloads, ready to post to TikTok/Reels/Shorts.
3. `stories show <id>` displays the story-so-far memory — use it to pitch the user
   tomorrow's `--direction` ideas.
4. One episode at a time per series: finish (or discard) the current episode before
   drafting the next.

> Casting and creative-direction advice (archetypes, hooks) lives in the `ugc-director`
> skill; character creation and general CLI syntax live in the `clipugc` skill.
