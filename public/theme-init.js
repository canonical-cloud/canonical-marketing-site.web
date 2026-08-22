(() => {
  const STORAGE_KEY = 'canonical-theme';
  const PREFERENCES = new Set(['auto', 'light', 'medium', 'dark']);
  const THEME_COLORS = {
    light: '#f3f7f5',
    medium: '#172033',
    dark: '#0a0f1a',
  };

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
      return PREFERENCES.has(value) ? value : 'auto';
    } catch {
      return 'auto';
    }
  };

  const persistPreference = (preference) => {
    try {
      if (preference === 'auto') {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, preference);
      }
    } catch {
      // Storage can be unavailable in privacy-restricted contexts. The theme
      // still applies for the current page without weakening that boundary.
    }
  };

  const apply = (requestedPreference, options = {}) => {
    const preference = PREFERENCES.has(requestedPreference) ? requestedPreference : 'auto';
    const theme = preference === 'auto' ? localTimeTheme() : preference;
    const root = document.documentElement;

    root.dataset.theme = theme;
    root.dataset.themePreference = preference;
    root.style.colorScheme = theme === 'light' ? 'light' : 'dark';

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute('content', THEME_COLORS[theme]);
    }

    if (options.persist === true) {
      persistPreference(preference);
    }

    return { preference, theme };
  };

  window.canonicalTheme = Object.freeze({
    apply,
    localTimeTheme,
    readPreference,
    storageKey: STORAGE_KEY,
  });

  apply(readPreference());
})();
