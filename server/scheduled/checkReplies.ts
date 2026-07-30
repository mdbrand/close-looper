import { Request, Response } from "express";
import { notifyOwner } from "../_core/notification";
import * as db from "../db";

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

    for (const dbUser of allUsers) {
      const gmailAccounts = await db.getGmailAccounts(dbUser.id);
      if (!gmailAccounts.length) continue;

      // Get all sent emails with Gmail message IDs
      const sentDrafts = await db.getEmailDrafts(dbUser.id, "sent");
      const draftsWithMessageId = sentDrafts.filter(d => d.gmailMessageId);
      if (!draftsWithMessageId.length) continue;

      for (const gmailAccount of gmailAccounts) {
        try {
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
            const inReplyTo = headers.find(h => h.name === "In-Reply-To")?.value;
            const references = headers.find(h => h.name === "References")?.value;

            // Check if this reply is to one of our sent emails
            const matchedDraft = draftsWithMessageId.find(d => {
              const msgId = `<${d.gmailMessageId}>`;
              return inReplyTo?.includes(msgId) || references?.includes(msgId);
            });

            if (matchedDraft) {
              const contact = await db.getContact(matchedDraft.contactId, dbUser.id);
              if (!contact || contact.loopStatus !== "active") continue;

              // Auto-pause the loop
              await db.updateContact(matchedDraft.contactId, dbUser.id, { loopStatus: "paused" });
              await db.createEmailEvent({ draftId: matchedDraft.id, eventType: "replied" });

              // Notify owner
              await notifyOwner({
                title: `Close Looper: ${contact.firstName} replied!`,
                content: `${contact.firstName} ${contact.lastName ?? ""} replied to your email "${matchedDraft.subject}". Their loop has been automatically paused. Follow up with them personally!`,
              });

              repliesFound++;
            }
          }
        } catch (err) {
          console.error(`[Cron] checkReplies error for Gmail ${gmailAccount.gmailAddress}:`, err);
        }
      }
    }

    console.log(`[Cron] checkReplies complete. Replies found: ${repliesFound}`);
    res.json({ ok: true, repliesFound });
  } catch (err: any) {
    console.error("[Cron] checkReplies error:", err);
    res.status(500).json({ error: err.message, stack: err.stack, timestamp: new Date().toISOString() });
  }
}
