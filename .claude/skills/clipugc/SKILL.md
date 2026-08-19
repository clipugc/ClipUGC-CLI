---
name: clipugc
description: ClipUGC CLI - create AI-generated UGC-style marketing videos for mobile apps from the terminal. Use when the user wants to create an AI character or AI influencer, generate character looks or reference images, create a UGC video or video clip from a look or photo, animate a photo with a driver video, merge an app screen recording into a UGC ad, suggest hook texts for ads, check ClipUGC credits or balance, manage ClipUGC characters/images/videos (list, show, rename, publish, delete, retry, download), or log in to ClipUGC with an API key.
argument-hint: "[command or description]"
---

# ClipUGC CLI Skill

You are helping the user run ClipUGC CLI commands. [ClipUGC](https://clipugc.com) makes AI-generated, influencer-style UGC (user-generated-content) marketing videos for mobile apps. The pipeline: create an AI character (structured appearance "DNA") → generate photorealistic looks (reference images) → turn a look into short video clips → merge a clip with the user's app screen recording + a hook text (+ optional music) into a final UGC ad.

Credits are consumed server-side (duration-aware; refunds return the exact amount charged): image = 2, clip (5s) = 7, clip (10s) = 13, motion control = 3 per second of driver video (rounded up, capped at 30s), scene-staged clip (a video created with `--scene`) = 9, merge = 1.

> **Creative direction lives in the `ugc-director` skill.** If the user asks "make an ad for my app", wants hook ideas, reaction styles, casting advice, or a full concept-to-ad plan, use `ugc-director` (it decides WHAT to generate: archetype, hook text, look scene, clip prompt) and come back here for command syntax. This skill is the command manual.

## Routing

Match the user's intent (from `$ARGUMENTS` or conversation context) to the right command:

| Intent | Command |
|--------|---------|
| Log in / authenticate | `clipugc auth login [--api-key <key>]` |
| Check login state | `clipugc auth status` |
| Log out | `clipugc auth logout` |
| Who am I | `clipugc whoami` |
| Check credits / balance / costs | `clipugc credits` |
| Show credit transaction history | `clipugc credits history [--per-page <n>] [--page <n>]` — paginated ledger of spends (negative), top-ups, and refunds |
| List / read / set config | `clipugc config list` / `config get <key>` / `config set <key> <value>` / `config path` |
| Delete the account | `clipugc account delete` (double confirmation; `--yes` skips) |
| Browse public characters | `clipugc characters list --discover [--search <q>]` |
| List my characters | `clipugc characters list --mine` |
| Combined character feed | `clipugc characters list --feed` — own characters newest-first, then public ones in unlock order; a Locked column marks locked rows |
| Create an AI character / influencer | `clipugc characters create --description "plain-text description of the person" [--scene "optional scene/pose"] [--inspiration img1.jpg img2.jpg] [--private] [--make-video [--motion-prompt "…"]] [--wait]` — the server extracts appearance DNA from the description and generates the first look automatically (2 credits). Public/discoverable by default; `--private` opts out. `--make-video` also stages the character's first video clip (id + status are printed; follow with `videos status <id>`), `--motion-prompt` steers its motion. Advanced structured path: `--name` + DNA flags/`--dna-json`. |
| Show / rename / publish / unpublish / delete a character | `clipugc characters show <id>` / `rename <id> --name "New"` / `publish <id>` / `unpublish <id>` / `delete <id> [--yes]` |
| Generate looks / reference images | `clipugc images generate --character <id> [--shots frontal,three_quarter,profile,back] [--template model_digitals\|scene_recreation\|specific_angle] [--scene "..."] [--resolution 0.5K\|1K\|2K\|4K] --wait` — a new look OF that character; `--scene` puts the same person in a new setting/outfit |
| List / inspect a character's images | `clipugc images list --character <id>` / `images show <id>` / `images status <id>` |
| Download a look image | `clipugc images download <id> [-o out.png]` |
| Scene variation of a look | `clipugc images variation <id> --scene "..." [--count 1-4] [--before-after] --wait` — remixes THAT specific look; `--count` returns up to 4 alternatives in one call |
| Retry / delete an image | `clipugc images retry <id> --wait` / `images delete <id> [--yes]` |
| List clips | `clipugc videos list [--character <id>] [--mergeable]` — `--character` filters to one AI character, `--mergeable` = completed clips not yet merged (ready for merge) |
| Create a video clip from a look or photo | `clipugc videos create (--image <lookId> \| --photo <file>) [--prompt "..."] [--scene "..."] [--duration 5\|10] [--keep-sound] --wait` — with `--scene` the server first stages that look into the new setting (same face), then animates it (scene-staged cost) |
| Animate a look/photo with a driver video | `clipugc videos motion (--image <lookId> \| --photo <file>) --driver <video.mp4> [--keep-sound] --wait` |
| Merge clip + app recording into a UGC ad | `clipugc videos merge <videoId> --app-video <screenrec.mp4> --hook "..." [--music <file.mp3>] --wait` — creates an AD with its OWN id (printed; `merged_video_id` under `--json`). `--wait` blocks until the render finishes (or fails, refunding the credit); then `ads download <adId>` gets the final ad |
| Inspect / download a clip | `clipugc videos show <id>` / `videos status <id>` / `videos download <id> [-o out.mp4]` |
| Retry / delete a clip | `clipugc videos retry <id> --wait` / `videos delete <id> [--yes]` |
| List finished ads | `clipugc ads list [--status pending\|processing\|completed\|failed]` (same as `videos list --finals`) |
| Inspect / download an ad | `clipugc ads show <adId>` / `ads download <adId> [-o out.mp4]` |
| Retry / delete an ad | `clipugc ads retry <adId> --wait` (free; only when `can_retry`) / `ads delete <adId> [--yes]` — deleting an ad leaves its source clip on the profile |
| Suggest hook texts | `clipugc hooks suggest [--context "my app is a habit tracker"]` |

**Clip ids and ad ids are different id spaces.** A clip lives at `clipugc videos …`, the ad merged
from it lives at `clipugc ads …`, and `ads download 121` is not `videos download 121`. Always take
the ad id from the merge output (`merged_video_id`) — never assume it equals the clip id.

**Every picture keeps the character's face.** A character's first completed picture is its BASE
IMAGE — the identity anchor, which never moves. Every later picture, from either picture command,
is generated as an edit of that base image, so the same person carries across settings, outfits and
moods. Only a brand-new character's first picture comes from the description/DNA alone (there is
nothing to anchor to yet), and uploaded `--inspiration` images take precedence over the base image.
So choose by intent, not by identity risk:

- `images generate --character <id> --scene "…"` — a new look OF this character. The default for
  building out a character (new setting, outfit, mood) and for extra angles via `--shots`.
- `images variation <lookId> --scene "…"` — remix THAT specific look, or when you want `--count 1-4`
  alternatives in a single call, or a `--before-after` pair.

If the intent is unclear, ask the user what they want to do and show the available commands.

Constraints to enforce before running: `--scene` max 600 chars; `--prompt` max 1500 chars; `--hook` max 150 chars; driver video mp4/mov max 50MB and max 30s; `--per-page` max 50. File formats — photo: png/jpg/jpeg/webp; app video + driver video: mp4/mov; music: mp3/wav/m4a. Uploads are auto-presigned; just pass local file paths.

## Prerequisites Check

Before running ANY command, always check:

1. **CLI installed**: Run `which clipugc`. If missing, run `npm install -g clipugc` (requires Node >= 20).
2. **Authenticated**: Run `clipugc auth status`. If not logged in, tell the user to create an API key in the ClipUGC dashboard (https://clipugc.com/dashboard → API keys) and run `clipugc auth login`. Do NOT ask the user to paste the key into chat — `auth login` prompts for it securely in the terminal.
**Credits packs**: `clipugc credits packs` lists purchasable packs (buy on the web dashboard / mobile IAP).

3. **Credits**: Before any generation command (`images generate`, `images variation`, `videos create`, `videos motion`, `videos merge`), run `clipugc credits` to check the balance against the action's cost (image 2, clip 5s 7, clip 10s 13, motion control 3 per second of driver video, scene-staged clip 9, merge free). Costs are duration-aware, so prefer the live values from `clipugc credits` over hard-coded numbers.

## Project workspace — organized output & resuming

Keep every artifact and id in a predictable workspace so a later session (or another agent) can resume without archaeology. Root: `./clipugc/` in the user's project cwd, unless the user names another location.

```
clipugc/
├── assets/                     # user inputs kept for reuse: app screen recordings, music, inspiration photos
└── influencers/
    └── <id>-<kebab-name>/      # e.g. 12-isabella-romero
        ├── influencer.json     # manifest — source of truth for resuming
        ├── pictures/           # looks: <imageId>-<short-desc>.<ext>
        ├── clips/              # raw clips: <videoId>-<mode>-<duration>s.mp4   (mode: i2v | motion)
        └── ads/                # finished ads: <adId>-<hook-slug>.mp4   (adId = merged_video_id)
```

Rules:

1. **Record ids immediately.** Append each new id + the exact prompt to `influencer.json` right after the API call returns — BEFORE any `--wait` — so an interrupted session loses nothing.
2. **Update the manifest after EVERY step** (create / generate / variation / videos create / motion / merge / download): statuses, file paths, merge state.
3. **Copy user inputs into `clipugc/assets/`** before uploading them, so hook A/B re-merges reuse the same recording/music.
4. **Download with explicit output paths** into the folders (`-o` creates missing parent directories):
   ```bash
   clipugc images download 87 -o clipugc/influencers/12-isabella-romero/pictures/87-cafe-selfie.png
   clipugc videos download 91 -o clipugc/influencers/12-isabella-romero/clips/91-i2v-5s.mp4
   # `videos merge 91 …` returns an AD with its own id (merged_video_id, e.g. 121) — download it
   # from the ads endpoint, named by the AD id, into ads/:
   clipugc ads download 121 -o clipugc/influencers/12-isabella-romero/ads/121-fixed-my-morning-routine.mp4
   ```

Compact `influencer.json` shape (extend as needed, keep these fields):

```json
{
  "id": 12,
  "name": "Isabella Romero",
  "description": "casual gen-z woman in her early 20s, brown hair, friendly smile",
  "created_at": "2026-07-23",
  "visibility": "public",
  "pictures": [
    { "id": 87, "prompt": "golden-hour cafe selfie", "file": "pictures/87-cafe-selfie.png", "status": "completed" }
  ],
  "clips": [
    { "id": 91, "mode": "i2v", "duration": 5, "prompt": "…a smirk slowly spreads, lips closed…", "source_image_id": 87, "file": "clips/91-i2v-5s.mp4", "status": "completed", "merged": true }
  ],
  "ads": [
    { "merged_video_id": 121, "video_id": 91, "hook_text": "this app fixed my morning routine", "app_video": "../../../assets/screenrec.mp4", "file": "ads/121-fixed-my-morning-routine.mp4", "status": "completed" }
  ]
}
```

**Resuming**: when asked to continue work on an influencer or ad, FIRST read `clipugc/influencers/*/influencer.json`. Then reconcile with the server before doing new work: `clipugc characters show <id> --json`, `clipugc videos list --character <id> --json`, `clipugc ads list --json`, and `images status <id>` / `videos status <id>` / `ads show <adId>` on anything the manifest still marks pending/processing — update the manifest with what you learn. If no manifest exists but the user references an existing influencer, find it (`characters list --mine`), then create the folder + manifest from server state (`characters show`, `images list --character <id>`, `videos list --character <id>`).

## Typical Workflows

Use `--json` on any command when you need to parse output — capture ids (character id, image id, video id) from command output and reuse them in the next step. Use `--wait` on generation commands so they block until the job is `completed` or `failed`. Route every id, prompt, and download through the project workspace above.

**Picture before clip.** Generate the look first, show it to the user, and wait for an explicit yes before running `videos create` — a rejected look costs 2 credits, a rejected clip costs 9.

### Workflow A — Create a character with looks

1. Create the character from the user's description (map traits to DNA flags):
   ```bash
   clipugc characters create --description "casual gen-z woman in her early 20s, brown hair, friendly smile" --json
   ```
   Capture the character id from the output, create `clipugc/influencers/<id>-<kebab-name>/`, and start its `influencer.json`.
2. Generate reference looks (2 credits per image; check credits first):
   ```bash
   clipugc images generate --character <characterId> --shots frontal,three_quarter --wait --json
   ```
3. Add looks in other settings whenever the plan needs them — same face, new scene (2 credits each):
   ```bash
   clipugc images generate --character <characterId> --scene "front-camera phone selfie in a parked car, daylight through the windshield, natural skin texture" --wait --json
   ```
   Reach for `images variation <lookId> --scene "…"` instead when the user points at ONE existing
   look to remix, or when `--count 1-4` / `--before-after` is wanted.
4. Show the results and let the user pick:
   ```bash
   clipugc images list --character <characterId>
   ```
   There is no separate "select" step — pass the chosen look's ID straight to `videos create --image <ID>`. Record each look's id + prompt in `influencer.json` and download keepers into `pictures/`.

### Workflow B — Make a UGC ad video end-to-end

1. Pick a look: `clipugc images list --character <characterId>` and note its ID (or use `--photo <file>` if the user supplies their own photo). No separate select step — the chosen ID is passed straight to `videos create --image <ID>`.
2. Create the clip (7 credits for 5s, 13 for 10s; a `--scene` staged clip is 9). Prefer a SILENT reaction — mouth closed, no talking — because lip-sync is the biggest AI giveaway; the hook text overlay does the talking:
   ```bash
   clipugc videos create --image <imageId> --prompt "Handheld selfie framing, tiny wobble. Her eyebrows lift, eyes widen, a delighted grin slowly spreads, she nods twice holding eye contact. Lips closed, no talking. Hair moves subtly." --duration 5 --wait --json
   ```
   Capture the video id (record it + the prompt in `influencer.json` before waiting). For archetype-specific reaction prompts (smirk, jaw-drop, crying, side-eye, deadpan…), hook formulas, and casting guidance, use the `ugc-director` skill — it turns an app idea into a full ad plan.
3. Get hook suggestions if the user doesn't have one:
   ```bash
   clipugc hooks suggest --context "my app is a habit tracker"
   ```
   Let the user pick a hook (max 150 chars).
4. Merge with the app screen recording (free) — copy the recording into `clipugc/assets/` first so re-merges reuse it:
   ```bash
   clipugc videos merge <videoId> --app-video clipugc/assets/screenrec.mp4 --hook "This app fixed my morning routine" --wait --json
   ```
   Capture `merged_video_id` from the output — that is the AD id, and it is what every later ad
   command takes. Record it in the manifest's `ads` array immediately.
5. Download the final ad into the workspace, named by the AD id:
   ```bash
   clipugc ads download <adId> -o clipugc/influencers/<id>-<name>/ads/<adId>-<hook-slug>.mp4
   ```

## Troubleshooting

Exit codes: 0 ok, 1 generic, 2 validation, 3 auth, 4 not found, 5 premium required, 6 insufficient credits, 7 network/server unreachable.

| Symptom | Fix |
|---------|-----|
| Exit 6 / "Insufficient credits" | Run `clipugc credits` to show the balance and per-action costs. Tell the user to top up credits in the ClipUGC dashboard (https://clipugc.com/dashboard). |
| Exit 3 / auth error | The stored key is missing, invalid, or revoked. Tell the user to create a fresh API key in the dashboard and re-run `clipugc auth login`. |
| Exit 7 / network error | Check `clipugc config get apiBaseUrl` (and the `CLIPUGC_API_BASE_URL` env var) — the API base URL may be wrong or the server unreachable. Retry after verifying connectivity. |
| Exit 5 / premium required | The action needs a paid plan. Tell the user to upgrade their plan in the ClipUGC dashboard. |
| Exit 2 / validation error | An input broke a constraint (scene > 600 chars, prompt > 1500, hook > 150, driver video > 50MB or > 30s, wrong file format, per-page > 50). Fix the input and re-run. |
| A generation ended `failed` | Retry it: `clipugc images retry <id> --wait` or `clipugc videos retry <id> --wait`. Check details first with `images show <id>` / `videos show <id>`. |
| Not sure what state a job is in | `clipugc images status <id>` / `clipugc videos status <id>` (no credits consumed). |
