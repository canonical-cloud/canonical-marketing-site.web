const form = document.querySelector('[data-contact-intake-form]');

if (form instanceof HTMLFormElement) {
  const INTAKE_ENDPOINT = 'https://forms.canonical.plus/v1/intake';
  const submit = form.querySelector('[data-contact-submit]');
  const status = form.querySelector('[data-contact-status]');

  if (!(submit instanceof HTMLButtonElement) || !(status instanceof HTMLElement)) {
    form.setAttribute('aria-disabled', 'true');
  } else {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      status.textContent = '';
      delete status.dataset.state;

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const values = new FormData(form);
      const payload = {
        kind: 'contact',
        source: 'canonical.plus/contact',
        displayName: String(values.get('displayName') || '').trim(),
        email: String(values.get('email') || '').trim(),
        organizationName: String(values.get('organizationName') || '').trim(),
        topic: String(values.get('topic') || '').trim(),
        message: String(values.get('message') || '').trim(),
        website: String(values.get('website') || '').trim(),
      };

      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      status.textContent = 'Sending your message…';

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
        if (!response.ok) throw new Error(body?.error || 'contact_delivery_failed');

        form.reset();
        status.textContent = 'Message sent to hello@canonical.plus. We’ll reply to the work email you provided.';
        status.dataset.state = 'success';
      } catch (error) {
        status.textContent = 'We could not send the form right now. Please email hello@canonical.plus directly.';
        status.dataset.state = 'error';
        console.warn('contact form delivery failed', error instanceof Error ? error.message : 'unknown_error');
      } finally {
        window.clearTimeout(timeout);
        submit.disabled = false;
        submit.removeAttribute('aria-busy');
      }
    });
  }
}
