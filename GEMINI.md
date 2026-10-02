# ClipUGC

ClipUGC makes short vertical UGC videos for mobile apps. An AI influencer
reacts on camera, then the app's own footage plays under a hook line. Every
influencer keeps the same face across all of their looks and clips.

This extension connects the hosted ClipUGC server at https://clipugc.com/mcp.
The first tool call opens a browser to sign in with a ClipUGC account. Every
tool acts as that user and spends that user's credits.

## How to run a session

1. Call `get_workspace` first and offer its first suggestion.
2. If the user shares an App Store, Google Play or website link, call
   `first_videos`. It makes three finished videos with three different
   influencers. Free, one batch a day per app.
3. Faces: `list_characters` and `get_character` show the public cast.
   For a new face, call `suggest_influencers`, then `create_character`.
4. Looks: `generate_image` puts the same face in a new setting. Describe only
   the place, outfit and light, never the person again.
5. Clips: `suggest_reactions`, then `create_clip` (or `create_clips` for a
   set). Silent reactions look most real: mouth closed, no talking.
6. Videos: `make_video` puts the clip, the app footage and a hook line together.
   `suggest_hooks` gives hook ideas. `make_videos` does a set.
7. Files from the user's device go through `request_upload`, then
   `list_uploads`. `get_download_url` returns a link to a finished file.

## Prices

Say the price before you spend, and check the balance with `get_credits`
(it has the live prices).

- New influencer or new look: 2 credits each
- Clip: 7 credits for 5 seconds, 13 for 10 seconds (2 more with a new scene)
- Motion clip (copies a movement from a reference video): 3 credits per
  second of that video
- `make_video` and `first_videos`: free

Set tools (`create_clips`, `make_videos`) and `create_motion_clip` show the
total first and only spend when called again with `confirm` set to true.

## Good to know

- Generation tools return at once with an id. Check progress with
  `get_video` (clips and videos) or `list_images` (looks).
- Clip, video, look, influencer and upload ids are separate id spaces. A
  clip id is not a video id.
- Plans and credit packs: https://clipugc.com/#pricing
