// Theme the page-side Hypothesis toolbar. It is rendered in a shadow root on
// the host page, so these variables must be set on the shadow host itself.
/** @typedef {'nord' | 'catppuccin' | 'tokyo-night-dark' | 'tokyo-night-light'} ThemeName */
/** @typedef {{scheme: 'dark' | 'light', surface: string, raised: string, border: string, muted: string, text: string, accent: string, accentStrong: string}} ThemePalette */

/** @type {Record<ThemeName, ThemePalette>} */
const palettes = {
  nord: {
    scheme: 'dark',
    surface: '#2e3440',
    raised: '#3b4252',
    border: '#434c5e',
    muted: '#d8dee9',
    text: '#eceff4',
    accent: '#88c0d0',
    accentStrong: '#8fbcbb',
  },
  catppuccin: {
    scheme: 'dark',
    surface: '#1e1e2e',
    raised: '#313244',
    border: '#585b70',
    muted: '#bac2de',
    text: '#cdd6f4',
    accent: '#cba6f7',
    accentStrong: '#b4befe',
  },
  'tokyo-night-dark': {
    scheme: 'dark',
    surface: '#1a1b26',
    raised: '#24283b',
    border: '#414868',
    muted: '#a9b1d6',
    text: '#c0caf5',
    accent: '#7aa2f7',
    accentStrong: '#bb9af7',
  },
  'tokyo-night-light': {
    scheme: 'light',
    surface: '#d5d6db',
    raised: '#e9e9ed',
    border: '#9699a3',
    muted: '#4c505e',
    text: '#343b58',
    accent: '#34548a',
    accentStrong: '#5a4a78',
  },
};

/** @param {ThemePalette} palette */
const propertiesFor = palette => ({
  '--color-white': palette.surface,
  '--color-black': '#000000',
  '--color-gray-300': palette.border,
  '--color-grey-0': palette.surface,
  '--color-grey-1': palette.raised,
  '--color-grey-2': palette.raised,
  '--color-grey-3': palette.border,
  '--color-grey-4': palette.border,
  '--color-grey-5': palette.muted,
  '--color-grey-6': palette.muted,
  '--color-grey-7': palette.text,
  '--color-grey-8': palette.text,
  '--color-grey-9': palette.text,
  '--color-slate-0': palette.surface,
  '--color-slate-1': palette.raised,
  '--color-slate-50': palette.surface,
  '--color-slate-100': palette.raised,
  '--color-slate-3': palette.border,
  '--color-slate-300': palette.border,
  '--color-slate-400': palette.border,
  '--color-slate-5': palette.muted,
  '--color-slate-500': palette.muted,
  '--color-slate-600': palette.muted,
  '--color-slate-7': palette.text,
  '--color-slate-700': palette.text,
  '--color-slate-800': palette.text,
  '--color-slate-9': palette.text,
  '--color-color-text': palette.text,
  '--color-color-text-light': palette.muted,
  '--color-color-text-inverted': palette.surface,
  '--color-brand': palette.accent,
  '--color-brand-dark': palette.accentStrong,
  '--color-blue-focus': palette.accent,
});

const tokenNames = Object.keys(propertiesFor(palettes.nord));
const extensionGlobals = /** @type {any} */ (globalThis);
const extensionAPI = extensionGlobals.browser ?? extensionGlobals.chrome;
const storage = extensionAPI?.storage;

if (storage?.sync && storage.onChanged) {
  /** @type {ThemeName | 'default'} */
  let currentTheme = 'default';
  /** @type {HTMLLinkElement | null} */
  let sidebarLink = null;
  const observer = new MutationObserver(watchForSidebar);

  function applyTheme() {
    const palette =
      currentTheme === 'default' ? undefined : palettes[currentTheme];
    const sidebars = /** @type {NodeListOf<HTMLElement>} */ (
      document.querySelectorAll('hypothesis-sidebar')
    );
    sidebars.forEach(sidebar => {
      if ((sidebar.dataset.hypothesisTheme ?? 'default') === currentTheme) {
        return;
      }

      if (!palette) {
        tokenNames.forEach(name => sidebar.style.removeProperty(name));
        sidebar.style.removeProperty('color-scheme');
        delete sidebar.dataset.hypothesisTheme;
        return;
      }

      Object.entries(propertiesFor(palette)).forEach(([name, value]) => {
        sidebar.style.setProperty(name, value);
      });
      sidebar.style.colorScheme = palette.scheme;
      sidebar.dataset.hypothesisTheme = currentTheme;
    });
  }

  /** @param {unknown} value */
  function setTheme(value) {
    currentTheme = isThemeName(value) ? value : 'default';
    applyTheme();
  }

  /** @param {unknown} value @returns {value is ThemeName} */
  function isThemeName(value) {
    return (
      value === 'nord' ||
      value === 'catppuccin' ||
      value === 'tokyo-night-dark' ||
      value === 'tokyo-night-light'
    );
  }

  function stop() {
    observer.disconnect();
    storage.onChanged.removeListener(onStorageChanged);
  }

  /**
   * @param {{sidebarTheme?: {newValue?: unknown}}} changes
   * @param {string} areaName
   */
  function onStorageChanged(changes, areaName) {
    if (areaName === 'sync' && changes.sidebarTheme) {
      setTheme(changes.sidebarTheme.newValue);
    }
  }

  function watchForSidebar() {
    const link = /** @type {HTMLLinkElement | null} */ (
      document.querySelector(
        'link[type="application/annotator+html"][rel="sidebar"]',
      )
    );
    if (link && link !== sidebarLink) {
      sidebarLink = link;
      sidebarLink.addEventListener('destroy', stop, { once: true });
    }
    applyTheme();
    if (document.querySelector('hypothesis-sidebar')) {
      observer.disconnect();
    }
  }

  /** @param {{sidebarTheme?: unknown}} preferences */
  const onStorageGet = ({ sidebarTheme }) => setTheme(sidebarTheme);
  const defaultSettings = { sidebarTheme: 'default' };

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  storage.onChanged.addListener(onStorageChanged);
  if (extensionGlobals.browser?.storage) {
    storage.sync
      .get(defaultSettings)
      .then(onStorageGet)
      .catch(() => {});
  } else {
    storage.sync.get(defaultSettings, onStorageGet);
  }
  watchForSidebar();
}
