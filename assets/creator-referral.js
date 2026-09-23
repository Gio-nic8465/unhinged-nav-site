// Only carry an explicit URL code during this visit. No cookies or persistent tracking.
(function (root) {
  const normalize = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value.toUpperCase() : null;
  const codeFrom = search => normalize(new URLSearchParams(search).get('ref'));
  root.UnhingedReferral = { normalize, codeFrom };
  if (!root.document) return;
  const code = codeFrom(root.location.search);
  if (!code) return;
  root.document.querySelectorAll('a[href]').forEach(link => {
    const url = new URL(link.getAttribute('href'), root.location.href);
    if (url.origin !== root.location.origin || !/^https?:$/.test(url.protocol)) return;
    url.searchParams.set('ref', code);
    link.setAttribute('href', url.pathname + url.search + url.hash);
  });
})(typeof window === 'undefined' ? globalThis : window);
