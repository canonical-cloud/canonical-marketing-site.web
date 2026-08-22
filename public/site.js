const APP_SCHEME = 'https';
const APP_HOST = 'app.canonical.plus';
const APP_ORIGIN = [APP_SCHEME, APP_HOST].join('://');
const READINESS_PATH = '/u/quote';
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
  window.addEventListener(
    'scroll',
    () => {
      nav.style.borderBottomColor = window.scrollY > 10
        ? 'rgba(255,255,255,0.1)'
        : 'rgba(255,255,255,0.06)';
    },
    { passive: true },
  );
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
