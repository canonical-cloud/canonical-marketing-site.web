const QUOTE_PATH = '/quote/';

const configureBrandStyles = () => {
  if (document.querySelector('link[data-canonical-brand-styles]')) return;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./brand-overrides.css', import.meta.url).href;
  stylesheet.dataset.canonicalBrandStyles = 'true';
  document.head.append(stylesheet);
};

configureBrandStyles();

const configureHeaderBranding = () => {
  const brand = document.getElementById('nav-logo');
  if (!(brand instanceof HTMLAnchorElement) || brand.dataset.brandLockup === 'true') return;

  const productMark = brand.querySelector('.nav__logo-icon');
  const productName = brand.querySelector('.nav__logo-text');
  if (!(productMark instanceof SVGElement) || !(productName instanceof HTMLElement)) return;

  brand.dataset.brandLockup = 'true';
  brand.classList.add('nav__brand-lockup');
  brand.setAttribute('aria-label', 'Canonical Cloud — canonical.plus home');

  const parentBrand = document.createElement('span');
  parentBrand.className = 'nav__parent-brand';

  const parentMark = document.createElement('img');
  parentMark.className = 'nav__parent-brand-mark';
  parentMark.src = new URL('./brand/canonical-cloud.svg', import.meta.url).href;
  parentMark.alt = '';
  parentMark.setAttribute('aria-hidden', 'true');
  parentMark.width = 38;
  parentMark.height = 38;

  const parentName = document.createElement('span');
  parentName.className = 'nav__parent-brand-name';
  parentName.textContent = 'CANONICAL CLOUD';
  parentBrand.append(parentMark, parentName);

  const productBrand = document.createElement('span');
  productBrand.className = 'nav__product-brand';
  productMark.classList.add('nav__product-brand-mark');
  productName.classList.add('nav__product-brand-name');
  productName.setAttribute('aria-label', 'canonical.plus product');
  productBrand.append(productMark, productName);

  brand.replaceChildren(parentBrand, productBrand);
};

configureHeaderBranding();

const configureApplicationLinks = () => {
  const quoteUrl = new URL(QUOTE_PATH, window.location.origin);
  for (const link of document.querySelectorAll('[data-application-link]')) {
    if (!(link instanceof HTMLAnchorElement)) continue;
    link.href = quoteUrl.href;
    link.removeAttribute('target');
    link.removeAttribute('rel');
  }
};

configureApplicationLinks();

const configurePeopleNavigation = () => {
  const readinessLink = document.getElementById('nav-services');
  const quoteLink = document.getElementById('nav-quote');
  if (!(readinessLink instanceof HTMLAnchorElement) || !(quoteLink instanceof HTMLAnchorElement)) return;
  if (document.getElementById('nav-people')) return;

  const peopleLink = document.createElement('a');
  peopleLink.id = 'nav-people';
  peopleLink.className = 'nav__link';
  peopleLink.textContent = 'People';
  peopleLink.href = new URL('../people/', readinessLink.href).href;
  quoteLink.before(peopleLink);
};

configurePeopleNavigation();

const configureSharedValueCopy = () => {
  const boundary = document.querySelector('.footer__boundary');
  if (boundary instanceof HTMLElement) {
    const heading = boundary.querySelector('strong');
    const copy = boundary.querySelector('span');
    if (heading) heading.textContent = 'Canonical supports readiness and pre-audit preparation.';
    if (copy) {
      copy.textContent = 'Scope frameworks, close control and evidence gaps, plan remediation, and prepare a clean handoff for the independent reviewer responsible for the formal decision.';
    }
  }

  const footerBrand = document.querySelector('.footer__brand');
  if (footerBrand instanceof HTMLElement && !footerBrand.querySelector('[data-prominent-contact]')) {
    const contact = document.createElement('a');
    contact.href = 'mailto:hello@canonical.plus';
    contact.textContent = 'hello@canonical.plus';
    contact.dataset.prominentContact = 'true';
    contact.className = 'footer__prominent-contact';
    footerBrand.append(contact);
  }

  const footerBottom = document.querySelectorAll('.footer__bottom .footer__copy');
  if (footerBottom.length > 1) {
    footerBottom[1].textContent = 'Canonical Plus prepares the program and reviewer handoff; qualified independent evaluators make formal assurance and certification decisions.';
  }
};

configureSharedValueCopy();

const nav = document.getElementById('main-nav');
if (nav) {
  const updateNavigationElevation = () => nav.classList.toggle('nav--scrolled', window.scrollY > 10);
  updateNavigationElevation();
  window.addEventListener('scroll', updateNavigationElevation, { passive: true });
}

const themeController = window.canonicalTheme;
if (themeController) {
  const themeButtons = document.querySelectorAll('[data-theme-choice]');
  const themeStatuses = document.querySelectorAll('[data-theme-status]');

  const synchronizeThemeControls = () => {
    const { theme, themePreference } = document.documentElement.dataset;
    for (const button of themeButtons) {
      if (!(button instanceof HTMLButtonElement)) continue;
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === themePreference));
    }

    const status = themePreference === 'auto'
      ? `Auto · ${theme} from local time`
      : `${theme[0].toUpperCase()}${theme.slice(1)} · manual`;
    for (const node of themeStatuses) node.textContent = status;
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
  skipLink.addEventListener('click', () => mainContent.focus({ preventScroll: true }));
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
    if (restoreFocus) toggle.focus();
  };

  setNavigationOpen(false);
  toggle.addEventListener('click', () => setNavigationOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) setNavigationOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setNavigationOpen(false, { restoreFocus: true });
    }
  });
  mobileNavigation.addEventListener('change', () => setNavigationOpen(false));
}

for (const image of document.querySelectorAll('[data-people-photo]')) {
  if (!(image instanceof HTMLImageElement)) continue;
  const showPlaceholder = () => { image.hidden = true; };
  image.addEventListener('error', showPlaceholder);
  if (image.complete && image.naturalWidth === 0) showPlaceholder();
}
