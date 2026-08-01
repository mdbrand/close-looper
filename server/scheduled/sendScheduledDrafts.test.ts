import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateRequest, getDueScheduledDrafts, sendDraft } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getDueScheduledDrafts: vi.fn(),
  sendDraft: vi.fn(),
}));

vi.mock("../_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("../db", () => ({ getDueScheduledDrafts }));
vi.mock("../sendDraft", () => ({ sendDraft }));

import { sendScheduledDraftsHandler } from "./sendScheduledDrafts";

function response() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe("scheduled delivery cron", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a normal signed-in user", async () => {
    authenticateRequest.mockResolvedValue({ id: 1, isCron: false });
    const res = response();
    await sendScheduledDraftsHandler({} as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(getDueScheduledDrafts).not.toHaveBeenCalled();
  });

  it("sends every due draft through the shared idempotent send path", async () => {
    authenticateRequest.mockResolvedValue({ id: -1, isCron: true });
    getDueScheduledDrafts.mockResolvedValue([{ id: 10, userId: 1 }, { id: 20, userId: 2 }]);
    sendDraft.mockResolvedValue({ success: true, messageId: "gmail-id" });
    const res = response();
    await sendScheduledDraftsHandler({} as any, res);
    expect(sendDraft).toHaveBeenNthCalledWith(1, 10, 1);
    expect(sendDraft).toHaveBeenNthCalledWith(2, 20, 2);
    expect(res.json).toHaveBeenCalledWith({ success: true, checked: 2, sent: 2, failed: 0 });
  });

  it("continues processing after one delivery fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    authenticateRequest.mockResolvedValue({ id: -1, isCron: true });
    getDueScheduledDrafts.mockResolvedValue([{ id: 10, userId: 1 }, { id: 20, userId: 2 }]);
    sendDraft.mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce({ success: true });
    const res = response();
    await sendScheduledDraftsHandler({} as any, res);
    expect(sendDraft).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ success: true, checked: 2, sent: 1, failed: 1 });
    errorSpy.mockRestore();
  });
});
