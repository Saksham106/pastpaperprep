export function createThemeInitScript(allowPreference: boolean) {
  return `
(function () {
  var allowPreference = ${allowPreference ? "true" : "false"};
  function storedTheme() {
    if (!allowPreference) return null;
    try {
      var stored = window.localStorage.getItem("pastpaperprep-theme");
      return stored === "light" || stored === "dark" ? stored : null;
    } catch (error) {
      return null;
    }
  }
  function applyTheme() {
    document.documentElement.dataset.theme = storedTheme() || "light";
  }
  applyTheme();
})();
`;
}

export const THEME_INIT_SCRIPT = createThemeInitScript(true);
