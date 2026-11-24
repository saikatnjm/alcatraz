
// ---- entry point (GNOME Shell 42-44) ---------------------------------------------------------

class AlcatrazExtension {
    enable() {
        this._look = new LockScreenLook(ExtensionUtils.getSettings());
    }

    disable() {
        // Session mode "unlock-dialog": this extension changes how the lock screen looks, so it
        // stays on while the screen is locked. It connects no keyboard signals. If it is switched
        // off while the screen is locked, destroy() puts the lock screen that is showing back
        // the way GNOME made it.
        this._look.destroy();
        this._look = null;
    }
}

function init() {
    return new AlcatrazExtension();
}
