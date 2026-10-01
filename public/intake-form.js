const EMAIL = 'hello@canonical.plus';

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);

for (const form of document.querySelectorAll('[data-intake-form]')) {
  if (!(form instanceof HTMLFormElement)) continue;

  const status = form.querySelector('[data-intake-status]');
  const submit = form.querySelector('button[type="submit"]');
  const endpoint = clean(form.dataset.intakeEndpoint, 2048);
  const kind = clean(form.dataset.intakeKind, 32) || 'contact';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const values = Object.fromEntries(new FormData(form).entries());
    if (clean(values.company_website, 256)) {
      form.reset();
      return;
    }

    if (!(status instanceof HTMLElement) || !(submit instanceof HTMLButtonElement)) return;

    if (!endpoint) {
      status.dataset.state = 'error';
      status.textContent = `Online delivery is being activated. Please email ${EMAIL} and we will respond from the same address.`;
      return;
    }

    const payload = {
      kind,
      contact_name: clean(values.contact_name, 120),
      contact_email: clean(values.contact_email, 254).toLowerCase(),
      organization_name: clean(values.organization_name, 160),
      target_date: clean(values.target_date, 32) || null,
      notes: clean(values.notes, 2000) || null,
      estimate_range: clean(values.estimate_range, 80) || null,
      estimate_summary: clean(values.estimate_summary, 1000) || null,
      company_profile: clean(values.company_profile, 64) || null,
      employee_band: clean(values.employee_band, 64) || null,
      sector: clean(values.sector, 96) || null,
      source_url: window.location.href.slice(0, 2048),
      submitted_at: new Date().toISOString(),
    };

    status.dataset.state = 'sending';
    status.textContent = kind === 'quote' ? 'Sending your quote…' : 'Sending your message…';
    submit.disabled = true;

    try {
      const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': requestId,
        },
        body: JSON.stringify(payload),
        credentials: 'omit',
        referrerPolicy: 'strict-origin-when-cross-origin',
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'request_failed');

      status.dataset.state = 'success';
      status.textContent = kind === 'quote'
        ? `Quote sent. Check your inbox; ${EMAIL} received a copy for follow-up.`
        : `Message sent to ${EMAIL}. We also sent a receipt to your inbox.`;
      form.dataset.submitted = 'true';
    } catch {
      status.dataset.state = 'error';
      status.textContent = `We could not send this form. Please email ${EMAIL} instead.`;
    } finally {
      submit.disabled = false;
    }
  });
}
