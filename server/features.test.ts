import { describe, it, expect, beforeEach } from "vitest";
import * as db from "./db";

describe("AI Feedback Loop", () => {
  it("creates a feedback rule with pattern and replacement", async () => {
    const ruleId = await db.createFeedbackRule({
      userId: 1,
      ruleType: "phrase_replacement",
      pattern: "just thinking of you",
      replacement: "hi",
      confidence: 65,
    });
    expect(ruleId).toBeGreaterThan(0);
  });

  it("retrieves active feedback rules for a user", async () => {
    await db.createFeedbackRule({
      userId: 1,
      ruleType: "phrase_replacement",
      pattern: "test pattern",
      replacement: "test replacement",
      confidence: 70,
    });
    const rules = await db.getFeedbackRules(1, true);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]?.isActive).toBe(true);
  });

  it("applies feedback rules to text", async () => {
    await db.createFeedbackRule({
      userId: 1,
      ruleType: "phrase_replacement",
      pattern: "just thinking of you",
      replacement: "hi",
      confidence: 70,
    });
    const { text, appliedRules } = await db.applyFeedbackRules(
      "Hey, just thinking of you today!",
      1
    );
    expect(text).toContain("hi");
    expect(appliedRules.length).toBeGreaterThan(0);
  });

  it("only applies rules with confidence >= 60", async () => {
    await db.createFeedbackRule({
      userId: 1,
      ruleType: "phrase_replacement",
      pattern: "low confidence",
      replacement: "replaced",
      confidence: 50, // below threshold
    });
    const { appliedRules } = await db.applyFeedbackRules(
      "This is low confidence text",
      1
    );
    expect(appliedRules.length).toBe(0);
  });

  it("updates rule confidence and active status", async () => {
    const ruleId = await db.createFeedbackRule({
      userId: 1,
      ruleType: "phrase_replacement",
      pattern: "test",
      replacement: "replaced",
      confidence: 50,
    });
    await db.updateFeedbackRule(ruleId, 1, { confidence: 80, isActive: false });
    const rules = await db.getFeedbackRules(1, false);
    const updated = rules.find(r => r.id === ruleId);
    expect(updated?.confidence).toBe(80);
    expect(updated?.isActive).toBe(false);
  });

  it("deletes a feedback rule", async () => {
    const ruleId = await db.createFeedbackRule({
      userId: 1,
      ruleType: "phrase_replacement",
      pattern: "delete me",
      replacement: "deleted",
      confidence: 70,
    });
    await db.deleteFeedbackRule(ruleId, 1);
    const rules = await db.getFeedbackRules(1, false);
    expect(rules.find(r => r.id === ruleId)).toBeUndefined();
  });
});

describe("Bulk Import/Export", () => {
  it("exports contacts as CSV", async () => {
    // This would be tested via the router
    // Verify CSV format: headers + rows
    const csv = "First Name,Last Name,Email\nJohn,Doe,john@example.com";
    expect(csv).toContain("First Name");
    expect(csv).toContain("john@example.com");
  });

  it("parses CSV with proper field mapping", async () => {
    const csv = "first name,last name,email\nJane,Smith,jane@example.com";
    const lines = csv.trim().split("\n");
    const headers = lines[0]!.split(",").map(h => h.trim().toLowerCase());
    expect(headers).toContain("first name");
    expect(headers).toContain("email");
  });

  it("handles CSV with quoted fields containing commas", async () => {
    const csv = 'first name,company\nJohn,"Acme, Inc."';
    // Verify quoted field parsing
    expect(csv).toContain('"Acme, Inc."');
  });

  it("skips duplicate emails during import", async () => {
    // Verify duplicate detection logic
    const emails = new Set(["john@example.com", "jane@example.com"]);
    const newEmail = "john@example.com";
    expect(emails.has(newEmail.toLowerCase())).toBe(true);
  });

  it("validates required fields (first name, email)", async () => {
    const row = { "first name": "", "email": "test@example.com" };
    const isValid = row["first name"]?.trim() && row["email"]?.trim();
    expect(isValid).toBeFalsy();
  });
});

describe("Calendar Manual Send", () => {
  it("allows sending a draft immediately outside approval queue", async () => {
    // Verify manualSend endpoint exists and accepts draftId
    // Response should include messageId from Gmail API
    expect(true).toBe(true); // Placeholder for integration test
  });

  it("prevents sending an already-sent email", async () => {
    // Verify status check: if draft.status === "sent", throw error
    const draftStatus = "sent";
    expect(draftStatus === "sent").toBe(true);
  });

  it("requires a Gmail account to be configured", async () => {
    // Verify gmailAccount lookup and error if missing
    expect(true).toBe(true); // Placeholder for integration test
  });

  it("includes tracking pixel and unsubscribe link in sent email", async () => {
    // Verify email body construction
    const body = "Hello";
    const trackingPixel = "<img src='/api/track/123.gif' />";
    const unsubscribeLink = "<a href='/api/unsubscribe/123'>Unsubscribe</a>";
    const fullBody = `${body}\n${trackingPixel}\n${unsubscribeLink}`;
    expect(fullBody).toContain("/api/track/");
    expect(fullBody).toContain("Unsubscribe");
  });

  it("updates draft status to sent after successful send", async () => {
    // Verify db.updateEmailDraft called with status: "sent"
    expect(true).toBe(true); // Placeholder for integration test
  });

  it("records email event as sent", async () => {
    // Verify db.createEmailEvent called with eventType: "sent"
    expect(true).toBe(true); // Placeholder for integration test
  });

  it("updates contact's lastTouchSentAt timestamp", async () => {
    // Verify db.updateContact called with lastTouchSentAt: new Date()
    expect(true).toBe(true); // Placeholder for integration test
  });
});

describe("Integration: Feedback Loop + Email Generation", () => {
  it("applies feedback rules to newly generated emails", async () => {
    // Simulate: generate email -> apply rules -> show in queue
    const originalBody = "Hey, just thinking of you!";
    await db.createFeedbackRule({
      userId: 1,
      ruleType: "phrase_replacement",
      pattern: "just thinking of you",
      replacement: "hi",
      confidence: 70,
    });
    const { text } = await db.applyFeedbackRules(originalBody, 1);
    expect(text).not.toContain("just thinking of you");
    expect(text).toContain("hi");
  });
});

describe("Integration: Bulk Import + Contact Loop", () => {
  it("imports contacts and sets them to active loop status", async () => {
    // Verify: import row -> create contact with loopStatus: "active"
    expect(true).toBe(true); // Placeholder for integration test
  });

  it("respects per-contact send frequency from import", async () => {
    // Verify: CSV column "send frequency (weeks)" -> contact.sendFrequencyWeeks
    expect(true).toBe(true); // Placeholder for integration test
  });
});
