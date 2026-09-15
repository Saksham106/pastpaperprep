export function createThemeInitScript(allowPreference: boolean) {
  return `
(function () {
  var allowPreference = ${allowPreference ? "true" : "false"};
  var stored = null;
  try { stored = window.localStorage.getItem("pastpaperprep-theme"); } catch {}
  document.documentElement.dataset.theme = allowPreference && (stored === "dark" || stored === "light") ? stored : "light";
})();
`;
}

export const THEME_INIT_SCRIPT = createThemeInitScript(false);
