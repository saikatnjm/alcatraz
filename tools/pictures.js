// Makes the pictures for the README, the website and extensions.gnome.org from the output folders
// of tests/run.sh, and the icon from docs/assets/logo.svg.
//
//   gjs tools/pictures.js <run with Alcatraz> <run without Alcatraz> <run for the password page>
//
// Each folder is the output of one test run: tests/run.sh, or the same run with
// ALCATRAZ_TEST_BASELINE=1 for GNOME's own lock screen. The pictures are only made smaller and
// cut out: nothing in them is changed. Use runs that show no one's name or face: a test shell
// on your own computer shows your own account on the password page; one in a container does not.
const {GdkPixbuf, GLib} = imports.gi;

const [withRun, withoutRun, passwordRun] = ARGV;
if (!passwordRun) {
    printerr('usage: gjs tools/pictures.js <run with Alcatraz> <run without Alcatraz> <run for the password page>');
    imports.system.exit(2);
}
const assets = GLib.build_filenamev([GLib.get_current_dir(), 'docs', 'assets']);
GLib.mkdir_with_parents(assets, 0o755);

function load(folder, name) {
    return GdkPixbuf.Pixbuf.new_from_file(GLib.build_filenamev([folder, name]));
}

function save(pixbuf, name) {
    const path = GLib.build_filenamev([assets, name]);
    if (name.endsWith('.jpg'))
        pixbuf.savev(path, 'jpeg', ['quality'], ['88']);
    else
        pixbuf.savev(path, 'png', [], []);
    print(`wrote docs/assets/${name} (${pixbuf.width} x ${pixbuf.height})`);
}

function smaller(pixbuf, width) {
    return pixbuf.scale_simple(width, Math.round(pixbuf.height * width / pixbuf.width), GdkPixbuf.InterpType.HYPER);
}

const lockScreen = load(withRun, '2-lock-clock.png');
save(smaller(lockScreen, 1280), 'lock-screen.jpg');
save(lockScreen, 'screenshot.jpg');
save(smaller(load(withoutRun, 'baseline-lock-clock.png'), 1280), 'gnome-lock-screen.jpg');
save(smaller(load(passwordRun, '3-lock-prompt.png'), 1280), 'password.jpg');

// The settings window, cut out where the test found it.
const [, bytes] = GLib.file_get_contents(GLib.build_filenamev([withRun, 'report.json']));
const [x, y, width, height] = JSON.parse(new TextDecoder().decode(bytes)).notes.settingsWindow;
save(load(withRun, '8-settings.png').new_subpixbuf(x, y, width, height), 'settings.png');

for (const size of [512, 128]) {
    const icon = GdkPixbuf.Pixbuf.new_from_file_at_size(GLib.build_filenamev([assets, 'logo.svg']), size, size);
    save(icon, `logo-${size}.png`);
}
