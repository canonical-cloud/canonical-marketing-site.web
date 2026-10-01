const form = document.querySelector('[data-contact-form]');

if (form instanceof HTMLFormElement) {
  const statusNode = form.querySelector('[data-contact-status]');
  const submitButton = form.querySelector('button[type="submit"]');
  const endpoint = form.dataset.intakeEndpoint || '';

  const setStatus = (message, state) => {
    if (!(statusNode instanceof HTMLElement)) return;
    statusNode.textContent = message;
    if (state) statusNode.dataset.state = state;
    else delete statusNode.dataset.state;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    if (String(data.get('website') || '').trim()) return;

    if (!endpoint) {
      setStatus('Automatic delivery is being configured. Please email hello@canonical.plus directly for now.', 'error');
      return;
    }

    const payload = {
      kind: 'contact',
      contact: {
        name: String(data.get('name') || '').trim(),
        email: String(data.get('email') || '').trim(),
        company: String(data.get('company') || '').trim(),
      },
      topic: String(data.get('topic') || '').trim(),
      message: String(data.get('message') || '').trim(),
      source: 'canonical.plus/contact',
    };

    if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;
    setStatus('Sending…', 'pending');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'omit',
        referrerPolicy: 'strict-origin-when-cross-origin',
      });
      if (!response.ok) throw new Error(`intake returned ${response.status}`);
      form.reset();
      setStatus('Message sent. We also delivered a copy to hello@canonical.plus.', 'success');
    } catch {
      setStatus('We could not send the form automatically. Please email hello@canonical.plus directly.', 'error');
    } finally {
      if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
    }
  });
}
