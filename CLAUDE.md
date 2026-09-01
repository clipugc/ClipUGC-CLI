# ClipUGC-CLI

Public npm CLI (`clipugc`) plus the Claude Code plugin that ships the ClipUGC
skills. TypeScript + Commander. Layering: `src/cli.ts` (registration) →
`commands/*` → `services/*` → `utils/*`. Config at
`~/.config/clipugc/config.json`. Auth is a Sanctum personal access token the
user creates on the dashboard (Dashboard → API Keys).

```bash
npm ci && npm run build   # plain tsc
npm test                  # vitest
npm run e2e               # drives the built binary against a website
```

## Plugin skill layout — do not "tidy" this

Claude Code's plugin loader scans **`<plugin-root>/skills/` and nothing else**.

- `skills/` at the repo root holds the real skill directories.
- `.claude/skills` is a **symlink** to `../skills`. That symlink is what loads
  the skills for sessions working inside this repo.

Replacing the symlink with a real directory, or moving the skills back under
`.claude/`, makes every skill silently invisible: the plugin still installs, no
error is raised, and sessions simply answer "that skill doesn't exist". This
already happened once in the sibling KAppMaker-CLI repo
([PR #31](https://github.com/KAppMaker/KAppMaker-CLI/pull/31)) and hid 22 skills
until someone noticed.

`scripts/check-plugin-layout.sh` guards it. Run it before releasing:

```bash
./scripts/check-plugin-layout.sh
```

It fails if `skills/` is missing, if `.claude/skills` stops being a symlink to
`../skills`, or if any `SKILL.md` frontmatter `name:` stops matching its
directory name.

**Bump `.claude-plugin/plugin.json` version on every skill change.** Claude Code
caches plugins by version, so a fix shipped without a bump reaches nobody.

## Skills

`clipugc` (drive the product), `ugc-director` (UGC ad creative direction: hooks,
archetypes, casting, prompt craft), `persona-account` (ongoing AI creator
accounts), `story-runner` (continuing story series episodes).
