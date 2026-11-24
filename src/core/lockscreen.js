// ---- the lock screen's look ------------------------------------------------------------------
//
// Everything here happens at the moment the screen locks. Nothing runs while the screen is
// unlocked, and there is no timer.
// The header supplies Clutter, Gio, GLib, Pango, St and Main; see tools/build.sh.

const USER_THEMES = 'user-theme@gnome-shell-extensions.gcampax.github.com';
const USER_THEMES_SCHEMA = 'org.gnome.shell.extensions.user-theme';

// How the clock is written while "Style the clock" is on; sizes and font come from the settings.
const CLOCK_STYLE = 'spacing: 0; padding-bottom: 0; color: white;';
const DATE_STYLE = 'font-weight: 600; color: rgba(255, 255, 255, 0.92); text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);';
const TIME_STYLE = 'font-weight: 700; padding-top: 0; font-feature-settings: "tnum"; text-shadow: 0 2px 18px rgba(0, 0, 0, 0.3);';
const HINT_STYLE = 'font-size: 11pt; font-weight: 500; padding-top: 10px; color: rgba(255, 255, 255, 0.85); ' +
    'text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);';

/**
 * The stylesheet of the shell theme the desktop shows, or null when it shows GNOME's own.
 *
 * A shell theme is loaded by the User Themes extension, which GNOME switches off while the
 * screen is locked. Its setting still names the theme, and the file is looked for where User
 * Themes looks for it, in the same order.
 */
function desktopThemeFile() {
    const userThemes = Main.extensionManager.lookup(USER_THEMES);
    if (!userThemes || !global.settings.get_strv('enabled-extensions').includes(USER_THEMES) ||
        global.settings.get_strv('disabled-extensions').includes(USER_THEMES))
        return null;

    // User Themes keeps its settings schema in its own folder when it was installed from
    // extensions.gnome.org, and among the system's schemas when it came as a package.
    const ownSchemas = userThemes.dir.get_child('schemas');
    const defaultSource = Gio.SettingsSchemaSource.get_default();
    const source = ownSchemas.get_child('gschemas.compiled').query_exists(null)
        ? Gio.SettingsSchemaSource.new_from_directory(ownSchemas.get_path(), defaultSource, false)
        : defaultSource;
    const schema = source.lookup(USER_THEMES_SCHEMA, true);
    if (!schema)
        return null;
    const name = new Gio.Settings({settings_schema: schema}).get_string('name');
    if (name === '')
        return null;

    const dataDirs = GLib.get_system_data_dirs();
    const places = [
        [GLib.get_home_dir(), '.themes', name, 'gnome-shell', 'gnome-shell.css'],
        [GLib.get_user_data_dir(), 'themes', name, 'gnome-shell', 'gnome-shell.css'],
        ...dataDirs.map(dir => [dir, 'themes', name, 'gnome-shell', 'gnome-shell.css']),
        ...dataDirs.map(dir => [dir, 'gnome-shell', 'theme', `${name}.css`]),
    ];
    for (const place of places) {
        const file = Gio.File.new_for_path(GLib.build_filenamev(place));
        if (file.query_exists(null))
            return file;
    }
    return null;
}

/** The family of the font the desktop is set to use: "Inter" for the setting "Inter 13". */
function desktopFontFamily() {
    return Pango.FontDescription.from_string(St.Settings.get().font_name).get_family();
}

/**
 * The parts of GNOME's lock screen that this extension changes.
 *
 * They are private to GNOME Shell, not a programming interface, though they have kept these
 * names from GNOME 42 to 51. If a later version renames or reshapes one of them, this returns
 * null, and the lock screen stays as GNOME made it.
 */
function lockScreenParts() {
    const dialog = Main.screenShield?._dialog;
    const clock = dialog?._clock;
    const parts = {
        dialog,
        clock,
        stack: dialog?._stack,
        wallpapers: dialog?._backgroundGroup,
        date: clock?._date,
        time: clock?._time,
        hint: clock?._hint,
    };
    const asExpected = parts.stack instanceof Clutter.Actor && parts.wallpapers instanceof Clutter.Actor &&
        [parts.date, parts.time, parts.hint].every(label => label instanceof St.Label && label.get_parent() === clock) &&
        typeof dialog._updateBackgroundEffects === 'function' && typeof clock._updateClock === 'function';
    return asExpected ? parts : null;
}

/**
 * The two fades of GNOME's screen shield: the short one that blackens a screen locked by hand,
 * and the long one that blackens a screen left idle. Private to GNOME Shell like the lock
 * screen's parts; null if they are not as expected, and then the screen is left to GNOME.
 */
function screenShieldFades() {
    const shield = Main.screenShield;
    const fades = {shield, short: shield?._shortLightbox, long: shield?._longLightbox};
    const asExpected = typeof shield?.connect === 'function' && typeof fades.short?.lightOff === 'function' &&
        typeof fades.short.active === 'boolean' && typeof fades.long?.active === 'boolean';
    return asExpected ? fades : null;
}

/** Blurs and dims the wallpapers behind a lock screen. Blur 0 and brightness 100 leave them as they are. */
function showWallpapers(wallpapers, blur, brightness) {
    const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    for (const wallpaper of wallpapers.get_children()) {
        const effect = wallpaper.get_effect('blur');
        if (!effect)
            continue;
        effect.brightness = brightness / 100;
        // GNOME 46 replaced the blur's "sigma" by a "radius", which is twice as large.
        if (effect.radius === undefined)
            effect.sigma = blur * scale;
        else
            effect.radius = 2 * blur * scale;
    }
}

class LockScreenLook {
    constructor(settings) {
        this._settings = settings;
        this._themeContext = St.ThemeContext.get_for_stage(global.stage);
        this._sessionId = Main.sessionMode.connect('updated', () => this._lookAgainSoon());
        if (Main.sessionMode.isLocked)
            this._lookAgainSoon();
    }

    destroy() {
        Main.sessionMode.disconnect(this._sessionId);
        this._sessionId = null;
        if (this._idleId) {
            GLib.source_remove(this._idleId);
            this._idleId = null;
        }
        this._undress();
        this._themeContext = null;
        this._settings = null;
    }

    // When the screen locks or unlocks, GNOME switches extensions off and on one after the
    // other, this one included, and User Themes takes its theme away in between. Looking once
    // all of that is over dresses the lock screen one time instead of once per extension, and
    // still before it is first drawn.
    _lookAgainSoon() {
        if (this._idleId)
            GLib.source_remove(this._idleId);
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._idleId = null;
            if (Main.sessionMode.isLocked)
                this._dress();
            else
                this._letGo();
            return GLib.SOURCE_REMOVE;
        });
    }

    _dress() {
        this._keepDesktopTheme();
        if (!this._themeId)
            this._themeId = this._themeContext.connect('changed', () => this._keepDesktopTheme());
        if (!this._activeId && this._settings.get_boolean('keep-screen-on') && screenShieldFades()) {
            this._activeId = Main.screenShield.connect('active-changed', () => this._showLockScreen());
            this._showLockScreen();
        }

        const parts = lockScreenParts();
        if (!parts || parts.dialog === this._parts?.dialog)
            return;
        this._letGoOfParts();
        this._parts = parts;

        const {dialog, clock, stack, wallpapers, date, time, hint} = parts;
        const settings = this._settings;
        this._stock = {
            dateIndex: clock.get_children().indexOf(date),
            styles: [clock, date, time, hint].map(actor => actor.style),
        };
        this._destroyId = dialog.connect('destroy', () => this._letGoOfParts());

        if (settings.get_boolean('change-wallpaper')) {
            const blur = settings.get_int('wallpaper-blur');
            const brightness = settings.get_int('wallpaper-brightness');
            // GNOME calls this method of the lock screen again when a monitor is added or the
            // scale changes. Standing in for it, on this one lock screen, keeps our values then.
            dialog._updateBackgroundEffects = () => showWallpapers(wallpapers, blur, brightness);
            dialog._updateBackgroundEffects();
        }
        if (settings.get_boolean('date-above-time'))
            clock.set_child_at_index(date, 0);
        if (settings.get_boolean('style-clock')) {
            const family = (settings.get_string('clock-font') || desktopFontFamily() || '').replace(/["\\;{}]/g, '');
            clock.style = family ? `${CLOCK_STYLE} font-family: "${family}";` : CLOCK_STYLE;
            date.style = `${DATE_STYLE} font-size: ${settings.get_int('date-size')}pt;`;
            time.style = `${TIME_STYLE} font-size: ${settings.get_int('time-size')}pt;`;
            hint.style = HINT_STYLE;
        }
        if (settings.get_boolean('hide-am-pm')) {
            this._textId = time.connect('notify::text', () => this._trimTime());
            this._trimTime();
        }
        if (settings.get_boolean('move-clock')) {
            this._clockTop = settings.get_int('clock-top') / 100;
            this._allocationId = stack.connect('notify::allocation', () => this._liftClock());
            this._liftClock();
        }
    }

    // Puts a lock screen that is still showing back the way GNOME made it.
    _undress() {
        const parts = this._parts;
        const stock = this._stock;
        this._letGo();
        if (!parts)
            return;
        const {dialog, clock, date, time, hint} = parts;
        dialog._updateBackgroundEffects();
        clock.set_child_at_index(date, stock.dateIndex);
        [clock, date, time, hint].forEach((actor, index) => (actor.style = stock.styles[index]));
        for (const line of [date, time, hint])
            line.translation_y = 0;
        clock._updateClock();
    }

    // For when the screen has been unlocked. User Themes is back by then and has loaded its
    // theme itself, and the lock screen is sliding away: GNOME destroys it and builds a new one
    // next time. So its parts are let go of as they are; putting them back would show as a jump.
    _letGo() {
        if (this._themeId) {
            this._themeContext.disconnect(this._themeId);
            this._themeId = null;
        }
        if (this._activeId) {
            Main.screenShield.disconnect(this._activeId);
            this._activeId = null;
        }
        if (this._ownTheme && Main.getThemeStylesheet() === this._ownTheme) {
            Main.setThemeStylesheet(null);
            Main.loadTheme();
        }
        this._ownTheme = null;
        this._letGoOfParts();
    }

    _letGoOfParts() {
        if (!this._parts)
            return;
        const {dialog, stack, time} = this._parts;
        dialog.disconnect(this._destroyId);
        this._destroyId = null;
        if (this._textId) {
            time.disconnect(this._textId);
            this._textId = null;
        }
        if (this._allocationId) {
            stack.disconnect(this._allocationId);
            this._allocationId = null;
        }
        delete dialog._updateBackgroundEffects;
        this._parts = null;
        this._stock = null;
    }

    // While the screen is locked and no shell theme is loaded, load the desktop's. That is the
    // case right after locking, and again whenever something takes the theme away.
    _keepDesktopTheme() {
        if (!this._settings.get_boolean('desktop-theme') || Main.getThemeStylesheet() !== null)
            return;
        const file = desktopThemeFile();
        if (!file)
            return;
        Main.setThemeStylesheet(file.get_path());
        Main.loadTheme();
        this._ownTheme = Main.getThemeStylesheet();
    }

    // GNOME blackens a screen locked by hand at once, and lets the display go off while it is
    // black. A Mac shows its lock screen instead. This lifts that fade, as moving the mouse does.
    // GNOME's screen saver stays active, so the display still goes off after 30 seconds without
    // input (gnome-settings-daemon), and a screen that went black because it was left idle (the
    // long fade) stays black.
    _showLockScreen() {
        const fades = screenShieldFades();
        if (fades?.shield.active && !fades.long.active && fades.short.active)
            fades.short.lightOff();
    }

    // "4:25 PM" becomes "4:25": the digits and what stands between them. GNOME writes the time
    // anew every minute, and that is when this runs again.
    _trimTime() {
        const {time} = this._parts;
        const digits = time.text.replace(/^[^\p{Nd}]+|[^\p{Nd}]+$/gu, '');
        if (digits !== '' && digits !== time.text)
            time.text = digits;
    }

    // The clock is the top of a box that GNOME places a third of the way down the screen, or in
    // its middle, and higher when there are many notifications. This shifts the clock's lines up
    // to the chosen height, never down, and only where they are painted: the layout, and with it
    // the password prompt, stays where GNOME put it.
    _liftClock() {
        const {stack, date, time, hint} = this._parts;
        const monitor = Main.layoutManager.primaryMonitor;
        const box = stack.get_allocation_box();
        if (!monitor || box.y2 <= box.y1)
            return;
        const shift = Math.min(0, Math.round(monitor.height * this._clockTop - box.y1));
        for (const line of [date, time, hint]) {
            if (line.translation_y !== shift)
                line.translation_y = shift;
        }
    }
}
