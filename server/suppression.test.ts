import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Lifting a suppression. Unsubscribing was previously irreversible from inside
 * the app, so these cover both halves of the undo: the block is removed, and
 * the paused contact behind it comes back.
 */

const calls = {
  removed: [] as { userId: number; email: string }[],
  reactivated: [] as { userId: number; email: string }[],
};

const state = { entries: [] as any[], reactivateCount: 0 };

vi.mock("./db", () => ({
  getSuppressionList: vi.fn(async (_userId: number) => state.entries),
  removeFromSuppressionList: vi.fn(async (userId: number, email: string) => {
    calls.removed.push({ userId, email });
  }),
  reactivateContactsByEmail: vi.fn(async (userId: number, email: string) => {
    calls.reactivated.push({ userId, email });
    return state.reactivateCount;
  }),
}));

function ctx(userId = 1): TrpcContext {
  return {
    user: {
      id: userId, openId: `u${userId}`, email: `u${userId}@example.com`, name: "Test",
      loginMethod: "manus", role: "user",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

async function caller(userId = 1) {
  const { appRouter } = await import("./routers");
  return appRouter.createCaller(ctx(userId));
}

describe("suppression list", () => {
  beforeEach(() => {
    calls.removed = [];
    calls.reactivated = [];
    state.entries = [];
    state.reactivateCount = 0;
    vi.resetModules();
  });

  it("lists the caller's suppressed addresses", async () => {
    state.entries = [{ id: 1, userId: 1, email: "gone@example.com", reason: "unsubscribed", createdAt: new Date() }];
    const result = await (await caller()).suppression.list();
    expect(result).toHaveLength(1);
    expect(result[0]!.email).toBe("gone@example.com");
  });

  it("removes the suppression and reactivates the contact behind it", async () => {
    state.reactivateCount = 1;
    const result = await (await caller()).suppression.remove({ email: "back@example.com" });

    expect(calls.removed).toEqual([{ userId: 1, email: "back@example.com" }]);
    expect(calls.reactivated).toEqual([{ userId: 1, email: "back@example.com" }]);
    expect(result.reactivatedContacts).toBe(1);
  });

  it("scopes both operations to the calling user", async () => {
    await (await caller(7)).suppression.remove({ email: "someone@example.com" });

    // A suppression belongs to one sender; user 7 must never be able to lift
    // user 1's block, nor reactivate their contacts.
    expect(calls.removed[0]!.userId).toBe(7);
    expect(calls.reactivated[0]!.userId).toBe(7);
  });

  it("rejects a malformed address rather than passing it to the database", async () => {
    await expect((await caller()).suppression.remove({ email: "not-an-email" })).rejects.toThrow();
    expect(calls.removed).toHaveLength(0);
  });

  it("succeeds even when no contact was paused", async () => {
    state.reactivateCount = 0;
    const result = await (await caller()).suppression.remove({ email: "orphan@example.com" });
    expect(result.success).toBe(true);
    expect(result.reactivatedContacts).toBe(0);
  });
});
