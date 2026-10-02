const root = document.querySelector('[data-quote-estimator]');

if (root instanceof HTMLElement) {
  const EXPECTED_SCHEMA_VERSION = 2;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const completeButton = root.querySelector('[data-complete-public-quote]');
  const rangeNode = root.querySelector('[data-quote-range]');
  const summaryNode = root.querySelector('[data-quote-summary]');
  const meterNode = root.querySelector('[data-quote-meter]');
  const statusNode = root.querySelector('[data-quote-status]');
  const standardGroup = root.querySelector('[data-standards-group]');
  const standardError = root.querySelector('[data-standard-error]');
  const completedPanel = document.querySelector('[data-quote-complete]');
  const completedRange = document.querySelector('[data-completed-range]');
  const completedSummary = document.querySelector('[data-completed-summary]');
  const speedSlider = root.querySelector('[data-quote-speed-slider]');

  root.dataset.quoteRuntime = 'booting';
  if (completeButton instanceof HTMLButtonElement) completeButton.disabled = true;

  const numeric = (name) => Number(root.dataset[name]);
  const schemaVersion = numeric('schemaVersion');
  const floor = numeric('floor');
  const ceiling = numeric('ceiling');
  const midpointFloor = numeric('midpointFloor');
  const midpointCeiling = numeric('midpointCeiling');
  const roundTo = numeric('roundTo');
  const lowerFactor = numeric('lowerFactor');
  const upperFactor = numeric('upperFactor');
  const currency = root.dataset.currency || '';
  const supabaseUrl = (root.dataset.supabaseUrl || '').replace(/\/+$/, '');

  const speedOptions = [...root.querySelectorAll('[data-option="speed"]')].map((node) => ({
    index: Number(node.dataset.index),
    id: node.dataset.id || '',
    label: node.dataset.label || '',
    amount: Number(node.dataset.amount),
  }));
  const standardInputs = [...root.querySelectorAll('input[name="quote_standard"]')];
  const depthInputs = [...root.querySelectorAll('input[name="quote_delivery_depth"]')];
  const complexityInputs = [...root.querySelectorAll('input[name="quote_complexity"]')];
  const companyStage = root.querySelector('select[name="quote_company_stage"]');
  const employeeBand = root.querySelector('select[name="quote_employee_band"]');
  const sector = root.querySelector('select[name="quote_sector"]');
  const emailInput = root.querySelector('input[name="quote_email"]');
  const companyInput = root.querySelector('input[name="quote_company"]');
  const websiteInput = root.querySelector('input[name="quote_website"]');

  const pricedInputValid = (input) =>
    input instanceof HTMLInputElement &&
    input.value.length > 0 &&
    (input.dataset.label || '').length > 0 &&
    Number.isFinite(Number(input.dataset.amount)) &&
    Number(input.dataset.amount) >= 0;

  const selectOptionsValid = (select, kind) =>
    select instanceof HTMLSelectElement &&
    select.options.length > 0 &&
    [...select.options].every((option) => {
      if (!option.value || !(option.dataset.label || '')) return false;
      if (kind === 'multiplier') {
        const value = Number(option.dataset.multiplier);
        return Number.isFinite(value) && value > 0;
      }
      const value = Number(option.dataset.amount);
      return Number.isFinite(value) && value >= 0;
    });

  const exactlyOneChecked = (inputs) =>
    inputs.filter((input) => input instanceof HTMLInputElement && input.checked).length === 1;

  const configurationValid =
    schemaVersion === EXPECTED_SCHEMA_VERSION &&
    /^[A-Z]{3}$/.test(currency) &&
    Number.isFinite(floor) && floor >= 0 &&
    Number.isFinite(ceiling) && ceiling > floor &&
    Number.isFinite(midpointFloor) && midpointFloor >= floor &&
    Number.isFinite(midpointCeiling) && midpointCeiling >= midpointFloor && midpointCeiling <= ceiling &&
    Number.isFinite(roundTo) && roundTo > 0 &&
    Number.isFinite(lowerFactor) && lowerFactor > 0 &&
    Number.isFinite(upperFactor) && upperFactor >= lowerFactor &&
    speedSlider instanceof HTMLInputElement &&
    speedSlider.type === 'range' &&
    speedOptions.length > 0 &&
    speedOptions.every((option, index) =>
      option.index === index && option.label && Number.isFinite(option.amount) && option.amount >= 0
    ) &&
    standardInputs.length > 0 && standardInputs.every(pricedInputValid) &&
    depthInputs.length > 0 && depthInputs.every(pricedInputValid) && exactlyOneChecked(depthInputs) &&
    complexityInputs.length > 0 && complexityInputs.every(pricedInputValid) && exactlyOneChecked(complexityInputs) &&
    standardInputs.some((input) => input instanceof HTMLInputElement && input.checked) &&
    selectOptionsValid(companyStage, 'multiplier') &&
    selectOptionsValid(employeeBand, 'amount') &&
    selectOptionsValid(sector, 'amount') &&
    emailInput instanceof HTMLInputElement &&
    companyInput instanceof HTMLInputElement &&
    websiteInput instanceof HTMLInputElement &&
    rangeNode instanceof HTMLElement &&
    summaryNode instanceof HTMLElement &&
    meterNode instanceof HTMLElement &&
    completeButton instanceof HTMLButtonElement;

  const allControls = root.querySelectorAll('input, select, button');

  const failClosed = () => {
    root.dataset.quoteRuntime = 'invalid';
    root.setAttribute('aria-disabled', 'true');
    if (rangeNode instanceof HTMLElement) rangeNode.textContent = 'Estimate unavailable';
    if (summaryNode instanceof HTMLElement) summaryNode.textContent = 'Quote configuration could not be validated. Please contact hello@canonical.plus.';
    if (meterNode instanceof HTMLElement) meterNode.style.width = '0%';
    for (const control of allControls) {
      if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLButtonElement) {
        control.disabled = true;
      }
    }
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

      const selectedInput = (name) => root.querySelector(`input[name="${name}"]:checked`);
      const selectedOption = (name) => root.querySelector(`select[name="${name}"] option:checked`);
      const checked = (name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)];
      const valueOf = (node) => Number(node?.dataset?.amount || 0);
      const labelOf = (node) => node?.dataset?.label || '';
      const roundMoney = (value) => Math.round(value / roundTo) * roundTo;

      const calculate = () => {
        const speed = speedOptions[Number(speedSlider.value)] || speedOptions[0];
        const standards = checked('quote_standard');
        const depth = selectedInput('quote_delivery_depth');
        const complexity = selectedInput('quote_complexity');
        const stage = selectedOption('quote_company_stage');
        const employees = selectedOption('quote_employee_band');
        const selectedSector = selectedOption('quote_sector');
        const stageMultiplier = Number(stage?.dataset?.multiplier || 1);

        const additive =
          speed.amount +
          standards.reduce((sum, item) => sum + valueOf(item), 0) +
          valueOf(depth) +
          valueOf(complexity) +
          valueOf(employees) +
          valueOf(selectedSector);
        const midpoint = clamp(additive * stageMultiplier, midpointFloor, midpointCeiling);
        const lower = clamp(roundMoney(midpoint * lowerFactor), floor, ceiling);
        const upper = clamp(roundMoney(midpoint * upperFactor), lower, ceiling);
        const summary = [
          speed.label,
          standards.map(labelOf).filter(Boolean).join(' + ') || 'No framework selected',
          labelOf(depth),
          labelOf(complexity),
          labelOf(stage),
          labelOf(employees),
          labelOf(selectedSector),
        ].filter(Boolean).join(' · ');

        return { speed, standards, depth, complexity, stage, employees, sector: selectedSector, midpoint, lower, upper, summary };
      };

      const render = () => {
        const quote = calculate();
        speedSlider.setAttribute('aria-valuetext', quote.speed.label);
        rangeNode.textContent = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
        summaryNode.textContent = quote.summary;
        const percentage = ((quote.midpoint - floor) / Math.max(1, ceiling - floor)) * 100;
        meterNode.style.width = `${clamp(percentage, 4, 100)}%`;
        if (quote.standards.length > 0 && standardError instanceof HTMLElement) {
          standardError.hidden = true;
          standardGroup?.removeAttribute('aria-invalid');
        }
        return quote;
      };

      const setStatus = (message, error = false) => {
        if (!(statusNode instanceof HTMLElement)) return;
        statusNode.textContent = message;
        statusNode.dataset.error = error ? 'true' : 'false';
      };

      let submissionKey = '';
      const invalidate = () => {
        submissionKey = '';
        if (completedPanel instanceof HTMLElement) completedPanel.hidden = true;
        setStatus('');
        render();
      };
      root.addEventListener('input', invalidate);
      root.addEventListener('change', invalidate);

      completeButton.addEventListener('click', async () => {
        const quote = render();
        if (quote.standards.length === 0) {
          standardGroup?.setAttribute('aria-invalid', 'true');
          if (standardError instanceof HTMLElement) standardError.hidden = false;
          const first = standardInputs[0];
          if (first instanceof HTMLInputElement) first.focus({ preventScroll: true });
          return;
        }
        if (!emailInput.reportValidity() || !companyInput.reportValidity()) return;

        if (!supabaseUrl) {
          setStatus('Quote email is temporarily unavailable. Please email hello@canonical.plus.', true);
          return;
        }

        if (!submissionKey) submissionKey = crypto.randomUUID();
        const payload = {
          kind: 'quote',
          email: emailInput.value.trim(),
          company: companyInput.value.trim(),
          idempotencyKey: submissionKey,
          website: websiteInput.value.trim(),
          selection: {
            speedWeeks: Number(quote.speed.id),
            standardIds: quote.standards.map((item) => item.value),
            deliveryDepthId: quote.depth?.value || '',
            complexityId: quote.complexity?.value || '',
            companyStageId: quote.stage?.value || '',
            employeeBandId: quote.employees?.value || '',
            sectorId: quote.sector?.value || '',
          },
          source: 'canonical.plus/quote',
        };

        completeButton.disabled = true;
        setStatus('Sending your quote…');
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/public-intake`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(`quote delivery failed: ${response.status}`);
          const serverRange = result?.quote?.range;
          const serverSummary = result?.quote?.summary;
          if (
            !serverRange ||
            !Number.isFinite(Number(serverRange.lowerUsd)) ||
            !Number.isFinite(Number(serverRange.upperUsd)) ||
            typeof serverSummary !== 'string'
          ) throw new Error('quote response was missing canonical server pricing');

          const canonicalRange = `${money.format(Number(serverRange.lowerUsd))}–${money.format(Number(serverRange.upperUsd))}`;
          rangeNode.textContent = canonicalRange;
          summaryNode.textContent = serverSummary;
          if (completedRange instanceof HTMLElement) completedRange.textContent = canonicalRange;
          if (completedSummary instanceof HTMLElement) completedSummary.textContent = serverSummary;
          if (completedPanel instanceof HTMLElement) {
            completedPanel.hidden = false;
            completedPanel.focus({ preventScroll: true });
            completedPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          setStatus('Quote sent successfully.');
          submissionKey = '';
        } catch {
          setStatus('We could not send the quote. Please email hello@canonical.plus and we will help.', true);
        } finally {
          completeButton.disabled = false;
        }
      });

      render();
    }
  }
}
