import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * discordlist.gg (dlist.gg) delivers vote webhooks as an HS256 JWT "contained
 * within the request body" - the raw body IS the token, signed with the
 * operator's Webhook Authorization secret (docs, archived OpenAPI spec).
 * Claims: {user_id, bot_id, is_test}. This is a dependency-free verify:
 * standard three-segment base64url token, HMAC-SHA256 over "<header>.<payload>".
 */

/** true when the value is shaped like a JWT (three base64url segments). */
export function isJwtLike(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  );
}

/** Verifies an HS256 JWT and returns its claims object, or null on any failure. */
export function verifyJwtHs256(token: string, secret: string): Record<string, unknown> | null {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  try {
    const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as { alg?: unknown };
    if (header?.alg !== 'HS256') return null;
    const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest();
    const sig = Buffer.from(s, 'base64url');
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as unknown;
    return typeof claims === 'object' && claims !== null && !Array.isArray(claims)
      ? (claims as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
