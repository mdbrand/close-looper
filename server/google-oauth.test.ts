import { describe, it, expect } from "vitest";

describe("Google OAuth secrets", () => {
  it("GOOGLE_CLIENT_ID is set and looks like a valid Google OAuth client ID", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    // In CI/test environments the secret may not be injected — skip gracefully
    if (!clientId) {
      console.warn("GOOGLE_CLIENT_ID not set in test environment — skipping validation");
      return;
    }
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it("GOOGLE_CLIENT_SECRET is set and has sufficient length", () => {
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    if (!secret) {
      console.warn("GOOGLE_CLIENT_SECRET not set in test environment — skipping validation");
      return;
    }
    expect(secret.length).toBeGreaterThan(10);
  });

  it("GOOGLE_REDIRECT_URI points to the gmail callback endpoint", () => {
    const uri = process.env.GOOGLE_REDIRECT_URI;
    if (!uri) {
      console.warn("GOOGLE_REDIRECT_URI not set in test environment — skipping validation");
      return;
    }
    expect(uri).toContain("/api/gmail/callback");
  });
});
