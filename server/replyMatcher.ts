type Header = { name?: string | null; value?: string | null };

export type ReplyCandidate = {
  threadId?: string | null;
  headers?: Header[] | null;
};

export type SentDraftIdentity = {
  gmailThreadId?: string | null;
  gmailRfcMessageId?: string | null;
};

function normalizeMessageId(value: string): string {
  return value.trim().replace(/^<|>$/g, "").toLowerCase();
}

/** Matches Gmail replies by thread first, with RFC Message-ID as a fallback. */
export function isReplyToDraft(candidate: ReplyCandidate, draft: SentDraftIdentity): boolean {
  if (candidate.threadId && draft.gmailThreadId && candidate.threadId === draft.gmailThreadId) return true;

  if (!draft.gmailRfcMessageId) return false;
  const expected = normalizeMessageId(draft.gmailRfcMessageId);
  if (!expected) return false;
  const headers = candidate.headers ?? [];
  const replyHeaders = headers
    .filter(header => ["in-reply-to", "references"].includes(header.name?.toLowerCase() ?? ""))
    .map(header => header.value ?? "");
  return replyHeaders.some(value =>
    value.split(/\s+/).some(messageId => normalizeMessageId(messageId) === expected)
  );
}
