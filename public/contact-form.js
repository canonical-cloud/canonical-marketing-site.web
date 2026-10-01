const form = document.querySelector('[data-contact-form]');

if (form instanceof HTMLFormElement) {
  const status = form.querySelector('[data-contact-status]');
  const submit = form.querySelector('button[type="submit"]');
  const supabaseUrl = (form.dataset.supabaseUrl || '').replace(/\/+$/, '');
  const supabaseKey = form.dataset.supabaseKey || '';

  const setStatus = (message, error = false) => {
    if (!(status instanceof HTMLElement)) return;
    status.textContent = message;
    status.dataset.error = error ? 'true' : 'false';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!supabaseUrl || !supabaseKey) {
      setStatus('The contact form is temporarily unavailable. Please email hello@canonical.plus.', true);
      return;
    }

    const data = new FormData(form);
    const payload = {
      kind: 'contact',
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      company: String(data.get('company') || '').trim(),
      topic: String(data.get('topic') || '').trim(),
      message: String(data.get('message') || '').trim(),
      source: 'canonical.plus/contact',
    };

    if (submit instanceof HTMLButtonElement) submit.disabled = true;
    setStatus('Sending…');
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
      if (!response.ok) throw new Error(`contact delivery failed: ${response.status}`);
      form.reset();
      setStatus('Message sent. We’ll reply from hello@canonical.plus.');
    } catch {
      setStatus('We could not send the form. Please email hello@canonical.plus.', true);
    } finally {
      if (submit instanceof HTMLButtonElement) submit.disabled = false;
    }
  });
}
