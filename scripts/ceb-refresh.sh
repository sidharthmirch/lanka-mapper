#!/bin/bash
# Refresh the CEB generation snapshot from a Sri Lanka host and push it.
#
# GitHub's runners can't fetch the CEB endpoint (geo-restricted to SL IPs), so
# this runs on a SL machine via the LaunchAgent com.lanka-mapper.ceb-refresh.
# Host-portable: set LANKA_MAPPER_REPO to the checkout path. The push triggers
# the Pages deploy (nextjs.yml); the scraper only rewrites the file when the
# underlying data changes, so commits happen ~daily, not every run.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
REPO="${LANKA_MAPPER_REPO:-$HOME/Repos/lanka-mapper}"
cd "$REPO" || { echo "$(date -u +%FT%TZ) repo not found: $REPO"; exit 1; }

# Stay current with main; bail out of the refresh if the tree is dirty (don't
# fight a human edit).
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "$(date -u +%FT%TZ) working tree dirty — skipping"
  exit 0
fi
git fetch -q origin main || true
git merge -q --ff-only origin/main 2>/dev/null || true

node scripts/build-ceb-generation.mjs || { echo "$(date -u +%FT%TZ) scrape failed"; exit 1; }

if ! git diff --quiet -- public/data/ceb-generation.json; then
  git add public/data/ceb-generation.json
  git commit -q -m "chore: refresh CEB generation snapshot"
  git push -q origin main && echo "$(date -u +%FT%TZ) pushed CEB snapshot"
else
  echo "$(date -u +%FT%TZ) no change"
fi
