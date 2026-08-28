export function createThemeInitScript(allowPreference: boolean) {
  return `
(function () {
  var allowPreference = ${allowPreference ? "true" : "false"};
  var media = window.matchMedia("(prefers-color-scheme: dark)");
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
    document.documentElement.dataset.theme = storedTheme() || (media.matches ? "dark" : "light");
  }
  applyTheme();
  if (media.addEventListener) media.addEventListener("change", applyTheme);
})();
`;
}

export const THEME_INIT_SCRIPT = createThemeInitScript(true);
