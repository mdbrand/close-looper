/**
 * Bounce detection.
 *
 * `bounced` was a declared value on both the suppression `reason` enum and the
 * email-event type, but nothing ever wrote it — bounce handling was a shape
 * without an implementation, so dead addresses kept getting mail and quietly
 * eroded sender reputation.
 *
 * Everything here is deliberately conservative. A false positive silently stops
 * mail to a real referral partner, which is worse than missing a bounce, so a
 * message is only ever treated as a hard bounce when BOTH the failed recipient
 * and a permanent (5.x.x) failure are unambiguous. Anything softer, ambiguous,
 * or unparseable is reported as `soft` and acted on by nobody.
 *
 * The parsing here is pure and string-based so it can be tested against real
 * bounce payloads without a Gmail connection.
 */

export type BounceKind = "hard" | "soft";

export type BounceReport = {
  isBounce: boolean;
  kind: BounceKind;
  /** Lower-cased address that failed, when it could be determined. */
  failedRecipient: string | null;
};

const NOT_A_BOUNCE: BounceReport = { isBounce: false, kind: "soft", failedRecipient: null };

/** Senders that generate delivery reports. */
const DAEMON_PATTERN = /(mailer-daemon|postmaster|mail delivery (subsystem|system)|no-?reply@.*bounce)/i;

/**
 * True when the message looks like a delivery-status report at all.
 *
 * Checked against the envelope rather than the body, so an ordinary email that
 * happens to quote a bounce is not mistaken for one.
 */
function looksLikeDeliveryReport(fromHeader: string, contentType: string, subject: string): boolean {
  if (DAEMON_PATTERN.test(fromHeader)) return true;
  if (/report-type=["']?delivery-status/i.test(contentType)) return true;
  // Some providers send a plain message with a recognisable subject.
  return /^(undeliverable|delivery status notification|returned mail|mail delivery failed)/i.test(subject.trim());
}

/** Pulls the address out of `Final-Recipient: rfc822; someone@example.com`. */
function parseFailedRecipient(body: string): string | null {
  const patterns = [
    /^final-recipient:\s*[^;]*;\s*(.+)$/im,
    /^original-recipient:\s*[^;]*;\s*(.+)$/im,
    /^x-failed-recipients:\s*(.+)$/im,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (!match?.[1]) continue;
    // Values arrive variously as <a@b.com>, "a@b.com", or bare.
    const cleaned = match[1].trim().replace(/^[<"']|[>"',;]$/g, "").trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return cleaned.toLowerCase();
  }
  return null;
}

/**
 * Classifies the failure.
 *
 * `Status:` is authoritative when present. A `Diagnostic-Code` 5xx is accepted
 * as a fallback, since some servers omit the status field. Absent both, the
 * failure is treated as soft — we do not guess.
 */
function classifyFailure(body: string): BounceKind {
  const status = body.match(/^status:\s*([245])\.\d{1,3}\.\d{1,3}/im);
  if (status?.[1]) return status[1] === "5" ? "hard" : "soft";

  const diagnostic = body.match(/^diagnostic-code:\s*smtp;\s*(\d{3})/im);
  if (diagnostic?.[1]) return diagnostic[1].startsWith("5") ? "hard" : "soft";

  return "soft";
}

export function parseBounce(input: {
  from: string;
  subject: string;
  contentType: string;
  body: string;
}): BounceReport {
  const { from = "", subject = "", contentType = "", body = "" } = input;

  if (!looksLikeDeliveryReport(from, contentType, subject)) return NOT_A_BOUNCE;

  const failedRecipient = parseFailedRecipient(body);
  const kind = classifyFailure(body);

  // A hard classification without a recipient is unusable — there is nothing to
  // suppress — so it is downgraded rather than guessed at.
  if (!failedRecipient) return { isBounce: true, kind: "soft", failedRecipient: null };

  return { isBounce: true, kind, failedRecipient };
}

/** Decodes a Gmail payload tree into searchable text. */
export function flattenGmailBody(payload: any): string {
  if (!payload) return "";
  const chunks: string[] = [];

  const walk = (part: any) => {
    if (!part) return;
    const data = part.body?.data;
    if (typeof data === "string" && data.length > 0) {
      try {
        chunks.push(Buffer.from(data, "base64url").toString("utf8"));
      } catch {
        // Undecodable part — skip it rather than failing the whole message.
      }
    }
    for (const child of part.parts ?? []) walk(child);
  };

  walk(payload);
  return chunks.join("\n");
}

/** Case-insensitive header lookup over Gmail's header array. */
export function getHeader(headers: { name?: string | null; value?: string | null }[], name: string): string {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}
