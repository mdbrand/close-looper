import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

export const digestRouter = router({
  getWeeklyDigest: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get all drafts sent in the past 7 days
    const allDrafts = await db.getEmailDrafts(ctx.user.id);
    const sentThisWeek = allDrafts.filter(d => 
      d.status === "sent" && d.sentAt && new Date(d.sentAt) >= sevenDaysAgo
    );
    
    // Get all opened emails
    const openedCount = sentThisWeek.filter(d => d.openCount && d.openCount > 0).length;
    const totalOpens = sentThisWeek.reduce((sum, d) => sum + (d.openCount ?? 0), 0);
    
    // Get upcoming drafts for next 7 days
    const nextWeekStart = new Date();
    const nextWeekEnd = new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingDrafts = allDrafts.filter(d => 
      d.status === "pending" && d.scheduledSendAt &&
      new Date(d.scheduledSendAt) >= nextWeekStart &&
      new Date(d.scheduledSendAt) <= nextWeekEnd
    );
    
    // Get active contacts
    const activeContacts = await db.getActiveContactsForCron(ctx.user.id);
    
    // Group sent emails by contact
    const contactStats: Record<number, { name: string; sent: number; opened: number }> = {};
    for (const draft of sentThisWeek) {
      if (!contactStats[draft.contactId]) {
        const contact = await db.getContact(draft.contactId, ctx.user.id);
        contactStats[draft.contactId] = {
          name: contact ? `${contact.firstName} ${contact.lastName}` : "Unknown",
          sent: 0,
          opened: 0,
        };
      }
      contactStats[draft.contactId]!.sent++;
      if (draft.openCount && draft.openCount > 0) {
        contactStats[draft.contactId]!.opened++;
      }
    }
    
    return {
      period: { start: sevenDaysAgo, end: now },
      summary: {
        emailsSent: sentThisWeek.length,
        emailsOpened: openedCount,
        totalOpens,
        openRate: sentThisWeek.length > 0 ? Math.round((openedCount / sentThisWeek.length) * 100) : 0,
      },
      contactStats: Object.values(contactStats),
      upcomingCount: upcomingDrafts.length,
      activeContactsCount: activeContacts.length,
    };
  }),

  generateDigestEmail: protectedProcedure.query(async ({ ctx }): Promise<{ subject: string; html: string; digest: any }> => {
    const digestData = await digestRouter.createCaller(ctx).getWeeklyDigest();
    
    const html: string = `
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
    .contact-row { padding: 10px; background: #f8f9fa; margin-bottom: 8px; border-radius: 4px; }
    .footer { font-size: 12px; color: #999; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0 0 15px 0;">📊 Close Looper Weekly Digest</h1>
      <div>
        <div class="stat">
          <div class="stat-value">${digestData.summary.emailsSent}</div>
          <div class="stat-label">Emails Sent</div>
        </div>
        <div class="stat">
          <div class="stat-value">${digestData.summary.emailsOpened}</div>
          <div class="stat-label">Opened</div>
        </div>
        <div class="stat">
          <div class="stat-value">${digestData.summary.openRate}%</div>
          <div class="stat-label">Open Rate</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">📬 This Week's Performance</div>
      ${digestData.contactStats.length > 0 ? digestData.contactStats.map((stat: any) => `
        <div class="contact-row">
          <strong>${stat.name}</strong><br>
          Sent: ${stat.sent} | Opened: ${stat.opened}
        </div>
      `).join("") : "<p>No emails sent this week</p>"}
    </div>

    <div class="section">
      <div class="section-title">📅 Coming Up</div>
      <p>${digestData.upcomingCount} email${digestData.upcomingCount !== 1 ? "s" : ""} scheduled for next week</p>
      <p>Active contacts: ${digestData.activeContactsCount}</p>
    </div>

    <div class="footer">
      <p>This is your weekly Close Looper digest. Log in to your dashboard to manage contacts and approve emails.</p>
    </div>
  </div>
</body>
</html>
    `;
    
    return {
      subject: "📊 Your Close Looper Weekly Digest",
      html,
      digest: digestData,
    };
  }),
});
