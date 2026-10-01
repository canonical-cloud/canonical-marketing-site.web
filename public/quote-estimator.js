const root = document.querySelector('[data-quote-estimator]');

if (root instanceof HTMLElement) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: root.dataset.currency || 'USD',
    maximumFractionDigits: 0,
  });

  const number = (name) => Number(root.dataset[name]);
  const floor = number('floor');
  const ceiling = number('ceiling');
  const midpointFloor = number('midpointFloor');
  const midpointCeiling = number('midpointCeiling');
  const roundTo = number('roundTo');
  const lowerFactor = number('lowerFactor');
  const upperFactor = number('upperFactor');
  const supabaseUrl = (root.dataset.supabaseUrl || '').replace(/\/+$/, '');
  const supabaseKey = root.dataset.supabaseKey || '';

  const speedSlider = root.querySelector('[data-quote-speed-slider]');
  const rangeNode = root.querySelector('[data-quote-range]');
  const summaryNode = root.querySelector('[data-quote-summary]');
  const meterNode = root.querySelector('[data-quote-meter]');
  const statusNode = root.querySelector('[data-quote-status]');
  const completeButton = root.querySelector('[data-complete-public-quote]');
  const standardError = root.querySelector('[data-standard-error]');
  const completedPanel = document.querySelector('[data-quote-complete]');
  const completedRange = document.querySelector('[data-completed-range]');
  const completedSummary = document.querySelector('[data-completed-summary]');
  const speedOptions = [...root.querySelectorAll('[data-option="speed"]')].map((node) => ({
    index: Number(node.dataset.index),
    id: node.dataset.id || '',
    label: node.dataset.label || '',
    amount: Number(node.dataset.amount),
  }));

  const selectedInput = (name) => root.querySelector(`input[name="${name}"]:checked`);
  const selectedOption = (name) => root.querySelector(`select[name="${name}"] option:checked`);
  const checked = (name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)];

  const valueOf = (node) => Number(node?.dataset?.amount || 0);
  const labelOf = (node) => node?.dataset?.label || '';

  const calculate = () => {
    const speed = speedOptions[Number(speedSlider?.value || 0)] || speedOptions[0];
    const standards = checked('quote_standard');
    const depth = selectedInput('quote_delivery_depth');
    const complexity = selectedInput('quote_complexity');
    const orgType = selectedOption('quote_organization_type');
    const employees = selectedOption('quote_employee_band');
    const sector = selectedOption('quote_sector');
    const additions =
      standards.reduce((sum, item) => sum + valueOf(item), 0) +
      valueOf(depth) + valueOf(complexity) + valueOf(orgType) + valueOf(employees) + valueOf(sector);
    const midpoint = clamp(speed.amount + additions, midpointFloor, midpointCeiling);
    const roundMoney = (value) => Math.round(value / roundTo) * roundTo;
    const lower = clamp(roundMoney(midpoint * lowerFactor), floor, ceiling);
    const upper = clamp(roundMoney(midpoint * upperFactor), lower, ceiling);
    const frameworkLabels = standards.map(labelOf).filter(Boolean);
    const summary = [
      speed.label,
      frameworkLabels.join(' + ') || 'No framework selected',
      labelOf(depth),
      labelOf(complexity),
      labelOf(orgType),
      labelOf(employees),
      labelOf(sector),
    ].filter(Boolean).join(' · ');
    return { speed, standards, depth, complexity, orgType, employees, sector, midpoint, lower, upper, summary };
  };

  const render = () => {
    const quote = calculate();
    if (rangeNode) rangeNode.textContent = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
    if (summaryNode) summaryNode.textContent = quote.summary;
    if (meterNode) {
      const pct = ((quote.midpoint - floor) / Math.max(1, ceiling - floor)) * 100;
      meterNode.style.width = `${clamp(pct, 4, 100)}%`;
    }
    return quote;
  };

  const setStatus = (message, error = false) => {
    if (!(statusNode instanceof HTMLElement)) return;
    statusNode.textContent = message;
    statusNode.dataset.error = error ? 'true' : 'false';
  };

  root.addEventListener('input', () => {
    if (completedPanel instanceof HTMLElement) completedPanel.hidden = true;
    render();
  });
  root.addEventListener('change', () => {
    if (completedPanel instanceof HTMLElement) completedPanel.hidden = true;
    render();
  });

  completeButton?.addEventListener('click', async () => {
    const quote = render();
    if (quote.standards.length === 0) {
      if (standardError instanceof HTMLElement) standardError.hidden = false;
      return;
    }
    if (standardError instanceof HTMLElement) standardError.hidden = true;

    const emailInput = root.querySelector('input[name="quote_email"]');
    const companyInput = root.querySelector('input[name="quote_company"]');
    if (!(emailInput instanceof HTMLInputElement) || !(companyInput instanceof HTMLInputElement) ||
        !emailInput.reportValidity() || !companyInput.reportValidity()) return;

    if (!supabaseUrl || !supabaseKey) {
      setStatus('Quote email is temporarily unavailable. Please email hello@canonical.plus.', true);
      return;
    }

    const payload = {
      kind: 'quote',
      email: emailInput.value.trim(),
      company: companyInput.value.trim(),
      range: { lowerUsd: quote.lower, upperUsd: quote.upper, currency: root.dataset.currency || 'USD' },
      scope: {
        deliverySpeed: quote.speed.label,
        standards: quote.standards.map(labelOf),
        serviceDepth: labelOf(quote.depth),
        complexity: labelOf(quote.complexity),
        organizationType: labelOf(quote.orgType),
        employeeBand: labelOf(quote.employees),
        sector: labelOf(quote.sector),
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
          apikey: supabaseKey,
          authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`quote delivery failed: ${response.status}`);
      if (completedRange instanceof HTMLElement) completedRange.textContent = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
      if (completedSummary instanceof HTMLElement) completedSummary.textContent = quote.summary;
      if (completedPanel instanceof HTMLElement) {
        completedPanel.hidden = false;
        completedPanel.focus({ preventScroll: true });
        completedPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setStatus('Quote sent successfully.');
    } catch {
      setStatus('We could not send the quote. Please email hello@canonical.plus and we will help.', true);
    } finally {
      completeButton.disabled = false;
    }
  });

  render();
}
