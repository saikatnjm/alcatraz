// ---- preferences window ----------------------------------------------------------------------
//
// Plain libadwaita 1.1 widgets only, so the same code runs from GNOME 42 to today.
// The header supplies Adw, Gio, Gtk and _ (gettext); see tools/build.sh.

function alcatrazSwitchRow(settings, key, title, subtitle) {
    const row = new Adw.ActionRow({title, subtitle});
    const toggle = new Gtk.Switch({valign: Gtk.Align.CENTER});
    settings.bind(key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
    row.add_suffix(toggle);
    row.activatable_widget = toggle;
    return row;
}

// A row that only counts while the switch stored under `switchKey` is on.
function alcatrazNumberRow(settings, key, switchKey, title, subtitle, min, max) {
    const row = new Adw.ActionRow({title, subtitle});
    const spin = Gtk.SpinButton.new_with_range(min, max, 1);
    spin.valign = Gtk.Align.CENTER;
    settings.bind(key, spin, 'value', Gio.SettingsBindFlags.DEFAULT);
    settings.bind(switchKey, row, 'sensitive', Gio.SettingsBindFlags.GET);
    row.add_suffix(spin);
    row.activatable_widget = spin;
    return row;
}

function alcatrazTextRow(settings, key, switchKey, title, subtitle, placeholder) {
    const row = new Adw.ActionRow({title, subtitle});
    const entry = new Gtk.Entry({valign: Gtk.Align.CENTER, placeholder_text: placeholder, width_chars: 18});
    settings.bind(key, entry, 'text', Gio.SettingsBindFlags.DEFAULT);
    settings.bind(switchKey, row, 'sensitive', Gio.SettingsBindFlags.GET);
    row.add_suffix(entry);
    row.activatable_widget = entry;
    return row;
}

function alcatrazLinkRow(title, subtitle, uri) {
    const row = new Adw.ActionRow({title, subtitle});
    const button = new Gtk.LinkButton({label: _('Open'), uri, valign: Gtk.Align.CENTER});
    row.add_suffix(button);
    row.activatable_widget = button;
    return row;
}

function fillAlcatrazPreferences(window, settings, metadata) {
    const page = new Adw.PreferencesPage();

    const locking = new Adw.PreferencesGroup({
        title: _('Locking'),
        description: _('Changes show the next time the screen locks (Super+L).'),
    });
    locking.add(alcatrazSwitchRow(settings, 'keep-screen-on',
        _('Show the lock screen right away'),
        _('As on a Mac. Off: GNOME turns the screen black at once. Either way the display goes off after 30 seconds without input.')));
    page.add(locking);

    const theme = new Adw.PreferencesGroup({title: _('Theme')});
    theme.add(alcatrazSwitchRow(settings, 'desktop-theme',
        _('Keep the desktop\'s theme'),
        _('GNOME drops a shell theme set with User Themes while the screen is locked. This keeps it.')));
    page.add(theme);

    const wallpaper = new Adw.PreferencesGroup({title: _('Wallpaper')});
    wallpaper.add(alcatrazSwitchRow(settings, 'change-wallpaper',
        _('Change how the wallpaper shows'), _('Off leaves it blurred and dark, as GNOME shows it')));
    wallpaper.add(alcatrazNumberRow(settings, 'wallpaper-blur', 'change-wallpaper',
        _('Blur'), _('0 is sharp. GNOME\'s own is 45 to 60'), 0, 100));
    wallpaper.add(alcatrazNumberRow(settings, 'wallpaper-brightness', 'change-wallpaper',
        _('Brightness'), _('100 shows the picture as it is. GNOME\'s own is 55 to 65'), 0, 100));
    page.add(wallpaper);

    const clock = new Adw.PreferencesGroup({title: _('Clock')});
    clock.add(alcatrazSwitchRow(settings, 'date-above-time',
        _('Date above the time'), _('Off leaves the date below it')));
    clock.add(alcatrazSwitchRow(settings, 'hide-am-pm',
        _('Hide AM and PM'), _('Shows only the digits, as in 4:25')));
    clock.add(alcatrazSwitchRow(settings, 'move-clock',
        _('Move the clock up'), _('Off leaves it where GNOME puts it')));
    clock.add(alcatrazNumberRow(settings, 'clock-top', 'move-clock',
        _('Distance from the top'), _('In percent of the screen\'s height'), 0, 40));
    clock.add(alcatrazSwitchRow(settings, 'style-clock',
        _('Style the clock'), _('Bold white letters with a soft shadow, in the sizes below')));
    clock.add(alcatrazNumberRow(settings, 'time-size', 'style-clock',
        _('Size of the time'), _('In points'), 24, 200));
    clock.add(alcatrazNumberRow(settings, 'date-size', 'style-clock',
        _('Size of the date'), _('In points'), 8, 72));
    clock.add(alcatrazTextRow(settings, 'clock-font', 'style-clock',
        _('Font'), _('The name of a font family. Empty uses the desktop\'s font'), _('Same as the desktop')));
    page.add(clock);

    const about = new Adw.PreferencesGroup({title: _('About')});
    about.add(alcatrazLinkRow(_('Website'), _('Pictures, questions and answers, and where to report a problem'), metadata.url));
    page.add(about);

    window.add(page);
}
