import { describe, expect, it } from "vitest";
import { flattenGmailBody, getHeader, parseBounce } from "./bounceParser";

/**
 * A false positive here silently stops mail to a real referral partner, so the
 * false-positive cases matter more than the detection cases and are tested
 * first. Payloads are shaped after real delivery status notifications.
 */

const GMAIL_HARD_BOUNCE = `
Delivery to the following recipient failed permanently:

     nosuchuser@example.com

Technical details of permanent failure:
Google tried to deliver your message, but it was rejected by the server for the recipient domain example.com.

Reporting-MTA: dns; googlemail.com
Final-Recipient: rfc822; nosuchuser@example.com
Action: failed
Status: 5.1.1
Diagnostic-Code: smtp; 550-5.1.1 The email account that you tried to reach does not exist.
`;

const SOFT_BOUNCE_MAILBOX_FULL = `
Reporting-MTA: dns; mail.example.com
Final-Recipient: rfc822; realperson@example.com
Action: failed
Status: 4.2.2
Diagnostic-Code: smtp; 452 4.2.2 The email account that you tried to reach is over quota.
`;

describe("things that must never be treated as bounces", () => {
  it("ignores an ordinary reply from a person", () => {
    const result = parseBounce({
      from: "John Smith <john@example.com>",
      subject: "Re: Thought of you",
      contentType: "text/plain; charset=UTF-8",
      body: "Thanks man! Let's grab lunch next week.",
    });
    expect(result.isBounce).toBe(false);
  });

  it("ignores a normal email that happens to quote a bounce", () => {
    // Someone forwarding a bounce to ask about it must not trigger suppression.
    const result = parseBounce({
      from: "Dana <dana@example.com>",
      subject: "weird thing that happened",
      contentType: "text/plain; charset=UTF-8",
      body: `Got this yesterday, any idea?\n\n> Final-Recipient: rfc822; someone@example.com\n> Status: 5.1.1`,
    });
    expect(result.isBounce).toBe(false);
    expect(result.failedRecipient).toBeNull();
  });

  it("does not classify a soft bounce as hard", () => {
    const result = parseBounce({
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
      subject: "Delivery Status Notification (Failure)",
      contentType: 'multipart/report; report-type=delivery-status; boundary="x"',
      body: SOFT_BOUNCE_MAILBOX_FULL,
    });
    expect(result.isBounce).toBe(true);
    expect(result.kind).toBe("soft");
  });

  it("downgrades a hard status with no parseable recipient", () => {
    // Nothing to suppress, so it must not be reported as actionable.
    const result = parseBounce({
      from: "postmaster@example.com",
      subject: "Undeliverable",
      contentType: "multipart/report; report-type=delivery-status",
      body: "Action: failed\nStatus: 5.0.0\n(no recipient given)",
    });
    expect(result.kind).toBe("soft");
    expect(result.failedRecipient).toBeNull();
  });

  it("treats an unclassifiable report as soft rather than guessing", () => {
    const result = parseBounce({
      from: "mailer-daemon@example.com",
      subject: "Returned mail",
      contentType: "text/plain",
      body: "Final-Recipient: rfc822; someone@example.com\nSomething went wrong.",
    });
    expect(result.kind).toBe("soft");
  });
});

describe("hard bounce detection", () => {
  it("detects a Gmail permanent failure and extracts the address", () => {
    const result = parseBounce({
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
      subject: "Delivery Status Notification (Failure)",
      contentType: 'multipart/report; report-type=delivery-status; boundary="x"',
      body: GMAIL_HARD_BOUNCE,
    });
    expect(result).toEqual({ isBounce: true, kind: "hard", failedRecipient: "nosuchuser@example.com" });
  });

  it("falls back to the diagnostic code when Status is absent", () => {
    const result = parseBounce({
      from: "MAILER-DAEMON@example.com",
      subject: "Undeliverable: Quick note",
      contentType: "multipart/report; report-type=delivery-status",
      body: "Final-Recipient: rfc822; gone@example.com\nDiagnostic-Code: smtp; 550 no such user",
    });
    expect(result.kind).toBe("hard");
    expect(result.failedRecipient).toBe("gone@example.com");
  });

  it("reads the X-Failed-Recipients form", () => {
    const result = parseBounce({
      from: "Mail Delivery System <MAILER-DAEMON@mx.example.net>",
      subject: "Mail delivery failed: returning message to sender",
      contentType: "multipart/report; report-type=delivery-status",
      body: "X-Failed-Recipients: dead@example.com\nStatus: 5.1.1",
    });
    expect(result.failedRecipient).toBe("dead@example.com");
    expect(result.kind).toBe("hard");
  });

  it("strips angle brackets and lowercases the address", () => {
    const result = parseBounce({
      from: "mailer-daemon@example.com",
      subject: "Undeliverable",
      contentType: "multipart/report; report-type=delivery-status",
      body: "Final-Recipient: rfc822; <Mixed.Case@Example.COM>\nStatus: 5.1.1",
    });
    expect(result.failedRecipient).toBe("mixed.case@example.com");
  });

  it("detects by subject when the sender address is unhelpful", () => {
    const result = parseBounce({
      from: "system@corporate-relay.example",
      subject: "Undeliverable: Thought of you",
      contentType: "text/plain",
      body: "Final-Recipient: rfc822; missing@example.com\nStatus: 5.1.1",
    });
    expect(result.isBounce).toBe(true);
    expect(result.kind).toBe("hard");
  });
});

describe("gmail payload helpers", () => {
  it("flattens nested multipart bodies", () => {
    const payload = {
      body: {},
      parts: [
        { mimeType: "text/plain", body: { data: Buffer.from("outer text").toString("base64url") } },
        { mimeType: "multipart/report", parts: [
          { mimeType: "message/delivery-status", body: { data: Buffer.from("Status: 5.1.1").toString("base64url") } },
        ] },
      ],
    };
    const text = flattenGmailBody(payload);
    expect(text).toContain("outer text");
    expect(text).toContain("Status: 5.1.1");
  });

  it("survives an undecodable part", () => {
    const payload = { parts: [{ body: { data: "!!!not base64!!!" } }, { body: { data: Buffer.from("ok").toString("base64url") } }] };
    expect(() => flattenGmailBody(payload)).not.toThrow();
    expect(flattenGmailBody(payload)).toContain("ok");
  });

  it("reads headers case-insensitively", () => {
    const headers = [{ name: "content-type", value: "multipart/report" }, { name: "From", value: "a@b.com" }];
    expect(getHeader(headers, "Content-Type")).toBe("multipart/report");
    expect(getHeader(headers, "from")).toBe("a@b.com");
    expect(getHeader(headers, "Missing")).toBe("");
  });
});
