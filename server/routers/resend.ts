import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

export const resendRouter = router({
  resendEmail: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      gmailAccountId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const draft = await db.getEmailDraft(input.draftId, ctx.user.id);
      if (!draft || draft.userId !== ctx.user.id) throw new Error("Draft not found");
      if (draft.status !== "sent") throw new Error("Only sent emails can be resent");

      // Create a new draft based on the sent email
      const trackingId = `resend_${input.draftId}_${Date.now()}`;
      const newDraftId = await db.createEmailDraft({
        userId: ctx.user.id,
        contactId: draft.contactId,
        subject: draft.subject,
        body: draft.body,
        whyExplanation: "Resend of previous email",
        trackingId,
        touchpointCategory: draft.touchpointCategory,
        touchpointName: draft.touchpointName,
        status: "approved",
        gmailAccountId: input.gmailAccountId,
      });

      // Send immediately
      const gmailAccount = await db.getGmailAccount(input.gmailAccountId);
      if (!gmailAccount) throw new Error("Gmail account not found");

      const { google } = await import("googleapis");
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      oauth2Client.setCredentials({
        access_token: gmailAccount.accessToken,
        refresh_token: gmailAccount.refreshToken ?? undefined,
        expiry_date: gmailAccount.tokenExpiry ?? undefined,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token) oauth2Client.setCredentials(credentials);

      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const contact = await db.getContact(draft.contactId, ctx.user.id);
      const trackingPixel = `<img src="${process.env.VITE_FRONTEND_FORGE_API_URL}/api/track/${trackingId}.gif" width="1" height="1" alt="" />`;
      const unsubscribeLink = `<a href="${process.env.VITE_FRONTEND_FORGE_API_URL}/api/unsubscribe/${trackingId}" style="color:#999;font-size:11px;text-decoration:none">Unsubscribe</a>`;

      const emailLines = [
        `From: ${gmailAccount.gmailAddress}`,
        `To: ${contact?.email}`,
        `Subject: ${draft.subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        `<html><body>${draft.body}<br><br>${trackingPixel}${unsubscribeLink}</body></html>`,
      ];
      const raw = Buffer.from(emailLines.join("\r\n")).toString("base64url");
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

      await db.updateEmailDraft(newDraftId, ctx.user.id, { status: "sent", sentAt: new Date() });
      return { success: true, draftId: newDraftId };
    }),
});
