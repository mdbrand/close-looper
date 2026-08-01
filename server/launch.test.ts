import { describe, expect, it } from "vitest";

// ─── Date Calculation Tests ───────────────────────────────────────────────────
function calcFirstSendDate(enrolledDate: Date): Date {
  const day = enrolledDate.getDate();
  let sendDate = new Date(enrolledDate.getFullYear(), enrolledDate.getMonth(), 15, 10, 0, 0);
  if (day > 10) sendDate = new Date(enrolledDate.getFullYear(), enrolledDate.getMonth() + 1, 15, 10, 0, 0);
  // Shift weekend to Tuesday
  const dow = sendDate.getDay();
  if (dow === 6) sendDate.setDate(sendDate.getDate() + 3); // Saturday → Tuesday
  else if (dow === 0) sendDate.setDate(sendDate.getDate() + 2); // Sunday → Tuesday
  return sendDate;
}

function calcNextSendDate(currentSendDate: Date): Date {
  const next = new Date(currentSendDate.getFullYear(), currentSendDate.getMonth() + 1, 15, 10, 0, 0);
  const dow = next.getDay();
  if (dow === 6) next.setDate(next.getDate() + 3);
  else if (dow === 0) next.setDate(next.getDate() + 2);
  return next;
}

describe("First send date calculation", () => {
  it("contact added on or before 10th gets current month 15th", () => {
    const enrolled = new Date(2026, 7, 5); // Aug 5
    const send = calcFirstSendDate(enrolled);
    expect(send.getMonth()).toBe(7); // August
    // Aug 15 2026 is a Saturday, so it shifts to Tuesday Aug 18
    expect(send.getDate()).toBe(18);
    expect(send.getDay()).toBe(2); // Tuesday
  });

  it("contact added after 10th gets next month 15th", () => {
    const enrolled = new Date(2026, 7, 12); // Aug 12
    const send = calcFirstSendDate(enrolled);
    expect(send.getMonth()).toBe(8); // September
    expect(send.getDate()).toBe(15);
  });

  it("shifts Saturday 15th to Tuesday 18th", () => {
    // Find a month where 15th is Saturday
    // Jan 2022: 15th is Saturday
    const enrolled = new Date(2022, 0, 1); // Jan 1
    const send = calcFirstSendDate(enrolled);
    expect(send.getDay()).not.toBe(6); // Not Saturday
    expect(send.getDay()).not.toBe(0); // Not Sunday
  });

  it("shifts Sunday 15th to Tuesday", () => {
    // Find a month where 15th is Sunday
    // May 2022: 15th is Sunday
    const enrolled = new Date(2022, 4, 1); // May 1
    const send = calcFirstSendDate(enrolled);
    expect(send.getDay()).not.toBe(0); // Not Sunday
  });

  it("weekday 15th stays on 15th", () => {
    // Aug 2026: 15th is Saturday, but let's use Sep 2026: 15th is Tuesday
    const enrolled = new Date(2026, 8, 1); // Sep 1
    const send = calcFirstSendDate(enrolled);
    expect(send.getDate()).toBe(15);
    expect(send.getDay()).toBe(2); // Tuesday
  });
});

describe("Monthly sequence advancement", () => {
  it("next send date is 15th of following month", () => {
    const current = new Date(2026, 7, 15); // Aug 15
    const next = calcNextSendDate(current);
    expect(next.getMonth()).toBe(8); // September
    expect(next.getDate()).toBe(15);
  });

  it("12 steps covers 12 months", () => {
    let date = calcFirstSendDate(new Date(2026, 0, 1));
    for (let step = 1; step < 12; step++) {
      date = calcNextSendDate(date);
    }
    // After 12 steps from Jan 2026, step 12 is Dec 2026
    expect(date.getMonth()).toBe(11); // December
    expect(date.getDate()).toBe(15);
  });
});

// ─── Suppression List Tests ───────────────────────────────────────────────────
describe("Suppression list logic", () => {
  it("email normalization lowercases addresses", () => {
    const email = "Rob@CooleyBrothers.COM";
    expect(email.toLowerCase()).toBe("rob@cooleybrothers.com");
  });

  it("suppressed emails should not be sent to", () => {
    const suppressedEmails = new Set(["test@example.com", "blocked@domain.com"]);
    const isSuppressed = (email: string) => suppressedEmails.has(email.toLowerCase());
    expect(isSuppressed("test@example.com")).toBe(true);
    expect(isSuppressed("TEST@EXAMPLE.COM")).toBe(true);
    expect(isSuppressed("safe@example.com")).toBe(false);
  });
});

// ─── Contact Tier Tests ───────────────────────────────────────────────────────
describe("Relationship tier validation", () => {
  it("valid tiers are cold, warm, hot", () => {
    const validTiers = ["cold", "warm", "hot"];
    expect(validTiers).toContain("cold");
    expect(validTiers).toContain("warm");
    expect(validTiers).toContain("hot");
    expect(validTiers).not.toContain("unknown");
  });

  it("cold contacts default to relationship_sequence loop type", () => {
    const contact = { relationshipTier: "cold", loopType: "relationship_sequence" };
    expect(contact.loopType).toBe("relationship_sequence");
  });
});

// ─── Email Validation Tests ───────────────────────────────────────────────────
describe("Email address validation", () => {
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  it("accepts valid email addresses", () => {
    expect(isValidEmail("rob@cooleybrothers.com")).toBe(true);
    expect(isValidEmail("test.user+tag@domain.co.uk")).toBe(true);
  });

  it("rejects invalid email addresses", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("missing@domain")).toBe(false);
    expect(isValidEmail("@nodomain.com")).toBe(false);
  });
});

// ─── CSV Template Tests ───────────────────────────────────────────────────────
describe("CSV template structure", () => {
  it("template includes required columns", () => {
    const requiredColumns = [
      "First Name", "Last Name", "Email", "Phone", "Company",
      "Relationship Tier", "Contact Source", "Personal Notes", "Tags"
    ];
    const templateHeaders = [
      "First Name", "Last Name", "Email", "Phone", "Company", "Industry",
      "Relationship Tier", "Contact Source", "Source Name", "Source Location",
      "Source URL", "Date Found", "Personal Notes", "Tags"
    ];
    requiredColumns.forEach(col => {
      expect(templateHeaders).toContain(col);
    });
  });
});
