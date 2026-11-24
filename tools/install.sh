#!/bin/sh
# Installs Alcatraz from this folder for the current user (no root needed) and switches it on.
#
#   tools/install.sh           install, or update after a change
#   tools/install.sh remove    switch it off and remove it
#
# It installs the zip that matches the running GNOME Shell with GNOME's own tool, which also
# compiles the settings schema. GNOME loads a new or changed extension at the next login: log
# out and back in once, then lock the screen (Super+L) to see it.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
UUID=alcatraz@saikatnjm.github.io

command -v gnome-shell >/dev/null 2>&1 || { echo "GNOME Shell not found: Alcatraz is a GNOME Shell extension." >&2; exit 1; }
command -v gnome-extensions >/dev/null 2>&1 || { echo "The gnome-extensions tool was not found." >&2; exit 1; }

# switch <on|off>: put Alcatraz on GNOME's list of enabled extensions, or take it off. GNOME keeps
# a second list of extensions that were switched off by hand, and that list wins: take it off
# that one too, or a fresh install would stay off without saying why.
switch() {
    gjs -c "
        const {Gio} = imports.gi;
        const [uuid, mode] = ['$UUID', '$1'];
        const settings = new Gio.Settings({schema_id: 'org.gnome.shell'});
        const enabled = settings.get_strv('enabled-extensions').filter(u => u !== uuid);
        if (mode === 'on')
            enabled.push(uuid);
        settings.set_strv('enabled-extensions', enabled);
        settings.set_strv('disabled-extensions', settings.get_strv('disabled-extensions').filter(u => u !== uuid));
        Gio.Settings.sync();
    "
}

if [ "${1:-}" = remove ]; then
    switch off
    gnome-extensions uninstall "$UUID" 2>/dev/null || rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$UUID"
    echo "Removed. The lock screen is GNOME's own again from the next login."
    exit 0
fi

major=$(gnome-shell --version | sed 's/[^0-9]*\([0-9][0-9]*\).*/\1/')
if [ "$major" -lt 42 ]; then
    echo "Alcatraz needs GNOME Shell 42 or newer (found $major)." >&2
    exit 1
fi
if [ "$major" -ge 45 ]; then range=gnome45-plus; else range=gnome42-44; fi

"$ROOT/tools/build.sh" zip >/dev/null
gnome-extensions install --force "$ROOT/dist/alcatraz-$range.shell-extension.zip"
switch on
echo "Installed Alcatraz $(cat "$ROOT/VERSION") for GNOME Shell $major and switched it on."
echo "Log out and back in once, then press Super+L."
