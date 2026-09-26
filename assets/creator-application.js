const form = document.querySelector('#creator-form');
const status = document.querySelector('#application-status');
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  status.textContent = 'Saving your application…';
  try {
    const payload = Object.fromEntries(new FormData(form));
    payload.consent = form.elements.consent.checked;
    const response = await fetch('https://lmzzcnbtzjqwnufmtdjh.supabase.co/functions/v1/creator-application', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw Error();
    status.textContent = 'Application received. We’ll review your channel and contact you by email. Applying does not enroll you or start your 90-day pilot.';
    form.reset();
  } catch {
    status.textContent = 'We couldn’t save your application. Please try again. If it continues, contact hello@unhingednav.com.';
  } finally { button.disabled = false; }
});
