#!/usr/bin/env bash
#
# Guards the one layout detail that silently breaks every skill in this plugin.
#
# Claude Code's plugin loader scans <plugin-root>/skills/ and nothing else. If
# skills live only in .claude/skills/, the plugin installs cleanly, reports no
# error, and none of its skills ever load. The failure is invisible: a session
# just answers "that skill doesn't exist".
#
# So: skills/ must exist at the root, and .claude/skills must stay a symlink to
# it (the symlink is what loads them for sessions working inside this repo).
set -uo pipefail

cd "$(dirname "$0")/.."
fail=0

note() {
    echo "FAIL: $1" >&2
    fail=1
}

if [ ! -d skills ]; then
    note "skills/ is missing from the plugin root. The loader reads only <plugin-root>/skills/, so every skill would be invisible."
fi

if [ -e .claude/skills ] && [ ! -L .claude/skills ]; then
    note ".claude/skills is a real directory. It must be a symlink to ../skills, or the two copies drift and the root one silently wins."
fi

if [ -L .claude/skills ]; then
    target="$(readlink .claude/skills)"
    if [ "$target" != "../skills" ]; then
        note ".claude/skills points at '$target', expected '../skills'."
    fi
fi

shopt -s nullglob
found=0
for dir in skills/*/; do
    name="$(basename "$dir")"
    found=$((found + 1))

    if [ ! -f "$dir/SKILL.md" ]; then
        note "skills/$name has no SKILL.md."
        continue
    fi

    declared="$(grep -m1 '^name:' "$dir/SKILL.md" | sed 's/name: *//' | tr -d '"'"'"'\r')"
    if [ -z "$declared" ]; then
        note "skills/$name/SKILL.md has no 'name:' in its frontmatter."
    elif [ "$declared" != "$name" ]; then
        note "skills/$name/SKILL.md declares name '$declared'; it must match the directory name."
    fi
done

if [ "$found" -eq 0 ]; then
    note "No skills found under skills/."
fi

if [ "$fail" -eq 0 ]; then
    echo "Plugin layout OK: $found skill(s) at the plugin root, .claude/skills symlinked."
fi

exit "$fail"
