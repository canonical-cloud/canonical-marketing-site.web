// Progressive enhancement only: FAQ questions remain available without JavaScript.
const tools = document.getElementById('faq-search-tools');
const input = document.getElementById('faq-search-input');
const clear = document.getElementById('faq-search-clear');
const status = document.getElementById('faq-search-status');
const empty = document.getElementById('faq-search-empty');
const root = document.querySelector('.faq-content');

if (
  tools instanceof HTMLElement &&
  input instanceof HTMLInputElement &&
  clear instanceof HTMLButtonElement &&
  status instanceof HTMLElement &&
  empty instanceof HTMLElement &&
  root instanceof HTMLElement
) {
  const groups = [...root.querySelectorAll('.faq-group')];
  const entries = groups.flatMap((group) =>
    [...group.querySelectorAll('details.faq-item')].map((element) => ({
      element,
      group,
      // Use the DOM's plain text. Never parse the search term as markup.
      indexedText: normalize(element.textContent || ''),
    })),
  );
  const topicLinks = [...document.querySelectorAll('.faq-categories a[href^="#"]')];

  function normalize(text) {
    return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  const showMatches = () => {
    const query = normalize(input.value);
    let matches = 0;

    for (const { element, indexedText } of entries) {
      const visible = !query || indexedText.includes(query);
      element.hidden = !visible;
      if (visible) matches++;
    }

    for (const group of groups) {
      group.hidden = ![...group.querySelectorAll('details.faq-item')].some(
        (entry) => !entry.hidden,
      );
    }

    clear.hidden = !query;
    empty.hidden = matches !== 0;
    status.textContent = query
      ? `${matches} matching ${matches === 1 ? 'question' : 'questions'} out of ${entries.length}`
      : `Showing all ${entries.length} questions`;
  };

  const resetSearch = () => {
    if (input.value) {
      input.value = '';
      showMatches();
    }
  };

  const openHashTarget = () => {
    if (!location.hash) return;
    let id;
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return; // Malformed escape sequence: keep all questions usable.
    }

    const target = document.getElementById(id);
    if (!(target instanceof HTMLElement) || !root.contains(target)) return;

    // When someone follows a question link, restore a filtered-out answer.
    resetSearch();
    if (target.matches('details.faq-item')) {
      target.open = true;
      // Opening the answer changes the page's height. Correct the browser's
      // initial fragment scroll once layout has settled.
      requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    }
  };

  input.addEventListener('input', showMatches);
  input.addEventListener('search', showMatches);
  clear.addEventListener('click', () => {
    resetSearch();
    input.focus();
  });
  for (const link of topicLinks) {
    link.addEventListener('click', resetSearch);
  }
  window.addEventListener('hashchange', openHashTarget);

  tools.hidden = false;
  showMatches();
  openHashTarget();
}
