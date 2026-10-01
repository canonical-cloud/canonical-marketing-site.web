const root = document.querySelector('[data-quote-estimator]');

if (root instanceof HTMLElement) {
  const EXPECTED_SCHEMA_VERSION = 2;
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
  const intakeEndpoint = root.dataset.intakeEndpoint || '';

  const speedSlider = root.querySelector('[data-quote-speed-slider]');
  const speedLabel = root.querySelector('[data-speed-label]');
  const speedNote = root.querySelector('[data-speed-note]');
  const rangeNode = root.querySelector('[data-quote-range]');
  const summaryNode = root.querySelector('[data-quote-summary]');
  const meterNode = root.querySelector('[data-quote-meter]');
  const standardGroup = root.querySelector('[data-standards-group]');
  const standardError = root.querySelector('[data-standard-error]');
  const stageSelect = root.querySelector('[data-quote-stage]');
  const employeeInput = root.querySelector('[data-quote-employees]');
  const sectorSelect = root.querySelector('[data-quote-sector]');
  const nameInput = root.querySelector('[data-quote-name]');
  const companyInput = root.querySelector('[data-quote-company]');
  const emailInput = root.querySelector('[data-quote-email]');
  const honeypotInput = root.querySelector('[data-quote-honeypot]');
  const completeButton = root.querySelector('[data-complete-public-quote]');
  const submitStatus = root.querySelector('[data-quote-submit-status]');
  const completedPanel = document.querySelector('[data-quote-complete]');
  const completedRange = document.querySelector('[data-completed-range]');
  const completedSummary = document.querySelector('[data-completed-summary]');
  const completedDelivery = document.querySelector('[data-completed-delivery]');

  const speedOptions = [...root.querySelectorAll('[data-quote-speed-option]')].map((node) => ({
    index: Number(node.dataset.index),
    weeks: Number(node.dataset.weeks),
    label: node.dataset.label || '',
    base: Number(node.dataset.base),
    note: node.dataset.note || '',
  }));
  const employeeBands = [...root.querySelectorAll('[data-employee-band]')].map((node) => ({
    id: node.dataset.id || '',
    label: node.dataset.label || '',
    min: Number(node.dataset.min),
    max: Number(node.dataset.max),
    amount: Number(node.dataset.amount),
  }));
  const standardInputs = [...root.querySelectorAll('input[name="quote_standard"]')];
  const depthInputs = [...root.querySelectorAll('input[name="quote_delivery_depth"]')];
  const complexityInputs = [...root.querySelectorAll('input[name="quote_complexity"]')];

  const requiredNodesPresent = [
    speedSlider,
    speedLabel,
    speedNote,
    rangeNode,
    summaryNode,
    meterNode,
    standardGroup,
    standardError,
    stageSelect,
    employeeInput,
    sectorSelect,
    emailInput,
    completeButton,
    submitStatus,
    completedPanel,
    completedRange,
    completedSummary,
    completedDelivery,
  ].every(Boolean);

  const configurationValid =
    requiredNodesPresent &&
    schemaVersion === EXPECTED_SCHEMA_VERSION &&
    /^[A-Z]{3}$/.test(currency) &&
    Number.isSafeInteger(floor) && floor >= 0 &&
    Number.isSafeInteger(ceiling) && ceiling > floor &&
    Number.isSafeInteger(midpointFloor) && midpointFloor >= floor &&
    Number.isSafeInteger(midpointCeiling) && midpointCeiling >= midpointFloor && midpointCeiling <= ceiling &&
    Number.isSafeInteger(roundTo) && roundTo > 0 &&
    Number.isFinite(lowerFactor) && lowerFactor > 0 &&
    Number.isFinite(upperFactor) && upperFactor >= lowerFactor &&
    speedOptions.length > 0 && employeeBands.length > 0 && standardInputs.length > 0 && depthInputs.length > 0 && complexityInputs.length > 0;

  const failClosed = () => {
    root.dataset.quoteRuntime = 'invalid';
    if (rangeNode instanceof HTMLElement) rangeNode.textContent = 'Estimate unavailable';
    if (summaryNode instanceof HTMLElement) summaryNode.textContent = 'Quote configuration could not be validated. Please contact hello@canonical.plus.';
    if (completeButton instanceof HTMLButtonElement) completeButton.disabled = true;
  };

  root.dataset.quoteRuntime = 'booting';
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
      const roundMoney = (value) => Math.round(value / roundTo) * roundTo;
      const checkedInputs = (name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)];
      const selectedRadio = (name) => root.querySelector(`input[name="${name}"]:checked`);
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const scrollBehavior = reducedMotion ? 'auto' : 'smooth';

      const selectedOption = (select) => select instanceof HTMLSelectElement ? select.selectedOptions[0] : null;
      const selectedSpeed = () => speedOptions.find((option) => option.index === Number(speedSlider.value)) || speedOptions[0];
      const selectedEmployeeBand = (count) => employeeBands.find((band) => count >= band.min && count <= band.max) || employeeBands[employeeBands.length - 1];

      const calculate = () => {
        const speed = selectedSpeed();
        const standards = checkedInputs('quote_standard');
        const depth = selectedRadio('quote_delivery_depth');
        const complexity = selectedRadio('quote_complexity');
        const stage = selectedOption(stageSelect);
        const sector = selectedOption(sectorSelect);
        const employeeCount = clamp(Math.round(Number(employeeInput.value) || 1), 1, 1000000);
        const employeeBand = selectedEmployeeBand(employeeCount);

        const standardAmount = standards.reduce((total, input) => total + Number(input.dataset.amount || 0), 0);
        const depthAmount = depth instanceof HTMLInputElement ? Number(depth.dataset.amount || 0) : 0;
        const complexityAmount = complexity instanceof HTMLInputElement ? Number(complexity.dataset.amount || 0) : 0;
        const sectorAmount = sector instanceof HTMLOptionElement ? Number(sector.dataset.amount || 0) : 0;
        const stageMultiplier = stage instanceof HTMLOptionElement ? Number(stage.dataset.multiplier || 1) : 1;

        const rawMidpoint = (speed.base + standardAmount + depthAmount + complexityAmount + employeeBand.amount + sectorAmount) * stageMultiplier;
        const midpoint = clamp(rawMidpoint, midpointFloor, midpointCeiling);
        const lower = clamp(roundMoney(midpoint * lowerFactor), floor, ceiling);
        const upper = clamp(roundMoney(midpoint * upperFactor), lower, ceiling);
        const standardLabels = standards.map((input) => input.dataset.label).filter(Boolean);
        const depthLabel = depth instanceof HTMLInputElement ? depth.dataset.label || '' : '';
        const complexityLabel = complexity instanceof HTMLInputElement ? complexity.dataset.label || '' : '';
        const stageLabel = stage instanceof HTMLOptionElement ? stage.dataset.label || stage.textContent || '' : '';
        const sectorLabel = sector instanceof HTMLOptionElement ? sector.dataset.label || sector.textContent || '' : '';
        const summary = `${stageLabel} · ${employeeBand.label} · ${sectorLabel} · ${standardLabels.join(' + ') || 'No standard selected'} · ${depthLabel} · ${complexityLabel}`;

        return {
          speed,
          standards,
          depth,
          complexity,
          stage,
          sector,
          employeeCount,
          employeeBand,
          lower,
          upper,
          midpoint,
          summary,
          standardLabels,
          depthLabel,
          complexityLabel,
          stageLabel,
          sectorLabel,
        };
      };

      const render = () => {
        const quote = calculate();
        speedLabel.textContent = quote.speed.label;
        speedNote.textContent = quote.speed.note;
        speedSlider.setAttribute('aria-valuetext', quote.speed.label);
        rangeNode.textContent = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
        summaryNode.textContent = quote.summary;
        employeeInput.value = String(quote.employeeCount);
        const percentage = ((quote.midpoint - floor) / Math.max(1, ceiling - floor)) * 100;
        meterNode.style.width = `${clamp(percentage, 4, 100)}%`;
        if (quote.standards.length > 0) {
          standardError.hidden = true;
          standardGroup.removeAttribute('aria-invalid');
        }
        return quote;
      };

      const invalidateCompletedQuote = () => {
        if (!completedPanel.hidden) completedPanel.hidden = true;
        submitStatus.textContent = '';
        delete submitStatus.dataset.state;
      };

      root.addEventListener('input', () => { invalidateCompletedQuote(); render(); });
      root.addEventListener('change', () => { invalidateCompletedQuote(); render(); });

      completeButton.addEventListener('click', async () => {
        const quote = render();
        if (quote.standards.length === 0) {
          standardGroup.setAttribute('aria-invalid', 'true');
          standardError.hidden = false;
          standardError.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
          return;
        }
        if (!(emailInput instanceof HTMLInputElement) || !emailInput.reportValidity()) return;
        if (honeypotInput instanceof HTMLInputElement && honeypotInput.value) return;

        const rangeText = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
        completedRange.textContent = rangeText;
        completedSummary.textContent = quote.summary;
        completeButton.disabled = true;
        submitStatus.textContent = 'Sending your estimate…';
        submitStatus.dataset.state = 'pending';

        if (!intakeEndpoint) {
          submitStatus.textContent = 'Email delivery is being configured. Your estimate is ready; please send it to hello@canonical.plus for now.';
          submitStatus.dataset.state = 'error';
          completedDelivery.textContent = 'Automatic email delivery is not configured on this deployment yet. Email hello@canonical.plus and include the estimate shown above.';
          completedPanel.hidden = false;
          completeButton.disabled = false;
          completedPanel.focus({ preventScroll: true });
          completedPanel.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
          return;
        }

        const payload = {
          kind: 'quote',
          schema_version: schemaVersion,
          contact: {
            name: nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '',
            email: emailInput.value.trim(),
            company: companyInput instanceof HTMLInputElement ? companyInput.value.trim() : '',
          },
          company_profile: {
            stage: quote.stage instanceof HTMLOptionElement ? quote.stage.value : '',
            employee_count: quote.employeeCount,
            employee_band: quote.employeeBand.id,
            sector: quote.sector instanceof HTMLOptionElement ? quote.sector.value : '',
          },
          scope: {
            delivery_weeks: quote.speed.weeks,
            standards: quote.standards.map((input) => input.value),
            delivery_depth: quote.depth instanceof HTMLInputElement ? quote.depth.value : '',
            complexity: quote.complexity instanceof HTMLInputElement ? quote.complexity.value : '',
          },
          estimate: {
            currency,
            lower: quote.lower,
            upper: quote.upper,
            summary: quote.summary,
          },
          source: 'canonical.plus/quote',
        };

        try {
          const response = await fetch(intakeEndpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'omit',
            referrerPolicy: 'strict-origin-when-cross-origin',
          });
          if (!response.ok) throw new Error(`intake returned ${response.status}`);

          submitStatus.textContent = `Estimate sent to ${emailInput.value.trim()}.`;
          submitStatus.dataset.state = 'success';
          completedDelivery.textContent = `We sent the estimate to ${emailInput.value.trim()} and copied hello@canonical.plus.`;
          completedPanel.hidden = false;
          completedPanel.focus({ preventScroll: true });
          completedPanel.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
        } catch {
          submitStatus.textContent = 'We could not send the email automatically. Your estimate is still available here; contact hello@canonical.plus and we can follow up.';
          submitStatus.dataset.state = 'error';
          completedDelivery.textContent = 'Automatic delivery failed. Your estimate remains visible above; email hello@canonical.plus for follow-up.';
          completedPanel.hidden = false;
        } finally {
          completeButton.disabled = false;
        }
      });

      render();
    }
  }
}
