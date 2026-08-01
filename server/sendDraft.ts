import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { contactSequenceEnrollments, emailSignatures, senderProfiles } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";
import { getAppUrl } from "./_core/env";

/**
 * The single path an email takes out of Close Looper.
 *
 * There used to be two — `drafts.send` and `drafts.manualSend` — which had
 * drifted apart. Only one checked the suppression list, only one attached the
 * signature and postal address, and they built their tracking and unsubscribe
 * URLs differently: one hardcoded the production host, the other read an
 * environment variable that is set nowhere, so it emitted a *relative*
 * unsubscribe link. A relative href is dead in an email client, which meant
 * that path was shipping mail with a non-functioning opt-out.
 *
 * Anything that sends mail goes through here, so those guarantees hold once.
 */

const SEQUENCE_TOTAL_STEPS = 12;

/** Renders the CAN-SPAM footer and the open-tracking pixel onto a draft body. */
async function buildHtmlBody(
  userId: number,
  body: string,
  trackingId: string
): Promise<string> {
  const appUrl = getAppUrl();
  const trackingPixelUrl = `${appUrl}/api/track/${trackingId}.gif`;
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/${trackingId}`;

  const database = await db.getDb();

  let signatureHtml = "";
  let mailingAddress = "";

  if (database) {
    // Preferred signature is the default one; fall back to any signature.
    let sigs = await database
      .select()
      .from(emailSignatures)
      .where(and(eq(emailSignatures.userId, userId), eq(emailSignatures.isDefault, true)))
      .limit(1);
    if (!sigs[0]) {
      sigs = await database.select().from(emailSignatures).where(eq(emailSignatures.userId, userId)).limit(1);
    }
    if (sigs[0]?.content) {
      signatureHtml = `<br><br><p style="color:#555;white-space:pre-wrap;font-family:inherit;">${sigs[0].content.replace(/\n/g, "<br>")}</p>`;
    }

    // CAN-SPAM requires a physical postal address on commercial mail.
    const profiles = await database.select().from(senderProfiles).where(eq(senderProfiles.userId, userId)).limit(1);
    if (profiles[0]?.mailingAddress) {
      mailingAddress = `<p style="font-size:11px;color:#999;margin-top:4px;">${profiles[0].mailingAddress}</p>`;
    }
  }

  return (
    `<html><body><p>${body.replace(/\n/g, "<br>")}</p>${signatureHtml}` +
    `<br><hr style="border:none;border-top:1px solid #eee;margin:20px 0;">${mailingAddress}` +
    `<p style="font-size:11px;color:#999;"><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a></p>` +
    `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" /></body></html>`
  );
}

/** Moves a sequence enrollment to its next step, or completes it. */
async function advanceSequence(enrollmentId: number): Promise<void> {
  const database = await db.getDb();
  if (!database) return;

  const [enrollment] = await database
    .select()
    .from(contactSequenceEnrollments)
    .where(eq(contactSequenceEnrollments.id, enrollmentId))
    .limit(1);
  if (!enrollment) return;

  const nextStep = enrollment.currentStepNumber + 1;
  if (nextStep > SEQUENCE_TOTAL_STEPS) {
    await database
      .update(contactSequenceEnrollments)
      .set({ status: "completed", completedAt: new Date(), currentStepNumber: SEQUENCE_TOTAL_STEPS })
      .where(eq(contactSequenceEnrollments.id, enrollment.id));
    return;
  }

  // Next touch lands on the 15th of the following month, nudged off weekends.
  const nextDate = new Date();
  nextDate.setMonth(nextDate.getMonth() + 1);
  nextDate.setDate(15);
  nextDate.setHours(10, 0, 0, 0);
  const dow = nextDate.getDay();
  if (dow === 0) nextDate.setDate(nextDate.getDate() + 2);
  if (dow === 6) nextDate.setDate(nextDate.getDate() + 3);

  await database
    .update(contactSequenceEnrollments)
    .set({ currentStepNumber: nextStep, nextSendAt: nextDate })
    .where(eq(contactSequenceEnrollments.id, enrollment.id));
}

export type SendResult = { success: true; messageId: string | null };

/**
 * Sends an already-vetted draft. Callers are responsible for their own
 * precondition (approved vs. send-now); everything after that is shared.
 */
export async function sendDraft(draftId: number, userId: number): Promise<SendResult> {
  const draft = await db.getEmailDraft(draftId, userId);
  if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
  if (draft.status === "sent") throw new TRPCError({ code: "BAD_REQUEST", message: "Email already sent" });

  const contact = await db.getContact(draft.contactId, userId);
  if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

  if (contact.email && (await db.isEmailSuppressed(contact.email, userId))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${contact.email} has unsubscribed or bounced. Cannot send to suppressed contacts.`,
    });
  }

  const gmailAccount = draft.gmailAccountId
    ? await db.getGmailAccount(draft.gmailAccountId, userId)
    : (await db.getGmailAccounts(userId)).find(a => a.isDefault);

  if (!gmailAccount) throw new TRPCError({ code: "BAD_REQUEST", message: "No Gmail account configured" });
  if (!gmailAccount.accessToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Gmail credentials unreadable. Please reconnect your Gmail account in Settings.",
    });
  }

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
      expiry_date: gmailAccount.tokenExpiry ?? undefined,
    });

    try {
      const tokenRes = await oauth2Client.getAccessToken();
      if (tokenRes.token && tokenRes.token !== gmailAccount.accessToken) {
        const creds = oauth2Client.credentials;
        await db.upsertGmailAccount({
          userId,
          gmailAddress: gmailAccount.gmailAddress,
          accessToken: tokenRes.token,
          refreshToken: creds.refresh_token ?? gmailAccount.refreshToken ?? "",
          tokenExpiry: creds.expiry_date ?? null,
          isDefault: gmailAccount.isDefault,
        });
      }
    } catch (refreshErr: any) {
      console.error("[sendDraft] Token refresh failed:", refreshErr?.message);
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Gmail token expired. Please reconnect your Gmail account in Settings.",
      });
    }

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const htmlBody = await buildHtmlBody(userId, draft.body, draft.trackingId);

    const raw = Buffer.from(
      [
        `From: ${gmailAccount.senderName ? `${gmailAccount.senderName} <${gmailAccount.gmailAddress}>` : gmailAccount.gmailAddress}`,
        `To: ${contact.email}`,
        `Subject: ${draft.subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        htmlBody,
      ].join("\r\n")
    ).toString("base64url");

    const sent = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    await db.updateEmailDraft(draftId, userId, {
      status: "sent",
      sentAt: new Date(),
      gmailMessageId: sent.data.id ?? null,
    });
    await db.createEmailEvent({ draftId: draft.id, eventType: "sent" });
    await db.updateContact(draft.contactId, userId, { lastTouchSentAt: new Date() });

    if (draft.sequenceEnrollmentId) {
      try {
        await advanceSequence(draft.sequenceEnrollmentId);
      } catch (seqErr) {
        // A send that succeeded must not be reported as failed because the
        // bookkeeping afterwards did not.
        console.error("[sendDraft] Sequence advancement error:", seqErr);
      }
    }

    // Reaches the Manus project owner, not the sending user — no tenant data.
    await notifyOwner({
      title: "Email Sent",
      content: "A Close Looper email was sent successfully.",
    }).catch(() => undefined);

    return { success: true, messageId: sent.data.id ?? null };
  } catch (err: any) {
    if (err instanceof TRPCError) throw err;
    console.error("[sendDraft] Send failed:", err);
    await db.updateEmailDraft(draftId, userId, { status: "failed" });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Send failed: ${err?.message || "Unknown error"}`,
    });
  }
}
