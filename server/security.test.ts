import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Regression tests for the tenant-isolation and credential-handling fixes.
 *
 * Each test here fails against the code as it stood before those fixes — that
 * is the point of them. The pre-existing suite passed throughout, because none
 * of it exercised an attacker's path.
 */

// The crypto module reads JWT_SECRET at import time, so set it before importing.
const withSecret = async () => {
  process.env.JWT_SECRET = "test-secret-not-used-in-production";
  vi.resetModules();
  return import("./_core/crypto");
};

// ─── #3 Credential encryption at rest ────────────────────────────────────────

describe("stored credential encryption", () => {
  it("round-trips a token through encrypt/decrypt", async () => {
    const { encryptSecret, decryptSecret } = await withSecret();
    const token = "ya29.a0AfB_byC-example-refresh-token";
    const stored = encryptSecret(token);

    expect(stored).not.toBe(token);
    expect(stored).not.toContain(token);
    expect(decryptSecret(stored)).toBe(token);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const { encryptSecret } = await withSecret();
    expect(encryptSecret("same-token")).not.toBe(encryptSecret("same-token"));
  });

  it("reads legacy plaintext rows unchanged, so no backfill is needed", async () => {
    const { decryptSecret, isEncrypted } = await withSecret();
    const legacy = "plaintext-token-written-before-encryption-existed";

    expect(isEncrypted(legacy)).toBe(false);
    expect(decryptSecret(legacy)).toBe(legacy);
  });

  it("rejects tampered ciphertext rather than returning wrong plaintext", async () => {
    const { encryptSecret, decryptSecret } = await withSecret();
    const stored = encryptSecret("sensitive");
    const tampered = stored.slice(0, -4) + "AAAA";

    expect(() => decryptSecret(tampered)).toThrow();
  });
});

// ─── #2 Gmail OAuth state forgery ────────────────────────────────────────────

describe("gmail oauth state", () => {
  it("accepts a state it signed", async () => {
    const { signGmailState, verifyGmailState } = await withSecret();
    expect(verifyGmailState(signGmailState(42))?.userId).toBe(42);
  });

  it("rejects a bare user id — the pre-fix format", async () => {
    const { verifyGmailState } = await withSecret();
    expect(verifyGmailState("42")).toBeNull();
  });

  it("rejects a forged state naming another user", async () => {
    const { verifyGmailState } = await withSecret();
    const forged = Buffer.from(
      JSON.stringify({ userId: 1, exp: Date.now() + 60_000 })
    ).toString("base64url");

    expect(verifyGmailState(forged)).toBeNull();
    expect(verifyGmailState(`${forged}.not-a-real-mac`)).toBeNull();
  });

  it("rejects a signed state whose payload was swapped to another user", async () => {
    const { signGmailState, verifyGmailState } = await withSecret();
    const mac = signGmailState(42).split(".")[1];
    const otherUser = Buffer.from(
      JSON.stringify({ userId: 99, exp: Date.now() + 60_000 })
    ).toString("base64url");

    expect(verifyGmailState(`${otherUser}.${mac}`)).toBeNull();
  });

  it("rejects an expired state", async () => {
    const { verifyGmailState, signGmailState } = await withSecret();
    const valid = signGmailState(7);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60 * 60 * 1000);

    expect(verifyGmailState(valid)).toBeNull();
    vi.restoreAllMocks();
  });
});

// ─── #1 Cross-tenant sending, #4 approval gate ───────────────────────────────

const OTHER_TENANTS_ACCOUNT_ID = 999;

vi.mock("./db", () => ({
  // Scoped lookup: returns undefined when the account is not the caller's.
  getGmailAccount: vi.fn(async (id: number, userId: number) =>
    id === OTHER_TENANTS_ACCOUNT_ID || userId !== 1
      ? undefined
      : { id, userId, gmailAddress: "me@example.com", accessToken: "tok", refreshToken: "r", isDefault: true }
  ),
  getGmailAccounts: vi.fn(async () => []),
  getEmailDraft: vi.fn(async (id: number) => ({
    id,
    userId: 1,
    contactId: 5,
    status: "pending",
    subject: "hi",
    body: "hello",
    trackingId: "t".repeat(32),
    gmailAccountId: 1,
  })),
  getContact: vi.fn(async () => ({ id: 5, userId: 1, firstName: "John", lastName: "Smith", email: "john@example.com" })),
  isEmailSuppressed: vi.fn(async () => false),
  updateEmailDraft: vi.fn(async () => undefined),
  updateContact: vi.fn(async () => undefined),
  createEmailEvent: vi.fn(async () => undefined),
  getEmailDrafts: vi.fn(async () => []),
  getVoiceProfile: vi.fn(async () => undefined),
  getTouchpoints: vi.fn(async () => []),
  createEmailDraft: vi.fn(async () => 1),
  getDb: vi.fn(async () => null),
}));

function ctxFor(userId: number): TrpcContext {
  return {
    user: {
      id: userId, openId: `user-${userId}`, email: `u${userId}@example.com`,
      name: "Test User", loginMethod: "manus", role: "user",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("cross-tenant gmail account use", () => {
  beforeEach(() => vi.resetModules());

  it("refuses to approve a draft against another tenant's gmail account", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(ctxFor(1));

    await expect(
      caller.drafts.approve({ id: 1, gmailAccountId: OTHER_TENANTS_ACCOUNT_ID })
    ).rejects.toThrow(/not found/i);
  });

  it("refuses to attach another tenant's gmail account via edit", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(ctxFor(1));

    await expect(
      caller.drafts.edit({ id: 1, gmailAccountId: OTHER_TENANTS_ACCOUNT_ID })
    ).rejects.toThrow(/not found/i);
  });

  it("allows approving against an account the caller owns", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(ctxFor(1));

    await expect(caller.drafts.approve({ id: 1, gmailAccountId: 1 })).resolves.toEqual({ success: true });
  });
});

describe("approval gate", () => {
  beforeEach(() => vi.resetModules());

  it("refuses to send a draft that is still pending", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(ctxFor(1));

    // The mocked draft is status "pending"; previously send() accepted it.
    await expect(caller.drafts.send({ id: 1 })).rejects.toThrow(/must be approved/i);
  });
});
