import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb }));

import { sequencesRouter } from "./routers/sequences";

function queryReturning(rows: unknown[]) {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(async () => rows);
  chain.then = (resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject);
  return chain;
}

function context(userId = 1): TrpcContext {
  return {
    user: {
      id: userId, openId: `user-${userId}`, email: `u${userId}@example.com`, name: "User",
      loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("sequence tenant isolation", () => {
  const update = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    update.mockReturnValue({ set: () => ({ where: vi.fn() }) });
  });

  it("does not update a step that cannot be resolved through an owned sequence", async () => {
    getDb.mockResolvedValue({ select: () => queryReturning([]), update });
    const caller = sequencesRouter.createCaller(context());
    await expect(caller.updateStep({ id: 999, internalName: "stolen" })).rejects.toThrow(/not found/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("does not expose another tenant's step to template generation", async () => {
    getDb.mockResolvedValue({ select: () => queryReturning([]), update });
    const caller = sequencesRouter.createCaller(context());
    await expect(caller.generateTemplate({ stepId: 999 })).rejects.toThrow(/not found/i);
  });

  it("does not enroll a contact or sequence the caller does not own", async () => {
    getDb.mockResolvedValue({ select: () => queryReturning([]), update });
    const caller = sequencesRouter.createCaller(context());
    await expect(caller.enroll({ contactId: 999, sequenceId: 888 })).rejects.toThrow(/contact not found/i);
    expect(update).not.toHaveBeenCalled();
  });
});
