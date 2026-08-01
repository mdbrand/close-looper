import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Onboarding progress is derived from real data rather than a stored flag, so
 * these cover the derivation rules — particularly that a half-filled record
 * does not count as a finished step.
 */

const state = {
  gmailAccounts: [] as any[],
  voiceProfile: undefined as any,
  contacts: [] as any[],
  senderProfile: undefined as any,
};

// Minimal stand-in for the drizzle query chain used by the router.
const fakeDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => (state.senderProfile ? [state.senderProfile] : []),
      }),
    }),
  }),
};

vi.mock("./db", () => ({
  getGmailAccounts: vi.fn(async () => state.gmailAccounts),
  getVoiceProfile: vi.fn(async () => state.voiceProfile),
  getContacts: vi.fn(async () => state.contacts),
  getDb: vi.fn(async () => fakeDb),
}));

function ctx(): TrpcContext {
  return {
    user: {
      id: 1, openId: "u1", email: "u1@example.com", name: "Test", loginMethod: "manus",
      role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

async function status() {
  const { appRouter } = await import("./routers");
  return appRouter.createCaller(ctx()).onboarding.status();
}

describe("onboarding status", () => {
  beforeEach(() => {
    state.gmailAccounts = [];
    state.voiceProfile = undefined;
    state.contacts = [];
    state.senderProfile = undefined;
    vi.resetModules();
  });

  it("reports nothing done for a brand new account", async () => {
    const result = await status();
    expect(result.steps).toEqual({ gmail: false, senderProfile: false, voice: false, contacts: false });
    expect(result.completedCount).toBe(0);
    expect(result.isComplete).toBe(false);
  });

  it("counts a step done once the underlying data exists", async () => {
    state.gmailAccounts = [{ id: 1, gmailAddress: "me@example.com" }];
    state.contacts = [{ id: 1 }];

    const result = await status();
    expect(result.steps.gmail).toBe(true);
    expect(result.steps.contacts).toBe(true);
    expect(result.gmailAddress).toBe("me@example.com");
    expect(result.contactCount).toBe(1);
  });

  it("does not count an empty sender profile row as done", async () => {
    // A row can exist without the fields the AI actually needs.
    state.senderProfile = { userId: 1, companyName: "", mainService: null };
    expect((await status()).steps.senderProfile).toBe(false);
  });

  it("does not count a whitespace-only voice sample as done", async () => {
    state.voiceProfile = { voiceSample: "   " };
    expect((await status()).steps.voice).toBe(false);
  });

  it("counts the sender profile once it can actually feed the AI", async () => {
    state.senderProfile = { userId: 1, companyName: "Acme Painting", mainService: "commercial painting" };
    expect((await status()).steps.senderProfile).toBe(true);
  });

  it("is complete only when every step is", async () => {
    state.gmailAccounts = [{ id: 1, gmailAddress: "me@example.com" }];
    state.senderProfile = { userId: 1, companyName: "Acme", mainService: "painting" };
    state.voiceProfile = { voiceSample: "hey man, hope you're good, talk soon" };
    state.contacts = [{ id: 1 }];

    const result = await status();
    expect(result.completedCount).toBe(4);
    expect(result.isComplete).toBe(true);
  });

  it("reopens a step when its data goes away, since nothing is latched", async () => {
    state.gmailAccounts = [{ id: 1, gmailAddress: "me@example.com" }];
    expect((await status()).steps.gmail).toBe(true);

    // Disconnecting Gmail must put the step back, which a stored flag would not.
    state.gmailAccounts = [];
    expect((await status()).steps.gmail).toBe(false);
  });
});
