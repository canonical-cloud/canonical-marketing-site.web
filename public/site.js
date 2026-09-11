const APP_SCHEME = 'https';
const APP_HOST = 'app.canonical.plus';
const APP_ORIGIN = [APP_SCHEME, APP_HOST].join('://');
const READINESS_PATH = '/u/readiness';
const readinessUrl = new URL(READINESS_PATH, APP_ORIGIN);
const signInUrl = new URL(READINESS_PATH, APP_ORIGIN);

const configureApplicationLinks = () => {
  for (const link of document.querySelectorAll('[data-application-link]')) {
    if (!(link instanceof HTMLAnchorElement)) {
      continue;
    }

    const kind = link.dataset.applicationLink;
    link.href = kind === 'sign-in' ? signInUrl.href : readinessUrl.href;
    link.rel = 'noopener';
  }
};

configureApplicationLinks();

const nav = document.getElementById('main-nav');

if (nav) {
  const updateNavigationElevation = () => {
    nav.classList.toggle('nav--scrolled', window.scrollY > 10);
  };

  updateNavigationElevation();
  window.addEventListener(
    'scroll',
    updateNavigationElevation,
    { passive: true },
  );
}

const themeController = window.canonicalTheme;

if (themeController) {
  const themeButtons = document.querySelectorAll('[data-theme-choice]');
  const themeStatuses = document.querySelectorAll('[data-theme-status]');

  const synchronizeThemeControls = () => {
    const { theme, themePreference } = document.documentElement.dataset;

    for (const button of themeButtons) {
      if (!(button instanceof HTMLButtonElement)) {
        continue;
      }

      const selected = button.dataset.themeChoice === themePreference;
      button.setAttribute('aria-pressed', String(selected));
    }

    const status = themePreference === 'auto'
      ? `Auto · ${theme} from local time`
      : `${theme[0].toUpperCase()}${theme.slice(1)} · manual`;

    for (const node of themeStatuses) {
      node.textContent = status;
    }
  };

  for (const button of themeButtons) {
    button.addEventListener('click', () => {
      themeController.apply(button.dataset.themeChoice, { persist: true });
      synchronizeThemeControls();
    });
  }

  window.addEventListener('storage', (event) => {
    if (event.key === themeController.storageKey) {
      themeController.apply(themeController.readPreference());
      synchronizeThemeControls();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && document.documentElement.dataset.themePreference === 'auto') {
      themeController.apply('auto');
      synchronizeThemeControls();
    }
  });

  window.setInterval(() => {
    if (document.documentElement.dataset.themePreference === 'auto') {
      themeController.apply('auto');
      synchronizeThemeControls();
    }
  }, 60_000);

  synchronizeThemeControls();
}

const skipLink = document.querySelector('.skip-link');
const mainContent = document.getElementById('main-content');

if (skipLink instanceof HTMLAnchorElement && mainContent instanceof HTMLElement) {
  skipLink.addEventListener('click', () => {
    mainContent.focus({ preventScroll: true });
  });
}

const toggle = document.getElementById('nav-toggle');
const links = document.getElementById('nav-links');
const mobileNavigation = window.matchMedia('(max-width: 768px)');

if (toggle && links) {
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', links.id);

  const setNavigationOpen = (open, { restoreFocus = false } = {}) => {
    const nextOpen = Boolean(open && mobileNavigation.matches);
    links.classList.toggle('nav__links--open', nextOpen);
    toggle.setAttribute('aria-expanded', String(nextOpen));
    toggle.setAttribute('aria-label', nextOpen ? 'Close navigation' : 'Open navigation');

    if (restoreFocus) {
      toggle.focus();
    }
  };

  setNavigationOpen(false);

  toggle.addEventListener('click', () => {
    setNavigationOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  links.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      setNavigationOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setNavigationOpen(false, { restoreFocus: true });
    }
  });

  mobileNavigation.addEventListener('change', () => setNavigationOpen(false));
}
