<p align="center"><img src="docs/assets/logo-128.png" width="96" height="96" alt=""></p>

<h1 align="center">Alcatraz</h1>

<p align="center"><b>A Mac-style lock screen for GNOME.</b><br>
Your desktop's theme on the lock screen, the wallpaper sharp, and a big clock near the top.<br>
GNOME 42 to 51. Nothing of it runs while you work.</p>

<p align="center"><img src="docs/assets/lock-screen.jpg" alt="The lock screen with Alcatraz: the date above a large bold clock near the top, over a sharp wallpaper of hills and a lighthouse in the evening fog"></p>

## What it does

GNOME switches extensions off while the screen is locked, and that includes **User Themes**, the
extension that loads a shell theme. So the lock screen falls back to the default look, whatever
theme your desktop uses, shows your wallpaper blurred and dark, and goes black as soon as you lock.

Alcatraz is allowed to stay on while the screen is locked. When you lock the screen it:

- **shows the lock screen right away**, as a Mac does, instead of a black screen. The display
  still goes off after 30 seconds without a key press or mouse move;
- **keeps your desktop's shell theme** on the lock screen;
- **shows the wallpaper sharp** instead of blurred and dark;
- **puts the date above a large clock near the top**, without AM or PM.

Every part has its own switch, and blur, brightness, the sizes, the font and the height of the
clock can be set. The name comes from the island: a locked place with a fine view.

| GNOME's own lock screen | With Alcatraz |
|---|---|
| <img src="docs/assets/gnome-lock-screen.jpg" alt="GNOME's own lock screen: the default theme, the wallpaper blurred and dark, the time above the date"> | <img src="docs/assets/lock-screen.jpg" alt="The same desktop locked with Alcatraz"> |

The same desktop in both pictures: the WhiteSur shell theme set with User Themes, and a wallpaper
of our own. The password page stays GNOME's own, in your theme:

<p align="center"><img src="docs/assets/password.jpg" width="720" alt="The password page with Alcatraz: GNOME's own avatar and password field over the sharp wallpaper"></p>

## Light, and careful

- **Nothing runs while the screen is unlocked.** No timer, no polling: Alcatraz only listens for
  the screen to lock and to unlock.
- **One short moment of work per lock.** In the tests, dressing the lock screen took 50 to 170
  milliseconds, most of it loading the theme, the same work User Themes does at every unlock.
- **The password prompt is GNOME's own.** Alcatraz does not touch it, its place, or the way you
  unlock. The clock is only moved where it is painted, not in the layout.
- **The display still sleeps.** GNOME switches the display off 30 seconds after the last key
  press or mouse move on a locked screen; Alcatraz leaves that alone. A screen that went black
  because you left the computer idle stays black.
- **It fails soft.** Alcatraz changes parts of GNOME's lock screen that are not a public
  programming interface. It checks for each of them, and if one is missing in some GNOME version,
  the lock screen stays as GNOME made it.
- **Switched off, it leaves nothing behind**, even when that happens while the screen is locked:
  the lock screen goes back to GNOME's own at once.

## Download

Every version stays available. Pick the zip for your GNOME version; to see which GNOME you have,
run `gnome-shell --version`.

| Version | Released | GNOME 42, 43, 44 | GNOME 45 to 51 | Notes |
|---|---|---|---|---|
| **1.0.0** (newest) | 24 Nov 2026 | [alcatraz-1.0.0-gnome42-44.shell-extension.zip](https://github.com/saikatnjm/alcatraz/releases/download/v1.0.0/alcatraz-1.0.0-gnome42-44.shell-extension.zip) | [alcatraz-1.0.0-gnome45-plus.shell-extension.zip](https://github.com/saikatnjm/alcatraz/releases/download/v1.0.0/alcatraz-1.0.0-gnome45-plus.shell-extension.zip) | First version |

The newest version is always at these two links:
[GNOME 42-44](https://github.com/saikatnjm/alcatraz/releases/latest/download/alcatraz-gnome42-44.shell-extension.zip) ·
[GNOME 45-51](https://github.com/saikatnjm/alcatraz/releases/latest/download/alcatraz-gnome45-plus.shell-extension.zip).
What changed in each version: [CHANGELOG.md](CHANGELOG.md) and the
[releases page](https://github.com/saikatnjm/alcatraz/releases).

## Install

You need GNOME 42 or newer. Keeping the theme needs the **User Themes** extension, the one that
sets your shell theme (package `gnome-shell-extensions` on Debian and Ubuntu,
`gnome-shell-extension-user-theme` on Fedora). Everything else works without it.

1. Download the zip for your GNOME version from the table above.
2. Install it with GNOME's own tool. Use this command rather than unpacking the zip by hand: it
   also prepares the settings.

   ```sh
   gnome-extensions install --force ~/Downloads/alcatraz-1.0.0-gnome45-plus.shell-extension.zip
   ```

   (Use the name of the zip you downloaded.)
3. Log out and back in. GNOME loads new extensions only at login.
4. Switch Alcatraz on: in the **Extensions** app, or with

   ```sh
   gnome-extensions enable alcatraz@saikatnjm.github.io
   ```
5. Lock the screen with **Super+L** to see it.

**From the source** instead: this builds the zip, installs it and switches it on (it needs
`glib-compile-schemas` and `zip`). Then log out and back in.

```sh
git clone https://github.com/saikatnjm/alcatraz.git
cd alcatraz
make install
```

### Update

Download the newer zip and run step 2 again with it (`gnome-extensions install --force ...`), then
log out and back in. Your settings are kept. From the source: `git pull` and `make install`.

## Settings

Open them from the Extensions app (the gear next to Alcatraz), or run
`gnome-extensions prefs alcatraz@saikatnjm.github.io`. Changes show the next time the screen locks.

<p align="center"><img src="docs/assets/settings.png" width="560" alt="The settings window: switches for locking, the theme, the wallpaper, the date above the time, AM and PM, the clock's height and style"></p>

| Setting | What it does | Default |
|---|---|---|
| Show the lock screen right away | The lock screen instead of a black screen after Super+L; the display still goes off after 30 s without input | on |
| Keep the desktop's theme | Your shell theme on the lock screen (needs User Themes) | on |
| Change how the wallpaper shows | Blur 0 is sharp; brightness 100 % is the picture as it is | on: blur 0, brightness 85 % (GNOME: 45 to 60, and 55 to 65 %) |
| Date above the time | The date on top, as on a Mac | on |
| Hide AM and PM | 4:25 instead of 4:25 PM | on |
| Move the clock up | Its distance from the top of the screen | on: 12 % of the screen's height |
| Style the clock | Bold white letters with a soft shadow: size of the time, of the date, and the font | on: 96 pt and 20 pt, the desktop's font |

Switched off, each part is left exactly as GNOME shows it.

## Uninstall

1. Switch Alcatraz off and remove it, with one command:

   ```sh
   gnome-extensions uninstall alcatraz@saikatnjm.github.io
   ```

   Or in the **Extensions** app: open Alcatraz and press **Remove**. If you installed from the
   source, `make uninstall` in that folder does the same.
2. Optional: remove your Alcatraz settings too.

   ```sh
   dconf reset -f /org/gnome/shell/extensions/alcatraz/
   ```
3. Log out and back in, or simply lock the screen: the lock screen is GNOME's own again.

If the command says the extension does not exist (it was installed but never loaded), remove the
folder by hand: `rm -r ~/.local/share/gnome-shell/extensions/alcatraz@saikatnjm.github.io`.

## How it was tested

`tests/run.sh` starts a hidden GNOME Shell with a throwaway home folder, locks its screen and
checks every part: that the lock screen shows instead of a black screen (and that a screen left idle still goes black), the theme, the wallpaper, the clock, the password prompt (where it is, that a
key brings it up), switching Alcatraz off and on while locked, every switch off, other values,
a desktop without User Themes, the settings window, and that unlocking works each time. It also
fails on any error or warning in GNOME's log that names Alcatraz. Your own screen is not locked
and nothing on your desktop changes.

Passed with 125 of 125 checks on GNOME 42.9 (Ubuntu 22.04), and in containers on GNOME 46.0
(Ubuntu 24.04) and 51.1 (Fedora 45). The continuous integration runs the same test on GNOME 42,
43, 46, 48, 49, 50 and 51. In a container, which has neither GDM nor systemd, the test tells
GNOME Shell that it may lock; everything else is that version's real lock screen.

## Development

```sh
make build       # both variants into build/: legacy (GNOME 42-44) and esm (GNOME 45+)
make zip         # the installable zips into dist/, the same ones for extensions.gnome.org
make test        # the lock-screen test on this computer
make images      # the container images for the next two (about 1 GB each)
make test-46     # the test with GNOME 46
make test-51     # the test with GNOME 51
make check       # extensions.gnome.org's checker (Shexli) on the zips
```

The code is in `src/`: `core/lockscreen.js` holds everything the extension does, `prefs/` the
settings window, and `shell/` and `prefs/` the few lines that differ between GNOME 42-44 and 45+.
`tools/build.sh` puts them together.

## Licence

GPL-3.0-or-later, see [LICENSE](LICENSE). The wallpaper in the pictures is drawn by
`tests/make-wallpaper.js`.

Mac is a trademark of Apple Inc. Alcatraz is not connected with or endorsed by Apple.
