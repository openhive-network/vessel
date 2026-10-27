#!/usr/bin/env bash
# Run the checks named after the suite and write test-results/<suite>/junit.xml.
#
#   .aidev/run-checks.sh <suite> <step>...
#
# Every run first installs node_modules offline from the image's yarn cache
# (`yarn install --offline --frozen-lockfile`, lifecycle scripts included: the
# native modules such as node-sass build here, and the root `postinstall` runs
# `build-dll`, `electron-builder install-app-deps` and the devEngines check) as
# the `install` case. Steps, one junit case each:
#
#   test   `yarn test` (test/runTests.js, the package.json `test` script). The
#          tree has no test/ directory at onboarding: the case is recorded as
#          skipped until one exists (see .aidev/README.md)
#   lint   eslint . (package.json `lint`, the first step of .travis.yml)
#   build  `yarn build`: webpack bundles of the main and renderer processes
#          (package.json `build`, what `package` builds before electron-builder)
#
# Runs offline in the image of .aidev/runtime/Dockerfile (Node from
# common-ci-configuration's node-test-tools). Electron is never started.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
root="$PWD"
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

# node_modules is reinstalled when yarn.lock, package.json or the Node version
# moved since the last successful install (a marker records them).
install() {
    local id marker=node_modules/.aidev-yarn-lock
    id="$(cat yarn.lock package.json | sha256sum | cut -d' ' -f1) $(node --version)"
    if [ "$(cat "$marker" 2>/dev/null)" = "$id" ] && [ -x node_modules/.bin/webpack ]; then
        echo "node_modules is current for yarn.lock"; return 0
    fi
    rm -f "$marker"
    yarn install --offline --frozen-lockfile --non-interactive || return 1
    printf '%s\n' "$id" > "$marker"
}
if ! step install install; then
    junit_write_cases "$out/junit.xml" "$suite" "$cases"
    exit 1
fi

unit() {
    if [ ! -f test/runTests.js ]; then
        printf 'case\ttest\tskip\t0\tno test/runTests.js in the tree\n' >> "$cases"
        return 0
    fi
    step test yarn run test
}

for s in "$@"; do
    case "$s" in
        test) unit ;;
        lint) step lint node_modules/.bin/eslint . ;;
        build) step build yarn run build ;;
        *) printf 'case\t%s\tfail\t0\tunknown step\n' "$s" >> "$cases"; status=1 ;;
    esac
done
junit_write_cases "$out/junit.xml" "$suite" "$cases"
exit "$status"
