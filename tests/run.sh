#!/bin/sh
# The lock-screen test. It installs the built zip in a throwaway home folder, starts a hidden
# GNOME Shell there with its own D-Bus session, locks that shell's screen, checks every part of
# the lock screen with Alcatraz on, switched off and set in other ways, unlocks again each time,
# and reports. Nothing on your desktop is touched, your own screen is not locked, and no window
# appears.
#
#   tests/run.sh [output-dir]        (default: build/test)
#
# Pictures of the lock screen, the report and the logs land in the output folder.
#
#   ALCATRAZ_TEST_THEMES=<folder>     use the shell themes in this folder (for example ~/.themes)
#   ALCATRAZ_TEST_THEME=<name>        ... and this one of them, instead of the test's own tiny theme
#   ALCATRAZ_TEST_WALLPAPER=<file>    the wallpaper (default: one drawn by tests/make-wallpaper.js)
#   ALCATRAZ_TEST_FONT="Inter 13"     the desktop's font (default: the system's)
#   ALCATRAZ_TEST_USER_THEMES=home    test with User Themes installed in the home folder, as it is
#                                     when it comes from extensions.gnome.org (default: the system's copy)
#   ALCATRAZ_TEST_NEED_THEME=1        fail when User Themes is not installed (default: test the rest)
#   ALCATRAZ_TEST_BASELINE=1          leave Alcatraz out: lock and unlock GNOME's own lock screen,
#                                     to see what the shell log says by itself
#
# Needs: gnome-shell 42+, gjs, dbus-run-session, glib-compile-schemas, zip.
set -u
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
UUID=alcatraz@saikatnjm.github.io
PROBE=alcatraz-probe@saikatnjm.github.io
USER_THEMES=user-theme@gnome-shell-extensions.gcampax.github.com
OUT=${1:-$ROOT/build/test}

major=$(gnome-shell --version | sed 's/[^0-9]*\([0-9][0-9]*\).*/\1/')
if [ "$major" -ge 45 ]; then variant=esm; range=gnome45-plus; else variant=legacy; range=gnome42-44; fi
zipfile=$ROOT/dist/alcatraz-$(cat "$ROOT/VERSION")-$range.shell-extension.zip
[ -f "$zipfile" ] || "$ROOT/tools/build.sh" zip >/dev/null || exit 1

mkdir -p "$OUT"
rm -rf "${OUT:?}"/* 2>/dev/null || true
OUT=$(CDPATH= cd -- "$OUT" && pwd)

# The work folder holds the test shell's sockets, whose paths may not be long.
if [ -d "/run/user/$(id -u)" ] && [ -w "/run/user/$(id -u)" ]; then
    WORK=$(mktemp -d "/run/user/$(id -u)/alcatraz-test.XXXXXX")
else
    WORK=$(mktemp -d /tmp/alcatraz-test.XXXXXX)
fi
trap 'rm -rf "$WORK"' EXIT

REAL_HOME=$HOME
export HOME="$WORK/home"
export XDG_RUNTIME_DIR="$WORK/run"
unset XDG_CONFIG_HOME XDG_DATA_HOME XDG_CACHE_HOME XDG_STATE_HOME WAYLAND_DISPLAY DISPLAY XAUTHORITY \
    DBUS_SESSION_BUS_ADDRESS XDG_SESSION_ID XDG_SEAT 2>/dev/null
extensions="$HOME/.local/share/gnome-shell/extensions"
mkdir -p "$extensions/$PROBE" "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

# Installed with GNOME's own tool, as on a user's computer: from GNOME 44 on that is what
# compiles the settings schema, which the zip for GNOME 45 and later leaves out.
if [ "${ALCATRAZ_TEST_BASELINE:-}" != 1 ]; then
    gnome-extensions install --force "$zipfile" || { echo "FAIL  could not install $zipfile"; exit 1; }
fi

cat "$ROOT/tests/probe/$variant-header.js" "$ROOT/tests/probe/probe-core.js" \
    "$ROOT/tests/probe/$variant-footer.js" > "$extensions/$PROBE/extension.js"
printf '{"uuid": "%s", "name": "Alcatraz test probe", "description": "Test helper", "shell-version": ["%s"], "session-modes": ["user", "unlock-dialog"]}\n' \
    "$PROBE" "$major" > "$extensions/$PROBE/metadata.json"

# The shell theme of the test desktop: the test's own tiny one, or one of yours.
theme=${ALCATRAZ_TEST_THEME:-AlcatrazTest}
if [ -n "${ALCATRAZ_TEST_THEMES:-}" ]; then
    ln -s "$ALCATRAZ_TEST_THEMES" "$HOME/.themes"
    # Themes may draw with icons and cursors from these folders.
    [ -d "$REAL_HOME/.icons" ] && ln -s "$REAL_HOME/.icons" "$HOME/.icons"
    [ -d "$REAL_HOME/.local/share/icons" ] && ln -s "$REAL_HOME/.local/share/icons" "$HOME/.local/share/icons"
else
    mkdir -p "$HOME/.themes/$theme/gnome-shell"
    cat > "$HOME/.themes/$theme/gnome-shell/gnome-shell.css" <<'EOF'
/* A shell theme for the test: it only has to be told apart from GNOME's own in a picture. */
#panel { background-color: #1b2a4a; }
.login-dialog-prompt-entry, .unlock-dialog-notification-source { border-radius: 99px; }
EOF
fi
themecss="$HOME/.themes/$theme/gnome-shell/gnome-shell.css"
[ -f "$themecss" ] || { echo "FAIL  no shell theme at $themecss"; exit 1; }

# User Themes: the system's copy, or a copy of it in the home folder with its schema beside it.
system_user_themes=
for dir in /usr/local/share /usr/share; do
    [ -d "$dir/gnome-shell/extensions/$USER_THEMES" ] && system_user_themes="$dir/gnome-shell/extensions/$USER_THEMES" && break
done
schemadir=
if [ -z "$system_user_themes" ]; then
    if [ "${ALCATRAZ_TEST_NEED_THEME:-}" = 1 ]; then
        echo "FAIL  the User Themes extension is not installed (package gnome-shell-extensions or gnome-shell-extension-user-theme)"
        exit 1
    fi
    echo "note  the User Themes extension is not installed: keeping the theme is NOT tested in this run"
    themecss=
elif [ "${ALCATRAZ_TEST_USER_THEMES:-}" = home ]; then
    cp -r "$system_user_themes" "$extensions/$USER_THEMES"
    mkdir -p "$extensions/$USER_THEMES/schemas"
    cp /usr/share/glib-2.0/schemas/org.gnome.shell.extensions.user-theme.gschema.xml "$extensions/$USER_THEMES/schemas/" &&
        glib-compile-schemas --strict "$extensions/$USER_THEMES/schemas" || { echo "FAIL  could not set up User Themes in the home folder"; exit 1; }
    schemadir="$extensions/$USER_THEMES/schemas"
fi

# GNOME Shell builds its lock screen only where it can lock for real, with GDM and systemd's
# logind running. A container has neither. There the test shows GNOME Shell its own
# loginManager.js with one change, canLock() answering yes, through G_RESOURCE_OVERLAYS (a
# debugging aid of GLib). Everything else is the real lock screen of that GNOME version.
if [ ! -d /run/systemd/seats ]; then
    for lib in $(find /usr/lib /usr/lib64 /usr/share/gnome-shell -path '*gnome-shell*' \( -name '*.so*' -o -name '*.gresource' \) 2>/dev/null); do
        if gresource list "$lib" 2>/dev/null | grep -qx /org/gnome/shell/misc/loginManager.js; then
            gresource extract "$lib" /org/gnome/shell/misc/loginManager.js > "$WORK/loginManager.js"
            break
        fi
    done
    if grep -q '^export function canLock() {$' "$WORK/loginManager.js" 2>/dev/null; then
        sed -i 's|^export function canLock() {$|function canLockForReal() {|' "$WORK/loginManager.js"
        printf '\n// The lock-screen test: no GDM and no logind here, but locking is wanted.\nexport function canLock() {\n    return true;\n}\n' >> "$WORK/loginManager.js"
    elif grep -q '^function canLock() {$' "$WORK/loginManager.js" 2>/dev/null; then
        sed -i 's|^function canLock() {$|function canLockForReal() {|' "$WORK/loginManager.js"
        printf '\n// The lock-screen test: no GDM and no logind here, but locking is wanted.\nfunction canLock() {\n    return true;\n}\n' >> "$WORK/loginManager.js"
    else
        echo "FAIL  no logind here, and GNOME Shell's canLock() could not be overlaid (is gresource installed?)"
        exit 1
    fi
    export G_RESOURCE_OVERLAYS="/org/gnome/shell/misc/loginManager.js=$WORK/loginManager.js"
    echo "note  no GDM and no logind here: GNOME Shell is told it may lock (canLock() overlaid)"
fi

export ALCATRAZ_PROBE_OUT="$OUT"
export ALCATRAZ_PROBE_THEME_CSS="$themecss"
export ALCATRAZ_SESSION_THEME="$theme"
export ALCATRAZ_SESSION_SCHEMADIR="$schemadir"
wallpaper=${ALCATRAZ_TEST_WALLPAPER:-}
if [ -z "$wallpaper" ]; then
    wallpaper=$WORK/wallpaper.png
    gjs "$ROOT/tests/make-wallpaper.js" "$wallpaper" || { echo "FAIL  could not draw the wallpaper"; exit 1; }
fi
export ALCATRAZ_SESSION_WALLPAPER="$wallpaper"
export ALCATRAZ_SESSION_FONT="${ALCATRAZ_TEST_FONT:-}"
export ALCATRAZ_PROBE_BASELINE="${ALCATRAZ_TEST_BASELINE:-}"
if [ "${ALCATRAZ_TEST_BASELINE:-}" = 1 ]; then
    echo "Lock-screen test: GNOME Shell $(gnome-shell --version | sed 's/[^0-9]*//'), WITHOUT Alcatraz (baseline)"
else
    echo "Lock-screen test: GNOME Shell $(gnome-shell --version | sed 's/[^0-9]*//'), $variant build from $(basename "$zipfile")"
fi
if [ -n "$themecss" ]; then
    if [ -n "$schemadir" ]; then where="the home folder"; else where=$system_user_themes; fi
    echo "Shell theme: $theme, User Themes from $where"
fi
dbus-run-session -- sh "$ROOT/tests/session.sh" > "$OUT/session.log" 2>&1

status=0
if [ ! -f "$OUT/report.json" ]; then
    echo "FAIL  no report: the shell or the probe did not get far enough"
    grep -iE "alcatraz|JS ERROR|error" "$OUT/shell.log" 2>/dev/null | head -20
    exit 1
fi
LC_ALL=C.UTF-8 gjs "$ROOT/tests/summary.js" "$OUT/report.json" || status=1

# An error or warning that names Alcatraz, or a JavaScript error with Alcatraz in its stack
# trace, fails the test even if every check passed. (The probe's own name does not count.)
named=$(grep -nE "(JS ERROR|JS WARNING|CRITICAL|had error|Extension .* error)" "$OUT/shell.log" "$OUT/session.log" 2>/dev/null | grep -F "$UUID")
traced=$(grep -A14 -E "JS ERROR|Gjs-CRITICAL|JS WARNING" "$OUT/shell.log" 2>/dev/null | grep -F "$UUID/")
if [ -n "$named$traced" ]; then
    echo "FAIL  errors that name Alcatraz in the shell log:"
    { printf '%s\n' "$named"; grep -B3 -A14 -E "JS ERROR|Gjs-CRITICAL|JS WARNING" "$OUT/shell.log" | grep -B8 -A8 -F "$UUID/"; } | head -40
    status=1
else
    echo "ok    no error or warning names Alcatraz in the shell log"
fi

# Three kinds of warning that careless handling of widgets leads to: placing them in the middle
# of a layout pass, asking a widget that is not on screen for its style, and using a widget
# that was destroyed. GNOME Shell on its own logs none of them in this test.
careless="Can't update stage views|st_widget_get_theme_node called on the widget|has been already (disposed|deallocated|finalized)"
if sed '/Shutting down GNOME Shell/q' "$OUT/shell.log" 2>/dev/null | grep -qE "$careless"; then
    echo "FAIL  layout, style or destroyed-widget warnings in the shell log:"
    sed '/Shutting down GNOME Shell/q' "$OUT/shell.log" | grep -E "$careless" | sed -E 's/^.*\*\*: [0-9:.]+: //; s/0x[0-9a-f]+//g' | sort | uniq -c | sort -rn | head -8
    status=1
else
    echo "ok    no layout, style or destroyed-widget warnings in the shell log"
fi

if grep -q "gnome-shell exit status: 0" "$OUT/shell.log" 2>/dev/null; then
    echo "ok    GNOME Shell ended normally"
else
    echo "FAIL  GNOME Shell did not end normally: $(tail -1 "$OUT/shell.log" 2>/dev/null)"
    status=1
fi
# The kinds of warning in the shell log, with numbers and addresses taken out: to compare a run
# with one made with ALCATRAZ_TEST_BASELINE=1. A kind that only shows up with Alcatraz is its own.
sed '/Shutting down GNOME Shell/q' "$OUT/shell.log" 2>/dev/null |
    grep -E "CRITICAL|WARNING|JS ERROR" |
    sed -E 's/^\(gnome-shell:[0-9]+\): //; s/[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]+: //; s/0x[0-9a-f]+//g; s/[0-9]+/N/g' |
    cut -c1-160 | sort | uniq -c | sort -rn > "$OUT/warning-kinds.txt"
echo "Pictures, report and logs: $OUT"
exit $status
