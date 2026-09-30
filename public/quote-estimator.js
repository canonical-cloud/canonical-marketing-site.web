const root = document.querySelector('[data-quote-estimator]');

if (root instanceof HTMLElement) {
  const currency = root.dataset.currency || 'USD';
  const floor = Number(root.dataset.floor || 5000);
  const ceiling = Number(root.dataset.ceiling || 15000);
  const midpointFloor = Number(root.dataset.midpointFloor || floor);
  const midpointCeiling = Number(root.dataset.midpointCeiling || ceiling);
  const roundTo = Number(root.dataset.roundTo || 500);
  const lowerFactor = Number(root.dataset.lowerFactor || 0.9);
  const upperFactor = Number(root.dataset.upperFactor || 1.12);

  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const roundMoney = (value) => Math.round(value / roundTo) * roundTo;

  const speedSlider = root.querySelector('[data-quote-speed-slider]');
  const speedLabel = root.querySelector('[data-speed-label]');
  const speedNote = root.querySelector('[data-speed-note]');
  const rangeNode = root.querySelector('[data-quote-range]');
  const summaryNode = root.querySelector('[data-quote-summary]');
  const meterNode = root.querySelector('[data-quote-meter]');
  const standardError = root.querySelector('[data-standard-error]');
  const completeButton = root.querySelector('[data-complete-public-quote]');
  const completedPanel = document.querySelector('[data-quote-complete]');
  const completedRange = document.querySelector('[data-completed-range]');
  const completedSummary = document.querySelector('[data-completed-summary]');

  const speedOptions = [...root.querySelectorAll('[data-quote-speed-option]')].map((node) => ({
    index: Number(node.dataset.index),
    weeks: Number(node.dataset.weeks),
    label: node.dataset.label || '',
    base: Number(node.dataset.base || 0),
    note: node.dataset.note || '',
  }));

  const checkedInputs = (name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)];
  const selectedRadio = (name) => root.querySelector(`input[name="${name}"]:checked`);

  const selectedSpeed = () => {
    const index = speedSlider instanceof HTMLInputElement ? Number(speedSlider.value) : 0;
    return speedOptions.find((option) => option.index === index) || speedOptions[0];
  };

  const calculate = () => {
    const speed = selectedSpeed();
    const standards = checkedInputs('quote_standard');
    const depth = selectedRadio('quote_delivery_depth');
    const complexity = selectedRadio('quote_complexity');

    const standardAmount = standards.reduce((total, input) => total + Number(input.dataset.amount || 0), 0);
    const depthAmount = depth instanceof HTMLInputElement ? Number(depth.dataset.amount || 0) : 0;
    const complexityAmount = complexity instanceof HTMLInputElement ? Number(complexity.dataset.amount || 0) : 0;

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
    if (rangeNode) rangeNode.textContent = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
    if (summaryNode) summaryNode.textContent = quote.summary;
    if (meterNode instanceof HTMLElement) {
      const percentage = ((quote.midpoint - floor) / Math.max(1, ceiling - floor)) * 100;
      meterNode.style.width = `${clamp(percentage, 4, 100)}%`;
    }
    if (standardError instanceof HTMLElement && quote.standards.length > 0) {
      standardError.hidden = true;
    }

    return quote;
  };

  root.addEventListener('input', render);
  root.addEventListener('change', render);

  if (completeButton instanceof HTMLButtonElement) {
    completeButton.addEventListener('click', () => {
      const quote = render();
      if (quote.standards.length === 0) {
        if (standardError instanceof HTMLElement) {
          standardError.hidden = false;
          standardError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      if (completedRange) completedRange.textContent = `${money.format(quote.lower)}–${money.format(quote.upper)}`;
      if (completedSummary) completedSummary.textContent = quote.summary;
      if (completedPanel instanceof HTMLElement) {
        completedPanel.hidden = false;
        completedPanel.focus({ preventScroll: true });
        completedPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  render();
}
