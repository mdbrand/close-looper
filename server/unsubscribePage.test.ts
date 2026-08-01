import { describe, expect, it } from "vitest";
import { unsubscribeConfirmPage, unsubscribeDonePage } from "./unsubscribePage";

/**
 * The confirm step exists because mail security gateways fetch every URL in an
 * inbound email. These pin the properties that make that safe.
 */

describe("unsubscribe confirmation page", () => {
  const trackingId = "a".repeat(32);

  it("posts rather than links, so a link scanner cannot trigger it", () => {
    const html = unsubscribeConfirmPage(trackingId);
    expect(html).toContain('method="POST"');
    expect(html).toContain(`action="/api/unsubscribe/${trackingId}"`);
    // A GET-able anchor to the action would reintroduce the bug.
    expect(html).not.toMatch(/<a[^>]+href="\/api\/unsubscribe/);
  });

  it("states plainly that nothing has happened yet", () => {
    const html = unsubscribeConfirmPage(trackingId);
    expect(html).toMatch(/nothing has changed/i);
    expect(html).not.toMatch(/you've been unsubscribed/i);
  });

  it("needs no JavaScript, since it opens in unpredictable mail browsers", () => {
    expect(unsubscribeConfirmPage(trackingId)).not.toContain("<script");
    expect(unsubscribeDonePage()).not.toContain("<script");
  });

  it("asks search engines not to index it", () => {
    expect(unsubscribeConfirmPage(trackingId)).toContain("noindex");
  });

  it("names the sender when one is known", () => {
    expect(unsubscribeConfirmPage(trackingId, "Acme Painting")).toContain("Acme Painting");
  });

  it("reads fine when the sender is unknown", () => {
    const html = unsubscribeConfirmPage(trackingId, null);
    expect(html).toContain("Stop receiving these emails?");
    expect(html).not.toContain("from undefined");
    expect(html).not.toContain("from null");
  });

  it("escapes a sender name rather than injecting it", () => {
    const html = unsubscribeConfirmPage(trackingId, '<script>alert(1)</script>');
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes the tracking id in the form action", () => {
    const html = unsubscribeConfirmPage('abc"><b>', null);
    expect(html).not.toContain('action="/api/unsubscribe/abc"><b>"');
  });

  it("confirms completion only on the done page", () => {
    expect(unsubscribeDonePage()).toMatch(/you've been unsubscribed/i);
  });
});
