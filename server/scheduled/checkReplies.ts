import { Request, Response } from "express";
import { notifyOwner } from "../_core/notification";
import * as db from "../db";
import { flattenGmailBody, getHeader, parseBounce } from "../bounceParser";
import { isReplyToDraft } from "../replyMatcher";

/**
 * Suppresses an address that hard-bounced, and pauses the contact behind it.
 *
 * Deliberately only touches addresses belonging to one of this user's own
 * contacts. Delivery reports land in the same inbox as everything else, and a
 * bounce for unrelated mail must never suppress an address inside Close Looper.
 *
 * Returns whether anything was actually suppressed.
 */
async function suppressBouncedAddress(userId: number, email: string): Promise<boolean> {
  const contacts = await db.getContacts(userId);
  const matching = contacts.filter(c => c.email?.toLowerCase() === email);
  if (!matching.length) {
    console.log(`[Cron] Hard bounce for an address with no matching contact; ignoring`);
    return false;
  }

  if (await db.isEmailSuppressed(email, userId)) return false;

  await db.addToSuppressionList(userId, email, "bounced");
  for (const contact of matching) {
    if (contact.loopStatus === "active") {
      await db.updateContact(contact.id, userId, { loopStatus: "paused" });
    }
  }

  // Recorded against the most recent email actually sent to this contact, so the
  // bounce shows up in that contact's history rather than floating unattached.
  const sent = await db.getEmailDrafts(userId, "sent");
  const lastToContact = sent
    .filter(d => matching.some(c => c.id === d.contactId))
    .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))[0];
  if (lastToContact) {
    await db.createEmailEvent({ draftId: lastToContact.id, eventType: "bounced" });
  }

  console.log(`[Cron] Hard bounce suppressed an address for user ${userId}`);
  return true;
}

export async function checkRepliesHandler(req: Request, res: Response) {
  try {
    const { sdk } = await import("../_core/sdk");
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    console.log("[Cron] checkReplies triggered");

    const allDb = await db.getDb();
    if (!allDb) return res.json({ ok: true, skipped: "no-db" });

    const { users } = await import("../../drizzle/schema");
    const allUsers = await allDb.select().from(users);

    let repliesFound = 0;
    let bouncesFound = 0;

    for (const dbUser of allUsers) {
      const gmailAccounts = await db.getGmailAccounts(dbUser.id);
      if (!gmailAccounts.length) continue;

      // Get all sent emails with a Gmail thread or RFC Message-ID.
      const sentDrafts = await db.getEmailDrafts(dbUser.id, "sent");
      const draftsWithReplyIdentity = sentDrafts.filter(d => d.gmailThreadId || d.gmailRfcMessageId);

      for (const gmailAccount of gmailAccounts) {
        try {
          const accountDrafts = draftsWithReplyIdentity.filter(d => d.gmailAccountId === gmailAccount.id);
          if (!accountDrafts.length) continue;
          const { google } = await import("googleapis");
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
          );
          oauth2Client.setCredentials({
            access_token: gmailAccount.accessToken,
            refresh_token: gmailAccount.refreshToken ?? undefined,
          });

          const gmail = google.gmail({ version: "v1", auth: oauth2Client });

          // Check for replies in the inbox from the last 7 days
          const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
          const { data } = await gmail.users.messages.list({
            userId: "me",
            q: `in:inbox after:${sevenDaysAgo}`,
            maxResults: 50,
          });

          if (!data.messages) continue;

          for (const msg of data.messages) {
            const { data: fullMsg } = await gmail.users.messages.get({ userId: "me", id: msg.id! });
            const headers = fullMsg.payload?.headers ?? [];

            // Bounces first: a delivery report is not a reply, and treating one
            // as such would pause the loop for the wrong reason.
            const bounce = parseBounce({
              from: getHeader(headers, "From"),
              subject: getHeader(headers, "Subject"),
              contentType: getHeader(headers, "Content-Type"),
              body: flattenGmailBody(fullMsg.payload),
            });

            if (bounce.isBounce) {
              // Only permanent failures are acted on. Soft bounces are transient
              // — a full mailbox or a greylisting server is not a dead address.
              if (bounce.kind === "hard" && bounce.failedRecipient) {
                const handled = await suppressBouncedAddress(dbUser.id, bounce.failedRecipient);
                if (handled) bouncesFound++;
              } else {
                console.log(`[Cron] Soft or unparseable bounce for user ${dbUser.id}, taking no action`);
              }
              continue;
            }

            const matchedDraft = accountDrafts.find(d => isReplyToDraft({
              threadId: fullMsg.threadId,
              headers,
            }, d));

            if (matchedDraft) {
              const contact = await db.getContact(matchedDraft.contactId, dbUser.id);
              if (!contact || contact.loopStatus !== "active") continue;

              // Auto-pause the loop
              await db.updateContact(matchedDraft.contactId, dbUser.id, { loopStatus: "paused" });
              await db.createEmailEvent({ draftId: matchedDraft.id, eventType: "replied" });

              // Reaches the Manus project owner rather than the sending user,
              // so it carries no contact names or subject lines. The reply and
              // the auto-pause are both visible in the user's own dashboard.
              await notifyOwner({
                title: "Close Looper: a contact replied",
                content: "A contact replied to a Close Looper email and their loop was automatically paused. Details are in that user's dashboard.",
              });

              repliesFound++;
            }
          }
        } catch (err) {
          console.error(`[Cron] checkReplies error for Gmail ${gmailAccount.gmailAddress}:`, err);
        }
      }
    }

    console.log(`[Cron] checkReplies complete. Replies: ${repliesFound}, bounces suppressed: ${bouncesFound}`);
    res.json({ ok: true, repliesFound, bouncesFound });
  } catch (err: any) {
    console.error("[Cron] checkReplies error:", err);
    // Stack traces stay in the logs, not in the HTTP response.
    res.status(500).json({ error: "checkReplies failed", timestamp: new Date().toISOString() });
  }
}
