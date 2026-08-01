import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEmailDraft: vi.fn(),
  getContact: vi.fn(),
  isEmailSuppressed: vi.fn(),
  getGmailAccount: vi.fn(),
  getGmailAccounts: vi.fn(),
  claimEmailDraft: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("./db", () => mocks);
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn() }));

import { sendDraft } from "./sendDraft";

const approvedDraft = {
  id: 10,
  userId: 1,
  contactId: 20,
  status: "approved",
  subject: "Hello",
  body: "Body",
  trackingId: "x".repeat(32),
  gmailAccountId: 30,
};

describe("send idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEmailDraft.mockResolvedValue(approvedDraft);
    mocks.getContact.mockResolvedValue({ id: 20, userId: 1, email: "recipient@example.com" });
    mocks.isEmailSuppressed.mockResolvedValue(false);
    mocks.getGmailAccount.mockResolvedValue({ id: 30, userId: 1, gmailAddress: "sender@example.com", accessToken: "token" });
    mocks.getGmailAccounts.mockResolvedValue([]);
    mocks.getDb.mockResolvedValue(null);
  });

  it("stops before Gmail when another request already claimed the draft", async () => {
    mocks.claimEmailDraft.mockResolvedValue(false);
    await expect(sendDraft(10, 1)).rejects.toThrow(/already claimed/i);
    expect(mocks.claimEmailDraft).toHaveBeenCalledWith(10, 1, ["approved"]);
  });

  it("refuses a draft already in the sending state", async () => {
    mocks.getEmailDraft.mockResolvedValue({ ...approvedDraft, status: "sending" });
    await expect(sendDraft(10, 1)).rejects.toThrow(/already being sent/i);
    expect(mocks.claimEmailDraft).not.toHaveBeenCalled();
  });

  it("refuses a manual retry of a draft already marked sent", async () => {
    mocks.getEmailDraft.mockResolvedValue({ ...approvedDraft, status: "sent" });
    await expect(sendDraft(10, 1, { allowedStatuses: ["pending", "approved", "failed"] })).rejects.toThrow(/already sent/i);
    expect(mocks.claimEmailDraft).not.toHaveBeenCalled();
  });
});
