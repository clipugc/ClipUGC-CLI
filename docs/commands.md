# Command reference

Every command, flag and credit cost. Add `--json` to any command for machine-readable output, and `--wait` to any generation command to poll until it finishes.

## Auth

| Command | Description |
|---------|-------------|
| `clipugc auth login [--api-key <key>]` | Authenticate the CLI. Prompts securely for the key if `--api-key` is omitted, validates it against the API, and stores it. |
| `clipugc auth status` | Show whether you are logged in and as whom. |
| `clipugc auth logout` | Remove the stored API key. |
| `clipugc whoami` | Show the authenticated account. |

## Config

| Command | Description |
|---------|-------------|
| `clipugc config list` | Show all config values. |
| `clipugc config get <key>` | Read one config value. |
| `clipugc config set <key> <value>` | Set a config value (`apiBaseUrl`, `apiKey`, `email`). |
| `clipugc config path` | Print the config file path. |

## Credits and account

| Command | Description |
|---------|-------------|
| `clipugc credits` | Show credit balance and per-action costs. |
| `clipugc credits history [--per-page <n>] [--page <n>]` | Show your credit transaction history (spends, top-ups, refunds) as a paginated table. Add `--json` for scripting. |
| `clipugc credits packs` | List purchasable credit packs (buy on the web dashboard / mobile app). |
| `clipugc account delete [--yes]` | Permanently delete your account. Double confirmation (y/N, then type `DELETE`); `--yes` skips both. |

## Characters

| Command | Description |
|---------|-------------|
| `clipugc characters list [--discover\|--mine\|--feed] [--search <q>] [--page N] [--per-page N]` | List characters. `--discover` shows public characters, `--mine` only yours, `--feed` combines both (your characters newest-first, then public ones in unlock order — a Locked column marks locked rows). `--per-page` max 50. |
| `clipugc characters create --description "…" [--scene "…"] [--inspiration f1.jpg…] [--private] [--make-video [--motion-prompt "…"]] [--wait]` | Create a character from a plain-text description — the first look generates automatically (2 credits). Public by default. `--make-video` also stages the character's first video clip (its id + status are printed for `videos` follow-ups); `--motion-prompt` steers that clip's motion. |
| `clipugc characters show <id>` | Show a character's details and DNA, plus its display name, video/picture counts, and preview clip when available. |
| `clipugc characters rename <id> --name "New"` | Rename a character. |
| `clipugc characters publish <id>` / `unpublish <id>` | Make a character public / private. |
| `clipugc characters delete <id> [--yes]` | Delete a character (`--yes` skips the confirmation). |

`characters create` advanced flags (structured DNA path, rarely needed — use `--description` instead):

| Flag | Values |
|------|--------|
| `--name "Full Name"` | Required. 2–120 chars. |
| `--age` | 18–99 |
| `--gender` | e.g. `male` \| `female` \| `other` |
| `--dna-json <file-or-inline-json>` | Appearance DNA fields (nationality, vibe, hair/eye color, …) as a JSON file path or inline JSON object. |

## Images (looks)

| Command | Description |
|---------|-------------|
| `clipugc images generate --character <id> [flags] [--wait]` | Generate reference images (looks) for a character. Costs 2 credits per image. |
| `clipugc images list --character <id>` | List a character's images. |
| `clipugc images show <id>` | Show image details. |
| `clipugc images download <id> [-o out.png]` | Download the look image to disk (`-o` creates missing parent directories). |
| `clipugc images status <id>` | Check generation status. |
| `clipugc images variation <id> --scene "..." [--count 1-4] [--before-after] [--wait]` | Generate scene variations of an existing image. |
| `clipugc images retry <id> [--wait]` | Retry a failed generation. |
| `clipugc images delete <id> [--yes]` | Delete an image. |

`images generate` flags:

| Flag | Values |
|------|--------|
| `--shots` | Comma-separated: `frontal`, `three_quarter`, `profile`, `back` |
| `--template` | `model_digitals` \| `scene_recreation` \| `specific_angle` |
| `--scene "..."` | Scene description, max 600 chars. |
| `--resolution` | `0.5K` \| `1K` \| `2K` \| `4K` |
| `--wait` | Poll with a spinner until completed or failed. |

## Videos

| Command | Description |
|---------|-------------|
| `clipugc videos list [--character <id>] [--mergeable \| --finals] [--page N] [--per-page N]` | List your clips. `--character` filters to one AI character, `--mergeable` shows only completed clips not yet merged (ready for `videos merge`). `--finals` lists finished **ads** instead of clips — identical to `clipugc ads list`, and the ids it prints are ad ids. |
| `clipugc videos create (--image <lookId> \| --photo <file>) [flags] [--wait]` | Create a video clip from a look or your own photo. Costs 7 credits (5s) or 13 (10s); a `--scene` staged clip costs 9. |
| `clipugc videos motion (--image <lookId> \| --photo <file>) --driver <video.mp4> [--keep-sound] [--wait]` | Animate a look/photo using a driver video (mp4/mov, max 50MB, max 30s). Costs 3 credits per second of driver video (rounded up, capped at 30s). |
| `clipugc videos merge <videoId> --app-video <screenrec.mp4> --hook "..." [--music <file.mp3>] [--wait]` | Merge a clip with your app's screen recording + a hook (max 150 chars) into a final UGC ad. Free — merging costs no credits. Prints the new **ad id** (`merged_video_id` under `--json`); `--wait` blocks until the merge render finishes. |
| `clipugc videos show <id>` | Show clip details (including the id of the ad made from it, if any). |
| `clipugc videos status <id>` | Check generation status. |
| `clipugc videos download <id> [-o out.mp4]` | Download the finished clip (`-o` creates missing parent directories). |
| `clipugc videos retry <id> [--wait]` | Retry a failed generation. |
| `clipugc videos delete <id> [--yes]` | Delete a clip. |

## Ads

A finished UGC ad is its own resource, not a flavour of a clip — so it has its own id space.
**An ad id is not a clip id**: `clipugc ads download 121` and `clipugc videos download 121` address
different things. `videos merge <clipId>` tells you the ad id it created, and deleting an ad leaves
the clip it was made from on the influencer's profile.

| Command | Description |
|---------|-------------|
| `clipugc ads list [--status <s>] [--page N] [--per-page N]` | List your finished ads. `--status` is one of `pending`, `processing`, `completed`, `failed`. Same as `videos list --finals`. |
| `clipugc ads show <adId>` | Show ad details: merge status, hook text, watermark, credits charged, source clip id. |
| `clipugc ads download <adId> [-o out.mp4]` | Download the finished ad (`-o` creates missing parent directories; default `clipugc-ad-<adId>.mp4`). |
| `clipugc ads retry <adId> [--wait]` | Re-render a failed ad. Free, and only works while the app recording is still stored (`can_retry`). |
| `clipugc ads delete <adId> [--yes]` | Delete the ad. The source clip is untouched. |

`videos create` flags:

| Flag | Values |
|------|--------|
| `--image <lookId>` or `--photo <file>` | One of the two is required. Photo: png/jpg/jpeg/webp. |
| `--prompt "..."` | Video prompt, max 1500 chars. |
| `--scene "..."` | Scene description, max 600 chars. Makes it a scene-staged clip (image + clip: 9 credits at 5s, 15 at 10s). |
| `--duration` | `5` \| `10` (seconds). 5s = 7 credits, 10s = 13. |
| `--keep-sound` | Keep the generated audio. |
| `--wait` | Poll until completed or failed. |

File uploads are handled automatically via presigned URLs. Accepted formats by purpose: photo `png/jpg/jpeg/webp`; app video and driver video `mp4/mov`; music `mp3/wav/m4a`.

## Hooks

| Command | Description |
|---------|-------------|
| `clipugc hooks suggest [--context "my app is a habit tracker"]` | Get AI-suggested hook texts for your UGC ad. |

---

[← Back to the README](../README.md)
