import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { ENV } from "./env";

/**
 * Secret material for at-rest encryption and OAuth state signing.
 *
 * Both keys are derived from the JWT_SECRET that already backs session cookies,
 * via HKDF with distinct `info` labels. Deriving rather than adding a new
 * environment secret keeps deployment a no-op, and the distinct labels mean the
 * encryption key and the signing key are cryptographically independent — one
 * leaking does not compromise the other, and neither can be used in place of
 * the session secret itself.
 *
 * Rotating JWT_SECRET invalidates stored ciphertext. That is survivable: the
 * only encrypted values are Gmail OAuth tokens, and the failure mode is a
 * prompt to reconnect Gmail (see `decryptSecret`).
 */
const HKDF_SALT = Buffer.from("close-looper/v1");

function deriveKey(info: string): Buffer | null {
  const secret = ENV.cookieSecret;
  if (!secret) {
    // Production must never run unencrypted. Locally and under test there is no
    // JWT_SECRET, so callers fall back to passthrough (see below).
    if (ENV.isProduction) {
      throw new Error(
        "JWT_SECRET is required to encrypt stored credentials. Refusing to run without it."
      );
    }
    return null;
  }
  return Buffer.from(hkdfSync("sha256", secret, HKDF_SALT, info, 32));
}

// ─── At-rest encryption (AES-256-GCM) ────────────────────────────────────────

const CIPHER_PREFIX = "v1:";

/**
 * Encrypts a secret for storage. Values are tagged `v1:` so `decryptSecret` can
 * distinguish ciphertext from rows written before encryption existed.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = deriveKey("gmail-token-encryption");
  if (!key) return plaintext; // dev/test without JWT_SECRET

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    CIPHER_PREFIX + iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

/**
 * Decrypts a stored secret.
 *
 * Untagged values are returned as-is: rows written before this change are
 * plaintext, and are re-encrypted the next time they are written (token
 * refresh). That makes the rollout a lazy migration with no backfill step.
 *
 * Throws on tampered or undecryptable ciphertext rather than returning
 * something wrong — callers treat that as "reconnect Gmail".
 */
export function decryptSecret(stored: string): string {
  if (!stored || !stored.startsWith(CIPHER_PREFIX)) return stored;

  const key = deriveKey("gmail-token-encryption");
  if (!key) throw new Error("Cannot decrypt stored credential: no JWT_SECRET configured.");

  const [ivPart, tagPart, ctPart] = stored.slice(CIPHER_PREFIX.length).split(":");
  if (!ivPart || !tagPart || !ctPart) throw new Error("Malformed encrypted credential.");

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** True when the value is stored ciphertext rather than a legacy plaintext row. */
export function isEncrypted(stored: string): boolean {
  return typeof stored === "string" && stored.startsWith(CIPHER_PREFIX);
}

// ─── Signed OAuth state ──────────────────────────────────────────────────────

export type GmailOAuthState = { userId: number; exp: number };

const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Signs the Gmail OAuth `state` parameter.
 *
 * Previously `state` was the bare user id, so anyone could complete an OAuth
 * dance and name an arbitrary user in the callback — attaching their mailbox to
 * someone else's account. The HMAC makes the user id unforgeable and the
 * expiry bounds replay.
 */
export function signGmailState(userId: number): string {
  const key = deriveKey("gmail-oauth-state");
  const payload: GmailOAuthState = { userId, exp: Date.now() + STATE_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  if (!key) return `${body}.dev`; // dev/test without JWT_SECRET
  const mac = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${mac}`;
}

/** Verifies a signed state. Returns null for anything forged, stale, or malformed. */
export function verifyGmailState(state: string): GmailOAuthState | null {
  if (!state) return null;
  const idx = state.lastIndexOf(".");
  if (idx <= 0) return null;

  const body = state.slice(0, idx);
  const mac = state.slice(idx + 1);
  const key = deriveKey("gmail-oauth-state");

  if (key) {
    const expected = createHmac("sha256", key).update(body).digest("base64url");
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } else if (mac !== "dev") {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof parsed?.userId !== "number" || typeof parsed?.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return parsed as GmailOAuthState;
  } catch {
    return null;
  }
}
