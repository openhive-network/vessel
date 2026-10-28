#!/usr/bin/env bash
# Run the checks named after the suite and write test-results/<suite>/junit.xml.
#
#   .aidev/run-checks.sh <suite> <step>...
#
# Every run first installs node_modules with `pnpm install --frozen-lockfile`
# from pnpm-lock.yaml and pnpm-workspace.yaml (which carries ccc's catalogs, so
# the npm-common-config submodule need not be checked out) as the `install`
# case: pnpm applies patches/ (patchedDependencies) and runs the root
# `postinstall` (`electron-builder install-app-deps`). It installs offline from
# the image's pnpm store ($npm_config_store_dir, filled from pnpm-lock.yaml by
# .aidev/runtime/Dockerfile); an image built before the pnpm port has no such
# store, and then the install runs online. Steps, one junit case each:
#
#   test       `pnpm test` (Vitest over app/**/*.test.ts)
#   lint       `pnpm run lint` (ESLint 9 flat config, eslint.config.mjs)
#   typecheck  `pnpm run typecheck` (tsc --noEmit)
#   build      `pnpm run build`: electron-vite bundles of main, preload and
#              renderer into out/ (what `package` builds before electron-builder)
#
# Runs in the image of .aidev/runtime/Dockerfile (Node from common-ci-
# configuration's node-test-tools). Electron is never started.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
root="$PWD"
export npm_config_update_notifier=false
suite="${1:?usage: $0 <suite> <step>...}"; shift
out="$root/test-results/$suite"
rm -rf "$out"; mkdir -p "$out"
cases="$out/cases.tsv"; : > "$cases"
source .aidev/junit-helpers.sh
printf 'property\tnode\t%s\n' "$(node --version)" >> "$cases"

status=0
step() {
    local name="$1"; shift
    local log="$out/$name.log" t0=$SECONDS rc=0
    echo "== $name" >&2
    ( cd "$root" && "$@" ) > "$log" 2>&1 < /dev/null || rc=$?
    if [ "$rc" -eq 0 ]; then
        printf 'case\t%s\tpass\t%s\t\n' "$name" "$((SECONDS - t0))" >> "$cases"
    else
        status=1; tail -40 "$log" >&2
        printf 'case\t%s\tfail\t%s\texit %s\t%s\n' "$name" "$((SECONDS - t0))" "$rc" "$log" >> "$cases"
    fi
    return "$rc"
}

# node_modules is reinstalled when the lockfile, package.json, pnpm-workspace.yaml,
# patches/ or the Node version moved since the last successful install (a marker
# records them).
install() {
    local id marker=node_modules/.aidev-pnpm-lock
    id="$(cat pnpm-lock.yaml package.json pnpm-workspace.yaml patches/* | sha256sum | cut -d' ' -f1) $(node --version)"
    if [ "$(cat "$marker" 2>/dev/null)" = "$id" ] && [ -x node_modules/.bin/electron-vite ]; then
        echo "node_modules is current for pnpm-lock.yaml"; return 0
    fi
    rm -f "$marker"
    if [ -n "${npm_config_store_dir:-}" ] && [ -d "$npm_config_store_dir" ]; then
        pnpm install --frozen-lockfile --offline --config.confirm-modules-purge=false || return 1
    else
        echo "no offline pnpm store in this image (built before the pnpm port); running an online pnpm install" >&2
        pnpm install --frozen-lockfile --config.confirm-modules-purge=false || return 1
    fi
    printf '%s\n' "$id" > "$marker"
}
if ! step install install; then
    junit_write_cases "$out/junit.xml" "$suite" "$cases"
    exit 1
fi

for s in "$@"; do
    case "$s" in
        test) step test pnpm test ;;
        lint) step lint pnpm run lint ;;
        typecheck) step typecheck pnpm run typecheck ;;
        build) step build pnpm run build ;;
        *) printf 'case\t%s\tfail\t0\tunknown step\n' "$s" >> "$cases"; status=1 ;;
    esac
done
junit_write_cases "$out/junit.xml" "$suite" "$cases"
exit "$status"
