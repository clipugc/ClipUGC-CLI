# Configuration

Where the CLI stores its settings, the environment variables it honours, and what each exit code means.

## Config file

Settings are stored at `~/.config/clipugc/config.json`:

| Key | Description |
|-----|-------------|
| `apiBaseUrl` | ClipUGC API base URL. |
| `apiKey` | Your API key (set by `clipugc auth login`). |
| `email` | Account email (set on login). |

Manage with `clipugc config list / get / set / path`.

## Environment variables

Env vars override the config file:

| Variable | Overrides |
|----------|-----------|
| `CLIPUGC_API_KEY` | `apiKey` |
| `CLIPUGC_API_BASE_URL` | `apiBaseUrl` |

## JSON output

Every command accepts the global `--json` flag to print raw JSON instead of formatted output — use it for scripting and to capture ids:

```bash
clipugc characters list --mine --json
```

## Waiting on long-running jobs

Generation commands (`images generate`, `images variation`, `images retry`, `videos create`, `videos motion`, `videos merge`, `videos retry`, `ads retry`) accept `--wait` to poll with a spinner until the job is `completed` or `failed`. Without `--wait`, the command returns immediately and you can poll with `images status <id>` / `videos status <id>` / `ads show <adId>`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Generic error |
| 2 | Validation error |
| 3 | Authentication error |
| 4 | Not found |
| 5 | Premium required |
| 6 | Insufficient credits |
| 7 | Network error / server unreachable |

---

[← Back to the README](../README.md)
