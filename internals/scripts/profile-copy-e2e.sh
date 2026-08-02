#!/usr/bin/env bash
# Phase 1 disposable-profile e2e harness (EXECUTION_STRATEGY §5 / spec §10.6).
# Extracts a keystore backup archive to a throwaway dir and launches Vessel against that COPY,
# so exercising the app can never mutate the real ~/Library/Application Support/vessel profile.
set -euo pipefail

ARCHIVE="${1:?usage: profile-copy-e2e.sh ~/Vessel-Keystore-Backups/vessel-profile-<ts>.tar.gz}"
[ -f "$ARCHIVE" ] || { echo "archive not found: $ARCHIVE" >&2; exit 1; }

TESTDIR="$(mktemp -d "${TMPDIR:-/tmp}/vessel-e2e-XXXXXX")"
tar xzf "$ARCHIVE" -C "$TESTDIR" # a COPY — never the live profile
echo "Disposable profile: $TESTDIR/vessel"
echo "(delete with: rm -rf \"$TESTDIR\")"

VESSEL_USER_DATA="$TESTDIR/vessel" npm start
