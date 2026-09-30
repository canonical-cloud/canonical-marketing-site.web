const root = document.querySelector('[data-quote-estimator]');

if (root instanceof HTMLElement) {
  const EXPECTED_SCHEMA_VERSION = 1;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const schemaVersion = Number(root.dataset.schemaVersion);
  const currency = root.dataset.currency || '';
  const floor = Number(root.dataset.floor);
  const ceiling = Number(root.dataset.ceiling);
  const midpointFloor = Number(root.dataset.midpointFloor);
  const midpointCeiling = Number(root.dataset.midpointCeiling);
  const roundTo = Number(root.dataset.roundTo);
  const lowerFactor = Number(root.dataset.lowerFactor);
  const upperFactor = Number(root.dataset.upperFactor);

  const speedSlider = root.querySelector('[data-quote-speed-slider]');
  const speedLabel = root.querySelector('[data-speed-label]');
  const speedNote = root.querySelector('[data-speed-note]');
  const rangeNode = root.querySelector('[data-quote-range]');
  const summaryNode = root.querySelector('[data-quote-summary]');
  const meterNode = root.querySelector('[data-quote-meter]');
  const standardGroup = root.querySelector('[data-standards-group]');
  const standardError = root.querySelector('[data-standard-error]');
  const completeButton = root.querySelector('[data-complete-public-quote]');
  const completedPanel = document.querySelector('[data-quote-complete]');
  const completedRange = document.querySelector('[data-completed-range]');
  const completedSummary = document.querySelector('[data-completed-summary]');

  const speedNodes = [...root.querySelectorAll('[data-quote-speed-option]')];
  const speedOptions = speedNodes.map((node) => ({
    index: Number(node.dataset.index),
    weeks: Number(node.dataset.weeks),
    label: node.dataset.label || '',
    base: Number(node.dataset.base),
    note: node.dataset.note || '',
  }));
  const standardInputs = [...root.querySelectorAll('input[name="quote_standard"]')];
  const depthInputs = [...root.querySelectorAll('input[name="quote_delivery_depth"]')];
  const complexityInputs = [...root.querySelectorAll('input[name="quote_complexity"]')];
  const pricedInputs = [...standardInputs, ...depthInputs, ...complexityInputs];

  const uniqueIndexes = new Set(speedOptions.map((option) => option.index));
  const uniqueValues = (inputs) => new Set(inputs.map((input) => input.value)).size === inputs.length;
  const pricedInputValid = (input) => {
    const amount = Number(input.dataset.amount);
    return input.value.length > 0 && (input.dataset.label || '').length > 0 && Number.isFinite(amount) && amount >= 0;
  };
  const configurationValid =
    schemaVersion === EXPECTED_SCHEMA_VERSION &&
    /^[A-Z]{3}$/.test(currency) &&
    Number.isFinite(floor) &&
    floor >= 0 &&
    Number.isFinite(ceiling) &&
    ceiling > floor &&
    Number.isFinite(midpointFloor) &&
    midpointFloor >= floor &&
    midpointFloor <= ceiling &&
    Number.isFinite(midpointCeiling) &&
    midpointCeiling >= midpointFloor &&
    midpointCeiling <= ceiling &&
    Number.isFinite(roundTo) &&
    roundTo > 0 &&
    Number.isFinite(lowerFactor) &&
    lowerFactor > 0 &&
    Number.isFinite(upperFactor) &&
    upperFactor >= lowerFactor &&
    speedOptions.length > 0 &&
    uniqueIndexes.size === speedOptions.length &&
    speedOptions.every(
      (option) =>
        Number.isInteger(option.index) &&
        option.index >= 0 &&
        Number.isInteger(option.weeks) &&
        option.weeks > 0 &&
        option.label.length > 0 &&
        Number.isFinite(option.base) &&
        option.base >= 0,
    ) &&
    standardInputs.length > 0 &&
    depthInputs.length > 0 &&
    complexityInputs.length > 0 &&
    uniqueValues(standardInputs) &&
    uniqueValues(depthInputs) &&
    uniqueValues(complexityInputs) &&
    pricedInputs.every(pricedInputValid);

  const failClosed = () => {
    root.dataset.quoteRuntime = 'invalid';
    if (rangeNode) rangeNode.textContent = 'Estimate unavailable';
    if (summaryNode) summaryNode.textContent = 'Quote configuration could not be validated. Please refresh or contact Canonical Plus.';
    if (meterNode instanceof HTMLElement) meterNode.style.width = '0%';
    if (completeButton instanceof HTMLButtonElement) completeButton.disabled = true;
  };

  if (!configurationValid) {
    failClosed();
  } else {
    root.dataset.quoteRuntime = 'ready';

    const money = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    const roundMoney = (value) => Math.round(value / roundTo) * roundTo;
    const checkedInputs = (name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)];
    const selectedRadio = (name) => root.querySelector(`input[name="${name}"]:checked`);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const scrollBehavior = reducedMotion ? 'auto' : 'smooth';

    const selectedSpeed = () => {
      const index = speedSlider instanceof HTMLInputElement ? Number(speedSlider.value) : speedOptions[0].index;
      return speedOptions.find((option) => option.index === index) || speedOptions[0];
    };

    const calculate = () => {
      const speed = selectedSpeed();
      const standards = checkedInputs('quote_standard');
      const depth = selectedRadio('quote_delivery_depth');
      const complexity = selectedRadio('quote_complexity');

      const standardAmount = standards.reduce((total, input) => total + Number(input.dataset.amount), 0);
      const depthAmount = depth instanceof HTMLInputElement ? Number(depth.dataset.amount) : 0;
      const complexityAmount = complexity instanceof HTMLInputElement ? Number(complexity.dataset.amount) : 0;

      const rawMidpoint = speed.base + standardAmount + depthAmount + complexityAmount;
      const midpoint = clamp(rawMidpoint, midpointFloor, midpointCeiling);
      const lower = clamp(roundMoney(midpoint * lowerFactor), floor, ceiling);
      const upper = clamp(roundMoney(midpoint * upperFactor), lower, ceiling);
      const standardLabels = standards.map((input) => input.dataset.label).filter(Boolean);
      const depthLabel = depth instanceof HTMLInputElement ? depth.dataset.label : '';
      const complexityLabel = complexity instanceof HTMLInputElement ? complexity.dataset.label : '';
      const summary = `${speed.label} · ${standardLabels.join(' + ') || 'No standard selected'} · ${depthLabel} · ${complexityLabel}`;

      return { speed, standards, lower, upper, midpoint, summary };
    };

    const render = () => {
      const quote = calculate();

      if (speedLabel) speedLabel.textContent = quote.speed.label;
      if (speedNote) speedNote.textContent = quote.speed.note;
      if (speedSlider instanceof HTMLInputElement) speedSlider.setAttribute('aria-valuetext', quote.speed.label);
      if (rangeNode) rangeNode.textContent = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
      if (summaryNode) summaryNode.textContent = quote.summary;
      if (meterNode instanceof HTMLElement) {
        const percentage = ((quote.midpoint - floor) / Math.max(1, ceiling - floor)) * 100;
        meterNode.style.width = `${clamp(percentage, 4, 100)}%`;
      }
      if (quote.standards.length > 0) {
        if (standardError instanceof HTMLElement) standardError.hidden = true;
        if (standardGroup instanceof HTMLElement) standardGroup.removeAttribute('aria-invalid');
      }

      return quote;
    };

    const invalidateCompletedQuote = () => {
      if (completedPanel instanceof HTMLElement && !completedPanel.hidden) {
        completedPanel.hidden = true;
      }
    };

    const handleEstimatorChange = () => {
      invalidateCompletedQuote();
      render();
    };

    root.addEventListener('input', handleEstimatorChange);
    root.addEventListener('change', handleEstimatorChange);

    if (completeButton instanceof HTMLButtonElement) {
      completeButton.addEventListener('click', () => {
        const quote = render();
        if (quote.standards.length === 0) {
          if (standardGroup instanceof HTMLElement) standardGroup.setAttribute('aria-invalid', 'true');
          if (standardError instanceof HTMLElement) {
            standardError.hidden = false;
            const firstStandard = root.querySelector('input[name="quote_standard"]');
            if (firstStandard instanceof HTMLInputElement) firstStandard.focus({ preventScroll: true });
            standardError.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
          }
          return;
        }

        if (completedRange) completedRange.textContent = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
        if (completedSummary) completedSummary.textContent = quote.summary;
        if (completedPanel instanceof HTMLElement) {
          completedPanel.hidden = false;
          completedPanel.focus({ preventScroll: true });
          completedPanel.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
        }
      });
    }

    render();
  }
}
