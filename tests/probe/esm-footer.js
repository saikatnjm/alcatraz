
// GNOME switches this probe off and on with the other extensions; it must start only once.
let started = false;

export default class AlcatrazProbeExtension extends Extension {
    enable() {
        if (started)
            return;
        started = true;
        new AlcatrazProbe().start();
    }

    disable() {}
}
