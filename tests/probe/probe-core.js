// ---- Alcatraz test probe ---------------------------------------------------------------------
//
// A second, test-only extension. Inside a hidden, throwaway GNOME Shell it locks the screen,
// checks every part of the lock screen with Alcatraz on, off and set in other ways, unlocks
// again each time, and writes pictures and a report into $ALCATRAZ_PROBE_OUT. Then it quits
// the shell. tests/run.sh starts the shell and reads the report. It is never installed for users.
//
// The header supplies: Clutter, Gio, GLib, Pango, Shell, St, Main, Config and AuthPrompt (the
// module that holds the password prompt's class).

const UUID = 'alcatraz@saikatnjm.github.io';
const SCHEMA = 'org.gnome.shell.extensions.alcatraz';
const USER_THEMES = 'user-theme@gnome-shell-extensions.gcampax.github.com';
const STATE_ACTIVE = 1;          // ExtensionState.ENABLED (called ACTIVE since GNOME 46)

function probeSleep(milliseconds) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

function probeScreenshot(path) {
    return new Promise(resolve => {
        try {
            const stream = Gio.File.new_for_path(path).replace(null, false, Gio.FileCreateFlags.NONE, null);
            new Shell.Screenshot().screenshot(false, stream, (shot, result) => {
                let ok = false;
                try {
                    shot.screenshot_finish(result);
                    stream.close(null);
                    ok = true;
                } catch (e) {
                    log(`alcatraz-probe: screenshot failed: ${e}`);
                }
                resolve(ok);
            });
        } catch (e) {
            log(`alcatraz-probe: screenshot failed: ${e}`);
            resolve(false);
        }
    });
}

const DEFAULTS = {
    'desktop-theme': true,
    'change-wallpaper': true,
    'wallpaper-blur': 0,
    'wallpaper-brightness': 85,
    'date-above-time': true,
    'hide-am-pm': true,
    'move-clock': true,
    'clock-top': 12,
    'style-clock': true,
    'time-size': 96,
    'date-size': 20,
    'clock-font': '',
};

class AlcatrazProbe {
    constructor() {
        this._out = GLib.getenv('ALCATRAZ_PROBE_OUT') || GLib.get_tmp_dir();
        // The stylesheet of the shell theme the test desktop is set to use; empty for none.
        this._themeCss = GLib.getenv('ALCATRAZ_PROBE_THEME_CSS') || null;
        this._report = {shell: Config.PACKAGE_VERSION, mode: Main.sessionMode.currentMode, checks: [], notes: {dressCalls: []}};
        this._dressCalls = [];
    }

    start() {
        this._run().catch(e => {
            this._check('the probe ran to its end', false, `${e}\n${e.stack ?? ''}`);
        }).then(() => this._finish());
    }

    _finish() {
        this._save();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            global.context.terminate();
            return GLib.SOURCE_REMOVE;
        });
    }

    _save() {
        try {
            GLib.file_set_contents(`${this._out}/report.json`, JSON.stringify(this._report, null, 2));
        } catch (e) {
            log(`alcatraz-probe: could not write the report: ${e}`);
        }
    }

    // Marks the shell log, so that a warning in it can be told to belong to a step of the test.
    _step(name) {
        log(`alcatraz-probe: ---- ${name}`);
        this._stepName = name;
    }

    _check(name, ok, detail) {
        this._report.checks.push({name, ok: Boolean(ok), detail: detail === undefined ? '' : String(detail)});
        this._save();
    }

    _extension() {
        return Main.extensionManager.lookup(UUID);
    }

    _settings() {
        const folder = this._extension().dir.get_child('schemas').get_path();
        const source = Gio.SettingsSchemaSource.new_from_directory(folder, Gio.SettingsSchemaSource.get_default(), false);
        return new Gio.Settings({settings_schema: source.lookup(SCHEMA, true)});
    }

    _set(settings, values) {
        for (const [key, value] of Object.entries({...DEFAULTS, ...values})) {
            if (typeof value === 'boolean')
                settings.set_boolean(key, value);
            else if (typeof value === 'number')
                settings.set_int(key, value);
            else
                settings.set_string(key, value);
        }
    }

    // Everything about how the lock screen looks right now, as plain values.
    _look() {
        const theme = Main.getThemeStylesheet();
        const dialog = Main.screenShield._dialog;
        const look = {
            mode: Main.sessionMode.currentMode,
            theme: theme ? theme.get_path() : null,
            dialog: Boolean(dialog),
        };
        if (!dialog)
            return look;
        const clock = dialog._clock;
        const date = clock._date, time = clock._time, hint = clock._hint;
        const name = child => child === date ? 'date' : child === time ? 'time' : child === hint ? 'hint' : '?';
        const font = label => {
            const description = label.get_theme_node().get_font();
            return {family: description.get_family(), size: Math.round(description.get_size() / Pango.SCALE)};
        };
        const effect = dialog._backgroundGroup.get_children()[0]?.get_effect('blur');
        const box = dialog._stack.get_allocation_box();
        const prompt = dialog._promptBox;
        Object.assign(look, {
            order: clock.get_children().map(name).join(','),
            time: time.text,
            shifts: [date, time, hint].map(label => label.translation_y),
            styled: [clock, date, time, hint].map(actor => Boolean(actor.style)),
            dateY: Math.round(date.get_transformed_position()[1]),
            timeY: Math.round(time.get_transformed_position()[1]),
            timeFont: font(time),
            dateFont: font(date),
            wallpapers: dialog._backgroundGroup.get_n_children(),
            blur: effect ? effect.radius ?? effect.sigma : null,
            blurIsRadius: effect ? effect.radius !== undefined : null,
            brightness: effect ? Math.round(effect.brightness * 100) : null,
            ownEffects: Object.prototype.hasOwnProperty.call(dialog, '_updateBackgroundEffects'),
            stackY: Math.round(box.y1),
            page: dialog._activePage === prompt ? 'prompt' : dialog._activePage === clock ? 'clock' : '?',
            clockVisible: clock.visible,
            promptVisible: prompt.visible,
            promptOpacity: prompt.opacity,
            promptShift: prompt.translation_y,
            promptY: Math.round(prompt.get_transformed_position()[1]),
        });
        return look;
    }

    // The checks for a lock screen dressed with the given settings.
    _expectDressed(label, values = {}) {
        const s = {...DEFAULTS, ...values};
        const look = this._look();
        const height = Main.layoutManager.primaryMonitor.height;
        const detail = JSON.stringify(look);
        const check = (name, ok) => this._check(`${label}: ${name}`, ok, detail);

        check('the screen is locked and shows the lock screen', look.mode === 'unlock-dialog' && look.dialog);
        if (!look.dialog)
            return look;
        if (this._themeCss) {
            if (s['desktop-theme'])
                check('the desktop\'s shell theme is loaded', look.theme === this._themeCss);
            else
                check('no shell theme is loaded (the switch is off)', look.theme === null);
        } else {
            check('no shell theme is loaded (the desktop has none)', look.theme === null);
        }
        if (s['change-wallpaper']) {
            const blur = look.blurIsRadius ? 2 * s['wallpaper-blur'] : s['wallpaper-blur'];
            check(`the wallpaper has blur ${s['wallpaper-blur']} and brightness ${s['wallpaper-brightness']}`,
                look.blur === blur && look.brightness === s['wallpaper-brightness'] && look.ownEffects);
        } else {
            check('the wallpaper is as GNOME shows it', look.blur > 0 && look.brightness < 70 && !look.ownEffects);
        }
        check(s['date-above-time'] ? 'the date stands above the time' : 'the time stands above the date',
            look.order === (s['date-above-time'] ? 'date,time,hint' : 'time,date,hint'));
        if (s['hide-am-pm'])
            check('the time shows digits only', /^\p{Nd}.*\p{Nd}$/u.test(look.time) && !/\p{L}/u.test(look.time));
        else
            check('the time still says AM or PM', /\p{L}/u.test(look.time));
        if (s['move-clock']) {
            const top = Math.round(height * s['clock-top'] / 100);
            const first = s['date-above-time'] ? look.dateY : look.timeY;
            check(`the clock starts at ${s['clock-top']} % of the screen's height (${top} px)`,
                Math.abs(first - top) <= 1 && look.shifts.every(shift => shift === look.shifts[0] && shift <= 0));
        } else {
            check('the clock is where GNOME puts it', look.shifts.every(shift => shift === 0));
        }
        if (s['style-clock']) {
            const family = s['clock-font'] || Pango.FontDescription.from_string(St.Settings.get().font_name).get_family();
            // Sizes in the report are in pixels: a point is 96/72 of a pixel on a plain screen.
            const px = points => Math.round(points * 96 / 72);
            check(`the time is ${s['time-size']} pt and the date ${s['date-size']} pt, in ${family}`,
                look.styled.every(Boolean) && Math.abs(look.timeFont.size - px(s['time-size'])) <= 1 &&
                Math.abs(look.dateFont.size - px(s['date-size'])) <= 1 &&
                look.timeFont.family === family && look.dateFont.family === family);
        } else {
            check('the clock is written as the theme says', look.styled.every(styled => !styled));
        }
        return look;
    }

    // The checks for a lock screen that is exactly as GNOME made it.
    _expectStock(label, theme = null) {
        const look = this._look();
        const detail = JSON.stringify(look);
        const check = (name, ok) => this._check(`${label}: ${name}`, ok, detail);
        check('the screen is locked and shows the lock screen', look.mode === 'unlock-dialog' && look.dialog);
        if (!look.dialog)
            return look;
        check(theme ? 'the theme is the one that was there' : 'no shell theme is loaded', look.theme === theme);
        check('the time stands above the date', look.order === 'time,date,hint');
        check('the time says AM or PM again', /\p{L}/u.test(look.time));
        check('the clock is where GNOME puts it', look.shifts.every(shift => shift === 0));
        check('the clock is written as the theme says', look.styled.every(styled => !styled));

        // GNOME's own values for the wallpaper: what its own method sets, and nothing of ours in its way.
        const dialog = Main.screenShield._dialog;
        dialog._updateBackgroundEffects();
        const again = this._look();
        check('the wallpaper is blurred and dimmed by GNOME\'s own values',
            !look.ownEffects && look.blur > 0 && look.brightness < 70 && again.blur === look.blur && again.brightness === look.brightness);
        return look;
    }

    async _lock() {
        Main.screenShield.lock(false);
        await probeSleep(1200);
        // A locked screen is blank until someone moves the mouse: do what that does.
        Main.screenShield._longLightbox.lightOff();
        Main.screenShield._shortLightbox.lightOff();
        await probeSleep(900);
    }

    async _unlock(label) {
        Main.screenShield.deactivate(false);
        await probeSleep(1500);
        const look = this._look();
        this._check(`${label}: unlocking works and the lock screen is gone`,
            look.mode !== 'unlock-dialog' && !look.dialog && !Main.sessionMode.isLocked, JSON.stringify(look));
        this._check(`${label}: back on the desktop the theme is the desktop's again`, look.theme === this._themeCss, JSON.stringify(look));
        return look;
    }

    async _picture(name) {
        if (GLib.getenv('ALCATRAZ_PROBE_PICTURES') === '0')
            return;
        await probeSleep(300);
        this._check(`picture ${name}.png was taken`, await probeScreenshot(`${this._out}/${name}.png`));
    }

    // Presses and releases a key the way a keyboard does.
    async _pressKey(keyval) {
        // GNOME 51 removed Clutter.get_default_backend(); there the backend comes from the stage.
        const backend = Clutter.get_default_backend?.() ?? global.stage.context.get_backend();
        const keyboard = backend.get_default_seat().create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        keyboard.notify_keyval(GLib.get_monotonic_time(), keyval, Clutter.KeyState.PRESSED);
        await probeSleep(80);
        keyboard.notify_keyval(GLib.get_monotonic_time(), keyval, Clutter.KeyState.RELEASED);
        await probeSleep(900);
    }

    // GNOME's own lock screen, without Alcatraz: locked, prompt up, back, unlocked, three times.
    // What the shell log says in this run is what it says by itself.
    async _baseline() {
        this._check('this run is without Alcatraz', !this._extension());
        for (const round of ['first', 'second', 'third']) {
            this._step(`baseline, ${round} lock`);
            await this._lock();
            const look = this._expectStock(`baseline, ${round} lock`);
            this._report.notes[`${round}Look`] = look;
            if (round === 'first')
                await this._picture('baseline-lock-clock');
            await this._pressKey(Clutter.KEY_Control_L);
            this._check(`baseline, ${round} lock: a key press brings up the password prompt`, this._look().page === 'prompt');
            if (round === 'first') {
                this._report.notes.promptY = this._look().promptY;
                Main.screenShield._dialog._authPrompt?.setQuestion?.('Password');
                await probeSleep(700);
                await this._picture('baseline-lock-prompt');
            }
            Main.screenShield._dialog._showClock();
            await probeSleep(900);
            await this._unlock(`baseline, ${round} lock`);
        }
    }

    async _run() {
        // Wait for GNOME Shell's start-up to be over; stock GNOME then shows the overview.
        for (let waited = 0; Main.layoutManager._startingUp && waited < 40; waited++)
            await probeSleep(500);
        await probeSleep(2500);
        if (Main.overview.visible) {
            Main.overview.hide();
            await probeSleep(1500);
        }

        // The test must not sign in for real, and must not mark the real login session as locked:
        // the password prompt is shown, never used.
        AuthPrompt.AuthPrompt.prototype.begin = function () {};
        const session = Main.screenShield._loginSession;
        if (session) {
            session.SetLockedHintRemote = () => {};
            session.SetLockedHintAsync = async () => {};
        }

        if (GLib.getenv('ALCATRAZ_PROBE_BASELINE') === '1') {
            await this._baseline();
            return;
        }

        const extension = this._extension();
        this._check('Alcatraz was found by the shell', Boolean(extension));
        if (!extension)
            return;
        this._check('Alcatraz is on and reported no error', extension.state === STATE_ACTIVE && !extension.error,
            `state ${extension.state}, error: ${extension.error ?? ''}`);
        if (extension.state !== STATE_ACTIVE)
            return;
        const settings = this._settings();
        const userThemes = Main.extensionManager.lookup(USER_THEMES);
        this._report.notes.userThemes = userThemes ? `${userThemes.path}, state ${userThemes.state}` : 'not installed';
        this._report.notes.themeCss = this._themeCss;
        this._report.notes.order = Main.extensionManager._extensionOrder.join(' ');
        if (this._themeCss) {
            this._check('on the desktop, User Themes shows the test theme', Main.getThemeStylesheet()?.get_path() === this._themeCss,
                `${Main.getThemeStylesheet()?.get_path()} (wanted ${this._themeCss})`);
        }
        this._check('nothing is waiting or connected while the screen is unlocked',
            !extension.stateObj._look._idleId && !extension.stateObj._look._themeId && !extension.stateObj._look._parts);
        await this._picture('1-desktop');

        // How long dressing the lock screen takes, and how often it happens: a stopwatch around
        // the method that does it.
        const lookClass = Object.getPrototypeOf(extension.stateObj._look);
        const dress = lookClass._dress;
        const probe = this;
        lookClass._dress = function () {
            const hadParts = Boolean(this._parts);
            const start = GLib.get_monotonic_time();
            dress.call(this);
            const call = {step: probe._stepName, ms: (GLib.get_monotonic_time() - start) / 1000, dressed: !hadParts && Boolean(this._parts)};
            probe._dressCalls.push(call);
            probe._report.notes.dressCalls.push(call);
        };
        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        let themeChanges = 0;
        const themeChangesId = themeContext.connect('changed', () => themeChanges++);

        // ---- 1. The first lock after logging in.
        this._step('first lock');
        await this._lock();
        this._report.notes.themeChangesAtFirstLock = themeChanges;
        this._check('first lock: the lock screen was dressed once',
            this._dressCalls.filter(call => call.dressed).length === 1, JSON.stringify(this._dressCalls));
        let look = this._expectDressed('first lock');
        this._check('first lock: Alcatraz is still on and reported no error',
            extension.state === STATE_ACTIVE && !extension.error, `state ${extension.state}, error: ${extension.error ?? ''}`);
        if (userThemes) {
            this._check('first lock: GNOME has switched User Themes off, as it does on a lock screen',
                userThemes.state !== STATE_ACTIVE, `state ${userThemes.state}`);
        }
        await this._picture('2-lock-clock');

        // A monitor that is plugged in makes GNOME build the wallpapers again.
        Main.screenShield._dialog._updateBackgrounds();
        look = this._look();
        this._check('first lock: wallpapers that GNOME builds anew get the same blur and brightness',
            look.blur === 0 && look.brightness === 85 && look.wallpapers > 0, JSON.stringify(look));

        // A key press brings up the password prompt, as on any lock screen. (Control, because
        // GNOME 51 types any printable key into the password field.)
        await this._pressKey(Clutter.KEY_Shift_L);
        look = this._look();
        this._check('first lock: Shift alone does not bring up the password prompt (GNOME ignores it)', look.page === 'clock', JSON.stringify(look));
        await this._pressKey(Clutter.KEY_Control_L);
        look = this._look();
        this._check('first lock: a key press brings up the password prompt', look.page === 'prompt' && look.promptVisible && !look.clockVisible,
            JSON.stringify(look));
        this._check('first lock: the password prompt is fully shown, where GNOME puts it',
            look.promptOpacity === 255 && look.promptShift === 0 && Boolean(Main.screenShield._dialog._authPrompt), JSON.stringify(look));
        const promptY = look.promptY;
        Main.screenShield._dialog._authPrompt?.setQuestion?.('Password');
        await probeSleep(700);
        await this._picture('3-lock-prompt');
        Main.screenShield._dialog._showClock();
        await probeSleep(900);
        this._expectDressed('first lock, back on the clock');

        // Off and on while locked. GNOME does this to an extension with every other extension
        // that was switched on before it and goes off for the lock screen; User Themes takes its
        // theme away in between.
        this._step('off and on three times while locked');
        for (let round = 0; round < 3; round++) {
            extension.stateObj.disable();
            Main.setThemeStylesheet(null);
            Main.loadTheme();
            extension.stateObj.enable();
        }
        await probeSleep(500);
        this._expectDressed('after switching off and on three times while locked');

        // Something takes the theme away while the screen stays locked.
        if (this._themeCss) {
            Main.setThemeStylesheet(null);
            Main.loadTheme();
            await probeSleep(200);
            this._check('a theme that is taken away while locked comes back', Main.getThemeStylesheet()?.get_path() === this._themeCss,
                `${Main.getThemeStylesheet()?.get_path()}`);
        }

        // Switched off for good while locked: the lock screen must be GNOME's own again.
        this._step('switched off while locked');
        extension.stateObj.disable();
        await probeSleep(500);
        this._expectStock('switched off while locked');
        const clock = Main.screenShield._dialog._clock;
        clock._time.text = '9:59 PM';
        Main.setThemeStylesheet(null);
        Main.loadTheme();
        await probeSleep(300);
        this._check('switched off while locked: nothing of Alcatraz reacts any more',
            clock._time.text === '9:59 PM' && Main.getThemeStylesheet() === null && !extension.stateObj._look,
            `${clock._time.text}, ${Main.getThemeStylesheet()?.get_path()}`);
        clock._updateClock();
        await this._picture('4-lock-switched-off');
        this._step('switched on again while locked');
        extension.stateObj.enable();
        await probeSleep(500);
        this._expectDressed('switched on again while locked');
        this._step('first unlock');
        await this._unlock('first lock');
        if (userThemes)
            this._check('first lock: User Themes is on again after unlocking', userThemes.state === STATE_ACTIVE, `state ${userThemes.state}`);
        this._check('after unlocking nothing is waiting or connected',
            !extension.stateObj._look._idleId && !extension.stateObj._look._themeId && !extension.stateObj._look._parts);
        await this._picture('5-unlocked');

        // ---- 2. A second lock.
        this._step('second lock');
        this._dressCalls.length = 0;
        await this._lock();
        this._expectDressed('second lock');
        this._check('second lock: the lock screen was dressed once',
            this._dressCalls.filter(call => call.dressed).length === 1, JSON.stringify(this._dressCalls));
        await this._unlock('second lock');

        // ---- 3. Every switch off: the lock screen must be exactly GNOME's.
        this._step('every switch off');
        this._set(settings, {
            'desktop-theme': false, 'change-wallpaper': false, 'date-above-time': false,
            'hide-am-pm': false, 'move-clock': false, 'style-clock': false,
        });
        await this._lock();
        this._expectStock('every switch off');
        await this._pressKey(Clutter.KEY_Control_L);
        look = this._look();
        this._check('the password prompt is in the same place with Alcatraz on and with every switch off',
            look.page === 'prompt' && look.promptY === promptY, `${look.promptY} px against ${promptY} px`);
        await this._picture('6-lock-every-switch-off');
        await this._unlock('every switch off');

        // ---- 4. Other values for everything.
        this._step('other values');
        const other = {
            'wallpaper-blur': 20, 'wallpaper-brightness': 50, 'date-above-time': false, 'hide-am-pm': false,
            'clock-top': 30, 'time-size': 60, 'date-size': 14, 'clock-font': 'Monospace',
        };
        this._set(settings, other);
        await this._lock();
        this._expectDressed('other values', other);
        await this._picture('7-lock-other-values');
        await this._unlock('other values');

        // ---- 5. Only the theme switch off.
        this._step('theme switch off');
        this._set(settings, {'desktop-theme': false});
        await this._lock();
        this._expectDressed('theme switch off', {'desktop-theme': false});
        await this._unlock('theme switch off');

        // ---- 6. A desktop without User Themes: there is no theme to keep.
        this._step('without User Themes');
        this._set(settings, {});
        if (userThemes) {
            const enabled = global.settings.get_strv('enabled-extensions');
            global.settings.set_strv('enabled-extensions', enabled.filter(uuid => uuid !== USER_THEMES));
            await probeSleep(1500);
            const themeCss = this._themeCss;
            this._themeCss = null;
            this._check('without User Themes the desktop shows GNOME\'s own theme', Main.getThemeStylesheet() === null);
            await this._lock();
            this._expectDressed('without User Themes');
            await this._unlock('without User Themes');
            global.settings.set_strv('enabled-extensions', enabled);
            await probeSleep(1500);
            this._themeCss = themeCss;
            this._check('User Themes is back on the desktop', Main.getThemeStylesheet()?.get_path() === themeCss,
                `${Main.getThemeStylesheet()?.get_path()}`);
        }

        // ---- 7. Switched off and on while the screen is unlocked.
        this._step('off and on while unlocked');
        extension.stateObj.disable();
        extension.stateObj.enable();
        await probeSleep(300);
        this._check('switching off and on while unlocked leaves nothing waiting or connected',
            !extension.stateObj._look._idleId && !extension.stateObj._look._themeId && !extension.stateObj._look._parts);
        this._check('Alcatraz is on at the end and reported no error', extension.state === STATE_ACTIVE && !extension.error,
            `state ${extension.state}, error: ${extension.error ?? ''}`);

        // ---- 8. The settings window, opened the way the Extensions app opens it.
        this._step('settings window');
        Main.extensionManager.openExtensionPrefs(UUID, '', {});
        let window = null;
        for (let i = 0; i < 24 && !window; i++) {
            await probeSleep(500);
            window = global.get_window_actors().map(actor => actor.meta_window).find(w => /alcatraz/i.test(w.get_title() ?? ''));
        }
        this._check('the settings window opened', Boolean(window), 'no window titled Alcatraz appeared');
        if (window) {
            await probeSleep(2500);
            const frame = window.get_frame_rect();
            this._report.notes.settingsWindow = [frame.x, frame.y, frame.width, frame.height];
            await this._picture('8-settings');
            window.delete(global.display.get_current_time_roundtrip());
            await probeSleep(800);
        }

        lookClass._dress = dress;
        themeContext.disconnect(themeChangesId);
    }
}
