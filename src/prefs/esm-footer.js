
export default class AlcatrazPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        fillAlcatrazPreferences(window, this.getSettings(), this.metadata);
    }
}
