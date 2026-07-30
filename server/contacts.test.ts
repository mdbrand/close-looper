import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  getContacts: vi.fn().mockResolvedValue([
    {
      id: 1, userId: 1, firstName: "John", lastName: "Smith",
      email: "john@example.com", phone: null, company: "Acme Inc",
      industry: "construction", relationshipType: "referral_partner",
      howWeMet: null, personalNotes: "Big Cowboys fan",
      linkedinUrl: null, instagramUrl: null, facebookUrl: null,
      birthday: null, loopStatus: "active", sendFrequencyWeeks: 4,
      tags: '["VIP"]', lastTouchSentAt: null, nextTouchScheduledAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
  ]),
  getContact: vi.fn().mockResolvedValue({
    id: 1, userId: 1, firstName: "John", lastName: "Smith",
    email: "john@example.com", loopStatus: "active", sendFrequencyWeeks: 4,
    relationshipType: "referral_partner", createdAt: new Date(), updatedAt: new Date(),
  }),
  createContact: vi.fn().mockResolvedValue(42),
  updateContact: vi.fn().mockResolvedValue(undefined),
  deleteContact: vi.fn().mockResolvedValue(undefined),
}));

function createContext(userId = 1): TrpcContext {
  return {
    user: {
      id: userId, openId: "test-user", email: "test@example.com",
      name: "Test User", loginMethod: "manus", role: "user",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("contacts router", () => {
  it("lists contacts for authenticated user", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.contacts.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].firstName).toBe("John");
  });

  it("gets a single contact by id", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.contacts.get({ id: 1 });
    expect(result.firstName).toBe("John");
    expect(result.email).toBe("john@example.com");
  });

  it("creates a new contact", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.contacts.create({
      firstName: "Jane",
      email: "jane@example.com",
      relationshipType: "referral_partner",
      loopStatus: "active",
      sendFrequencyWeeks: 4,
    });
    expect(result.id).toBe(42);
  });

  it("updates a contact's loop status", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.contacts.setLoopStatus({ id: 1, status: "paused" });
    expect(result.success).toBe(true);
  });

  it("deletes a contact", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.contacts.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});
