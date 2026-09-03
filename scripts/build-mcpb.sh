#!/usr/bin/env bash
#
# Build the Claude Desktop extension bundle: dist-mcpb/clipugc.mcpb
#
# An MCPB bundle is a zip with manifest.json at its root plus everything the server needs at
# runtime. For a Node server that means the compiled JS, package.json (dist/version.js reads
# the version from it) and a production-only node_modules, which is why the bundle is staged
# in its own directory instead of being packed from the repo root (the repo node_modules also
# holds the dev toolchain).
#
# Usage: npm run build:mcpb
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_DIR="dist-mcpb"
STAGE="$OUT_DIR/stage"
BUNDLE="$OUT_DIR/clipugc.mcpb"

echo "==> Compiling TypeScript"
npm run build --silent

echo "==> Staging the bundle in $STAGE"
rm -rf "$OUT_DIR"
mkdir -p "$STAGE"
cp package.json package-lock.json manifest.json icon.png .mcpbignore "$STAGE/"
cp -R dist "$STAGE/dist"

echo "==> Installing production dependencies"
# npm ci installs exactly what package-lock.json pins; --omit=dev leaves out the toolchain.
(cd "$STAGE" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund --silent)
# The lock file is only needed for the install; mcpb pack skips it anyway.
rm -f "$STAGE/package-lock.json"

echo "==> Validating manifest.json"
mcpb validate "$STAGE/manifest.json"

echo "==> Packing"
mcpb pack "$STAGE" "$BUNDLE"

echo
echo "Bundle: $BUNDLE ($(du -h "$BUNDLE" | cut -f1))"
