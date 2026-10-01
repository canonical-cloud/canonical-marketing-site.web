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
  const employeeBand = root.querySelector('[data-quote-employee-band]');
  const sectorSelect = root.querySelector('[data-quote-sector]');
  const completedPanel = document.querySelector('[data-quote-complete]');
  const completedRange = document.querySelector('[data-completed-range]');
  const completedSummary = document.querySelector('[data-completed-summary]');

  root.dataset.quoteRuntime = 'booting';
  if (completeButton instanceof HTMLButtonElement) completeButton.disabled = true;

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
  const companyProfileInputs = [...root.querySelectorAll('input[name="quote_company_profile"]')];
  const pricedInputs = [...standardInputs, ...depthInputs, ...complexityInputs, ...companyProfileInputs];
  const allControls = [speedSlider, ...pricedInputs, employeeBand, sectorSelect].filter(Boolean);

  const uniqueValues = (inputs) => new Set(inputs.map((input) => input.value)).size === inputs.length;
  const pricedInputValid = (input) => {
    const amount = Number(input.dataset.amount);
    return input instanceof HTMLInputElement && input.value.length > 0 && (input.dataset.label || '').length > 0 && Number.isSafeInteger(amount) && amount >= 0;
  };
  const exactlyOneChecked = (inputs) => inputs.filter((input) => input instanceof HTMLInputElement && input.checked).length === 1;
  const speedValue = speedSlider instanceof HTMLInputElement ? Number(speedSlider.value) : Number.NaN;
  const speedControlValid =
    speedSlider instanceof HTMLInputElement &&
    speedSlider.type === 'range' &&
    Number(speedSlider.min) === 0 &&
    Number(speedSlider.max) === speedOptions.length - 1 &&
    Number(speedSlider.step) === 1 &&
    Number.isInteger(speedValue) &&
    speedOptions.some((option) => option.index === speedValue);
  const selectValid = (select, priced = false) => {
    if (!(select instanceof HTMLSelectElement) || select.options.length === 0) return false;
    return [...select.options].every((option) => {
      if (!option.value || !(option.dataset.label || '').length) return false;
      if (!priced) return true;
      const amount = Number(option.dataset.amount);
      return Number.isSafeInteger(amount) && amount >= 0;
    });
  };
  const requiredNodesPresent =
    speedLabel instanceof HTMLElement &&
    speedNote instanceof HTMLElement &&
    rangeNode instanceof HTMLElement &&
    summaryNode instanceof HTMLElement &&
    meterNode instanceof HTMLElement &&
    standardGroup instanceof HTMLElement &&
    standardError instanceof HTMLElement &&
    completeButton instanceof HTMLButtonElement &&
    employeeBand instanceof HTMLSelectElement &&
    sectorSelect instanceof HTMLSelectElement &&
    completedPanel instanceof HTMLElement &&
    completedRange instanceof HTMLElement &&
    completedSummary instanceof HTMLElement;
  const configurationValid =
    schemaVersion === EXPECTED_SCHEMA_VERSION &&
    /^[A-Z]{3}$/.test(currency) &&
    Number.isSafeInteger(floor) && floor >= 0 &&
    Number.isSafeInteger(ceiling) && ceiling > floor &&
    Number.isSafeInteger(midpointFloor) && midpointFloor >= floor && midpointFloor <= ceiling &&
    Number.isSafeInteger(midpointCeiling) && midpointCeiling >= midpointFloor && midpointCeiling <= ceiling &&
    Number.isSafeInteger(roundTo) && roundTo > 0 &&
    Number.isFinite(lowerFactor) && lowerFactor > 0 &&
    Number.isFinite(upperFactor) && upperFactor >= lowerFactor &&
    speedOptions.length > 0 && speedOptions.every((option, index) => option.index === index && Number.isInteger(option.weeks) && option.weeks > 0 && option.label.length > 0 && Number.isSafeInteger(option.base) && option.base >= 0) &&
    speedControlValid &&
    standardInputs.length > 0 && depthInputs.length > 0 && complexityInputs.length > 0 && companyProfileInputs.length > 0 &&
    uniqueValues(standardInputs) && uniqueValues(depthInputs) && uniqueValues(complexityInputs) && uniqueValues(companyProfileInputs) &&
    pricedInputs.every(pricedInputValid) &&
    standardInputs.some((input) => input instanceof HTMLInputElement && input.checked) &&
    exactlyOneChecked(depthInputs) && exactlyOneChecked(complexityInputs) && exactlyOneChecked(companyProfileInputs) &&
    selectValid(employeeBand, true) && selectValid(sectorSelect, false) && requiredNodesPresent;

  const failClosed = () => {
    root.dataset.quoteRuntime = 'invalid';
    root.setAttribute('aria-disabled', 'true');
    if (rangeNode instanceof HTMLElement) rangeNode.textContent = 'Estimate unavailable';
    if (summaryNode instanceof HTMLElement) summaryNode.textContent = 'Quote configuration could not be validated. Please refresh or contact hello@canonical.plus.';
    if (meterNode instanceof HTMLElement) meterNode.style.width = '0%';
    if (completeButton instanceof HTMLButtonElement) completeButton.disabled = true;
    for (const control of allControls) control.disabled = true;
    if (completedPanel instanceof HTMLElement) completedPanel.hidden = true;
  };

  if (!configurationValid) {
    failClosed();
  } else {
    let money;
    try {
      money = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 });
      money.format(0);
    } catch {
      failClosed();
    }

    if (money) {
      root.dataset.quoteRuntime = 'ready';
      root.removeAttribute('aria-disabled');
      completeButton.disabled = false;

      const roundMoney = (value) => Math.round(value / roundTo) * roundTo;
      const checkedInputs = (name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)];
      const selectedRadio = (name) => root.querySelector(`input[name="${name}"]:checked`);
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const scrollBehavior = reducedMotion ? 'auto' : 'smooth';
      const selectedOption = (select) => select.options[select.selectedIndex];

      const selectedSpeed = () => {
        const index = Number(speedSlider.value);
        return speedOptions.find((option) => option.index === index) || speedOptions[0];
      };

      const calculate = () => {
        const speed = selectedSpeed();
        const standards = checkedInputs('quote_standard');
        const depth = selectedRadio('quote_delivery_depth');
        const complexity = selectedRadio('quote_complexity');
        const companyProfile = selectedRadio('quote_company_profile');
        const employeeOption = selectedOption(employeeBand);
        const sectorOption = selectedOption(sectorSelect);

        const standardAmount = standards.reduce((total, input) => total + Number(input.dataset.amount), 0);
        const depthAmount = depth instanceof HTMLInputElement ? Number(depth.dataset.amount) : 0;
        const complexityAmount = complexity instanceof HTMLInputElement ? Number(complexity.dataset.amount) : 0;
        const companyAmount = companyProfile instanceof HTMLInputElement ? Number(companyProfile.dataset.amount) : 0;
        const employeeAmount = Number(employeeOption?.dataset.amount || 0);

        const rawMidpoint = speed.base + standardAmount + depthAmount + complexityAmount + companyAmount + employeeAmount;
        const midpoint = clamp(rawMidpoint, midpointFloor, midpointCeiling);
        const lower = clamp(roundMoney(midpoint * lowerFactor), floor, ceiling);
        const upper = clamp(roundMoney(midpoint * upperFactor), lower, ceiling);
        const standardLabels = standards.map((input) => input.dataset.label).filter(Boolean);
        const depthLabel = depth instanceof HTMLInputElement ? depth.dataset.label : '';
        const complexityLabel = complexity instanceof HTMLInputElement ? complexity.dataset.label : '';
        const companyLabel = companyProfile instanceof HTMLInputElement ? companyProfile.dataset.label : '';
        const employeeLabel = employeeOption?.dataset.label || '';
        const sectorLabel = sectorOption?.dataset.label || '';
        const summary = `${speed.label} · ${standardLabels.join(' + ') || 'No standard selected'} · ${depthLabel} · ${complexityLabel} · ${companyLabel} · ${employeeLabel} · ${sectorLabel}`;

        return {
          speed,
          standards,
          lower,
          upper,
          midpoint,
          summary,
          companyProfile: companyProfile?.value || '',
          employeeBand: employeeBand.value,
          sector: sectorSelect.value,
        };
      };

      const syncIntake = (quote) => {
        for (const node of document.querySelectorAll('[data-intake-estimate-range]')) node.value = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
        for (const node of document.querySelectorAll('[data-intake-estimate-summary]')) node.value = quote.summary;
        for (const node of document.querySelectorAll('[data-intake-company-profile]')) node.value = quote.companyProfile;
        for (const node of document.querySelectorAll('[data-intake-employee-band]')) node.value = quote.employeeBand;
        for (const node of document.querySelectorAll('[data-intake-sector]')) node.value = quote.sector;
      };

      const render = () => {
        const quote = calculate();
        speedLabel.textContent = quote.speed.label;
        speedNote.textContent = quote.speed.note;
        speedSlider.setAttribute('aria-valuetext', quote.speed.label);
        rangeNode.textContent = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
        summaryNode.textContent = quote.summary;
        const percentage = ((quote.midpoint - floor) / Math.max(1, ceiling - floor)) * 100;
        meterNode.style.width = `${clamp(percentage, 4, 100)}%`;
        syncIntake(quote);
        if (quote.standards.length > 0) {
          standardError.hidden = true;
          standardGroup.removeAttribute('aria-invalid');
        }
        return quote;
      };

      const invalidateCompletedQuote = () => {
        if (!completedPanel.hidden) completedPanel.hidden = true;
      };
      const handleEstimatorChange = () => { invalidateCompletedQuote(); render(); };
      root.addEventListener('input', handleEstimatorChange);
      root.addEventListener('change', handleEstimatorChange);

      completeButton.addEventListener('click', () => {
        const quote = render();
        if (quote.standards.length === 0) {
          standardGroup.setAttribute('aria-invalid', 'true');
          standardError.hidden = false;
          const firstStandard = root.querySelector('input[name="quote_standard"]');
          if (firstStandard instanceof HTMLInputElement) firstStandard.focus({ preventScroll: true });
          standardError.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
          return;
        }
        completedRange.textContent = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
        completedSummary.textContent = quote.summary;
        syncIntake(quote);
        completedPanel.hidden = false;
        completedPanel.focus({ preventScroll: true });
        completedPanel.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
      });

      render();
    }
  }
}
