#!/usr/bin/env bash
# Run the checks named after the suite and write test-results/<suite>/junit.xml.
#
#   .aidev/run-checks.sh <suite> <step>...
#
# Every run first installs node_modules with `npm ci --legacy-peer-deps` from
# package-lock.json (lifecycle scripts included: the root `postinstall` runs
# patch-package, which applies patches/, and `electron-builder install-app-deps`)
# as the `install` case. It installs offline from the image's npm cache
# ($npm_config_cache, filled from package-lock.json by .aidev/runtime/Dockerfile);
# an image built before the npm port has no such cache, and then the install
# falls back to an online `npm ci`. Steps, one junit case each:
#
#   test       `npm test` (Vitest over app/**/*.test.ts)
#   lint       `npm run lint` (ESLint 9 flat config, eslint.config.mjs)
#   typecheck  `npm run typecheck` (tsc --noEmit)
#   build      `npm run build`: electron-vite bundles of main, preload and
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

# node_modules is reinstalled when package-lock.json, package.json or the Node
# version moved since the last successful install (a marker records them).
install() {
    local id marker=node_modules/.aidev-npm-lock
    id="$(cat package-lock.json package.json | sha256sum | cut -d' ' -f1) $(node --version)"
    if [ "$(cat "$marker" 2>/dev/null)" = "$id" ] && [ -x node_modules/.bin/electron-vite ]; then
        echo "node_modules is current for package-lock.json"; return 0
    fi
    rm -f "$marker"
    if [ -n "${npm_config_cache:-}" ] && [ -d "$npm_config_cache/_cacache" ]; then
        npm ci --legacy-peer-deps --offline --no-audit --no-fund || return 1
    else
        echo "no offline npm cache in this image (built before the npm port); running an online npm ci" >&2
        npm ci --legacy-peer-deps --no-audit --no-fund || return 1
    fi
    printf '%s\n' "$id" > "$marker"
}
if ! step install install; then
    junit_write_cases "$out/junit.xml" "$suite" "$cases"
    exit 1
fi

for s in "$@"; do
    case "$s" in
        test) step test npm test ;;
        lint) step lint npm run lint ;;
        typecheck) step typecheck npm run typecheck ;;
        build) step build npm run build ;;
        *) printf 'case\t%s\tfail\t0\tunknown step\n' "$s" >> "$cases"; status=1 ;;
    esac
done
junit_write_cases "$out/junit.xml" "$suite" "$cases"
exit "$status"
