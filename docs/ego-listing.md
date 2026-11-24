# Alcatraz on extensions.gnome.org

Notes for the day Alcatraz is uploaded to https://extensions.gnome.org (EGO). Nothing here has
been uploaded yet.

## The listing

EGO copies the name, the description and the url from `metadata.json` at every upload, so the
listing text lives in `src/metadata.json.in`:

- **Name:** Alcatraz
- **Description:** the `description` in `src/metadata.json.in` (it starts "A Mac-style lock
  screen for GNOME.")
- **Url:** https://github.com/saikatnjm/alcatraz
- **Screenshot:** `docs/assets/screenshot.jpg` (EGO takes up to 2 MB)
- **Icon:** `docs/assets/logo-512.png` (EGO takes at most 512 x 512)

## Uploading

1. Run `make zip` and `make check`. The checker must say "clean" for both zips.
2. Run the tests: `make test`, `make test-46`, `make test-51`.
3. Sign in at https://extensions.gnome.org and open https://extensions.gnome.org/upload/.
4. Upload `dist/alcatraz-<version>-gnome42-44.shell-extension.zip`, then
   `dist/alcatraz-<version>-gnome45-plus.shell-extension.zip`. EGO numbers the uploads itself.
5. On the extension's page, add the screenshot and the icon.

## For the reviewer

Things a reviewer will ask about, and where the answer is:

- **Why `unlock-dialog`:** the extension changes how the lock screen looks, so it must run while
  the screen is locked. It connects no keyboard signals. The comment in `disable()` says so.
- **Private names:** `Main.screenShield._dialog` and its `_clock` (with `_date`, `_time`,
  `_hint`), `_stack`, `_backgroundGroup`, `_updateBackgroundEffects` and `_updateClock`. They have
  the same names from GNOME 42 to 51; `lockScreenParts()` checks each one before anything is
  changed and leaves GNOME's lock screen alone if one is missing.
- **The theme:** loaded with `Main.setThemeStylesheet()` and `Main.loadTheme()`, as User Themes
  does, only while the screen is locked and only if User Themes is switched on for the desktop.
  The stylesheet is looked for where User Themes looks for it.
- **Cleanup:** `disable()` destroys the one object; its `destroy()` disconnects every signal,
  removes the one idle source and, when the screen is locked, puts the lock screen back.
- **The settings schema:** compiled in the zip for GNOME 42 to 44 only.
