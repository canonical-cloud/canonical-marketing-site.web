(() => {
  const currentScriptSrc = document.currentScript?.src;
  if (currentScriptSrc && document.head && typeof document.createElement === 'function') {
    const existingBrandStyles = document.querySelector('link[data-canonical-brand-styles]');
    if (!existingBrandStyles) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = new URL('./brand-overrides.css?v=20261102-lmd-theme', currentScriptSrc).href;
      stylesheet.dataset.canonicalBrandStyles = 'true';
      document.head.append(stylesheet);
    }
  }

  const STORAGE_KEY = 'canonical-theme';
  const THEMES = new Set(['light', 'medium', 'dark']);
  const THEME_COLORS = {
    light: '#f3f7f5',
    medium: '#172033',
    dark: '#0a0f1a',
  };

  // First-visit default only: until the visitor picks light, medium, or dark,
  // the initial theme follows browser-local time. There is no "auto" choice.
  const localTimeTheme = (date = new Date()) => {
    const hour = date.getHours();

    if (hour >= 8 && hour < 17) {
      return 'light';
    }

    if ((hour >= 6 && hour < 8) || (hour >= 17 && hour < 21)) {
      return 'medium';
    }

    return 'dark';
  };

  const readPreference = () => {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return THEMES.has(value) ? value : localTimeTheme();
    } catch {
      return localTimeTheme();
    }
  };

  const persistPreference = (theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable in privacy-restricted contexts. The theme
      // still applies for the current page without weakening that boundary.
    }
  };

  const apply = (requestedTheme, options = {}) => {
    const theme = THEMES.has(requestedTheme) ? requestedTheme : localTimeTheme();
    const root = document.documentElement;

    root.dataset.theme = theme;
    root.style.colorScheme = theme === 'light' ? 'light' : 'dark';

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute('content', THEME_COLORS[theme]);
    }

    if (options.persist === true) {
      persistPreference(theme);
    }

    return { theme };
  };

  window.canonicalTheme = Object.freeze({
    apply,
    localTimeTheme,
    readPreference,
    storageKey: STORAGE_KEY,
  });

  apply(readPreference());
})();
