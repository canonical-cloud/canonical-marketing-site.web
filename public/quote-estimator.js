const root = document.querySelector('[data-quote-estimator]');

if (root instanceof HTMLElement) {
  const EXPECTED_SCHEMA_VERSION = 2;
  const INTAKE_ENDPOINT = 'https://forms.canonical.plus/v1/intake';
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const schemaVersion = Number(root.dataset.schemaVersion);
  const pricingRevision = root.dataset.pricingRevision || '';
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
  const organizationTypeSelect = root.querySelector('[data-quote-organization-type]');
  const organizationTypeNote = root.querySelector('[data-organization-type-note]');
  const employeeInput = root.querySelector('[data-quote-employees]');
  const employeeBandNode = root.querySelector('[data-employee-band]');
  const sectorSelect = root.querySelector('[data-quote-sector]');
  const completeButton = root.querySelector('[data-complete-public-quote]');
  const completedPanel = document.querySelector('[data-quote-complete]');
  const completedRange = document.querySelector('[data-completed-range]');
  const completedSummary = document.querySelector('[data-completed-summary]');
  const emailForm = document.querySelector('[data-quote-email-form]');
  const emailSubmit = document.querySelector('[data-quote-email-submit]');
  const emailStatus = document.querySelector('[data-quote-email-status]');

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
  const employeeBandNodes = [...root.querySelectorAll('[data-quote-employee-band]')];
  const employeeBands = employeeBandNodes.map((node) => ({
    index: Number(node.dataset.index),
    id: node.dataset.id || '',
    label: node.dataset.label || '',
    min: Number(node.dataset.min),
    max: node.dataset.max === '' ? null : Number(node.dataset.max),
    amount: Number(node.dataset.amount),
  }));
  const standardInputs = [...root.querySelectorAll('input[name="quote_standard"]')];
  const depthInputs = [...root.querySelectorAll('input[name="quote_delivery_depth"]')];
  const complexityInputs = [...root.querySelectorAll('input[name="quote_complexity"]')];
  const pricedInputs = [...standardInputs, ...depthInputs, ...complexityInputs];
  const allControls = [
    speedSlider,
    ...pricedInputs,
    organizationTypeSelect,
    employeeInput,
    sectorSelect,
  ].filter((control) => control instanceof HTMLInputElement || control instanceof HTMLSelectElement);

  const uniqueValues = (inputs) => new Set(inputs.map((input) => input.value)).size === inputs.length;
  const pricedInputValid = (input) => {
    const amount = Number(input.dataset.amount);
    return (
      input instanceof HTMLInputElement &&
      input.value.length > 0 &&
      (input.dataset.label || '').length > 0 &&
      Number.isSafeInteger(amount) &&
      amount >= 0
    );
  };
  const pricedSelectValid = (select) => {
    if (!(select instanceof HTMLSelectElement) || select.options.length === 0) return false;
    const values = [...select.options].map((option) => option.value);
    return (
      new Set(values).size === values.length &&
      [...select.options].every((option) => {
        const amount = Number(option.dataset.amount);
        return option.value.length > 0 && (option.dataset.label || '').length > 0 && Number.isSafeInteger(amount) && amount >= 0;
      })
    );
  };
  const exactlyOneChecked = (inputs) =>
    inputs.filter((input) => input instanceof HTMLInputElement && input.checked).length === 1;
  const speedValue = speedSlider instanceof HTMLInputElement ? Number(speedSlider.value) : Number.NaN;
  const speedControlValid =
    speedSlider instanceof HTMLInputElement &&
    speedSlider.type === 'range' &&
    Number(speedSlider.min) === 0 &&
    Number(speedSlider.max) === speedOptions.length - 1 &&
    Number(speedSlider.step) === 1 &&
    Number.isInteger(speedValue) &&
    speedOptions.some((option) => option.index === speedValue);
  const employeeBandsValid =
    employeeBands.length > 0 &&
    new Set(employeeBands.map((band) => band.id)).size === employeeBands.length &&
    employeeBands.every((band, index) => {
      if (
        band.index !== index ||
        !band.id ||
        !band.label ||
        !Number.isSafeInteger(band.min) ||
        band.min < 1 ||
        !Number.isSafeInteger(band.amount) ||
        band.amount < 0
      ) return false;
      if (band.max !== null && (!Number.isSafeInteger(band.max) || band.max < band.min)) return false;
      if (index === 0 && band.min !== 1) return false;
      if (index > 0) {
        const previous = employeeBands[index - 1];
        if (previous.max === null || band.min !== previous.max + 1) return false;
      }
      return index < employeeBands.length - 1 ? band.max !== null : band.max === null;
    });
  const requiredNodesPresent =
    speedLabel instanceof HTMLElement &&
    speedNote instanceof HTMLElement &&
    rangeNode instanceof HTMLElement &&
    summaryNode instanceof HTMLElement &&
    meterNode instanceof HTMLElement &&
    standardGroup instanceof HTMLElement &&
    standardError instanceof HTMLElement &&
    organizationTypeSelect instanceof HTMLSelectElement &&
    organizationTypeNote instanceof HTMLElement &&
    employeeInput instanceof HTMLInputElement &&
    employeeBandNode instanceof HTMLElement &&
    sectorSelect instanceof HTMLSelectElement &&
    completeButton instanceof HTMLButtonElement &&
    completedPanel instanceof HTMLElement &&
    completedRange instanceof HTMLElement &&
    completedSummary instanceof HTMLElement &&
    emailForm instanceof HTMLFormElement &&
    emailSubmit instanceof HTMLButtonElement &&
    emailStatus instanceof HTMLElement;
  const configurationValid =
    schemaVersion === EXPECTED_SCHEMA_VERSION &&
    /^\d{4}-\d{2}-\d{2}-v\d+$/.test(pricingRevision) &&
    /^[A-Z]{3}$/.test(currency) &&
    Number.isSafeInteger(floor) &&
    floor >= 0 &&
    Number.isSafeInteger(ceiling) &&
    ceiling > floor &&
    Number.isSafeInteger(midpointFloor) &&
    midpointFloor >= floor &&
    midpointFloor <= ceiling &&
    Number.isSafeInteger(midpointCeiling) &&
    midpointCeiling >= midpointFloor &&
    midpointCeiling <= ceiling &&
    Number.isSafeInteger(roundTo) &&
    roundTo > 0 &&
    Number.isFinite(lowerFactor) &&
    lowerFactor > 0 &&
    Number.isFinite(upperFactor) &&
    upperFactor >= lowerFactor &&
    speedOptions.length > 0 &&
    speedOptions.every(
      (option, index) =>
        option.index === index &&
        Number.isInteger(option.weeks) &&
        option.weeks > 0 &&
        option.label.length > 0 &&
        Number.isSafeInteger(option.base) &&
        option.base >= 0,
    ) &&
    speedControlValid &&
    standardInputs.length > 0 &&
    depthInputs.length > 0 &&
    complexityInputs.length > 0 &&
    uniqueValues(standardInputs) &&
    uniqueValues(depthInputs) &&
    uniqueValues(complexityInputs) &&
    pricedInputs.every(pricedInputValid) &&
    standardInputs.some((input) => input instanceof HTMLInputElement && input.checked) &&
    exactlyOneChecked(depthInputs) &&
    exactlyOneChecked(complexityInputs) &&
    pricedSelectValid(organizationTypeSelect) &&
    pricedSelectValid(sectorSelect) &&
    employeeBandsValid &&
    employeeInput.min === '1' &&
    employeeInput.max === '100000' &&
    employeeInput.step === '1' &&
    requiredNodesPresent;

  const failClosed = () => {
    root.dataset.quoteRuntime = 'invalid';
    root.setAttribute('aria-disabled', 'true');
    if (rangeNode instanceof HTMLElement) rangeNode.textContent = 'Estimate unavailable';
    if (summaryNode instanceof HTMLElement) {
      summaryNode.textContent = 'Quote configuration could not be validated. Please refresh or contact hello@canonical.plus.';
    }
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
      money = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      });
      money.format(0);
    } catch {
      failClosed();
    }

    if (money) {
      root.dataset.quoteRuntime = 'ready';
      root.removeAttribute('aria-disabled');

      const roundMoney = (value) => Math.round(value / roundTo) * roundTo;
      const checkedInputs = (name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)];
      const selectedRadio = (name) => root.querySelector(`input[name="${name}"]:checked`);
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const scrollBehavior = reducedMotion ? 'auto' : 'smooth';
      let completedQuote = null;

      const selectedSpeed = () => {
        const index = Number(speedSlider.value);
        return speedOptions.find((option) => option.index === index) || speedOptions[0];
      };
      const selectedOption = (select) => select.selectedOptions[0];
      const employeeSelection = () => {
        const raw = Number(employeeInput.value);
        if (!Number.isInteger(raw) || raw < 1 || raw > 100000) return null;
        const band = employeeBands.find((candidate) => raw >= candidate.min && (candidate.max === null || raw <= candidate.max));
        return band ? { count: raw, band } : null;
      };

      const calculate = () => {
        const speed = selectedSpeed();
        const standards = checkedInputs('quote_standard');
        const depth = selectedRadio('quote_delivery_depth');
        const complexity = selectedRadio('quote_complexity');
        const organizationType = selectedOption(organizationTypeSelect);
        const sector = selectedOption(sectorSelect);
        const employees = employeeSelection();

        if (
          !(depth instanceof HTMLInputElement) ||
          !(complexity instanceof HTMLInputElement) ||
          !(organizationType instanceof HTMLOptionElement) ||
          !(sector instanceof HTMLOptionElement) ||
          employees === null
        ) return null;

        const standardAmount = standards.reduce((total, input) => total + Number(input.dataset.amount), 0);
        const rawMidpoint =
          speed.base +
          standardAmount +
          Number(depth.dataset.amount) +
          Number(complexity.dataset.amount) +
          Number(organizationType.dataset.amount) +
          employees.band.amount +
          Number(sector.dataset.amount);
        const midpoint = clamp(rawMidpoint, midpointFloor, midpointCeiling);
        const lower = clamp(roundMoney(midpoint * lowerFactor), floor, ceiling);
        const upper = clamp(roundMoney(midpoint * upperFactor), lower, ceiling);
        const standardLabels = standards.map((input) => input.dataset.label).filter(Boolean);
        const summary = [
          speed.label,
          standardLabels.join(' + ') || 'No standard selected',
          depth.dataset.label || '',
          complexity.dataset.label || '',
          organizationType.dataset.label || '',
          employees.band.label,
          sector.dataset.label || '',
        ].filter(Boolean).join(' · ');

        return {
          speed,
          standards,
          depth,
          complexity,
          organizationType,
          employees,
          sector,
          lower,
          upper,
          midpoint,
          summary,
        };
      };

      const render = () => {
        const quote = calculate();
        if (!quote) {
          rangeNode.textContent = 'Enter a valid employee count';
          summaryNode.textContent = 'Employee count must be a whole number from 1 to 100,000.';
          employeeBandNode.textContent = 'Employee count required';
          completeButton.disabled = true;
          return null;
        }

        speedLabel.textContent = quote.speed.label;
        speedNote.textContent = quote.speed.note;
        speedSlider.setAttribute('aria-valuetext', quote.speed.label);
        rangeNode.textContent = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
        summaryNode.textContent = quote.summary;
        employeeBandNode.textContent = quote.employees.band.label;
        organizationTypeNote.textContent = quote.organizationType.dataset.note || organizationTypeNote.textContent;
        const percentage = ((quote.midpoint - floor) / Math.max(1, ceiling - floor)) * 100;
        meterNode.style.width = `${clamp(percentage, 4, 100)}%`;
        completeButton.disabled = false;
        if (quote.standards.length > 0) {
          standardError.hidden = true;
          standardGroup.removeAttribute('aria-invalid');
        }
        return quote;
      };

      const resetEmailStatus = () => {
        emailStatus.textContent = '';
        delete emailStatus.dataset.state;
      };

      const invalidateCompletedQuote = () => {
        completedQuote = null;
        resetEmailStatus();
        if (!completedPanel.hidden) completedPanel.hidden = true;
      };

      const handleEstimatorChange = () => {
        invalidateCompletedQuote();
        render();
      };

      root.addEventListener('input', handleEstimatorChange);
      root.addEventListener('change', handleEstimatorChange);

      completeButton.addEventListener('click', () => {
        const quote = render();
        if (!quote) {
          employeeInput.focus({ preventScroll: true });
          employeeInput.reportValidity();
          return;
        }
        if (quote.standards.length === 0) {
          standardGroup.setAttribute('aria-invalid', 'true');
          standardError.hidden = false;
          const firstStandard = root.querySelector('input[name="quote_standard"]');
          if (firstStandard instanceof HTMLInputElement) firstStandard.focus({ preventScroll: true });
          standardError.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
          return;
        }

        completedQuote = quote;
        completedRange.textContent = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
        completedSummary.textContent = quote.summary;
        completedPanel.hidden = false;
        completedPanel.focus({ preventScroll: true });
        completedPanel.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
      });

      emailForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        resetEmailStatus();
        if (!completedQuote) {
          emailStatus.textContent = 'Please review the estimate again before sending.';
          emailStatus.dataset.state = 'error';
          return;
        }
        if (!emailForm.checkValidity()) {
          emailForm.reportValidity();
          return;
        }

        const form = new FormData(emailForm);
        const email = String(form.get('email') || '').trim();
        const displayName = String(form.get('displayName') || '').trim();
        const organizationName = String(form.get('organizationName') || '').trim();
        const website = String(form.get('website') || '').trim();

        const payload = {
          kind: 'quote',
          source: 'canonical.plus/quote',
          email,
          displayName,
          organizationName,
          website,
          pricingRevision,
          quote: {
            currency,
            speedWeeks: completedQuote.speed.weeks,
            standardIds: completedQuote.standards.map((input) => input.value),
            deliveryDepthId: completedQuote.depth.value,
            complexityId: completedQuote.complexity.value,
            organizationTypeId: completedQuote.organizationType.value,
            employeeCount: completedQuote.employees.count,
            employeeBandId: completedQuote.employees.band.id,
            sectorId: completedQuote.sector.value,
          },
        };

        emailSubmit.disabled = true;
        emailSubmit.setAttribute('aria-busy', 'true');
        emailStatus.textContent = 'Sending your quote…';

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(INTAKE_ENDPOINT, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: 'strict-origin-when-cross-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          let body = null;
          try {
            body = await response.json();
          } catch {
            body = null;
          }
          if (!response.ok) {
            throw new Error(body?.error || 'quote_delivery_failed');
          }
          emailStatus.textContent = 'Quote sent. Check your inbox; hello@canonical.plus was copied.';
          emailStatus.dataset.state = 'success';
        } catch (error) {
          emailStatus.textContent = 'We could not send the quote right now. Please email hello@canonical.plus and we’ll help directly.';
          emailStatus.dataset.state = 'error';
          console.warn('quote email delivery failed', error instanceof Error ? error.message : 'unknown_error');
        } finally {
          window.clearTimeout(timeout);
          emailSubmit.disabled = false;
          emailSubmit.removeAttribute('aria-busy');
        }
      });

      render();
    }
  }
}
