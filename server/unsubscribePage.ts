/**
 * The unsubscribe pages.
 *
 * Kept as plain server-rendered HTML with no JavaScript: this is opened from a
 * mail client, sometimes inside an in-app browser, by someone who may be
 * annoyed already. It has to work everywhere, first time.
 */

const SHELL = (title: string, inner: string) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; margin: 0; padding: 24px;
    background: #faf9f7; color: #1c1917;
  }
  .card {
    max-width: 26rem; width: 100%; text-align: center;
    background: #fff; border: 1px solid #e7e5e4; border-radius: 14px;
    padding: 40px 32px; box-shadow: 0 1px 3px rgba(0,0,0,.04);
  }
  h1 { font-size: 1.35rem; margin: 0 0 12px; font-weight: 600; }
  p { color: #57534e; line-height: 1.6; margin: 0 0 24px; font-size: .95rem; }
  button {
    font: inherit; font-weight: 500; cursor: pointer;
    background: #1c1917; color: #fff; border: 0;
    border-radius: 9px; padding: 12px 22px; width: 100%;
  }
  button:hover { background: #292524; }
  .muted { font-size: .8rem; color: #a8a29e; margin: 18px 0 0; }
  @media (prefers-color-scheme: dark) {
    body { background: #1c1917; color: #f5f5f4; }
    .card { background: #292524; border-color: #44403c; }
    p { color: #d6d3d1; }
    button { background: #f5f5f4; color: #1c1917; }
    button:hover { background: #e7e5e4; }
    .muted { color: #78716c; }
  }
</style>
</head><body><div class="card">${inner}</div></body></html>`;

/**
 * Shown when the link is opened. Changes nothing.
 *
 * The confirm step exists because corporate mail security gateways
 * (Proofpoint, Mimecast, Microsoft Safe Links and similar) fetch every URL in
 * an inbound email before a human sees it. When unsubscribing happened on GET,
 * those scanners silently unsubscribed and paused real contacts — invisible to
 * both sides, and precisely the outcome this product exists to prevent.
 * Scanners do not submit forms, so moving the action to POST fixes it.
 */
export function unsubscribeConfirmPage(trackingId: string, senderLabel?: string | null): string {
  const from = senderLabel ? ` from ${escapeHtml(senderLabel)}` : "";
  return SHELL(
    "Unsubscribe",
    `<h1>Stop receiving these emails?</h1>
     <p>You won't get any more messages${from}. You can always reply and ask to be added back.</p>
     <form method="POST" action="/api/unsubscribe/${encodeURIComponent(trackingId)}">
       <button type="submit">Yes, unsubscribe me</button>
     </form>
     <p class="muted">If you opened this by accident, just close this page — nothing has changed.</p>`
  );
}

/** Shown after the POST actually goes through. */
export function unsubscribeDonePage(): string {
  return SHELL(
    "Unsubscribed",
    `<h1>You've been unsubscribed.</h1>
     <p>You won't receive any more emails from this sender.</p>
     <p class="muted">Changed your mind? Reply to any earlier email and ask to be put back on.</p>`
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
