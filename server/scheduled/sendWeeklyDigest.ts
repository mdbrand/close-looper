import { Router } from "express";
import { getDb, getEmailDrafts, getContacts, getGmailAccounts } from "../db";
import { notifyOwner } from "../_core/notification";
import { sdk } from "../_core/sdk";
import { google } from "googleapis";
import { eq } from "drizzle-orm";

export const sendWeeklyDigestRouter = Router();

sendWeeklyDigestRouter.post("/cron/send-weekly-digest", async (req, res) => {
  try {
    // Authenticate cron request
    const authResult = await sdk.authenticateRequest(req);
    if (!authResult) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    // Get the owner user
    const { users } = await import("../../drizzle/schema");
    const ownerUser = await db.select().from(users).where(eq(users.openId, process.env.OWNER_OPEN_ID || "")).limit(1);
    
    if (!ownerUser || ownerUser.length === 0) {
      return res.status(404).json({ error: "Owner user not found" });
    }

    const user = ownerUser[0]!;
    
    try {
      // Get digest data
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const allDrafts = await getEmailDrafts(user.id);
        const sentThisWeek = allDrafts.filter(d => 
          d.status === "sent" && d.sentAt && new Date(d.sentAt) >= sevenDaysAgo
        );

        const openedCount = sentThisWeek.filter(d => d.openCount && d.openCount > 0).length;

        const nextWeekStart = new Date();
        const nextWeekEnd = new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const upcomingDrafts = allDrafts.filter(d => 
          d.status === "pending" && d.scheduledSendAt &&
          new Date(d.scheduledSendAt) >= nextWeekStart &&
          new Date(d.scheduledSendAt) <= nextWeekEnd
        );

        const activeContacts = await getContacts(user.id);
        const activeContactsCount = activeContacts.filter(c => c.loopStatus === "active").length;

        // Build digest HTML
        const digestHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .stat { display: inline-block; margin-right: 20px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #0066cc; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #0066cc; padding-bottom: 5px; }
    .footer { font-size: 12px; color: #999; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0 0 15px 0;">📊 Your Close Looper Weekly Digest</h1>
      <div>
        <div class="stat">
          <div class="stat-value">${sentThisWeek.length}</div>
          <div class="stat-label">Emails Sent</div>
        </div>
        <div class="stat">
          <div class="stat-value">${openedCount}</div>
          <div class="stat-label">Opened</div>
        </div>
        <div class="stat">
          <div class="stat-value">${sentThisWeek.length > 0 ? Math.round((openedCount / sentThisWeek.length) * 100) : 0}%</div>
          <div class="stat-label">Open Rate</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">📅 Coming Up</div>
      <p>${upcomingDrafts.length} email${upcomingDrafts.length !== 1 ? "s" : ""} scheduled for next week</p>
      <p>Active contacts: ${activeContactsCount}</p>
    </div>

    <div class="footer">
      <p>This is your weekly Close Looper digest. Log in to your dashboard to manage contacts and approve emails.</p>
    </div>
  </div>
</body>
</html>
        `;

        // Send digest email to user
        if (user.email) {
          const gmailAccounts = await getGmailAccounts(user.id);

          const defaultAccount = gmailAccounts.find(a => a.isDefault) || gmailAccounts[0];
          if (defaultAccount) {
            try {
              const oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                process.env.GOOGLE_REDIRECT_URI
              );
              oauth2Client.setCredentials({
                access_token: defaultAccount.accessToken,
                refresh_token: defaultAccount.refreshToken ?? undefined,
                expiry_date: defaultAccount.tokenExpiry ?? undefined,
              });

              const { credentials } = await oauth2Client.refreshAccessToken();
              if (credentials.access_token) {
                oauth2Client.setCredentials(credentials);
              }

              const gmail = google.gmail({ version: "v1", auth: oauth2Client });
              const emailLines = [
                `From: ${defaultAccount.gmailAddress}`,
                `To: ${user.email}`,
                `Subject: 📊 Your Close Looper Weekly Digest`,
                `MIME-Version: 1.0`,
                `Content-Type: text/html; charset=utf-8`,
                ``,
                digestHtml,
              ];
              const raw = Buffer.from(emailLines.join("\r\n")).toString("base64url");
              await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

              console.log(`[Weekly Digest] Sent to ${user.email}`);
            } catch (err) {
              console.error(`[Weekly Digest] Failed to send to ${user.email}:`, err);
            }
          }
        }
    } catch (err) {
      console.error(`[Weekly Digest] Error processing user ${user.id}:`, err);
    }

    res.json({ success: true, processed: 1 });
  } catch (err) {
    console.error("[Weekly Digest] Cron error:", err);
    res.status(500).json({ error: String(err) });
  }
});
