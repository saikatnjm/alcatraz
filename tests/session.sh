#!/bin/sh
# Runs inside the private D-Bus session started by run.sh.
set -u
UUID=alcatraz@saikatnjm.github.io
PROBE=alcatraz-probe@saikatnjm.github.io
USER_THEMES=user-theme@gnome-shell-extensions.gcampax.github.com

# GNOME Shell expects a system bus. Containers have none, so give it an empty private one.
SYSBUS=
if [ ! -S /run/dbus/system_bus_socket ] && [ -z "${DBUS_SYSTEM_BUS_ADDRESS:-}" ]; then
    address="unix:path=$XDG_RUNTIME_DIR/system-bus"
    if SYSBUS=$(dbus-daemon --session --address="$address" --fork --print-pid 2>/dev/null); then
        export DBUS_SYSTEM_BUS_ADDRESS="$address"
    fi
fi

enabled="'$PROBE'"
[ "$ALCATRAZ_PROBE_BASELINE" = 1 ] || enabled="$enabled, '$UUID'"
if [ -n "$ALCATRAZ_PROBE_THEME_CSS" ]; then
    enabled="'$USER_THEMES', $enabled"
    if [ -n "$ALCATRAZ_SESSION_SCHEMADIR" ]; then
        gsettings --schemadir "$ALCATRAZ_SESSION_SCHEMADIR" set org.gnome.shell.extensions.user-theme name "$ALCATRAZ_SESSION_THEME"
    else
        gsettings set org.gnome.shell.extensions.user-theme name "$ALCATRAZ_SESSION_THEME"
    fi
fi
gsettings set org.gnome.shell enabled-extensions "[$enabled]"
gsettings set org.gnome.shell disable-user-extensions false
gsettings set org.gnome.shell welcome-dialog-last-shown-version '99.0'
gsettings set org.gnome.desktop.interface enable-hot-corners false
gsettings set org.gnome.desktop.interface color-scheme prefer-dark
# A 12-hour clock, so that there is an AM or PM to hide.
gsettings set org.gnome.desktop.interface clock-format '12h'
[ -n "$ALCATRAZ_SESSION_FONT" ] && gsettings set org.gnome.desktop.interface font-name "$ALCATRAZ_SESSION_FONT"
if [ -f "$ALCATRAZ_SESSION_WALLPAPER" ]; then
    gsettings set org.gnome.desktop.background picture-uri "file://$ALCATRAZ_SESSION_WALLPAPER"
    gsettings set org.gnome.desktop.background picture-uri-dark "file://$ALCATRAZ_SESSION_WALLPAPER"
fi

# Newer GNOME versions dropped some of these options along with X11, so pass only what exists.
options="--headless --virtual-monitor 1920x1080"
for option in --wayland --no-x11; do
    if gnome-shell --help-all 2>/dev/null | grep -q -- "$option "; then options="$options $option"; fi
done
# shellcheck disable=SC2086
timeout "${ALCATRAZ_TEST_TIMEOUT:-240}" gnome-shell $options > "$ALCATRAZ_PROBE_OUT/shell.log" 2>&1
echo "gnome-shell exit status: $?" >> "$ALCATRAZ_PROBE_OUT/shell.log"

[ -n "$SYSBUS" ] && kill "$SYSBUS" 2>/dev/null
exit 0
