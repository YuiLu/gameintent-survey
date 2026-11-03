// Preserve the current host, path, and query when upgrading public entry links.
// Local HTTP remains available for the isolated development/test server.
export function secureStudyUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
  url.protocol = 'https:';
  return url.href;
}
