import { createHmac, timingSafeEqual } from "crypto";

/**
 * توكن بسيط وموقّع (HMAC) بنحطه في كوكي httpOnly بعد ما اليوزر يدخل باسورد Rooms صح.
 * كده مش محتاجين نخزن سيشنز في قاعدة بيانات، وفي نفس الوقت التوكن مش قابل للتزوير
 * لأنه موقّع بسر (ROOMS_SESSION_SECRET) موجود على السيرفر بس.
 */

export const ROOMS_COOKIE_NAME = "viora_rooms_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 ساعة

function getSecret(): string {
  const secret = process.env.ROOMS_SESSION_SECRET;
  if (!secret) {
    throw new Error("ROOMS_SESSION_SECRET مش متضاف في .env.local");
  }
  return secret;
}

export function createRoomsSessionToken(): string {
  const issuedAt = Date.now().toString();
  const signature = createHmac("sha256", getSecret()).update(issuedAt).digest("hex");
  return `${issuedAt}.${signature}`;
}

export function verifyRoomsSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return false;

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > SESSION_MAX_AGE_SECONDS * 1000) return false;

  const expected = createHmac("sha256", getSecret()).update(issuedAt).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const ROOMS_COOKIE_MAX_AGE = SESSION_MAX_AGE_SECONDS;
