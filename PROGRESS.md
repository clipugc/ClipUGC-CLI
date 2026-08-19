# ClipUGC CLI — Progress

Track B: public `clipugc` npm CLI against the ClipUGC `/api/v1` REST API.

## Implemented

- [x] Repo scaffold: TypeScript ESM, Node >=20, Commander 13, plain tsc build, `bin: clipugc`
- [x] Core infra: config (`~/.config/clipugc/config.json`), logger, prompt (incl. hidden secret input), output helpers (tables, `--json`, pagination footer), polling util (`--wait` spinner + elapsed)
- [x] API client (`src/services/api.ts`): envelope unwrap, typed errors (400/401/404/1002/1003/network), no `process.exit` in services — entry (`src/index.ts`) maps errors to exit codes
- [x] Version single-sourced from package.json at runtime (`src/version.ts`)
- [x] CI workflow (`.github/workflows/ci.yml`): build + vitest + help smoke test
- [x] Commands: auth login/status/logout, whoami
- [x] Commands: config list/get/set/path
- [x] Commands: credits, credits packs (list purchasable packs)
- [x] Commands: account delete (y/N + type DELETE; `--yes` for scripting)
- [x] Commands: characters create is description-first (free-text → server DNA + first look); DNA flags/`--dna-json` are the advanced path. list/show/rename/publish/unpublish/delete
- [x] Commands: images generate/list/show/status/variation/retry/delete/**download** (`--wait` polling; no `select` — a look id is passed straight to `videos create`)
- [x] Commands: videos list/create/motion/merge/show/status/download/retry/delete (`--photo` auto-presign, driver ≤50MB + ffprobe ≤30s check, download to disk)
- [x] Commands: **ads** list/show/download/retry/delete — finished UGC ads on the native `/merged-videos` endpoints. `videos merge` reports the new ad's `merged_video_id`; `--wait` polls the AD's own status; `videos list --finals` lists ads
- [x] Commands: hooks suggest
- [x] Uploads service (presign + PUT + spinner; purpose→extension validation)
- [x] Skill packaging: `.claude/skills/clipugc/SKILL.md`, `.claude-plugin/{plugin.json,marketplace.json}`
- [x] README.md (install, quickstart, command reference, config/exit codes, skill install)
- [x] E2E script (`scripts/e2e.ts`, `npm run e2e`) — fails fast when server unreachable

## Tested

- [x] vitest: 132 tests green across 11 files — api envelope/error mapping, config load/save/env overrides, user/credits service, characters (query building, DNA merge, validation), images (payload, variation validation), videos (XOR image/photo, duration/hook validation), uploads (presign+PUT, extension/size validation), hooks, account delete confirm logic
- [x] `npm run build` clean; `node dist/index.js --help` + per-group `--help` spot-checked
- [x] Exit-code smoke tests: unauthenticated → 3, missing required option → Commander error, config/auth status informational → 0
- [x] E2E vs local website (`npm run e2e`) — **PASSED 2026-07-18**, all 14 steps green (auth → character → image gen → clip → merge → download → hooks → cleanup) against local Sail + FalMock
- [x] **Full E2E vs PRODUCTION 2026-07-19** — real API via dashboard-created PAT: 3 influencers, 13 looks, 7 clips, 2 merged ads. Consistency verified. Gaps found + fixed (see below).

## Blockers / assumptions

- `GET /credits` verified live in e2e (deployed with the website's ff770eb). `DELETE /user` implemented server-side; not exercised in e2e (test user is admin, deletion blocked by design).
- `X-App-Secret` and `X-Client-Type` are intentionally NOT sent (PAT/Sanctum path). If prod returns "Invalid client" before the server change deploys, that's expected.
- List responses: services tolerantly extract arrays from `data` (raw array or wrapped in known keys) and read `data.pagination`; adjust once real payloads are observed.
- `check-status` responses are assumed to carry `{status: pending|processing|completed|failed, failure_reason?}`.
- E2E token comes from local-only `GET /api/v1/test/login` (assumed `data.token` or `data.access_token`) or `CLIPUGC_E2E_TOKEN`. The merge step uses a dummy mp4 and is tolerated as a warning if server-side processing rejects it.
- Exit codes: 0 ok, 1 generic, 2 validation, 3 auth, 4 not found, 5 premium required, 6 insufficient credits, 7 network unreachable.

## Pending / next

- [x] Run e2e against the local website; contract drift found+fixed: `template` is required by the server (CLI now defaults to `model_digitals`), Laravel 422 validation responses are now surfaced with field messages. Server-side merge bug with presigned keys found by e2e and fixed on the website (commit 0644658).
- [x] **Production e2e follow-ups (2026-07-19):**
  - `images download <id>` added — no more reading `media.image_url` out of `--json` by hand.
  - `videos merge --wait` now waits on the actual merge render (was returning early on the
    clip's "completed" status); merge failure surfaces + refunds. Since 0.3.1 it polls the ad
    resource (`GET /merged-videos/{id}`) rather than the clip's synthesised `merge_status`.
  - `credits packs` command added.
  - API client retries idempotent GETs on transient failures (429/5xx/network) with backoff —
    fixes the burst-download blips seen under server load.
  - Look-id discoverability: `images list` shows each look's scene; web gallery/video cards show `#id`.
- [ ] Publish to npm (`npm publish`) when go-live ops are done (credit packs configured, RevenueCat keys set).
