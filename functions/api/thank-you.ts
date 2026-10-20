interface Env {
  RESEND_API_KEY?: string;
  THANKS_TO_EMAIL?: string;
  EMAIL_FROM?: string;
  TURNSTILE_SECRET_KEY?: string;
}

interface ThankYouPayload {
  name?: unknown;
  message?: unknown;
  website?: unknown;
  turnstileToken?: unknown;
}

interface TurnstileResult {
  success: boolean;
  hostname?: string;
}

interface RateBucket {
  count: number;
  expiresAt: number;
}

const recentRequests = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 3;

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function isRateLimited(ip: string | null): boolean {
  if (!ip) return false;
  const now = Date.now();
  for (const [key, bucket] of recentRequests) {
    if (bucket.expiresAt <= now) recentRequests.delete(key);
  }
  if (recentRequests.size > 1000) {
    const oldestKey = recentRequests.keys().next().value;
    if (oldestKey) recentRequests.delete(oldestKey);
  }

  const bucket = recentRequests.get(ip);
  if (!bucket || bucket.expiresAt <= now) {
    recentRequests.set(ip, { count: 1, expiresAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (bucket.count >= RATE_LIMIT) return true;
  bucket.count += 1;
  return false;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  if (request.headers.get('Origin') !== url.origin) return json({ error: 'INVALID_ORIGIN' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ error: 'JSON_REQUIRED' }, 415);
  }

  if (!env.RESEND_API_KEY || !env.THANKS_TO_EMAIL || !env.EMAIL_FROM || !env.TURNSTILE_SECRET_KEY) {
    return json({ error: 'EMAIL_SERVICE_NOT_CONFIGURED' }, 503);
  }
  if (/[\r\n]/.test(env.EMAIL_FROM) || /[\r\n]/.test(env.THANKS_TO_EMAIL)) {
    return json({ error: 'EMAIL_SERVICE_NOT_CONFIGURED' }, 503);
  }

  let payload: ThankYouPayload;
  try {
    const raw = await request.text();
    if (raw.length > 10_000) return json({ error: 'REQUEST_TOO_LARGE' }, 413);
    payload = JSON.parse(raw) as ThankYouPayload;
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }

  if (typeof payload.website === 'string' && payload.website.trim()) {
    return json({ ok: true });
  }

  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const name =
    typeof payload.name === 'string'
      ? payload.name
          .replace(/[\u0000-\u001f\u007f]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 60)
      : '';
  const token = typeof payload.turnstileToken === 'string' ? payload.turnstileToken : '';
  if (message.length < 4 || message.length > 600 || token.length < 10 || token.length > 2048) {
    return json({ error: 'INVALID_FORM' }, 400);
  }

  const verifyBody: { secret: string; response: string; remoteip?: string } = {
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  };
  const remoteIp = request.headers.get('CF-Connecting-IP');
  if (remoteIp) verifyBody.remoteip = remoteIp;

  let verification: TurnstileResult;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyBody),
    });
    if (!response.ok) return json({ error: 'VERIFICATION_UNAVAILABLE' }, 502);
    verification = (await response.json()) as TurnstileResult;
  } catch {
    return json({ error: 'VERIFICATION_UNAVAILABLE' }, 502);
  }

  if (!verification.success || verification.hostname !== url.hostname) {
    return json({ error: 'VERIFICATION_FAILED' }, 400);
  }
  if (isRateLimited(remoteIp)) return json({ error: 'RATE_LIMITED' }, 429);

  const emailText = [
    'Lời nhắn mới gửi qua thiệp Ngày Phụ nữ Việt Nam 20/10.',
    `Người gửi: ${name || 'Không ghi tên'}`,
    '',
    message,
  ].join('\n');

  try {
    const idempotencyDigest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(token),
    );
    const idempotencyKey = Array.from(new Uint8Array(idempotencyDigest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [env.THANKS_TO_EMAIL],
        subject: 'Lời nhắn qua thiệp 20/10',
        text: emailText,
      }),
    });
    if (!response.ok) return json({ error: 'EMAIL_DELIVERY_FAILED' }, 502);
  } catch {
    return json({ error: 'EMAIL_DELIVERY_FAILED' }, 502);
  }

  return json({ ok: true });
}
