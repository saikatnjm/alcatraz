#!/bin/sh
# Runs the lock-screen test inside a container image that has GNOME Shell, to check Alcatraz on
# other GNOME versions than the one on your desktop.
#
#   tests/in-container.sh <image> [output-dir]
#
# The zips are built here first, and the very zip that a user installs is what gets installed in
# the container. The ALCATRAZ_TEST_* settings of tests/run.sh are passed on; a folder given in
# ALCATRAZ_TEST_THEMES is mounted read-only, and so is ALCATRAZ_TEST_FONTS=<folder of fonts>.
# Images are built from tests/Dockerfile.apt or tests/Dockerfile.dnf, for example:
#   docker build -t alcatraz-test:gnome46 -f tests/Dockerfile.apt --build-arg BASE=ubuntu:24.04 tests
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
IMAGE=${1:?usage: tests/in-container.sh <image> [output-dir]}
OUT=${2:-$ROOT/build/test-$(printf '%s' "$IMAGE" | tr -c 'A-Za-z0-9._-' '-')}
ENGINE=${CONTAINER_ENGINE:-docker}

"$ROOT/tools/build.sh" zip >/dev/null
rm -rf "$OUT"
mkdir -p "$OUT"
chmod 777 "$OUT"
OUT=$(CDPATH= cd -- "$OUT" && pwd)    # docker takes a relative path for a volume name
set --
if [ -n "${ALCATRAZ_TEST_THEMES:-}" ]; then
    set -- "$@" -v "$(CDPATH= cd -- "$ALCATRAZ_TEST_THEMES" && pwd):/themes:ro" -e ALCATRAZ_TEST_THEMES=/themes \
        -e ALCATRAZ_TEST_THEME="${ALCATRAZ_TEST_THEME:-}"
fi
if [ -n "${ALCATRAZ_TEST_FONTS:-}" ]; then
    set -- "$@" -v "$(CDPATH= cd -- "$ALCATRAZ_TEST_FONTS" && pwd):/usr/local/share/fonts/test:ro"
fi
# The sources are mounted read-only and copied inside, so the container cannot change them.
"$ENGINE" run --rm "$@" \
    -e ALCATRAZ_TEST_BASELINE="${ALCATRAZ_TEST_BASELINE:-}" \
    -e ALCATRAZ_TEST_USER_THEMES="${ALCATRAZ_TEST_USER_THEMES:-}" \
    -e ALCATRAZ_TEST_NEED_THEME="${ALCATRAZ_TEST_NEED_THEME:-1}" \
    -e ALCATRAZ_TEST_FONT="${ALCATRAZ_TEST_FONT:-}" \
    -v "$ROOT:/src:ro" -v "$OUT:/out" "$IMAGE" sh -c '
    set -e
    cp -r /src /tmp/alcatraz
    cd /tmp/alcatraz
    rm -rf build
    tests/run.sh /out
'
