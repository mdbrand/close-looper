import { describe, expect, it } from "vitest";
import { isReplyToDraft } from "./replyMatcher";

describe("reply matching", () => {
  it("matches an inbound message in the Gmail thread", () => {
    expect(isReplyToDraft({ threadId: "thread-123" }, { gmailThreadId: "thread-123" })).toBe(true);
  });

  it("does not confuse the Gmail API message id with an RFC Message-ID", () => {
    expect(isReplyToDraft({
      headers: [{ name: "In-Reply-To", value: "<rfc-message@example.com>" }],
    }, {
      gmailRfcMessageId: "gmail-api-resource-id",
    })).toBe(false);
  });

  it("matches RFC Message-ID values with or without angle brackets", () => {
    expect(isReplyToDraft({
      headers: [{ name: "References", value: "<older@example.com> <sent-42@example.com>" }],
    }, {
      gmailRfcMessageId: "<sent-42@example.com>",
    })).toBe(true);
  });

  it("does not match a different Gmail thread", () => {
    expect(isReplyToDraft({ threadId: "other-thread" }, { gmailThreadId: "thread-123" })).toBe(false);
  });
});
