
// GNOME switches this probe off and on with the other extensions; it must start only once.
let started = false;

function init() {
    return {
        enable() {
            if (started)
                return;
            started = true;
            new AlcatrazProbe().start();
        },
        disable() {},
    };
}
