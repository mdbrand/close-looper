import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getAnalyticsStats: vi.fn().mockResolvedValue({
    sentThisMonth: 12,
    sentAllTime: 47,
    openRate: 68,
    pendingCount: 3,
    activeContacts: 15,
    pausedContacts: 2,
  }),
  getContacts: vi.fn().mockResolvedValue([
    {
      id: 1, userId: 1, firstName: "Alice", lastName: "Jones",
      loopStatus: "paused", personalNotes: null,
      lastTouchSentAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
      createdAt: new Date(), updatedAt: new Date(),
    }
  ]),
  getCalendarEvents: vi.fn().mockResolvedValue([]),
  getEmailDrafts: vi.fn().mockResolvedValue([]),
  getContact: vi.fn().mockResolvedValue(null),
}));

function createContext(): TrpcContext {
  return {
    user: {
      id: 1, openId: "test-user", email: "test@example.com",
      name: "Test User", loginMethod: "manus", role: "user",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("analytics router", () => {
  it("returns dashboard stats", async () => {
    const caller = appRouter.createCaller(createContext());
    const stats = await caller.analytics.stats();
    expect(stats).not.toBeNull();
    expect(stats?.sentThisMonth).toBe(12);
    expect(stats?.openRate).toBe(68);
    expect(stats?.activeContacts).toBe(15);
  });

  it("returns needs-attention contacts", async () => {
    const caller = appRouter.createCaller(createContext());
    const attention = await caller.analytics.needsAttention();
    expect(Array.isArray(attention)).toBe(true);
    // Alice is paused, so she should be in needs-attention
    expect(attention.some(c => c.firstName === "Alice")).toBe(true);
  });
});

