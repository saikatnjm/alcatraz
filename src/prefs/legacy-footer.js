
function init() {
    ExtensionUtils.initTranslations();
}

function fillPreferencesWindow(window) {
    fillAlcatrazPreferences(window, ExtensionUtils.getSettings(), Me.metadata);
}
