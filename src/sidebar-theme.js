const themes = new Set([
  'default',
  'nord',
  'catppuccin',
  'tokyo-night-dark',
  'tokyo-night-light',
]);

/** @param {unknown} theme */
function applyTheme(theme) {
  document.documentElement.dataset.hypothesisTheme =
    typeof theme === 'string' && themes.has(theme) ? theme : 'default';
}

chrome.storage.sync.get({ sidebarTheme: 'default' }, ({ sidebarTheme }) => {
  applyTheme(sidebarTheme);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.sidebarTheme) {
    applyTheme(changes.sidebarTheme.newValue);
  }
});
