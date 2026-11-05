// The encrypted COS URL is bound to one browser session and one video path.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ticketLifetimeMs = 10 * 60_000;

async function ticketKey(secret) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode('study-media-v1:' + secret));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function issueMediaTicket(secret, session, path, cosUrl) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = encoder.encode(path + '\n' + session);
  const payload = encoder.encode(JSON.stringify({expires: Date.now() + ticketLifetimeMs, cosUrl}));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    {name: 'AES-GCM', iv, additionalData}, await ticketKey(secret), payload,
  ));
  return btoa(String.fromCharCode(...iv, ...encrypted)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export async function openMediaTicket(secret, request) {
  const url = new URL(request.url);
  const ticket = url.searchParams.get('play');
  const session = request.headers.get('cookie')?.match(/(?:^|;\s*)gi_participant=([a-f0-9]{48})(?=;|$)/)?.[1];
  if (!secret || !session || !ticket || !/^[A-Za-z0-9_-]{40,2048}$/.test(ticket)) return null;
  try {
    const bytes = Uint8Array.from(atob(ticket.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    const additionalData = encoder.encode(url.pathname + '\n' + session);
    const payload = await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData},
      await ticketKey(secret), bytes.slice(12),
    );
    const {expires, cosUrl} = JSON.parse(decoder.decode(payload));
    return expires > Date.now() && typeof cosUrl === 'string' ? cosUrl : null;
  } catch {
    return null;
  }
}
