import { describe, expect, it } from "vitest";
import { extractSubstitution } from "./routers/feedback";
import { getAppUrl } from "./_core/env";

/**
 * Covers the send-path consolidation and the feedback-capture rewrite.
 */

// ─── Email links must be absolute ────────────────────────────────────────────

describe("app url used in outbound email", () => {
  it("is absolute, so unsubscribe links survive leaving the app", () => {
    const url = getAppUrl();
    expect(url).toMatch(/^https?:\/\//);
  });

  it("never yields a bare path — the bug that shipped dead unsubscribe links", () => {
    // Previously: `${process.env.VITE_APP_URL ?? ""}/api/unsubscribe/x` with the
    // variable unset produced "/api/unsubscribe/x", which is inert in a mail client.
    expect(`${getAppUrl()}/api/unsubscribe/abc`).not.toMatch(/^\/api/);
  });

  it("has no trailing slash, so joined paths never double up", () => {
    expect(getAppUrl()).not.toMatch(/\/$/);
  });
});

// ─── Learned edit rules must be reusable ─────────────────────────────────────

describe("feedback rule capture", () => {
  it("learns just the changed phrase, not the whole line", () => {
    const before = "Hey John, I hope this email finds you well. Wanted to say hi.";
    const after = "Hey John, hope you're doing good. Wanted to say hi.";

    const result = extractSubstitution(before, after);

    expect(result).not.toBeNull();
    // The stable parts of the sentence must not end up inside the pattern,
    // or the rule can only ever match this exact draft.
    expect(result!.pattern).not.toContain("Wanted to say hi");
    expect(result!.pattern).not.toContain("Hey John");
    expect(result!.pattern).toContain("finds you well");
  });

  it("captures whole words, never fragments", () => {
    const result = extractSubstitution("call me tomorrow", "call me today");
    expect(result!.pattern).toBe("tomorrow");
    expect(result!.replacement).toBe("today");
  });

  it("learns a deletion", () => {
    const result = extractSubstitution("Thanks so much for everything!", "Thanks for everything!");
    expect(result).not.toBeNull();
    expect(result!.pattern).toContain("so much");
  });

  it("learns nothing from an identical draft", () => {
    expect(extractSubstitution("same text", "same text")).toBeNull();
  });

  it("refuses to learn from a full rewrite, which generalises to nothing", () => {
    const before = "Hey John, saw the game last night and thought of you. Hope the crew is staying busy this spring.";
    const after = "Morning Susan, the quarterly numbers came in ahead of plan and I wanted to pass that along right away.";

    expect(extractSubstitution(before, after)).toBeNull();
  });

  it("refuses to learn a pattern too short to be meaningful", () => {
    expect(extractSubstitution("a b", "a c")).toBeNull();
  });

  it("produces a pattern that actually matches a future draft", () => {
    const result = extractSubstitution(
      "Hi Dana, I hope this email finds you well. Quick note.",
      "Hi Dana, hope things are good. Quick note."
    )!;
    const escaped = result.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // The same phrase in a completely different draft must still be corrected —
    // that is the whole point of the feature.
    const futureDraft = "Hey Marcus, I hope this email finds you well. Catching up soon?";
    expect(new RegExp(escaped, "gi").test(futureDraft)).toBe(true);
  });
});
